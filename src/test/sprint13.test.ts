import * as assert from 'assert';
import * as http from 'http';
import { AddressInfo } from 'net';
import { ApiRoute } from '../models/route';
import {
  buildInitialStateForRoute,
  normalizeHttpClientMethod,
} from '../httpClient/httpClientProvider';
import {
  buildCurlFromConfig,
  HttpRequestService,
  validateAndResolveRequest,
} from '../httpClient/httpRequestService';
import {
  isWebviewToHostMessage,
  isValidHttpRequestConfig,
} from '../httpClient/httpClientMessages';
import {
  HttpClientInitialState,
  HttpRequestConfig,
} from '../httpClient/httpClientTypes';
import { COMMANDS } from '../utils/constants';

suite('API Routes Explorer — Sprint 13 HTTP Client Webview Suite', () => {
  let server: http.Server;
  let serverPort: number;
  let serverBaseUrl: string;

  suiteSetup((done) => {
    // Spin up an ephemeral local HTTP test server
    server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://localhost`);

      if (url.pathname === '/delay') {
        // Delay response to test timeouts
        setTimeout(() => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ delayed: true }));
        }, 300);
        return;
      }

      if (url.pathname === '/redirect-source') {
        res.writeHead(302, { Location: `${serverBaseUrl}/redirect-target` });
        res.end();
        return;
      }

      if (url.pathname === '/redirect-target') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ redirected: true }));
        return;
      }

      if (url.pathname === '/text-plain') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Hello plain text response');
        return;
      }

      if (url.pathname === '/echo-post' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
          res.writeHead(201, {
            'Content-Type': 'application/json',
            'X-Custom-Echo': 'true',
          });
          res.end(JSON.stringify({ received: JSON.parse(body || '{}') }));
        });
        return;
      }

      if (url.pathname === '/api/v1/users/42') {
        const queryVal = url.searchParams.get('role') || 'none';
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 42, role: queryVal }));
        return;
      }

      if (url.pathname === '/api/v1/error-400') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bad Request' }));
        return;
      }

      if (url.pathname === '/api/v1/no-content') {
        res.writeHead(204);
        res.end();
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

  // 1. Initial State & Command Helpers
  suite('1. Route Initialization & State Pre-fill', () => {
    test('Command ID is registered in constants', () => {
      assert.strictEqual(COMMANDS.OPEN_HTTP_CLIENT, 'apiRouteExplorer.openHttpClient');
    });

    test('buildInitialStateForRoute prepares clean state for Express route', () => {
      const route: ApiRoute = {
        method: 'GET',
        path: '/api/v1/users/:id',
        filePath: '/workspace/src/routes/users.ts',
        line: 15,
        column: 0,
        framework: 'express',
      };

      const state: HttpClientInitialState = buildInitialStateForRoute(route, 'http://localhost:5000');
      assert.strictEqual(state.method, 'GET');
      assert.strictEqual(state.openApiPath, '/api/v1/users/{id}');
      assert.strictEqual(state.fullUrl, 'http://localhost:5000/api/v1/users/{id}');
      assert.strictEqual(state.pathParams.length, 1);
      assert.strictEqual(state.pathParams[0].name, 'id');
      assert.strictEqual(state.pathParams[0].value, '');
      assert.strictEqual(state.framework, 'express');
    });

    test('buildInitialStateForRoute handles Next.js dynamic routes', () => {
      const route: ApiRoute = {
        method: 'POST',
        path: '/api/items/[itemId]/reviews/[reviewId]',
        filePath: '/workspace/src/app/api/items/[itemId]/reviews/[reviewId]/route.ts',
        line: 20,
        column: 0,
        framework: 'nextjs',
      };

      const state = buildInitialStateForRoute(route, 'http://localhost:3000');
      assert.strictEqual(state.method, 'POST');
      assert.strictEqual(state.openApiPath, '/api/items/{itemId}/reviews/{reviewId}');
      assert.strictEqual(state.pathParams.length, 2);
      assert.strictEqual(state.pathParams[0].name, 'itemId');
      assert.strictEqual(state.pathParams[1].name, 'reviewId');
      assert.ok(state.headers.some((h) => h.key === 'Content-Type' && h.value === 'application/json'));
    });

    test('normalizeHttpClientMethod defaults ANY to GET', () => {
      assert.strictEqual(normalizeHttpClientMethod('ANY'), 'GET');
      assert.strictEqual(normalizeHttpClientMethod('POST'), 'POST');
      assert.strictEqual(normalizeHttpClientMethod('DELETE'), 'DELETE');
    });
  });

  // 2. Request Validation & Path Parameters
  suite('2. Request Parameter & URL Validation', () => {
    test('Replaces valid path parameters in URL', () => {
      const config: HttpRequestConfig = {
        method: 'GET',
        url: 'http://localhost:3000/api/v1/users/{id}',
        pathParams: [{ name: 'id', value: '123' }],
        queryParams: [],
        headers: [],
        body: '',
      };

      const res = validateAndResolveRequest(config);
      assert.strictEqual(res.ok, true);
      if (res.ok) {
        assert.strictEqual(res.resolved.resolvedUrl, 'http://localhost:3000/api/v1/users/123');
      }
    });

    test('Rejects request when required path parameter is missing or empty', () => {
      const config: HttpRequestConfig = {
        method: 'GET',
        url: 'http://localhost:3000/api/v1/users/{id}',
        pathParams: [{ name: 'id', value: '   ' }],
        queryParams: [],
        headers: [],
        body: '',
      };

      const res = validateAndResolveRequest(config);
      assert.strictEqual(res.ok, false);
      if (!res.ok) {
        assert.ok(res.error.includes('Required path parameter "id" is missing.'));
      }
    });

    test('Encodes query parameters with special characters safely', () => {
      const config: HttpRequestConfig = {
        method: 'GET',
        url: 'http://localhost:3000/api/v1/search',
        pathParams: [],
        queryParams: [
          { id: '1', key: 'q', value: 'hello world & test', enabled: true },
          { id: '2', key: 'page', value: '1', enabled: true },
          { id: '3', key: 'ignored', value: 'off', enabled: false },
        ],
        headers: [],
        body: '',
      };

      const res = validateAndResolveRequest(config);
      assert.strictEqual(res.ok, true);
      if (res.ok) {
        const u = new URL(res.resolved.resolvedUrl);
        assert.strictEqual(u.searchParams.get('q'), 'hello world & test');
        assert.strictEqual(u.searchParams.get('page'), '1');
        assert.strictEqual(u.searchParams.get('ignored'), null);
      }
    });

    test('Rejects invalid URL scheme', () => {
      const config: HttpRequestConfig = {
        method: 'GET',
        url: 'ftp://localhost:3000/test',
        pathParams: [],
        queryParams: [],
        headers: [],
        body: '',
      };

      const res = validateAndResolveRequest(config);
      assert.strictEqual(res.ok, false);
      if (!res.ok) {
        assert.ok(res.error.includes('Invalid request URL'));
      }
    });
  });

  // 3. Body Validation & Headers
  suite('3. Request Body & Header Processing', () => {
    test('Validates JSON body for POST request', () => {
      const config: HttpRequestConfig = {
        method: 'POST',
        url: 'http://localhost:3000/api/v1/users',
        pathParams: [],
        queryParams: [],
        headers: [{ id: '1', key: 'Content-Type', value: 'application/json', enabled: true }],
        body: '{"name": "Alice"}',
      };

      const res = validateAndResolveRequest(config);
      assert.strictEqual(res.ok, true);
      if (res.ok) {
        assert.strictEqual(res.resolved.body, '{"name": "Alice"}');
      }
    });

    test('Rejects invalid JSON body with clear message', () => {
      const config: HttpRequestConfig = {
        method: 'POST',
        url: 'http://localhost:3000/api/v1/users',
        pathParams: [],
        queryParams: [],
        headers: [{ id: '1', key: 'Content-Type', value: 'application/json', enabled: true }],
        body: '{"name": "Alice",',
      };

      const res = validateAndResolveRequest(config);
      assert.strictEqual(res.ok, false);
      if (!res.ok) {
        assert.strictEqual(res.error, 'Request body contains invalid JSON.');
      }
    });

    test('Allows empty body for POST request', () => {
      const config: HttpRequestConfig = {
        method: 'POST',
        url: 'http://localhost:3000/api/v1/trigger',
        pathParams: [],
        queryParams: [],
        headers: [],
        body: '   ',
      };

      const res = validateAndResolveRequest(config);
      assert.strictEqual(res.ok, true);
      if (res.ok) {
        assert.strictEqual(res.resolved.body, undefined);
      }
    });
  });

  // 4. cURL Generation
  suite('4. cURL Command Formatting', () => {
    test('Generates cURL command for GET with query parameters', () => {
      const config: HttpRequestConfig = {
        method: 'GET',
        url: 'http://localhost:3000/api/v1/users',
        pathParams: [],
        queryParams: [{ id: '1', key: 'role', value: 'admin', enabled: true }],
        headers: [{ id: '2', key: 'Accept', value: 'application/json', enabled: true }],
        body: '',
      };

      const curl = buildCurlFromConfig(config);
      assert.ok(curl.includes('curl -X GET "http://localhost:3000/api/v1/users?role=admin"'));
      assert.ok(curl.includes('-H "Accept: application/json"'));
    });

    test('Generates cURL command for POST with JSON payload', () => {
      const config: HttpRequestConfig = {
        method: 'POST',
        url: 'http://localhost:3000/api/v1/items',
        pathParams: [],
        queryParams: [],
        headers: [{ id: '1', key: 'Content-Type', value: 'application/json', enabled: true }],
        body: '{"title":"Test Item"}',
      };

      const curl = buildCurlFromConfig(config);
      assert.ok(curl.includes('curl -X POST "http://localhost:3000/api/v1/items"'));
      assert.ok(curl.includes('-d \'{"title":"Test Item"}\''));
    });

    test('Generates cURL command with -I for HEAD request', () => {
      const config: HttpRequestConfig = {
        method: 'HEAD',
        url: 'http://localhost:3000/api/v1/health',
        pathParams: [],
        queryParams: [],
        headers: [],
        body: '',
      };

      const curl = buildCurlFromConfig(config);
      assert.ok(curl.startsWith('curl -I "http://localhost:3000/api/v1/health"'));
    });
  });

  // 5. Real Execution against Local Test Server
  suite('5. HttpRequestService Execution', () => {
    const service = new HttpRequestService();

    test('Executes GET request and captures status, headers, body, and timing', async () => {
      const config: HttpRequestConfig = {
        method: 'GET',
        url: `${serverBaseUrl}/api/v1/users/{id}`,
        pathParams: [{ name: 'id', value: '42' }],
        queryParams: [{ id: '1', key: 'role', value: 'developer', enabled: true }],
        headers: [{ id: '2', key: 'Accept', value: 'application/json', enabled: true }],
        body: '',
      };

      const res = await service.execute(config);
      assert.strictEqual(res.ok, true);
      if (res.ok) {
        assert.strictEqual(res.data.status, 200);
        assert.strictEqual(res.data.isJson, true);
        assert.ok(res.data.timeMs >= 0);
        const parsed = JSON.parse(res.data.body);
        assert.strictEqual(parsed.id, 42);
        assert.strictEqual(parsed.role, 'developer');
        assert.ok(res.data.headers['content-type'].includes('application/json'));
      }
    });

    test('Executes POST request with JSON body and captures 201 response', async () => {
      const config: HttpRequestConfig = {
        method: 'POST',
        url: `${serverBaseUrl}/echo-post`,
        pathParams: [],
        queryParams: [],
        headers: [{ id: '1', key: 'Content-Type', value: 'application/json', enabled: true }],
        body: JSON.stringify({ message: 'Hello from test' }),
      };

      const res = await service.execute(config);
      assert.strictEqual(res.ok, true);
      if (res.ok) {
        assert.strictEqual(res.data.status, 201);
        assert.strictEqual(res.data.headers['x-custom-echo'], 'true');
        const parsed = JSON.parse(res.data.body);
        assert.strictEqual(parsed.received.message, 'Hello from test');
      }
    });

    test('Captures 204 No Content response cleanly', async () => {
      const config: HttpRequestConfig = {
        method: 'DELETE',
        url: `${serverBaseUrl}/api/v1/no-content`,
        pathParams: [],
        queryParams: [],
        headers: [],
        body: '',
      };

      const res = await service.execute(config);
      assert.strictEqual(res.ok, true);
      if (res.ok) {
        assert.strictEqual(res.data.status, 204);
        assert.strictEqual(res.data.body, '');
      }
    });

    test('Captures 400 Bad Request error status without throwing', async () => {
      const config: HttpRequestConfig = {
        method: 'GET',
        url: `${serverBaseUrl}/api/v1/error-400`,
        pathParams: [],
        queryParams: [],
        headers: [],
        body: '',
      };

      const res = await service.execute(config);
      assert.strictEqual(res.ok, true);
      if (res.ok) {
        assert.strictEqual(res.data.status, 400);
        const parsed = JSON.parse(res.data.body);
        assert.strictEqual(parsed.error, 'Bad Request');
      }
    });

    test('Handles plain-text response safely', async () => {
      const config: HttpRequestConfig = {
        method: 'GET',
        url: `${serverBaseUrl}/text-plain`,
        pathParams: [],
        queryParams: [],
        headers: [],
        body: '',
      };

      const res = await service.execute(config);
      assert.strictEqual(res.ok, true);
      if (res.ok) {
        assert.strictEqual(res.data.status, 200);
        assert.strictEqual(res.data.isJson, false);
        assert.strictEqual(res.data.body, 'Hello plain text response');
      }
    });

    test('Follows HTTP redirects seamlessly', async () => {
      const config: HttpRequestConfig = {
        method: 'GET',
        url: `${serverBaseUrl}/redirect-source`,
        pathParams: [],
        queryParams: [],
        headers: [],
        body: '',
      };

      const res = await service.execute(config);
      assert.strictEqual(res.ok, true);
      if (res.ok) {
        assert.strictEqual(res.data.status, 200);
        const parsed = JSON.parse(res.data.body);
        assert.strictEqual(parsed.redirected, true);
      }
    });

    test('Handles connection refused with user-friendly error message', async () => {
      // Connect to an unused local port
      const config: HttpRequestConfig = {
        method: 'GET',
        url: 'http://127.0.0.1:59999/api/test',
        pathParams: [],
        queryParams: [],
        headers: [],
        body: '',
      };

      const res = await service.execute(config);
      assert.strictEqual(res.ok, false);
      if (!res.ok) {
        assert.strictEqual(res.error, 'Unable to connect to the API server.');
      }
    });

    test('Handles request timeout properly without hanging', async () => {
      const config: HttpRequestConfig = {
        method: 'GET',
        url: `${serverBaseUrl}/delay`,
        pathParams: [],
        queryParams: [],
        headers: [],
        body: '',
        timeoutMs: 50, // 50ms timeout against 300ms server delay
      };

      const res = await service.execute(config);
      assert.strictEqual(res.ok, false);
      if (!res.ok) {
        assert.strictEqual(res.error, 'Request timed out.');
      }
    });
  });

  // 6. Webview Protocol & Security
  suite('6. Webview Protocol Validation & Security Safeguards', () => {
    test('isWebviewToHostMessage validates ready and resetRequest messages', () => {
      assert.strictEqual(isWebviewToHostMessage({ type: 'ready' }), true);
      assert.strictEqual(isWebviewToHostMessage({ type: 'resetRequest' }), true);
    });

    test('isWebviewToHostMessage validates well-formed sendRequest message', () => {
      const msg = {
        type: 'sendRequest',
        payload: {
          method: 'GET',
          url: 'http://localhost:3000/api/users',
          pathParams: [],
          queryParams: [],
          headers: [],
          body: '',
        },
      };
      assert.strictEqual(isWebviewToHostMessage(msg), true);
    });

    test('isWebviewToHostMessage rejects invalid message types and malformed payloads', () => {
      assert.strictEqual(isWebviewToHostMessage(null), false);
      assert.strictEqual(isWebviewToHostMessage('not-an-object'), false);
      assert.strictEqual(isWebviewToHostMessage({ type: 'unknownAction' }), false);
      assert.strictEqual(isWebviewToHostMessage({ type: 'sendRequest', payload: { method: 'INVALID' } }), false);
      assert.strictEqual(isValidHttpRequestConfig({ method: 'GET', url: 123 }), false);
    });

    test('Ensures no sensitive credentials or .env paths are embedded in initial state', () => {
      const route: ApiRoute = {
        method: 'POST',
        path: '/api/v1/auth/login',
        filePath: '/workspace/src/auth.ts',
        line: 10,
        column: 0,
        framework: 'express',
      };

      const state = buildInitialStateForRoute(route);
      const serialized = JSON.stringify(state);
      assert.ok(!serialized.includes('DATABASE_URL'));
      assert.ok(!serialized.includes('SECRET'));
      assert.ok(!serialized.includes('.env'));
      assert.ok(!serialized.includes('PASSWORD'));
    });
  });
});
