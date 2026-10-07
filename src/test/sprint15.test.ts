import * as assert from 'assert';
import { ApiRoute } from '../models/route';
import { buildInitialStateForRoute } from '../httpClient/httpClientProvider';
import { isWebviewToHostMessage } from '../httpClient/httpClientMessages';
import { generateOpenApiDocument } from '../openapi/openApiGenerator';
import { serializeOpenApiToYaml, serializeOpenApiToJson } from '../openapi/openApiYamlSerializer';
import { COMMANDS, MESSAGES } from '../utils/constants';
import { analyzeWorkspaceRoutes } from '../analysis/routeAnalyzer';

suite('API Route Explorer — Sprint 15 MVP Integration & UX Suite', () => {
  const sampleExpressRoute: ApiRoute = {
    method: 'GET',
    path: '/api/v1/users/:id',
    filePath: '/workspace/src/routes/user.routes.ts',
    line: 41,
    column: 5,
    framework: 'express',
    handlerName: 'getUserById',
  };

  const sampleNestRoute: ApiRoute = {
    method: 'POST',
    path: '/api/v1/orders',
    filePath: '/workspace/src/orders/orders.controller.ts',
    line: 25,
    column: 3,
    framework: 'nestjs',
    handlerName: 'createOrder',
  };

  const sampleFastifyRoute: ApiRoute = {
    method: 'DELETE',
    path: '/api/v1/items/:itemId',
    filePath: '/workspace/src/items/item.routes.js',
    line: 80,
    column: 2,
    framework: 'fastify',
  };

  const sampleNextAppRoute: ApiRoute = {
    method: 'PATCH',
    path: '/api/products/:sku',
    filePath: '/workspace/src/app/api/products/[sku]/route.ts',
    line: 12,
    column: 0,
    framework: 'nextjs',
  };

  test('TASK 1 & 4: buildInitialStateForRoute preserves routeContext with source location', () => {
    const state = buildInitialStateForRoute(sampleExpressRoute, 'http://localhost:5000');

    assert.strictEqual(state.method, 'GET');
    assert.strictEqual(state.routePath, '/api/v1/users/:id');
    assert.strictEqual(state.openApiPath, '/api/v1/users/{id}');
    assert.strictEqual(state.framework, 'express');
    assert.strictEqual(state.baseUrl, 'http://localhost:5000');
    assert.strictEqual(state.fullUrl, 'http://localhost:5000/api/v1/users/{id}');

    // Task 4: Preserves HttpClientRouteContext
    assert.ok(state.routeContext, 'Expected routeContext to be populated');
    assert.strictEqual(state.routeContext.method, 'GET');
    assert.strictEqual(state.routeContext.path, '/api/v1/users/:id');
    assert.ok(state.routeContext.sourceFile?.includes('user.routes.ts'));
    assert.strictEqual(state.routeContext.sourceLine, 42); // 1-indexed
    assert.strictEqual(state.routeContext.sourceColumn, 6);
    assert.strictEqual(state.routeContext.framework, 'express');
    assert.strictEqual(state.routeContext.handlerName, 'getUserById');
  });

  test('TASK 2: WebviewToHostMessage validates openSource message safely', () => {
    // Valid openSource message
    const validMsg = {
      type: 'openSource',
      payload: {
        filePath: 'src/routes/user.routes.ts',
        line: 42,
      },
    };
    assert.strictEqual(isWebviewToHostMessage(validMsg), true);

    // Valid without line
    const validWithoutLine = {
      type: 'openSource',
      payload: {
        filePath: 'src/routes/user.routes.ts',
      },
    };
    assert.strictEqual(isWebviewToHostMessage(validWithoutLine), true);

    // Invalid messages
    assert.strictEqual(isWebviewToHostMessage(null), false);
    assert.strictEqual(isWebviewToHostMessage(undefined), false);
    assert.strictEqual(isWebviewToHostMessage({ type: 'openSource' }), false);
    assert.strictEqual(
      isWebviewToHostMessage({ type: 'openSource', payload: { filePath: 123 } }),
      false
    );
    assert.strictEqual(
      isWebviewToHostMessage({
        type: 'openSource',
        payload: { filePath: 'test.ts', line: 'invalid' },
      }),
      false
    );
  });

  test('TASK 3: Unified Action Triad commands are defined and consistent', () => {
    assert.strictEqual(COMMANDS.ANALYZE_ROUTE, 'apiRouteExplorer.analyzeRoute');
    assert.strictEqual(COMMANDS.OPEN_HTTP_CLIENT, 'apiRouteExplorer.openHttpClient');
    assert.strictEqual(COMMANDS.VIEW_ROUTE_OPENAPI, 'apiRouteExplorer.viewRouteOpenApi');
  });

  test('TASK 5: OpenAPI single route integration produces valid, deterministic YAML and JSON', () => {
    const singleSpecResult = generateOpenApiDocument([sampleExpressRoute], undefined, {
      title: 'User API Endpoint',
      version: '1.0.0',
    });

    assert.strictEqual(singleSpecResult.document.openapi, '3.0.3');
    assert.strictEqual(singleSpecResult.stats.totalOperations, 1);
    assert.ok(singleSpecResult.document.paths['/api/v1/users/{id}']);

    const pathItem = singleSpecResult.document.paths['/api/v1/users/{id}'];
    assert.ok(pathItem.get);
    assert.strictEqual(pathItem.get.operationId, 'getApiV1UsersById');
    assert.strictEqual(pathItem.get.parameters?.length, 1);
    assert.strictEqual(pathItem.get.parameters?.[0].name, 'id');
    assert.strictEqual(pathItem.get.parameters?.[0].in, 'path');

    // Serialization to YAML
    const yaml = serializeOpenApiToYaml(singleSpecResult.document);
    assert.ok(yaml.includes('openapi: 3.0.3'));
    assert.ok(yaml.includes('/api/v1/users/{id}'));
    assert.ok(yaml.includes('operationId: getApiV1UsersById'));

    // Serialization to JSON
    const json = serializeOpenApiToJson(singleSpecResult.document);
    const parsed = JSON.parse(json);
    assert.strictEqual(parsed.openapi, '3.0.3');
    assert.ok(parsed.paths['/api/v1/users/{id}']);
  });

  test('TASK 7 & 8: Empty and Error states provide actionable guidance', () => {
    assert.ok(
      MESSAGES.NO_ROUTES_TITLE.includes('No routes discovered yet'),
      'Expected actionable title'
    );
    assert.ok(
      MESSAGES.NO_ROUTES_EMPTY_DESCRIPTION.includes('No API routes discovered in workspace.'),
      'Expected guidance on how to resolve empty routes'
    );
    assert.ok(
      MESSAGES.SCAN_FAILED_TITLE.includes('Route scanning failed'),
      'Expected informative error title'
    );
  });

  test('TASK 9: First-Run experience message is defined and welcoming', () => {
    assert.ok(
      MESSAGES.FIRST_RUN_WELCOME.includes('Discover your API routes'),
      'First-run message must describe core value proposition'
    );
    assert.ok(
      MESSAGES.FIRST_RUN_WELCOME.includes('Test endpoints'),
      'First-run message must mention HTTP Client testing'
    );
    assert.ok(
      MESSAGES.FIRST_RUN_WELCOME.includes('Generate OpenAPI documentation'),
      'First-run message must mention OpenAPI'
    );
  });

  test('TASK 14: All 5 supported frameworks maintain Route -> HTTP Client -> OpenAPI integration', () => {
    const routes: ApiRoute[] = [
      sampleExpressRoute,
      sampleNestRoute,
      sampleFastifyRoute,
      sampleNextAppRoute,
      {
        method: 'GET',
        path: '/api/legacy/report',
        filePath: '/workspace/pages/api/legacy/report.ts',
        line: 8,
        column: 0,
        framework: 'nextjs',
      },
    ];

    // 1. Route Analysis
    const analysis = analyzeWorkspaceRoutes(routes, new Map());
    assert.strictEqual(analysis.routes.length, 5);

    // 2. HTTP Client state construction for each
    for (const r of routes) {
      const state = buildInitialStateForRoute(r, 'http://localhost:3000');
      assert.strictEqual(state.method, r.method);
      assert.ok(state.fullUrl.startsWith('http://localhost:3000'));
      assert.ok(state.routeContext, 'Each route should preserve routeContext');
      assert.strictEqual(state.routeContext.method, r.method);
    }

    // 3. OpenAPI Generation for full set
    const openApiResult = generateOpenApiDocument(routes, analysis);
    assert.strictEqual(openApiResult.stats.totalOperations, 5);
    const yaml = serializeOpenApiToYaml(openApiResult.document);
    assert.ok(yaml.length > 0);
  });
});
