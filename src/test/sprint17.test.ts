import * as assert from 'assert';
import * as vscode from 'vscode';
import { ApiRoute } from '../models/route';
import {
  getSharedVariables,
  setSharedVariables,
  initHttpClientState,
} from '../httpClient/httpClientProvider';
import { HttpClientPanel } from '../httpClient/httpClientPanel';
import { validateAndResolveRequest } from '../httpClient/httpRequestService';
import { HttpRequestConfig } from '../httpClient/httpClientTypes';
import { isRelevantSourceForAnalysis } from '../scanner/routeScanner';
import { isIgnoredFile } from '../scanner/routeWatcher';
import { resolveRouterPrefixes } from '../analysis/prefixResolver';
import { parseExpressRoutes } from '../scanner/routeParser';
import { generateOpenApiDocument } from '../openapi/openApiGenerator';
import { RouteCodeLensProvider } from '../providers/routeCodeLensProvider';
import { COMMANDS } from '../utils/constants';

suite('API Routes Explorer — Sprint 17 Quality, Performance & Feature Enhancements Suite', () => {
  suite('1. Unified & Persistent HTTP Client Variables', () => {
    test('HttpClientPanel.sharedVariables and httpClientProvider stay synchronized and persist to workspaceState', () => {
      const storage = new Map<string, unknown>();
      const mockMemento: vscode.Memento = {
        keys: () => Array.from(storage.keys()),
        get: <T>(key: string, defaultValue?: T): T | undefined =>
          (storage.has(key) ? (storage.get(key) as T) : defaultValue),
        update: async (key: string, value: unknown) => {
          storage.set(key, value);
        },
      };

      initHttpClientState(mockMemento);
      setSharedVariables({ baseUrl: 'http://localhost:8080', token: 'jwt_abc' });

      assert.strictEqual(HttpClientPanel.sharedVariables.baseUrl, 'http://localhost:8080');
      assert.strictEqual(HttpClientPanel.sharedVariables.token, 'jwt_abc');
      assert.strictEqual(getSharedVariables().baseUrl, 'http://localhost:8080');

      const persisted = storage.get('apiRouteExplorer.httpClient.variables') as Record<string, string>;
      assert.ok(persisted);
      assert.strictEqual(persisted.baseUrl, 'http://localhost:8080');
      assert.strictEqual(persisted.token, 'jwt_abc');
    });
  });

  suite('2. URL Path Resolution & Multi-Value Query Parameters', () => {
    test('Preserves path parameter value when it matches an existing segment name (/posts/{slug} -> /posts/posts)', () => {
      const config: HttpRequestConfig = {
        method: 'GET',
        url: 'http://localhost:3000/posts/{slug}',
        pathParams: [{ name: 'slug', value: 'posts' }],
        queryParams: [],
        headers: [],
        body: '',
      };

      const res = validateAndResolveRequest(config);
      assert.strictEqual(res.ok, true);
      if (res.ok) {
        assert.strictEqual(res.resolved.resolvedUrl, 'http://localhost:3000/posts/posts');
      }
    });

    test('Preserves repeated query parameter keys as multi-value query params (?tag=a&tag=b)', () => {
      const config: HttpRequestConfig = {
        method: 'GET',
        url: 'http://localhost:3000/api/items',
        pathParams: [],
        queryParams: [
          { id: '1', key: 'tag', value: 'backend', enabled: true },
          { id: '2', key: 'tag', value: 'typescript', enabled: true },
          { id: '3', key: 'limit', value: '20', enabled: true },
        ],
        headers: [],
        body: '',
      };

      const res = validateAndResolveRequest(config);
      assert.strictEqual(res.ok, true);
      if (res.ok) {
        const parsed = new URL(res.resolved.resolvedUrl);
        assert.deepStrictEqual(parsed.searchParams.getAll('tag'), ['backend', 'typescript']);
        assert.strictEqual(parsed.searchParams.get('limit'), '20');
      }
    });
  });

  suite('3. Scanner Performance & Memory Hygiene', () => {
    test('isIgnoredFile excludes .test.ts, .spec.ts, __tests__, and .turbo directories', () => {
      assert.strictEqual(isIgnoredFile(vscode.Uri.file('/workspace/src/users.test.ts')), true);
      assert.strictEqual(isIgnoredFile(vscode.Uri.file('/workspace/src/users.spec.js')), true);
      assert.strictEqual(isIgnoredFile(vscode.Uri.file('/workspace/src/__tests__/helper.ts')), true);
      assert.strictEqual(isIgnoredFile(vscode.Uri.file('/workspace/.turbo/cache/file.js')), true);
      assert.strictEqual(isIgnoredFile(vscode.Uri.file('/workspace/src/routes/users.routes.ts')), false);
    });

    test('isRelevantSourceForAnalysis filters out unrelated plain files while keeping routes and schemas', () => {
      assert.strictEqual(
        isRelevantSourceForAnalysis('const x = 1 + 2; console.log(x);', []),
        false
      );
      assert.strictEqual(
        isRelevantSourceForAnalysis('const schema = z.object({ email: z.string() });', []),
        true
      );
      assert.strictEqual(
        isRelevantSourceForAnalysis('app.use("/api", apiRouter);', []),
        true
      );
    });
  });

  suite('4. Hono & Koa Router Mount Resolution', () => {
    test('Resolves Hono app.route("/prefix", subRouter) across files', () => {
      const fileSources = {
        '/workspace/src/index.ts': `
          import { Hono } from 'hono';
          import bookRoutes from './books.ts';
          const app = new Hono();
          app.route('/api/v1/books', bookRoutes);
        `,
        '/workspace/src/books.ts': `
          import { Hono } from 'hono';
          const bookRoutes = new Hono();
          bookRoutes.get('/:id', getBook);
          export default bookRoutes;
        `,
      };

      const rawRoutes = parseExpressRoutes(fileSources['/workspace/src/books.ts'], '/workspace/src/books.ts');
      const resolved = resolveRouterPrefixes(rawRoutes, fileSources);

      assert.strictEqual(resolved.length, 1);
      assert.strictEqual(resolved[0].path, '/api/v1/books/:id');
    });

    test('Resolves Koa router.use("/prefix", subRouter.routes()) across files', () => {
      const fileSources = {
        '/workspace/src/server.ts': `
          import Router from '@koa/router';
          import authRouter from './auth.router.ts';
          const router = new Router();
          router.use('/auth', authRouter.routes());
        `,
        '/workspace/src/auth.router.ts': `
          import Router from '@koa/router';
          const authRouter = new Router();
          authRouter.post('/login', handleLogin);
          export default authRouter;
        `,
      };

      const rawRoutes = parseExpressRoutes(fileSources['/workspace/src/auth.router.ts'], '/workspace/src/auth.router.ts');
      const resolved = resolveRouterPrefixes(rawRoutes, fileSources);

      assert.strictEqual(resolved.length, 1);
      assert.strictEqual(resolved[0].path, '/auth/login');
    });
  });

  suite('5. Rich OpenAPI 3.0.3 Query & RequestBody Schema Generation', () => {
    test('Populates OpenAPI query parameters and requestBody properties from route handler source', () => {
      const route: ApiRoute = {
        method: 'POST',
        path: '/api/users/:orgId',
        filePath: '/workspace/src/users.routes.ts',
        line: 3,
        column: 0,
        framework: 'express',
      };

      const fileSources = {
        '/workspace/src/users.routes.ts': `
          const createUserSchema = z.object({
            email: z.string(),
            age: z.number(),
            password: z.string(),
          });
          router.post('/api/users/:orgId', validate(createUserSchema), (req, res) => {
            const { notify } = req.query;
            res.json({ ok: true });
          });
        `,
      };

      const result = generateOpenApiDocument([route], undefined, {
        fileSources,
      });

      const postOp = result.document.paths['/api/users/{orgId}']?.post;
      assert.ok(postOp, 'Expected POST operation to be generated');

      // Path + Query parameters
      assert.ok(postOp.parameters);
      assert.ok(postOp.parameters.some((p) => p.name === 'orgId' && p.in === 'path'));
      assert.ok(postOp.parameters.some((p) => p.name === 'notify' && p.in === 'query'));

      // RequestBody schema properties
      const bodySchema = postOp.requestBody?.content['application/json']?.schema;
      assert.ok(bodySchema);
      assert.strictEqual(bodySchema.type, 'object');
      assert.ok(bodySchema.properties);
      assert.strictEqual(bodySchema.properties.email?.type, 'string');
      assert.strictEqual(bodySchema.properties.age?.type, 'number');
      assert.strictEqual(bodySchema.properties.password?.format, 'password');
    });
  });

  suite('6. Editor RouteCodeLensProvider', () => {
    test('Provides Test API, Analyze, and OpenAPI CodeLens items for routes in active document', () => {
      const provider = new RouteCodeLensProvider();
      const route: ApiRoute = {
        method: 'GET',
        path: '/api/v1/orders',
        filePath: '/workspace/src/orders.ts',
        line: 12,
        column: 2,
        framework: 'express',
      };

      provider.setRoutes([route]);

      const mockDoc = {
        uri: vscode.Uri.file('/workspace/src/orders.ts'),
        lineCount: 50,
      } as unknown as vscode.TextDocument;

      const lenses = provider.provideCodeLenses(mockDoc);
      assert.strictEqual(lenses.length, 3);
      assert.strictEqual(lenses[0].command?.command, COMMANDS.OPEN_HTTP_CLIENT);
      assert.strictEqual(lenses[1].command?.command, COMMANDS.ANALYZE_ROUTE);
      assert.strictEqual(lenses[2].command?.command, COMMANDS.VIEW_ROUTE_OPENAPI);
      assert.strictEqual(lenses[0].range.start.line, 12);

      provider.dispose();
    });
  });
});

