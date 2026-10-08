import * as assert from 'assert';
import { ApiRoute } from '../models/route';
import { parseExpressRoutes } from '../scanner/routeParser';
import { resolveRouterPrefixes, getLastDiscoveryDiagnostics } from '../analysis/prefixResolver';
import { buildInitialStateForRoute } from '../httpClient/httpClientProvider';
import { validateAndResolveRequest } from '../httpClient/httpRequestService';
import { HttpRequestConfig } from '../httpClient/httpClientTypes';

suite('API Routes Explorer — Sprint 16 Route Discovery & Test API Parameter Auto-Fill Suite', () => {

  // =========================================================================
  // A. Nested Admin Router
  // =========================================================================
  test('A. Nested admin router resolves multi-tier module prefixes', () => {
    const rawRoutes: ApiRoute[] = [
      {
        method: 'GET',
        path: '/list',
        filePath: '/workspace/src/modules/admin/services/services.routes.js',
        line: 10,
        column: 0,
        framework: 'express',
      },
    ];

    const fileSources = {
      '/workspace/src/app.js': `
        import adminRouter from './modules/admin/admin.routes.js';
        app.use('/admin', adminRouter);
      `,
      '/workspace/src/modules/admin/admin.routes.js': `
        import servicesRouter from './services/services.routes.js';
        adminRouter.use('/services', servicesRouter);
      `,
      '/workspace/src/modules/admin/services/services.routes.js': `
        servicesRouter.get('/list', listServices);
      `,
    };

    const resolved = resolveRouterPrefixes(rawRoutes, fileSources);
    assert.strictEqual(resolved.length, 1);
    assert.strictEqual(resolved[0].path, '/admin/services/list');
    assert.strictEqual(resolved[0].filePath, '/workspace/src/modules/admin/services/services.routes.js');
    assert.strictEqual(resolved[0].line, 10);
  });

  // =========================================================================
  // B. 2+ Level Nested Router
  // =========================================================================
  test('B. 2+ level nested router chains prefixes through four tiers (/api -> /v1 -> /admin -> /users)', () => {
    const rawRoutes: ApiRoute[] = [
      {
        method: 'GET',
        path: '/profile',
        filePath: '/workspace/src/modules/admin/users/users.routes.js',
        line: 5,
        column: 0,
        framework: 'express',
      },
    ];

    const fileSources = {
      '/workspace/src/app.js': `
        const v1 = require('./v1.routes');
        app.use('/api', v1);
      `,
      '/workspace/src/v1.routes.js': `
        const admin = require('./modules/admin/admin.routes');
        v1.use('/v1', admin);
      `,
      '/workspace/src/modules/admin/admin.routes.js': `
        const users = require('./users/users.routes');
        admin.use('/admin', users);
      `,
      '/workspace/src/modules/admin/users/users.routes.js': `
        users.use('/users', userRouter);
        userRouter.get('/profile', getProfile);
      `,
    };

    const resolved = resolveRouterPrefixes(rawRoutes, fileSources);
    assert.strictEqual(resolved.length, 1);
    assert.strictEqual(resolved[0].path, '/api/v1/admin/users/profile');
  });

  // =========================================================================
  // C. Mounted Router Prefix Accumulation
  // =========================================================================
  test('C. Mounted router prefix accumulation handles multiple mount parents without loss', () => {
    const rawRoutes: ApiRoute[] = [
      {
        method: 'POST',
        path: '/create',
        filePath: '/workspace/src/modules/complaint/complaint.routes.js',
        line: 12,
        column: 0,
        framework: 'express',
      },
    ];

    const fileSources = {
      '/workspace/src/app.js': `
        import customerRouter from './customer.routes.js';
        import professionalRouter from './professional.routes.js';
        app.use('/customer', customerRouter);
        app.use('/professional', professionalRouter);
      `,
      '/workspace/src/customer.routes.js': `
        import complaintRouter from './modules/complaint/complaint.routes.js';
        customerRouter.use('/complaints', complaintRouter);
      `,
      '/workspace/src/professional.routes.js': `
        import complaintRouter from './modules/complaint/complaint.routes.js';
        professionalRouter.use('/complaints', complaintRouter);
      `,
      '/workspace/src/modules/complaint/complaint.routes.js': `
        complaintRouter.post('/create', createComplaint);
      `,
    };

    const resolved = resolveRouterPrefixes(rawRoutes, fileSources);
    assert.strictEqual(resolved.length, 2);
    const paths = resolved.map((r) => r.path).sort();
    assert.deepStrictEqual(paths, [
      '/customer/complaints/create',
      '/professional/complaints/create',
    ]);
  });

  // =========================================================================
  // D. Prefix Overlap / Deduplication
  // =========================================================================
  test('D. Prefix overlap/deduplication prevents duplicated path segments', () => {
    const rawRoutes: ApiRoute[] = [
      {
        method: 'GET',
        path: '/users/active',
        filePath: '/workspace/src/modules/users.routes.js',
        line: 15,
        column: 0,
        framework: 'express',
      },
    ];

    const fileSources = {
      '/workspace/src/app.js': `
        import usersRouter from './modules/users.routes.js';
        app.use('/api/v1/users', usersRouter);
      `,
      '/workspace/src/modules/users.routes.js': `
        usersRouter.get('/users/active', getActiveUsers);
      `,
    };

    const resolved = resolveRouterPrefixes(rawRoutes, fileSources);
    assert.strictEqual(resolved.length, 1);
    assert.strictEqual(resolved[0].path, '/api/v1/users/active');
  });

  // =========================================================================
  // E. Missing Router Relationship / Diagnostics
  // =========================================================================
  test('E. Unresolved router import is recorded in diagnostics and does not drop route', () => {
    const rawRoutes: ApiRoute[] = [
      {
        method: 'GET',
        path: '/unknown',
        filePath: '/workspace/src/routes/standalone.js',
        line: 3,
        column: 0,
        framework: 'express',
      },
    ];

    const fileSources = {
      '/workspace/src/app.js': `
        const missing = require('./nonexistent/module');
        app.use('/missing', missing);
      `,
      '/workspace/src/routes/standalone.js': `
        standaloneRouter.get('/unknown', handler);
      `,
    };

    const resolved = resolveRouterPrefixes(rawRoutes, fileSources);
    assert.strictEqual(resolved.length, 1);
    assert.strictEqual(resolved[0].path, '/unknown');

    const diag = getLastDiscoveryDiagnostics();
    assert.ok(diag.unresolvedRelationships.length > 0);
    assert.strictEqual(diag.unresolvedRelationships[0].routerVar, 'missing');
  });

  // =========================================================================
  // F. Circular Router Reference Safety
  // =========================================================================
  test('F. Circular router reference does not enter infinite loop or crash', () => {
    const rawRoutes: ApiRoute[] = [
      {
        method: 'GET',
        path: '/ping',
        filePath: '/workspace/src/a.js',
        line: 4,
        column: 0,
        framework: 'express',
      },
    ];

    const fileSources = {
      '/workspace/src/a.js': `
        import b from './b.js';
        a.use('/a', b);
        a.get('/ping', handlePing);
      `,
      '/workspace/src/b.js': `
        import a from './a.js';
        b.use('/b', a);
      `,
    };

    const resolved = resolveRouterPrefixes(rawRoutes, fileSources);
    assert.ok(resolved.length >= 1);
  });

  // =========================================================================
  // G. :id Parameter Auto-Fill
  // =========================================================================
  test('G. :id parameter auto-detects path param with sensible placeholder in Test API', () => {
    const route: ApiRoute = {
      method: 'GET',
      path: '/api/v1/users/:id',
      filePath: '/workspace/src/users.js',
      line: 20,
      column: 0,
      framework: 'express',
    };

    const state = buildInitialStateForRoute(route, 'http://localhost:5000');
    assert.strictEqual(state.method, 'GET');
    assert.strictEqual(state.pathParams.length, 1);
    assert.strictEqual(state.pathParams[0].name, 'id');
    assert.strictEqual(state.pathParams[0].placeholder, '123');
    assert.strictEqual(state.pathParams[0].isOptional, false);
    assert.strictEqual(state.fullUrl, 'http://localhost:5000/api/v1/users/{id}');
  });

  // =========================================================================
  // H. Multiple Path Parameters
  // =========================================================================
  test('H. Multiple path parameters preserve order and distinct placeholder values', () => {
    const route: ApiRoute = {
      method: 'GET',
      path: '/orders/:orderId/items/:itemId',
      filePath: '/workspace/src/orders.js',
      line: 40,
      column: 0,
      framework: 'express',
    };

    const state = buildInitialStateForRoute(route, 'http://localhost:5000');
    assert.strictEqual(state.pathParams.length, 2);
    assert.strictEqual(state.pathParams[0].name, 'orderId');
    assert.strictEqual(state.pathParams[0].placeholder, '123');
    assert.strictEqual(state.pathParams[1].name, 'itemId');
    assert.strictEqual(state.pathParams[1].placeholder, '456');

    // Test resolution when user inputs values
    const config: HttpRequestConfig = {
      method: 'GET',
      url: state.fullUrl,
      pathParams: [
        { name: 'orderId', value: 'ORD-99' },
        { name: 'itemId', value: 'ITEM-1' },
      ],
      queryParams: [],
      headers: [],
      body: '',
    };

    const result = validateAndResolveRequest(config);
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.resolved.resolvedUrl, 'http://localhost:5000/orders/ORD-99/items/ITEM-1');
    }
  });

  // =========================================================================
  // I. Optional Path Parameter
  // =========================================================================
  test('I. Optional path parameter is detected with isOptional true and resolved safely', () => {
    const route: ApiRoute = {
      method: 'GET',
      path: '/users/:id?',
      filePath: '/workspace/src/users.js',
      line: 30,
      column: 0,
      framework: 'express',
    };

    const state = buildInitialStateForRoute(route, 'http://localhost:5000');
    assert.strictEqual(state.pathParams.length, 1);
    assert.strictEqual(state.pathParams[0].name, 'id');
    assert.strictEqual(state.pathParams[0].isOptional, true);

    // Resolving without providing optional param removes the token cleanly
    const config: HttpRequestConfig = {
      method: 'GET',
      url: state.fullUrl,
      pathParams: state.pathParams,
      queryParams: [],
      headers: [],
      body: '',
    };

    const result = validateAndResolveRequest(config);
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.resolved.resolvedUrl, 'http://localhost:5000/users');
    }
  });

  // =========================================================================
  // J. URL Encoding
  // =========================================================================
  test('J. URL encoding properly encodes special characters and spaces in parameters', () => {
    const config: HttpRequestConfig = {
      method: 'GET',
      url: 'http://localhost:5000/search/:query',
      pathParams: [{ name: 'query', value: 'hello world & special/chars' }],
      queryParams: [],
      headers: [],
      body: '',
    };

    const result = validateAndResolveRequest(config);
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(
        result.resolved.resolvedUrl,
        'http://localhost:5000/search/hello%20world%20%26%20special%2Fchars'
      );
    }
  });

  // =========================================================================
  // K. Test API Initial Parameter Values
  // =========================================================================
  test('K. Test API initial parameter state preserves empty user value while providing placeholder', () => {
    const route: ApiRoute = {
      method: 'GET',
      path: '/professionals/:professionalId/services/:serviceId',
      filePath: '/workspace/src/prof.js',
      line: 12,
      column: 0,
      framework: 'express',
    };

    const state = buildInitialStateForRoute(route, 'http://localhost:8000');
    assert.strictEqual(state.pathParams[0].value, '');
    assert.strictEqual(state.pathParams[0].placeholder, '123');
    assert.strictEqual(state.pathParams[1].value, '');
    assert.strictEqual(state.pathParams[1].placeholder, '456');
    assert.strictEqual(state.fullUrl, 'http://localhost:8000/professionals/{professionalId}/services/{serviceId}');
  });

  // =========================================================================
  // L. Test API URL Update & Unresolved Token Guard
  // =========================================================================
  test('L. Test API rejects request if required path parameter remains unresolved', () => {
    const config: HttpRequestConfig = {
      method: 'GET',
      url: 'http://localhost:5000/users/{id}',
      pathParams: [{ name: 'id', value: '' }],
      queryParams: [],
      headers: [],
      body: '',
    };

    const result = validateAndResolveRequest(config);
    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.code, 'MISSING_PATH_PARAM');
    }
  });

  // =========================================================================
  // M. Query + Path Parameter Combination
  // =========================================================================
  test('M. Query + path parameter combination separates query from path and resolves cleanly', () => {
    const route: ApiRoute = {
      method: 'GET',
      path: '/users/:userId/bookings/:bookingId?status=active',
      filePath: '/workspace/src/bookings.js',
      line: 55,
      column: 0,
      framework: 'express',
    };

    const state = buildInitialStateForRoute(route, 'http://localhost:5000');
    assert.strictEqual(state.pathParams.length, 2);
    assert.strictEqual(state.pathParams[0].name, 'userId');
    assert.strictEqual(state.pathParams[1].name, 'bookingId');
    assert.strictEqual(state.queryParams.length, 1);
    assert.strictEqual(state.queryParams[0].key, 'status');
    assert.strictEqual(state.queryParams[0].value, 'active');

    const config: HttpRequestConfig = {
      method: 'GET',
      url: state.fullUrl,
      pathParams: [
        { name: 'userId', value: '123' },
        { name: 'bookingId', value: '456' },
      ],
      queryParams: state.queryParams,
      headers: [],
      body: '',
    };

    const result = validateAndResolveRequest(config);
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(
        result.resolved.resolvedUrl,
        'http://localhost:5000/users/123/bookings/456?status=active'
      );
    }
  });

  // =========================================================================
  // N. Existing Non-Parameter Routes
  // =========================================================================
  test('N. Existing non-parameter routes resolve cleanly without inventing pathParams', () => {
    const route: ApiRoute = {
      method: 'GET',
      path: '/api/v1/health',
      filePath: '/workspace/src/app.js',
      line: 8,
      column: 0,
      framework: 'express',
    };

    const state = buildInitialStateForRoute(route, 'http://localhost:5000');
    assert.strictEqual(state.pathParams.length, 0);
    assert.strictEqual(state.fullUrl, 'http://localhost:5000/api/v1/health');

    const config: HttpRequestConfig = {
      method: 'GET',
      url: state.fullUrl,
      pathParams: [],
      queryParams: [],
      headers: [],
      body: '',
    };

    const result = validateAndResolveRequest(config);
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.resolved.resolvedUrl, 'http://localhost:5000/api/v1/health');
    }
  });

  // =========================================================================
  // Parser Chaining & Array Paths
  // =========================================================================
  test('Chained router.route() and array paths are parsed accurately', () => {
    const source = `
      router.route(['/item1', '/item2'])
        .get(getItem)
        .post(createItem);
      chatRouter.route('/messages')
        .get(getMessages)
        .all(catchAllMessages);
    `;

    const routes = parseExpressRoutes(source, '/workspace/src/chat.js');
    assert.strictEqual(routes.length, 6);
    assert.strictEqual(routes[0].method, 'GET');
    assert.strictEqual(routes[0].path, '/item1');
    assert.strictEqual(routes[1].method, 'GET');
    assert.strictEqual(routes[1].path, '/item2');
    assert.strictEqual(routes[2].method, 'POST');
    assert.strictEqual(routes[2].path, '/item1');
    assert.strictEqual(routes[3].method, 'POST');
    assert.strictEqual(routes[3].path, '/item2');
    assert.strictEqual(routes[4].method, 'GET');
    assert.strictEqual(routes[4].path, '/messages');
    assert.strictEqual(routes[5].method, 'ANY');
    assert.strictEqual(routes[5].path, '/messages');
  });

  // =========================================================================
  // Non-Router Callers False-Positive Protection
  // =========================================================================
  test('Non-router callers (req, res, redisClient, map) do not create false routes', () => {
    const source = `
      const header = req.get('Authorization');
      res.get('Content-Type');
      const val = redisClient.get('cache_key');
      const entry = map.get('some_key');
    `;

    const routes = parseExpressRoutes(source, '/workspace/src/middleware.js');
    assert.strictEqual(routes.length, 0);
  });

  // =========================================================================
  // Root Route Isolation
  // =========================================================================
  test('Root routes declared on app remain isolated and never inherit child router mount prefixes', () => {
    const rawRoutes: ApiRoute[] = [
      {
        method: 'GET',
        path: '/health',
        filePath: '/workspace/src/app.js',
        line: 10,
        column: 0,
        framework: 'express',
      },
      {
        method: 'GET',
        path: '/',
        filePath: '/workspace/src/app.js',
        line: 20,
        column: 0,
        framework: 'express',
      },
      {
        method: 'GET',
        path: '/apple-app-site-association',
        filePath: '/workspace/src/app.js',
        line: 30,
        column: 0,
        framework: 'express',
      },
    ];

    const fileSources = {
      '/workspace/src/app.js': `
        app.get('/health', (req, res) => res.send('OK'));
        app.get('/', (req, res) => res.send('Home'));
        app.get('/apple-app-site-association', (req, res) => res.json({}));
        app.use('/api/v1', v1Router);
        app.use('/api/v2', v2Router);
      `,
    };

    const resolved = resolveRouterPrefixes(rawRoutes, fileSources);
    assert.strictEqual(resolved.length, 3);
    assert.strictEqual(resolved[0].path, '/health');
    assert.strictEqual(resolved[1].path, '/');
    assert.strictEqual(resolved[2].path, '/apple-app-site-association');
  });

  // =========================================================================
  // Express .route() with GET, POST, PUT, DELETE, ALL, OPTIONS, HEAD
  // =========================================================================
  test('Express .route() handles GET, POST, PUT, DELETE, ALL, OPTIONS, HEAD accurately', () => {
    const source = `
      router.route('/resource')
        .get(handleGet)
        .post(handlePost)
        .put(handlePut)
        .delete(handleDelete)
        .all(handleAny)
        .options(handleOptions)
        .head(handleHead);
    `;

    const routes = parseExpressRoutes(source, '/workspace/src/resource.routes.js');
    assert.strictEqual(routes.length, 7);
    const methods = routes.map((r) => r.method);
    assert.deepStrictEqual(methods, [
      'GET',
      'POST',
      'PUT',
      'DELETE',
      'ANY',
      'OPTIONS',
      'HEAD',
    ]);
    routes.forEach((r) => assert.strictEqual(r.path, '/resource'));
  });

  // =========================================================================
  // Middleware-Aware .use() with Multiple Intermediate Middlewares
  // =========================================================================
  test('Middleware-aware .use() correctly extracts router after multiple intermediate middlewares', () => {
    const rawRoutes: ApiRoute[] = [
      {
        method: 'GET',
        path: '/secure',
        filePath: '/workspace/src/admin.js',
        line: 5,
        column: 0,
        framework: 'express',
      },
    ];

    const fileSources = {
      '/workspace/src/app.js': `
        import adminRouter from './admin.js';
        v1Router.use('/admin', verifyToken, rateLimiter, requirePermission('ADMIN'), adminRouter);
      `,
      '/workspace/src/admin.js': `
        adminRouter.get('/secure', handleSecure);
      `,
    };

    const resolved = resolveRouterPrefixes(rawRoutes, fileSources);
    assert.strictEqual(resolved.length, 1);
    assert.strictEqual(resolved[0].path, '/admin/secure');
  });

  // =========================================================================
  // ESM and CommonJS Import Varieties
  // =========================================================================
  test('Resolves routers across ESM named, aliased, CJS default, and CJS destructured imports', () => {
    const fileSources = {
      '/workspace/src/app.js': `
        import { adminRouter as aliasedRouter } from './r1.js';
        const { directCjsRouter } = require('./r2.js');
        const defaultCjsRouter = require('./r3.js');

        app.use('/aliased', aliasedRouter);
        app.use('/destructured', directCjsRouter);
        app.use('/default-cjs', defaultCjsRouter);
      `,
      '/workspace/src/r1.js': `
        export const adminRouter = Router();
        adminRouter.get('/r1', h);
      `,
      '/workspace/src/r2.js': `
        const directCjsRouter = Router();
        directCjsRouter.get('/r2', h);
      `,
      '/workspace/src/r3.js': `
        defaultCjsRouter.get('/r3', h);
      `,
    };

    const rawRoutes: ApiRoute[] = [
      ...parseExpressRoutes(fileSources['/workspace/src/r1.js'], '/workspace/src/r1.js'),
      ...parseExpressRoutes(fileSources['/workspace/src/r2.js'], '/workspace/src/r2.js'),
      ...parseExpressRoutes(fileSources['/workspace/src/r3.js'], '/workspace/src/r3.js'),
    ];

    const resolved = resolveRouterPrefixes(rawRoutes, fileSources);
    assert.strictEqual(resolved.length, 3);
    const paths = resolved.map((r) => r.path).sort();
    assert.deepStrictEqual(paths, [
      '/aliased/r1',
      '/default-cjs/r3',
      '/destructured/r2',
    ]);
  });

  // =========================================================================
  // URL Safety & Special Characters Encoding
  // =========================================================================
  test('URL safety safely encodes special characters: John Doe, hello/world, a+b, a&b, ?, #, %', () => {
    const specialValues = [
      { name: 'val1', raw: 'John Doe', expected: 'John%20Doe' },
      { name: 'val2', raw: 'hello/world', expected: 'hello%2Fworld' },
      { name: 'val3', raw: 'a+b', expected: 'a%2Bb' },
      { name: 'val4', raw: 'a&b', expected: 'a%26b' },
      { name: 'val5', raw: '?', expected: '%3F' },
      { name: 'val6', raw: '#', expected: '%23' },
      { name: 'val7', raw: '%', expected: '%25' },
    ];

    for (const item of specialValues) {
      const config: HttpRequestConfig = {
        method: 'GET',
        url: 'http://localhost:5000/echo/{param}',
        pathParams: [{ name: 'param', value: item.raw }],
        queryParams: [],
        headers: [],
        body: '',
      };

      const result = validateAndResolveRequest(config);
      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.strictEqual(result.resolved.resolvedUrl, `http://localhost:5000/echo/${item.expected}`);
      }
    }
  });

});
