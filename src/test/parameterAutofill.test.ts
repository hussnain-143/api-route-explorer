import * as assert from 'assert';
import { ApiRoute } from '../models/route';
import {
  extractRouteParameters,
} from '../analysis/parameterExtractor';
import {
  suggestParameterValue,
  buildJsonObjectFromParams,
} from '../analysis/parameterSuggester';
import { buildInitialStateForRoute } from '../httpClient/httpClientProvider';
import {
  interpolateVariables,
  validateAndResolveRequest,
  buildCurlFromConfig,
} from '../httpClient/httpRequestService';

function createTestRoute(overrides: Partial<ApiRoute> & { path: string; method: ApiRoute['method'] }): ApiRoute {
  return {
    filePath: '/workspace/routes/test.js',
    line: 1,
    column: 1,
    framework: 'express',
    ...overrides,
  };
}

suite('API Routes Explorer — Smart API Parameter Detection & Autofill Suite', () => {
  // A. Path parameter
  test('A. Single path parameter /users/:userId produces userId', () => {
    const route = createTestRoute({
      path: '/users/:userId',
      method: 'GET',
      filePath: '/workspace/routes/users.js',
      line: 10,
    });
    const params = extractRouteParameters(route);
    const pathParams = params.filter((p) => p.location === 'path');

    assert.strictEqual(pathParams.length, 1);
    assert.strictEqual(pathParams[0].name, 'userId');
    assert.strictEqual(pathParams[0].required, true);
    assert.strictEqual(pathParams[0].placeholder, '123');
  });

  // B. Multiple path parameters
  test('B. Multiple path parameters /users/:userId/orders/:orderId produces userId, orderId', () => {
    const route = createTestRoute({
      path: '/users/:userId/orders/:orderId',
      method: 'GET',
      filePath: '/workspace/routes/orders.js',
      line: 15,
    });
    const params = extractRouteParameters(route);
    const pathParams = params.filter((p) => p.location === 'path');

    assert.strictEqual(pathParams.length, 2);
    assert.strictEqual(pathParams[0].name, 'userId');
    assert.strictEqual(pathParams[0].placeholder, '123');
    assert.strictEqual(pathParams[1].name, 'orderId');
    assert.strictEqual(pathParams[1].placeholder, '456');
  });

  test('B2. Supports optional path parameter :id? and curly syntax {userId}', () => {
    const route = createTestRoute({
      path: '/items/{userId}/details/:tag?',
      method: 'GET',
      filePath: '/workspace/routes/items.js',
      line: 5,
    });
    const params = extractRouteParameters(route);
    const pathParams = params.filter((p) => p.location === 'path');

    assert.strictEqual(pathParams.length, 2);
    assert.strictEqual(pathParams[0].name, 'userId');
    assert.strictEqual(pathParams[0].isOptional, false);
    assert.strictEqual(pathParams[1].name, 'tag');
    assert.strictEqual(pathParams[1].isOptional, true);
  });

  // C. Query parameters
  test('C. Query parameters extracted separately from path and handler', () => {
    const routeSource = `
      router.get('/users?status=active&page=1', (req, res) => {
        const { limit } = req.query;
        res.json([]);
      });
    `;
    const route = createTestRoute({
      path: '/users?status=active&page=1',
      method: 'GET',
      filePath: '/workspace/routes/users.js',
      line: 2,
    });
    const fileSources = new Map<string, string>([
      [route.filePath, routeSource],
    ]);

    const params = extractRouteParameters(route, fileSources);
    const queryParams = params.filter((p) => p.location === 'query');

    const queryNames = queryParams.map((p) => p.name);
    assert.ok(queryNames.includes('status'), 'status query param detected');
    assert.ok(queryNames.includes('page'), 'page query param detected');
    assert.ok(queryNames.includes('limit'), 'limit query param detected from handler');

    const statusParam = queryParams.find((p) => p.name === 'status');
    assert.strictEqual(statusParam?.value, 'active');
  });

  // D. Body destructuring
  test('D. Body destructuring: const { email, password } = req.body', () => {
    const routeSource = `
      router.post('/login', (req, res) => {
        const { email, password } = req.body;
        res.json({ ok: true });
      });
    `;
    const route = createTestRoute({
      path: '/login',
      method: 'POST',
      filePath: '/workspace/routes/auth.js',
      line: 2,
    });
    const fileSources = new Map<string, string>([
      [route.filePath, routeSource],
    ]);

    const params = extractRouteParameters(route, fileSources);
    const bodyParams = params.filter((p) => p.location === 'body');

    assert.strictEqual(bodyParams.length, 2);
    assert.strictEqual(bodyParams[0].name, 'email');
    assert.strictEqual(bodyParams[0].value, 'user@example.com');
    assert.strictEqual(bodyParams[1].name, 'password');
    assert.strictEqual(bodyParams[1].value, 'password');
    assert.strictEqual(bodyParams[1].isSensitive, true);
  });

  // E. Direct body access
  test('E. Direct body access: req.body.email and req.body.password', () => {
    const routeSource = `
      router.post('/login', (req, res) => {
        const email = req.body.email;
        const password = req.body.password;
        res.json({ token: 'abc' });
      });
    `;
    const route = createTestRoute({
      path: '/login',
      method: 'POST',
      filePath: '/workspace/routes/auth.js',
      line: 2,
    });
    const fileSources = new Map<string, string>([
      [route.filePath, routeSource],
    ]);

    const params = extractRouteParameters(route, fileSources);
    const bodyParams = params.filter((p) => p.location === 'body');

    assert.strictEqual(bodyParams.length, 2);
    const names = bodyParams.map((p) => p.name);
    assert.ok(names.includes('email'));
    assert.ok(names.includes('password'));
  });

  // F. Nested body access
  test('F. Nested body access: req.body.user.email and req.body.user.name', () => {
    const routeSource = `
      router.post('/users', (req, res) => {
        const email = req.body.user.email;
        const name = req.body.user.name;
        res.json({ id: 1 });
      });
    `;
    const route = createTestRoute({
      path: '/users',
      method: 'POST',
      filePath: '/workspace/routes/users.js',
      line: 2,
    });
    const fileSources = new Map<string, string>([
      [route.filePath, routeSource],
    ]);

    const params = extractRouteParameters(route, fileSources);
    const bodyParams = params.filter((p) => p.location === 'body');

    assert.strictEqual(bodyParams.length, 2);
    assert.strictEqual(bodyParams[0].name, 'user.email');
    assert.strictEqual(bodyParams[1].name, 'user.name');

    // Verify nested JSON object serialization
    const jsonObj = buildJsonObjectFromParams(bodyParams);
    assert.deepStrictEqual(jsonObj, {
      user: {
        email: 'user@example.com',
        name: 'John Doe',
      },
    });
  });

  // G. Validation schema
  test('G. Validation schema: z.object({ email: z.string(), password: z.string() })', () => {
    const routeSource = `
      const loginSchema = z.object({
        email: z.string().email(),
        password: z.string().min(8),
      });

      router.post('/login', validate(loginSchema), (req, res) => {
        res.json({ success: true });
      });
    `;
    const route = createTestRoute({
      path: '/login',
      method: 'POST',
      filePath: '/workspace/routes/auth.js',
      line: 7,
    });
    const fileSources = new Map<string, string>([
      [route.filePath, routeSource],
    ]);

    const params = extractRouteParameters(route, fileSources);
    const bodyParams = params.filter((p) => p.location === 'body');

    assert.strictEqual(bodyParams.length, 2);
    const names = bodyParams.map((p) => p.name);
    assert.ok(names.includes('email'));
    assert.ok(names.includes('password'));
  });

  // H. Login endpoint: complete Test API model
  test('H. Complete Test API model for POST /auth/login', () => {
    const routeSource = `
      router.post('/auth/login', (req, res) => {
        const { email, password } = req.body;
        res.json({ token: 'jwt' });
      });
    `;
    const route = createTestRoute({
      path: '/auth/login',
      method: 'POST',
      filePath: '/workspace/controllers/auth.js',
      line: 2,
    });
    const fileSources = new Map<string, string>([
      [route.filePath, routeSource],
    ]);

    const initialState = buildInitialStateForRoute(route, 'http://localhost:3000', fileSources);

    assert.strictEqual(initialState.method, 'POST');
    assert.strictEqual(initialState.routePath, '/auth/login');
    assert.strictEqual(initialState.bodyParams?.length, 2);

    const emailParam = initialState.bodyParams?.find((p) => p.name === 'email');
    assert.ok(emailParam);
    assert.strictEqual(emailParam?.value, 'user@example.com');

    const passParam = initialState.bodyParams?.find((p) => p.name === 'password');
    assert.ok(passParam);
    assert.strictEqual(passParam?.value, 'password');
    assert.strictEqual(passParam?.placeholder, '••••••••');
    assert.strictEqual(passParam?.isSensitive, true);

    // Initial body JSON must be formatted and match expected keys
    const parsedBody = JSON.parse(initialState.body || '{}');
    assert.deepStrictEqual(parsedBody, {
      email: 'user@example.com',
      password: 'password',
    });
  });

  // I. Mixed parameters: Path + Query + Body remain completely separate
  test('I. Mixed parameters: Path, Query, and Body remain completely separated', () => {
    const routeSource = `
      router.post('/users/:userId?notify=true', (req, res) => {
        const { email } = req.body;
        res.json({ id: req.params.userId });
      });
    `;
    const route = createTestRoute({
      path: '/users/:userId?notify=true',
      method: 'POST',
      filePath: '/workspace/routes/users.js',
      line: 2,
    });
    const fileSources = new Map<string, string>([
      [route.filePath, routeSource],
    ]);

    const params = extractRouteParameters(route, fileSources);

    const pathParams = params.filter((p) => p.location === 'path');
    const queryParams = params.filter((p) => p.location === 'query');
    const bodyParams = params.filter((p) => p.location === 'body');

    assert.strictEqual(pathParams.length, 1, 'Path parameter count');
    assert.strictEqual(pathParams[0].name, 'userId');

    assert.strictEqual(queryParams.length, 1, 'Query parameter count');
    assert.strictEqual(queryParams[0].name, 'notify');

    assert.strictEqual(bodyParams.length, 1, 'Body parameter count');
    assert.strictEqual(bodyParams[0].name, 'email');

    // Build initial state
    const state = buildInitialStateForRoute(route, 'http://localhost:3000', fileSources);
    assert.strictEqual(state.pathParams.length, 1);
    assert.strictEqual(state.pathParams[0].name, 'userId');

    assert.strictEqual(state.queryParams.length, 1);
    assert.strictEqual(state.queryParams[0].key, 'notify');

    assert.strictEqual(state.bodyParams?.length, 1);
    assert.strictEqual(state.bodyParams?.[0].name, 'email');
  });

  // J. Unknown body: No fake parameters created
  test('J. Unknown body: Never invents fake body parameters', () => {
    const routeSource = `
      router.post('/webhook', (req, res) => {
        handleGenericWebhook(req);
        res.sendStatus(200);
      });
    `;
    const route = createTestRoute({
      path: '/webhook',
      method: 'POST',
      filePath: '/workspace/routes/webhook.js',
      line: 2,
    });
    const fileSources = new Map<string, string>([
      [route.filePath, routeSource],
    ]);

    const params = extractRouteParameters(route, fileSources);
    const bodyParams = params.filter((p) => p.location === 'body');

    assert.strictEqual(bodyParams.length, 0, 'No fake body parameters should be invented');

    const state = buildInitialStateForRoute(route, 'http://localhost:3000', fileSources);
    assert.strictEqual(state.bodyParams?.length, 0);
    assert.strictEqual(state.body, '{\n  \n}');
  });

  // K. Sensitive source values: Environment variables never read or leaked
  test('K. Sensitive source values: process.env.PASSWORD is never exposed', () => {
    const routeSource = `
      router.post('/login', (req, res) => {
        const password = process.env.PASSWORD || req.body.password;
        res.json({ ok: true });
      });
    `;
    const route = createTestRoute({
      path: '/login',
      method: 'POST',
      filePath: '/workspace/routes/auth.js',
      line: 2,
    });
    const fileSources = new Map<string, string>([
      [route.filePath, routeSource],
    ]);

    const params = extractRouteParameters(route, fileSources);
    const passParam = params.find((p) => p.name === 'password');

    assert.ok(passParam);
    assert.strictEqual(passParam?.value, 'password');
    assert.notStrictEqual(passParam?.value, 'process.env.PASSWORD');
    assert.strictEqual(passParam?.isSensitive, true);
  });

  // Cross-file controller handler resolution
  test('L. Resolves controller handler across files (router.post -> authController.login)', () => {
    const routesSource = `
      import * as authController from './controllers/authController';
      router.post('/login', authController.login);
    `;
    const controllerSource = `
      export function login(req, res) {
        const { email, password } = req.body;
        return res.json({ token: 'xyz' });
      }
    `;

    const route = createTestRoute({
      path: '/login',
      method: 'POST',
      filePath: '/workspace/routes.js',
      line: 3,
    });

    const fileSources = new Map<string, string>([
      ['/workspace/routes.js', routesSource],
      ['/workspace/controllers/authController.js', controllerSource],
    ]);

    const params = extractRouteParameters(route, fileSources);
    const bodyParams = params.filter((p) => p.location === 'body');

    assert.strictEqual(bodyParams.length, 2);
    const names = bodyParams.map((p) => p.name);
    assert.ok(names.includes('email'));
    assert.ok(names.includes('password'));
  });

  // Smart suggestions utility
  test('M. Deterministic parameter value suggestions', () => {
    const emailSug = suggestParameterValue('userEmail', 'body');
    assert.strictEqual(emailSug.value, 'user@example.com');
    assert.strictEqual(emailSug.type, 'string');

    const passSug = suggestParameterValue('pass', 'body');
    assert.strictEqual(passSug.value, 'password');
    assert.strictEqual(passSug.isSensitive, true);

    const idSug0 = suggestParameterValue('customerId', 'path', undefined, 0);
    assert.strictEqual(idSug0.value, '123');

    const idSug1 = suggestParameterValue('orderId', 'path', undefined, 1);
    assert.strictEqual(idSug1.value, '456');

    const phoneSug = suggestParameterValue('phoneNumber', 'body');
    assert.strictEqual(phoneSug.value, '+1-555-0199');

    const pageSug = suggestParameterValue('page', 'query');
    assert.strictEqual(pageSug.value, 1);

    const limitSug = suggestParameterValue('limit', 'query');
    assert.strictEqual(limitSug.value, 20);

    const rememberSug = suggestParameterValue('rememberMe', 'body');
    assert.strictEqual(rememberSug.value, false);
  });

  // Postman-style variables & interpolation
  test('N1. interpolateVariables replaces {{baseUrl}} and {{token}} while preserving unknowns', () => {
    const vars = { baseUrl: 'http://localhost:5000', token: 'jwt-xyz-123' };
    const interpolatedUrl = interpolateVariables('{{baseUrl}}/api/v1/users', vars);
    assert.strictEqual(interpolatedUrl, 'http://localhost:5000/api/v1/users');

    const authHeader = interpolateVariables('Bearer {{token}}', vars);
    assert.strictEqual(authHeader, 'Bearer jwt-xyz-123');

    const unknown = interpolateVariables('{{unknownVar}}', vars);
    assert.strictEqual(unknown, '{{unknownVar}}');
  });

  test('N2. validateAndResolveRequest interpolates variables in URL, headers, query, and body', () => {
    const vars = {
      baseUrl: 'http://localhost:4000',
      token: 'secret-token-777',
      tenantId: 'tenant-99',
    };

    const res = validateAndResolveRequest({
      method: 'POST',
      url: '{{baseUrl}}/api/v1/tenants/{{tenantId}}',
      pathParams: [
        { name: 'tenantId', value: '{{tenantId}}' },
      ],
      queryParams: [
        { id: '1', key: 'filter', value: '{{tenantId}}', enabled: true },
      ],
      headers: [
        { id: '2', key: 'Authorization', value: 'Bearer {{token}}', enabled: true },
      ],
      body: JSON.stringify({ authToken: '{{token}}' }),
      variables: vars,
    });

    assert.strictEqual(res.ok, true);
    if (res.ok) {
      assert.strictEqual(res.resolved.resolvedUrl, 'http://localhost:4000/api/v1/tenants/tenant-99?filter=tenant-99');
      assert.strictEqual(res.resolved.headers['Authorization'], 'Bearer secret-token-777');
      const parsedBody = JSON.parse(res.resolved.body || '{}');
      assert.strictEqual(parsedBody.authToken, 'secret-token-777');
    }
  });

  test('N3. buildCurlFromConfig interpolates variables into reproducible cURL command', () => {
    const curl = buildCurlFromConfig({
      method: 'GET',
      url: '{{baseUrl}}/api/profile',
      pathParams: [],
      queryParams: [],
      headers: [
        { id: '1', key: 'Authorization', value: 'Bearer {{token}}', enabled: true },
      ],
      variables: {
        baseUrl: 'http://127.0.0.1:8080',
        token: 'active-jwt-token',
      },
      body: '',
    });

    assert.ok(curl.includes('http://127.0.0.1:8080/api/profile'));
    assert.ok(curl.includes('Bearer active-jwt-token'));
  });

  test('N4. buildInitialStateForRoute exposes variables including shared baseUrl', () => {
    const route = createTestRoute({
      path: '/auth/me',
      method: 'GET',
    });
    const state = buildInitialStateForRoute(route, 'http://localhost:8000');
    assert.ok(state.variables);
    assert.strictEqual(state.variables.baseUrl, 'http://localhost:8000');
    assert.strictEqual(typeof state.variables.token, 'string');
  });

  test('O. Proper dynamic parameter auto-naming: newPassword and custom fields auto-set keys with clean values', () => {
    // 1. Dynamic credential handling
    const newPassSug = suggestParameterValue('newPassword', 'body');
    assert.strictEqual(newPassSug.value, '');
    assert.strictEqual(newPassSug.placeholder, '••••••••');
    assert.strictEqual(newPassSug.isSensitive, true);
    assert.strictEqual(newPassSug.type, 'string');

    const confirmPassSug = suggestParameterValue('confirmPassword', 'body');
    assert.strictEqual(confirmPassSug.value, '');
    assert.strictEqual(confirmPassSug.placeholder, '••••••••');
    assert.strictEqual(confirmPassSug.isSensitive, true);

    // 2. Dynamic custom body fields
    const customSug = suggestParameterValue('companyName', 'body');
    assert.strictEqual(customSug.value, '');
    assert.strictEqual(customSug.placeholder, 'companyName');
    assert.strictEqual(customSug.type, 'string');

    // 3. Dynamic JSON body generation preserves auto-named keys
    const routeSource = `
      router.post('/change-password', (req, res) => {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        res.json({ ok: true });
      });
    `;
    const route = createTestRoute({
      path: '/change-password',
      method: 'POST',
      filePath: '/workspace/routes/account.js',
      line: 2,
    });
    const fileSources = new Map<string, string>([[route.filePath, routeSource]]);
    const state = buildInitialStateForRoute(route, 'http://localhost:3000', fileSources);

    assert.strictEqual(state.bodyParams?.length, 3);
    const parsedBody = JSON.parse(state.body || '{}');
    assert.deepStrictEqual(parsedBody, {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
  });
});
