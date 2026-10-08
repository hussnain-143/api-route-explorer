import * as assert from 'assert';
import * as http from 'http';
import { AddressInfo } from 'net';
import { ApiRoute } from '../models/route';
import {
  resolveFullUrl,
  buildRouteUrl,
} from '../utils/routeFormatters';
import { collapseRepeatingSegments } from '../analysis/prefixResolver';
import {
  buildCurlFromConfig,
  HttpRequestService,
  validateAndResolveRequest,
} from '../httpClient/httpRequestService';
import {
  isWebviewToHostMessage,
} from '../httpClient/httpClientMessages';
import { HttpRequestConfig } from '../httpClient/httpClientTypes';

suite('API Routes Explorer — Sprint 14 HTTP Client Hardening Suite', () => {
  let server: http.Server;
  let serverPort: number;
  let serverBaseUrl: string;

  suiteSetup((done) => {
    // Spin up a local HTTP test server for Sprint 14 tests
    server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', 'http://localhost');

      if (url.pathname === '/slow-endpoint') {
        // Keeps socket open for cancellation test
        setTimeout(() => {
          if (!res.writableEnded) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ finished: true }));
          }
        }, 1500);
        return;
      }

      if (url.pathname === '/api/v1/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', uptime: 100 }));
        return;
      }

      if (url.pathname === '/users/user_12345') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ userId: 'user_12345' }));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      serverPort = addr.port;
      serverBaseUrl = `http://127.0.0.1:${serverPort}`;
      done();
    });
  });

  suiteTeardown((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  // ==========================================
  // TASK 1: URL & Base-Path Resolution Tests
  // ==========================================
  suite('URL Resolution & Prefix Overlap Deduplication', () => {
    test('resolves base without trailing slash and route with leading slash', () => {
      const result = resolveFullUrl('http://localhost:5000', '/api/v1/health');
      assert.strictEqual(result, 'http://localhost:5000/api/v1/health');
    });

    test('resolves base with trailing slash and route with leading slash', () => {
      const result = resolveFullUrl('http://localhost:5000/', '/api/v1/health');
      assert.strictEqual(result, 'http://localhost:5000/api/v1/health');
    });

    test('resolves base without trailing slash and route without leading slash', () => {
      const result = resolveFullUrl('http://localhost:5000', 'api/v1/health');
      assert.strictEqual(result, 'http://localhost:5000/api/v1/health');
    });

    test('resolves base containing path prefix and route without prefix', () => {
      const result = resolveFullUrl('http://localhost:5000/api/v1', '/health');
      assert.strictEqual(result, 'http://localhost:5000/api/v1/health');
    });

    test('prevents duplicate prefix when base and route both contain /api/v1', () => {
      const result = resolveFullUrl('http://localhost:5000/api/v1', '/api/v1/health');
      assert.strictEqual(result, 'http://localhost:5000/api/v1/health');
    });

    test('prevents deep multi-segment duplicate prefix like /api/v1/admin/auth', () => {
      const result = resolveFullUrl(
        'http://localhost:5000/api/v1/admin/auth',
        '/api/v1/admin/auth/signin'
      );
      assert.strictEqual(result, 'http://localhost:5000/api/v1/admin/auth/signin');
    });

    test('works for arbitrary custom API prefixes', () => {
      const result = resolveFullUrl(
        'https://api.mycloud.org/gateway/v3/tenant-x',
        '/gateway/v3/tenant-x/orders'
      );
      assert.strictEqual(
        result,
        'https://api.mycloud.org/gateway/v3/tenant-x/orders'
      );
    });

    test('preserves existing query parameters on route', () => {
      const result = resolveFullUrl('http://localhost:5000/api/v1', '/users?active=true&limit=10');
      assert.strictEqual(result, 'http://localhost:5000/api/v1/users?active=true&limit=10');
    });

    test('preserves dynamic parameter placeholders in route', () => {
      const result = resolveFullUrl('http://localhost:5000/api/v1', '/users/{id}');
      assert.strictEqual(result, 'http://localhost:5000/api/v1/users/{id}');
    });

    test('handles URL encoded characters in route path', () => {
      const result = resolveFullUrl('http://localhost:5000/api', '/files/my%20document%20v1');
      assert.strictEqual(result, 'http://localhost:5000/api/files/my%20document%20v1');
    });

    test('buildRouteUrl uses resolveFullUrl correctly', () => {
      const route: ApiRoute = {
        method: 'GET',
        path: '/api/v1/users',
        filePath: 'src/routes.ts',
        line: 10,
        column: 0,
        framework: 'express',
      };
      const url = buildRouteUrl(route, 'http://localhost:5000/api/v1');
      assert.strictEqual(url, 'http://localhost:5000/api/v1/users');
    });

    test('collapseRepeatingSegments deduplicates consecutive repeated sequence blocks', () => {
      assert.deepStrictEqual(
        collapseRepeatingSegments(['api', 'v1', 'api', 'v1', 'health']),
        ['api', 'v1', 'health']
      );
      assert.deepStrictEqual(
        collapseRepeatingSegments(['v1', 'v1', 'users']),
        ['v1', 'users']
      );
      assert.deepStrictEqual(
        collapseRepeatingSegments(['api', 'users']),
        ['api', 'users']
      );
    });
  });

  // ==========================================
  // TASK 2: Dynamic Path Parameters Tests
  // ==========================================
  suite('Dynamic Path Parameters', () => {
    test('substitutes single dynamic path parameter with valid value', () => {
      const config: HttpRequestConfig = {
        method: 'GET',
        url: 'http://localhost:5000/users/{id}',
        pathParams: [{ name: 'id', value: 'user_12345' }],
        queryParams: [],
        headers: [],
        body: '',
      };

      const result = validateAndResolveRequest(config);
      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.strictEqual(result.resolved.resolvedUrl, 'http://localhost:5000/users/user_12345');
      }
    });

    test('URI encodes special characters in path parameter values', () => {
      const config: HttpRequestConfig = {
        method: 'GET',
        url: 'http://localhost:5000/files/{filename}',
        pathParams: [{ name: 'filename', value: 'report 2026/01.pdf' }],
        queryParams: [],
        headers: [],
        body: '',
      };

      const result = validateAndResolveRequest(config);
      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.strictEqual(
          result.resolved.resolvedUrl,
          'http://localhost:5000/files/report%202026%2F01.pdf'
        );
      }
    });

    test('fails validation when dynamic path parameter is missing', () => {
      const config: HttpRequestConfig = {
        method: 'GET',
        url: 'http://localhost:5000/users/{id}',
        pathParams: [],
        queryParams: [],
        headers: [],
        body: '',
      };

      const result = validateAndResolveRequest(config);
      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.code, 'MISSING_PATH_PARAM');
        assert.strictEqual(result.error, 'Required path parameter "id" is missing.');
        assert.ok(result.possibleCauses && result.possibleCauses.length > 0);
      }
    });

    test('fails validation when dynamic path parameter is whitespace-only', () => {
      const config: HttpRequestConfig = {
        method: 'GET',
        url: 'http://localhost:5000/users/{id}',
        pathParams: [{ name: 'id', value: '   ' }],
        queryParams: [],
        headers: [],
        body: '',
      };

      const result = validateAndResolveRequest(config);
      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.code, 'MISSING_PATH_PARAM');
        assert.strictEqual(result.error, 'Required path parameter "id" is missing.');
      }
    });

    test('substitutes multiple dynamic parameters cleanly', () => {
      const config: HttpRequestConfig = {
        method: 'GET',
        url: 'http://localhost:5000/orgs/{orgId}/teams/{teamId}',
        pathParams: [
          { name: 'orgId', value: 'acme' },
          { name: 'teamId', value: 'engineering' },
        ],
        queryParams: [],
        headers: [],
        body: '',
      };

      const result = validateAndResolveRequest(config);
      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.strictEqual(
          result.resolved.resolvedUrl,
          'http://localhost:5000/orgs/acme/teams/engineering'
        );
      }
    });

    test('preserves existing query parameters when substituting path parameters', () => {
      const config: HttpRequestConfig = {
        method: 'GET',
        url: 'http://localhost:5000/users/{id}?includeDetails=true',
        pathParams: [{ name: 'id', value: '99' }],
        queryParams: [{ id: '1', key: 'sort', value: 'desc', enabled: true }],
        headers: [],
        body: '',
      };

      const result = validateAndResolveRequest(config);
      assert.strictEqual(result.ok, true);
      if (result.ok) {
        const u = new URL(result.resolved.resolvedUrl);
        assert.strictEqual(u.pathname, '/users/99');
        assert.strictEqual(u.searchParams.get('includeDetails'), 'true');
        assert.strictEqual(u.searchParams.get('sort'), 'desc');
      }
    });
  });

  // ==========================================
  // TASK 5: Error UX & Structured Causes
  // ==========================================
  suite('Developer-Facing Error UX', () => {
    test('returns clear developer causes for ECONNREFUSED', async () => {
      const service = new HttpRequestService();
      // Port 59999 is almost certainly closed
      const config: HttpRequestConfig = {
        method: 'GET',
        url: 'http://127.0.0.1:59999/api/health',
        pathParams: [],
        queryParams: [],
        headers: [],
        body: '',
      };

      const result = await service.execute(config);
      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.code, 'ECONNREFUSED');
        assert.strictEqual(result.error, 'Unable to connect to the API server.');
        assert.ok(result.possibleCauses && result.possibleCauses.length >= 2);
        assert.ok(result.possibleCauses.includes('Backend is not running'));
      }
    });

    test('returns structured causes for invalid URL', () => {
      const config: HttpRequestConfig = {
        method: 'GET',
        url: 'ftp://localhost:5000/resource',
        pathParams: [],
        queryParams: [],
        headers: [],
        body: '',
      };

      const result = validateAndResolveRequest(config);
      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.code, 'ERR_INVALID_URL');
        assert.ok(result.possibleCauses && result.possibleCauses.length > 0);
      }
    });

    test('returns structured causes for malformed JSON body', () => {
      const config: HttpRequestConfig = {
        method: 'POST',
        url: 'http://localhost:5000/api/submit',
        pathParams: [],
        queryParams: [],
        headers: [{ id: '1', key: 'Content-Type', value: 'application/json', enabled: true }],
        body: '{ "invalid": unquoted }',
      };

      const result = validateAndResolveRequest(config);
      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.code, 'MALFORMED_JSON');
        assert.strictEqual(result.error, 'Request body contains invalid JSON.');
        assert.ok(result.possibleCauses && result.possibleCauses.length > 0);
      }
    });
  });

  // ==========================================
  // TASK 6 & 7: Copy Actions & Request Cancellation
  // ==========================================
  suite('Request Cancellation & Active Request Lifecycle', () => {
    test('cancelling an active request aborts execution and yields CANCELLED code', async () => {
      const service = new HttpRequestService();
      const config: HttpRequestConfig = {
        method: 'GET',
        url: `${serverBaseUrl}/slow-endpoint`,
        pathParams: [],
        queryParams: [],
        headers: [],
        body: '',
      };

      // Launch slow request asynchronously
      const requestPromise = service.execute(config, 'cancel-test-1');

      // Allow request to initiate socket
      await new Promise((r) => setTimeout(r, 40));

      // Cancel the request
      const cancelled = service.cancel('cancel-test-1');
      assert.strictEqual(cancelled, true, 'service.cancel should return true for active request');

      const result = await requestPromise;
      assert.strictEqual(result.ok, false);
      if (!result.ok) {
        assert.strictEqual(result.code, 'CANCELLED');
        assert.strictEqual(result.error, 'Request was cancelled by user.');
        assert.ok(result.possibleCauses && result.possibleCauses.length > 0);
      }
    });

    test('calling cancel on an idle identifier returns false safely', () => {
      const service = new HttpRequestService();
      const cancelled = service.cancel('non-existent-id');
      assert.strictEqual(cancelled, false);
    });

    test('executing a new request on the same id automatically cancels previous request', async () => {
      const service = new HttpRequestService();
      const configSlow: HttpRequestConfig = {
        method: 'GET',
        url: `${serverBaseUrl}/slow-endpoint`,
        pathParams: [],
        queryParams: [],
        headers: [],
        body: '',
      };
      const configFast: HttpRequestConfig = {
        method: 'GET',
        url: `${serverBaseUrl}/api/v1/health`,
        pathParams: [],
        queryParams: [],
        headers: [],
        body: '',
      };

      const p1 = service.execute(configSlow, 'shared-id');
      await new Promise((r) => setTimeout(r, 20));

      const p2 = service.execute(configFast, 'shared-id');

      const [res1, res2] = await Promise.all([p1, p2]);
      assert.strictEqual(res1.ok, false);
      if (!res1.ok) {
        assert.strictEqual(res1.code, 'CANCELLED');
      }
      assert.strictEqual(res2.ok, true);
    });
  });

  // ==========================================
  // Protocol Validation Tests
  // ==========================================
  suite('Message Protocol Boundary Validation', () => {
    test('validates cancelRequest message', () => {
      assert.strictEqual(isWebviewToHostMessage({ type: 'cancelRequest' }), true);
    });

    test('validates copyText message with valid string payload', () => {
      assert.strictEqual(
        isWebviewToHostMessage({
          type: 'copyText',
          payload: { text: 'http://localhost:5000', label: 'Request URL' },
        }),
        true
      );
    });

    test('rejects copyText message with missing or invalid payload', () => {
      assert.strictEqual(isWebviewToHostMessage({ type: 'copyText', payload: null }), false);
      assert.strictEqual(
        isWebviewToHostMessage({ type: 'copyText', payload: { text: 123, label: 'label' } }),
        false
      );
    });

    test('rejects unknown message types', () => {
      assert.strictEqual(isWebviewToHostMessage({ type: 'unknownAction' }), false);
      assert.strictEqual(isWebviewToHostMessage(null), false);
      assert.strictEqual(isWebviewToHostMessage('not-an-object'), false);
    });
  });

  // ==========================================
  // cURL Generator Hardening Tests
  // ==========================================
  suite('cURL Generation Hardening', () => {
    test('buildCurlFromConfig encodes dynamic parameters cleanly', () => {
      const config: HttpRequestConfig = {
        method: 'GET',
        url: 'http://localhost:5000/users/{id}',
        pathParams: [{ name: 'id', value: 'alice 1' }],
        queryParams: [],
        headers: [],
        body: '',
      };

      const curl = buildCurlFromConfig(config);
      assert.strictEqual(curl, 'curl -X GET "http://localhost:5000/users/alice%201"');
    });

    test('buildCurlFromConfig collapses duplicate URL segments', () => {
      const config: HttpRequestConfig = {
        method: 'GET',
        url: 'http://localhost:5000/api/v1/api/v1/health',
        pathParams: [],
        queryParams: [],
        headers: [],
        body: '',
      };

      const curl = buildCurlFromConfig(config);
      assert.strictEqual(curl, 'curl -X GET "http://localhost:5000/api/v1/health"');
    });
  });
});
