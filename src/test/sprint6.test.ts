import * as assert from 'assert';
import { ApiRoute } from '../models/route';
import { detectFrameworks } from '../frameworks/frameworkDetector';
import { defaultFrameworkRegistry } from '../frameworks/frameworkRegistry';
import { FastifyAdapter } from '../frameworks/fastify/fastifyAdapter';
import { NestjsAdapter } from '../frameworks/nestjs/nestjsAdapter';
import { parseFastifyRoutes } from '../frameworks/fastify/fastifyRouteParser';
import { parseNestjsRoutes } from '../frameworks/nestjs/nestjsRouteParser';
import { findDuplicateRoutes, findSharedPathGroups } from '../analysis/duplicateDetector';
import { calculateRouteStatistics, formatRouteStatistics } from '../analysis/routeStatistics';
import { analyzeMissingHandlers } from '../analysis/handlerAnalyzer';
import { createRouteQuickPickItem } from '../scanner/routeSearch';

suite('API Route Explorer — Sprint 6 Fastify & NestJS Suite', function () {
  this.timeout(10000);

  // =========================================================================
  // 1. FRAMEWORK DETECTION TESTS (Fastify & NestJS)
  // =========================================================================
  test('detectFrameworks detects Fastify from package.json dependency', () => {
    const pkg = JSON.stringify({ dependencies: { fastify: '^4.26.0' } });
    const result = detectFrameworks(['src/app.ts'], pkg);

    assert.strictEqual(result.hasFastify, true);
    assert.strictEqual(result.hasExpress, false);
    assert.ok(result.detectedFrameworks.includes('fastify'));
    assert.ok(result.evidence.fastify.length > 0);
  });

  test('detectFrameworks detects NestJS from package.json and controller file', () => {
    const pkg = JSON.stringify({ dependencies: { '@nestjs/core': '^10.0.0' } });
    const files = ['src/users/users.controller.ts', 'src/app.module.ts'];
    const result = detectFrameworks(files, pkg);

    assert.strictEqual(result.hasNestjs, true);
    assert.strictEqual(result.hasExpress, false);
    assert.ok(result.detectedFrameworks.includes('nestjs'));
    assert.ok(result.evidence.nestjs.length >= 2);
  });

  test('FrameworkRegistry registers all four adapters', () => {
    const adapters = defaultFrameworkRegistry.getAdapters();
    const frameworks = adapters.map((a) => a.framework);

    assert.strictEqual(adapters.length, 4);
    assert.ok(frameworks.includes('express'));
    assert.ok(frameworks.includes('nextjs'));
    assert.ok(frameworks.includes('fastify'));
    assert.ok(frameworks.includes('nestjs'));
  });

  // =========================================================================
  // 2. FASTIFY ROUTE PARSER TESTS
  // =========================================================================
  test('FastifyAdapter accurately claims Fastify source files', () => {
    const adapter = new FastifyAdapter();
    const sourceWithImport = 'import Fastify from "fastify"; const server = Fastify();';
    const sourceWithPlugin = 'async function routes(fastify, options) { fastify.get("/test", fn); }';
    const unrelatedSource = 'function add(a, b) { return a + b; }';

    assert.strictEqual(adapter.canHandle('/workspace/src/app.ts', sourceWithImport), true);
    assert.strictEqual(adapter.canHandle('/workspace/src/routes.js', sourceWithPlugin), true);
    assert.strictEqual(adapter.canHandle('/workspace/src/math.js', unrelatedSource), false);
  });

  test('parseFastifyRoutes detects standard HTTP methods with accurate positions', () => {
    const source = [
      '// Fastify server instance',
      'const fastify = require("fastify")();',
      '',
      'fastify.get("/users", async (req, reply) => {',
      '  return [];',
      '});',
      '',
      'fastify.post("/users", async (req, reply) => {',
      '  return { created: true };',
      '});',
      '',
      'fastify.put("/users/:id", (req, reply) => {});',
      'fastify.patch("/users/:id", (req, reply) => {});',
      'fastify.delete("/users/:id", (req, reply) => {});',
      'fastify.head("/health", (req, reply) => {});',
      'fastify.options("/health", (req, reply) => {});',
    ].join('\n');

    const routes = parseFastifyRoutes(source, '/workspace/src/app.js');
    assert.strictEqual(routes.length, 7);

    const methods = routes.map((r) => r.method);
    assert.deepStrictEqual(methods, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

    // Check line coordinates
    assert.strictEqual(routes[0].line, 3); // GET on line 4
    assert.strictEqual(routes[0].path, '/users');
    assert.strictEqual(routes[0].framework, 'fastify');

    assert.strictEqual(routes[1].line, 7); // POST on line 8
    assert.strictEqual(routes[1].path, '/users');

    assert.strictEqual(routes[2].line, 11); // PUT on line 12
    assert.strictEqual(routes[2].path, '/users/:id');
  });

  test('parseFastifyRoutes detects fastify.route() single and array methods', () => {
    const source = [
      'fastify.route({',
      '  method: "GET",',
      '  url: "/products",',
      '  handler: getProducts,',
      '});',
      '',
      'fastify.route({',
      '  method: ["PUT", "PATCH"],',
      '  url: "/products/:id",',
      '  handler: updateProduct,',
      '});',
    ].join('\n');

    const routes = parseFastifyRoutes(source, '/workspace/src/routes.js');
    assert.strictEqual(routes.length, 3);

    assert.strictEqual(routes[0].method, 'GET');
    assert.strictEqual(routes[0].path, '/products');

    assert.strictEqual(routes[1].method, 'PUT');
    assert.strictEqual(routes[1].path, '/products/:id');

    assert.strictEqual(routes[2].method, 'PATCH');
    assert.strictEqual(routes[2].path, '/products/:id');
  });

  test('FastifyAdapter postProcessRoutes resolves fastify.register prefix statically', () => {
    const adapter = new FastifyAdapter();

    const appSource = [
      'const fastify = require("fastify")();',
      'const userRoutes = require("./routes/users");',
      'fastify.register(userRoutes, { prefix: "/api/v1/users" });',
    ].join('\n');

    const userRoutes: ApiRoute[] = [
      {
        method: 'GET',
        path: '/:id',
        filePath: '/workspace/routes/users.js',
        line: 2,
        column: 0,
        framework: 'fastify',
      },
      {
        method: 'POST',
        path: '/',
        filePath: '/workspace/routes/users.js',
        line: 5,
        column: 0,
        framework: 'fastify',
      },
    ];

    const fileSources = new Map<string, string>([
      ['/workspace/app.js', appSource],
      ['/workspace/routes/users.js', 'fastify.get("/:id", fn); fastify.post("/", fn);'],
    ]);

    const resolved = adapter.postProcessRoutes(userRoutes, fileSources);
    assert.strictEqual(resolved.length, 2);
    assert.strictEqual(resolved[0].path, '/api/v1/users/:id');
    assert.strictEqual(resolved[1].path, '/api/v1/users');
  });

  test('Fastify missing handler analysis detects unhandled calls', () => {
    const suspiciousSource = 'fastify.get("/users");';
    const validSource = 'fastify.get("/users", async (req, reply) => {});';

    const warnings = analyzeMissingHandlers(suspiciousSource, '/workspace/app.js');
    assert.strictEqual(warnings.length, 1);
    assert.strictEqual(warnings[0].method, 'GET');
    assert.strictEqual(warnings[0].path, '/users');

    const cleanWarnings = analyzeMissingHandlers(validSource, '/workspace/app.js');
    assert.strictEqual(cleanWarnings.length, 0);
  });

  // =========================================================================
  // 3. NESTJS ROUTE PARSER TESTS
  // =========================================================================
  test('NestjsAdapter accurately claims NestJS controller files', () => {
    const adapter = new NestjsAdapter();
    const controllerSource = '@Controller("users") export class UsersController {}';
    const plainClass = 'export class MathService {}';

    assert.strictEqual(adapter.canHandle('/workspace/src/users.controller.ts', controllerSource), true);
    assert.strictEqual(adapter.canHandle('/workspace/src/math.service.ts', plainClass), false);
  });

  test('parseNestjsRoutes extracts controller prefix and method decorators with exact positions', () => {
    const source = [
      'import { Controller, Get, Post, Put, Patch, Delete, Param } from "@nestjs/common";',
      '',
      '@Controller("users")',
      'export class UsersController {',
      '  @Get()',
      '  findAll() { return []; }',
      '',
      '  @Get(":id")',
      '  findOne(@Param("id") id: string) { return {}; }',
      '',
      '  @Post()',
      '  create() { return {}; }',
      '',
      '  @Put(":id")',
      '  update() {}',
      '',
      '  @Patch(":id")',
      '  patch() {}',
      '',
      '  @Delete(":id")',
      '  remove() {}',
      '}',
    ].join('\n');

    const routes = parseNestjsRoutes(source, '/workspace/src/users.controller.ts');
    assert.strictEqual(routes.length, 6);

    // 1. GET /users
    assert.strictEqual(routes[0].method, 'GET');
    assert.strictEqual(routes[0].path, '/users');
    assert.strictEqual(routes[0].line, 4); // Line 5
    assert.strictEqual(routes[0].handlerName, 'findAll');
    assert.strictEqual(routes[0].framework, 'nestjs');

    // 2. GET /users/:id
    assert.strictEqual(routes[1].method, 'GET');
    assert.strictEqual(routes[1].path, '/users/:id');
    assert.strictEqual(routes[1].line, 7); // Line 8
    assert.strictEqual(routes[1].handlerName, 'findOne');

    // 3. POST /users
    assert.strictEqual(routes[2].method, 'POST');
    assert.strictEqual(routes[2].path, '/users');
    assert.strictEqual(routes[2].line, 10); // Line 11

    // 4. PUT /users/:id
    assert.strictEqual(routes[3].method, 'PUT');
    assert.strictEqual(routes[3].path, '/users/:id');

    // 5. PATCH /users/:id
    assert.strictEqual(routes[4].method, 'PATCH');
    assert.strictEqual(routes[4].path, '/users/:id');

    // 6. DELETE /users/:id
    assert.strictEqual(routes[5].method, 'DELETE');
    assert.strictEqual(routes[5].path, '/users/:id');
  });

  test('parseNestjsRoutes handles empty @Controller() and nested path decorators', () => {
    const source = [
      '@Controller()',
      'export class AppController {',
      '  @Get("/health")',
      '  getHealth() {}',
      '',
      '  @Get("api/v1/ping")',
      '  ping() {}',
      '}',
    ].join('\n');

    const routes = parseNestjsRoutes(source, '/workspace/src/app.controller.ts');
    assert.strictEqual(routes.length, 2);
    assert.strictEqual(routes[0].path, '/health');
    assert.strictEqual(routes[1].path, '/api/v1/ping');
  });

  test('parseNestjsRoutes avoids false positives on non-HTTP decorators', () => {
    const source = [
      '@Injectable()',
      'export class UsersService {',
      '  find() {}',
      '}',
      '',
      '@Module({ controllers: [] })',
      'export class AppModule {}',
    ].join('\n');

    const routes = parseNestjsRoutes(source, '/workspace/src/users.service.ts');
    assert.strictEqual(routes.length, 0);
  });

  // =========================================================================
  // 4. MULTI-FRAMEWORK DUPLICATE & ANALYSIS RULES
  // =========================================================================
  test('Rule 1: Same path + different method is a shared path, NOT duplicate', () => {
    const routes: ApiRoute[] = [
      {
        method: 'GET',
        path: '/api/users',
        filePath: '/src/app.ts',
        line: 5,
        column: 0,
        framework: 'fastify',
      },
      {
        method: 'POST',
        path: '/api/users',
        filePath: '/src/app.ts',
        line: 10,
        column: 0,
        framework: 'fastify',
      },
    ];

    const duplicates = findDuplicateRoutes(routes);
    const shared = findSharedPathGroups(routes);

    assert.strictEqual(duplicates.length, 0, 'Must NOT be a duplicate');
    assert.strictEqual(shared.length, 1, 'Must be classified as 1 shared path');
    assert.strictEqual(shared[0].methods.length, 2);
  });

  test('Rule 2: Same method + same path within same framework is a duplicate', () => {
    const routes: ApiRoute[] = [
      {
        method: 'GET',
        path: '/api/users',
        filePath: '/src/app1.ts',
        line: 5,
        column: 0,
        framework: 'fastify',
      },
      {
        method: 'GET',
        path: '/api/users',
        filePath: '/src/app2.ts',
        line: 12,
        column: 0,
        framework: 'fastify',
      },
    ];

    const duplicates = findDuplicateRoutes(routes);
    assert.strictEqual(duplicates.length, 1);
    assert.strictEqual(duplicates[0].routes.length, 2);
  });

  test('Rule 3: Framework isolation — identical paths in different frameworks are NOT duplicates', () => {
    const routes: ApiRoute[] = [
      {
        method: 'GET',
        path: '/api/users',
        filePath: '/express/server.js',
        line: 5,
        column: 0,
        framework: 'express',
      },
      {
        method: 'GET',
        path: '/api/users',
        filePath: '/fastify/app.ts',
        line: 8,
        column: 0,
        framework: 'fastify',
      },
      {
        method: 'GET',
        path: '/api/users',
        filePath: '/nestjs/users.controller.ts',
        line: 10,
        column: 0,
        framework: 'nestjs',
      },
    ];

    const duplicates = findDuplicateRoutes(routes);
    assert.strictEqual(duplicates.length, 0, 'Different frameworks must not conflict');
  });

  test('Parameter normalization flags parameter name differences as duplicates within framework', () => {
    const routes: ApiRoute[] = [
      {
        method: 'GET',
        path: '/users/:id',
        filePath: '/nestjs/controller1.ts',
        line: 5,
        column: 0,
        framework: 'nestjs',
      },
      {
        method: 'GET',
        path: '/users/:userId',
        filePath: '/nestjs/controller2.ts',
        line: 8,
        column: 0,
        framework: 'nestjs',
      },
    ];

    const duplicates = findDuplicateRoutes(routes);
    assert.strictEqual(duplicates.length, 1);
  });

  // =========================================================================
  // 5. FOUR-FRAMEWORK STATISTICS & SEARCH INTEGRATION
  // =========================================================================
  test('calculateRouteStatistics reports breakdown across all 4 frameworks', () => {
    const routes: ApiRoute[] = [
      { method: 'GET', path: '/exp', filePath: '/a.js', line: 1, column: 0, framework: 'express' },
      { method: 'POST', path: '/next', filePath: '/b.ts', line: 1, column: 0, framework: 'nextjs' },
      { method: 'PUT', path: '/fast', filePath: '/c.ts', line: 1, column: 0, framework: 'fastify' },
      { method: 'DELETE', path: '/nest', filePath: '/d.ts', line: 1, column: 0, framework: 'nestjs' },
    ];

    const stats = calculateRouteStatistics(routes);
    assert.strictEqual(stats.totalRoutes, 4);
    assert.strictEqual(stats.totalFiles, 4);

    const summary = formatRouteStatistics(stats);
    assert.ok(summary.includes('Express'));
    assert.ok(summary.includes('Next.js'));
    assert.ok(summary.includes('Fastify'));
    assert.ok(summary.includes('NestJS'));
  });

  test('createRouteQuickPickItem displays Fastify and NestJS in detail', () => {
    const fastifyItem = createRouteQuickPickItem({
      method: 'GET',
      path: '/fast',
      filePath: '/server.ts',
      line: 5,
      column: 0,
      framework: 'fastify',
    });
    assert.ok(fastifyItem.detail!.includes('Fastify'));

    const nestItem = createRouteQuickPickItem({
      method: 'POST',
      path: '/nest',
      filePath: '/controller.ts',
      line: 12,
      column: 0,
      framework: 'nestjs',
    });
    assert.ok(nestItem.detail!.includes('NestJS'));
  });
});
