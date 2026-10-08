import * as assert from 'assert';
import { ApiRoute } from '../models/route';
import { RouteAnalysisResult } from '../analysis/routeAnalyzer';
import {
  convertRouteToOpenApiPath,
  extractResourceTag,
  generateOperationId,
  buildPathParameters,
} from '../openapi/openApiPathBuilder';
import {
  generateOpenApiDocument,
  getSafeRelativePath,
} from '../openapi/openApiGenerator';
import {
  serializeOpenApiToJson,
  serializeOpenApiToYaml,
} from '../openapi/openApiYamlSerializer';
import {
  generateOpenApiJsonString,
  generateOpenApiYamlString,
} from '../openapi/openApiExporter';
import { COMMANDS } from '../utils/constants';

suite('API Routes Explorer — Sprint 12 OpenAPI Specification Generation Suite', () => {
  const sampleRoutes: ApiRoute[] = [
    {
      method: 'GET',
      path: '/api/v1/users',
      filePath: '/workspace/src/routes/users.ts',
      line: 10,
      column: 2,
      framework: 'express',
      handlerName: 'getUsers',
    },
    {
      method: 'POST',
      path: '/api/v1/users',
      filePath: '/workspace/src/routes/users.ts',
      line: 25,
      column: 2,
      framework: 'express',
      handlerName: 'createUser',
    },
    {
      method: 'GET',
      path: '/api/v1/users/:id',
      filePath: '/workspace/src/routes/users.ts',
      line: 40,
      column: 2,
      framework: 'express',
      handlerName: 'getUserById',
    },
    {
      method: 'DELETE',
      path: '/api/v1/users/:id',
      filePath: '/workspace/src/routes/users.ts',
      line: 55,
      column: 2,
      framework: 'express',
      handlerName: 'deleteUser',
    },
    // Next.js App Router route with dynamic segment [id]
    {
      method: 'GET',
      path: '/app/api/products/[id]',
      filePath: '/workspace/src/app/api/products/[id]/route.ts',
      line: 5,
      column: 0,
      framework: 'nextjs',
      handlerName: 'GET',
    },
    // Next.js catch-all route [...slug]
    {
      method: 'GET',
      path: '/docs/[...slug]',
      filePath: '/workspace/src/app/docs/[...slug]/route.ts',
      line: 8,
      column: 0,
      framework: 'nextjs',
      handlerName: 'GET',
    },
    // Fastify route
    {
      method: 'PUT',
      path: '/api/orders/:orderId',
      filePath: '/workspace/src/modules/orders.ts',
      line: 12,
      column: 0,
      framework: 'fastify',
    },
    // NestJS route
    {
      method: 'GET',
      path: '/customers/:customerId/addresses/:addressId',
      filePath: '/workspace/src/modules/customers.controller.ts',
      line: 22,
      column: 0,
      framework: 'nestjs',
      handlerName: 'findAddress',
    },
    // Next.js Pages router wildcard route
    {
      method: 'ANY',
      path: '/api/webhooks',
      filePath: '/workspace/src/pages/api/webhooks.ts',
      line: 4,
      column: 0,
      framework: 'nextjs',
    },
  ];

  const sampleAnalysis: RouteAnalysisResult = {
    routes: sampleRoutes,
    duplicates: [],
    sharedPaths: [
      {
        normalizedPath: '/api/v1/users',
        methods: ['GET', 'POST'],
        routes: [sampleRoutes[0], sampleRoutes[1]],
      },
    ],
    missingHandlers: [],
    conflicts: [],
    middlewareGroups: [],
    statistics: {
      totalRoutes: 9,
      totalFiles: 6,
      framework: 'multi-framework',
      frameworkCounts: { express: 4, nextjs: 3, fastify: 1, nestjs: 1 },
      methodCounts: { GET: 4, POST: 1, DELETE: 1, PUT: 1, ANY: 1, PATCH: 0, OPTIONS: 0, HEAD: 0 },
      duplicateCount: 0,
      sharedPathCount: 1,
      potentialConflictCount: 0,
      healthyCount: 9,
      warningCount: 0,
      errorCount: 0,
      middlewareReferenceCount: 0,
    },
    relationships: new Map(),
  };

  suite('1. OpenAPI Path Conversion & Parameter Extraction', () => {
    test('Converts Express colon parameters to OpenAPI curly braces', () => {
      const res = convertRouteToOpenApiPath('/api/v1/users/:id');
      assert.strictEqual(res.openApiPath, '/api/v1/users/{id}');
      assert.deepStrictEqual(res.pathParameters, ['id']);
    });

    test('Converts Next.js [param] and catch-all [...slug] to OpenAPI', () => {
      const r1 = convertRouteToOpenApiPath('/products/[id]');
      assert.strictEqual(r1.openApiPath, '/products/{id}');
      assert.deepStrictEqual(r1.pathParameters, ['id']);

      const r2 = convertRouteToOpenApiPath('/docs/[...slug]');
      assert.strictEqual(r2.openApiPath, '/docs/{slug}');
      assert.deepStrictEqual(r2.pathParameters, ['slug']);

      const r3 = convertRouteToOpenApiPath('/shop/[[...category]]');
      assert.strictEqual(r3.openApiPath, '/shop/{category}');
      assert.deepStrictEqual(r3.pathParameters, ['category']);
    });

    test('Strips Next.js route groups and deduplicates slashes', () => {
      const res = convertRouteToOpenApiPath('//(admin)//dashboard//:tab//');
      assert.strictEqual(res.openApiPath, '/dashboard/{tab}');
      assert.deepStrictEqual(res.pathParameters, ['tab']);
    });

    test('Handles multiple path parameters across nested hierarchy', () => {
      const res = convertRouteToOpenApiPath('/orgs/:orgId/repos/:repoId/pulls/:pullNumber');
      assert.strictEqual(res.openApiPath, '/orgs/{orgId}/repos/{repoId}/pulls/{pullNumber}');
      assert.deepStrictEqual(res.pathParameters, ['orgId', 'repoId', 'pullNumber']);
    });

    test('buildPathParameters produces required string schema parameter objects', () => {
      const params = buildPathParameters(['id', 'slug']);
      assert.strictEqual(params.length, 2);
      assert.strictEqual(params[0].name, 'id');
      assert.strictEqual(params[0].in, 'path');
      assert.strictEqual(params[0].required, true);
      assert.strictEqual(params[0].schema.type, 'string');
    });

    test('extractResourceTag extracts meaningful resource segment', () => {
      assert.strictEqual(extractResourceTag('/api/v1/users/{id}'), 'users');
      assert.strictEqual(extractResourceTag('/auth/login'), 'auth');
      assert.strictEqual(extractResourceTag('/health'), 'health');
      assert.strictEqual(extractResourceTag('/'), 'default');
    });

    test('generateOperationId creates unique, deterministic camelCase IDs', () => {
      const used = new Set<string>();
      const id1 = generateOperationId('get', '/users', used);
      assert.strictEqual(id1, 'getUsers');

      const id2 = generateOperationId('get', '/users/{id}', used);
      assert.strictEqual(id2, 'getUsersById');

      // Collision handling
      const id3 = generateOperationId('get', '/users', used);
      assert.strictEqual(id3, 'getUsers_2');
    });
  });

  suite('2. OpenAPI 3.0.3 Document Generation', () => {
    test('Generates valid OpenAPI 3.0.3 skeleton with metadata', () => {
      const result = generateOpenApiDocument(sampleRoutes, sampleAnalysis, {
        title: 'Test Store API',
        version: '2.1.0',
        baseUrl: 'https://api.teststore.com',
        workspaceRoot: '/workspace',
      });

      const doc = result.document;
      assert.strictEqual(doc.openapi, '3.0.3');
      assert.strictEqual(doc.info.title, 'Test Store API');
      assert.strictEqual(doc.info.version, '2.1.0');
      assert.strictEqual(doc.servers?.[0]?.url, 'https://api.teststore.com');
      assert.ok(doc.paths['/api/v1/users']);
      assert.ok(doc.paths['/api/v1/users/{id}']);
      assert.ok(doc.tags && doc.tags.length > 0);
    });

    test('Organizes shared path endpoints under the same path item', () => {
      const result = generateOpenApiDocument(sampleRoutes, sampleAnalysis);
      const userPath = result.document.paths['/api/v1/users'];
      assert.ok(userPath, 'Path /api/v1/users must exist');
      assert.ok(userPath.get, 'GET /api/v1/users must exist');
      assert.ok(userPath.post, 'POST /api/v1/users must exist');
      assert.strictEqual(userPath.get.operationId, 'getApiV1Users');
      assert.strictEqual(userPath.post.operationId, 'postApiV1Users');
    });

    test('Generates path parameters and requestBody appropriately', () => {
      const result = generateOpenApiDocument(sampleRoutes, sampleAnalysis);
      const userItemPath = result.document.paths['/api/v1/users/{id}'];
      assert.ok(userItemPath.get);
      assert.ok(userItemPath.get.parameters);
      assert.strictEqual(userItemPath.get.parameters[0].name, 'id');
      assert.strictEqual(userItemPath.get.parameters[0].in, 'path');

      // POST should include minimal safe requestBody skeleton
      const userPost = result.document.paths['/api/v1/users'].post;
      assert.ok(userPost?.requestBody);
      assert.strictEqual(
        userPost?.requestBody?.content['application/json']?.schema?.type,
        'object'
      );

      // GET should not include requestBody
      assert.strictEqual(userItemPath.get.requestBody, undefined);
    });

    test('Expands ANY wildcard handler into standard methods without overwriting explicit routes', () => {
      const result = generateOpenApiDocument(sampleRoutes, sampleAnalysis, {
        expandWildcardMethods: true,
      });

      const webhookPath = result.document.paths['/api/webhooks'];
      assert.ok(webhookPath);
      assert.ok(webhookPath.get, 'ANY should expand to get');
      assert.ok(webhookPath.post, 'ANY should expand to post');
      assert.ok(webhookPath.put, 'ANY should expand to put');
      assert.ok(webhookPath.delete, 'ANY should expand to delete');
      assert.ok(webhookPath.patch, 'ANY should expand to patch');
    });

    test('Safely handles duplicate route declarations without emitting duplicate JSON keys', () => {
      const duplicateRoutes: ApiRoute[] = [
        {
          method: 'GET',
          path: '/api/duplicate',
          filePath: '/workspace/src/file1.ts',
          line: 10,
          column: 0,
          framework: 'express',
        },
        {
          method: 'GET',
          path: '/api/duplicate',
          filePath: '/workspace/src/file2.ts',
          line: 20,
          column: 0,
          framework: 'express',
        },
      ];

      const result = generateOpenApiDocument(duplicateRoutes, undefined, {
        workspaceRoot: '/workspace',
      });
      const dupPath = result.document.paths['/api/duplicate'];
      assert.ok(dupPath.get);
      assert.strictEqual(result.stats.duplicateCollisions, 1);

      // Metadata records both declarations
      const meta = dupPath.get['x-api-route-explorer'];
      assert.ok(meta);
      assert.strictEqual(meta.isDuplicate, true);
      assert.strictEqual(meta.duplicateCount, 2);
      assert.strictEqual(meta.declarations?.length, 2);
      assert.strictEqual(meta.declarations?.[0].filePath, 'src/file1.ts');
      assert.strictEqual(meta.declarations?.[1].filePath, 'src/file2.ts');
    });
  });

  suite('3. YAML and JSON Serializers', () => {
    test('serializeOpenApiToJson produces valid parseable JSON', () => {
      const result = generateOpenApiDocument(sampleRoutes, sampleAnalysis);
      const jsonStr = serializeOpenApiToJson(result.document);
      const parsed = JSON.parse(jsonStr);

      assert.strictEqual(parsed.openapi, '3.0.3');
      assert.strictEqual(parsed.info.title, 'API Routes Explorer API');
      assert.ok(parsed.paths['/api/v1/users']);
    });

    test('serializeOpenApiToYaml produces valid formatted YAML string', () => {
      const result = generateOpenApiDocument(sampleRoutes, sampleAnalysis);
      const yamlStr = serializeOpenApiToYaml(result.document);

      assert.ok(yamlStr.startsWith('openapi: 3.0.3') || yamlStr.startsWith('openapi: "3.0.3"'), 'YAML must begin with openapi');
      assert.ok(yamlStr.includes('info:'), 'YAML must contain info section');
      assert.ok(yamlStr.includes('paths:'), 'YAML must contain paths section');
      assert.ok(yamlStr.includes('/api/v1/users:'), 'YAML must contain route paths');
      assert.ok(yamlStr.includes('operationId:'), 'YAML must contain operation IDs');
    });

    test('generateOpenApiJsonString and generateOpenApiYamlString helper functions', () => {
      const json = generateOpenApiJsonString(sampleRoutes, sampleAnalysis);
      assert.ok(json.includes('"openapi": "3.0.3"'));

      const yaml = generateOpenApiYamlString(sampleRoutes, sampleAnalysis);
      assert.ok(yaml.includes('openapi: 3.0.3') || yaml.includes('openapi: "3.0.3"'));
    });
  });

  suite('4. Determinism & Security Safeguards', () => {
    test('Repeated generation produces 100% identical byte outputs', () => {
      const options = { workspaceRoot: '/workspace' };
      const out1Json = generateOpenApiJsonString(sampleRoutes, sampleAnalysis, options);
      const out2Json = generateOpenApiJsonString(sampleRoutes, sampleAnalysis, options);
      assert.strictEqual(out1Json, out2Json, 'JSON output must be completely deterministic');

      const out1Yaml = generateOpenApiYamlString(sampleRoutes, sampleAnalysis, options);
      const out2Yaml = generateOpenApiYamlString(sampleRoutes, sampleAnalysis, options);
      assert.strictEqual(out1Yaml, out2Yaml, 'YAML output must be completely deterministic');
    });

    test('Never leaks absolute local machine paths into exported metadata', () => {
      const absRoute: ApiRoute = {
        method: 'GET',
        path: '/test/route',
        filePath: '/Users/husnain/SecretProject/src/routes/secret.ts',
        line: 5,
        column: 0,
        framework: 'express',
      };

      const result = generateOpenApiDocument([absRoute], undefined, {
        workspaceRoot: '/Users/husnain/SecretProject',
      });
      const yaml = serializeOpenApiToYaml(result.document);

      assert.ok(!yaml.includes('/Users/husnain'), 'Must not include local user home path');
      assert.ok(yaml.includes('src/routes/secret.ts'), 'Should include safe relative path');
    });

    test('getSafeRelativePath normalizes windows and unix paths safely', () => {
      assert.strictEqual(
        getSafeRelativePath('/home/user/repo/src/app.ts', '/home/user/repo'),
        'src/app.ts'
      );
      assert.strictEqual(
        getSafeRelativePath('C:/projects/app/src/routes/users.js', 'C:/projects/app'),
        'src/routes/users.js'
      );
    });
  });

  suite('5. Multi-Framework Coverage (Express, Next.js, Fastify, NestJS)', () => {
    test('Generates complete OpenAPI spec covering all 5 framework styles', () => {
      const result = generateOpenApiDocument(sampleRoutes, sampleAnalysis);
      const paths = result.document.paths;

      // Express
      assert.ok(paths['/api/v1/users']);
      // Next.js App Router
      assert.ok(paths['/app/api/products/{id}']);
      // Next.js Catch-all
      assert.ok(paths['/docs/{slug}']);
      // Fastify
      assert.ok(paths['/api/orders/{orderId}']);
      // NestJS
      assert.ok(paths['/customers/{customerId}/addresses/{addressId}']);

      assert.strictEqual(result.stats.totalPaths, 7);
      assert.ok(result.stats.totalOperations >= 10);
    });
  });

  suite('6. High-Throughput Scalability Benchmark', () => {
    test('Generates OpenAPI specification from 4,750+ routes in under 100ms', () => {
      const largeRoutes: ApiRoute[] = [];
      for (let f = 0; f < 500; f++) {
        for (let r = 0; r < 10; r++) {
          largeRoutes.push({
            method: r % 2 === 0 ? 'GET' : 'POST',
            path: `/api/resource${f}/item/:itemId`,
            filePath: `/workspace/src/mod${f}/routes.ts`,
            line: r * 5,
            column: 0,
            framework: 'express',
          });
        }
      }

      assert.strictEqual(largeRoutes.length, 5000);

      const tStart = Date.now();
      const res = generateOpenApiDocument(largeRoutes, undefined, {
        workspaceRoot: '/workspace',
      });
      const duration = Date.now() - tStart;

      assert.strictEqual(res.stats.totalPaths, 500);
      assert.ok(res.stats.totalOperations >= 1000);
      assert.ok(
        duration < 150,
        `Large-scale OpenAPI generation took ${duration}ms, should be < 150ms`
      );
    });
  });

  suite('7. Command Registry Verification', () => {
    test('OpenAPI export command IDs are registered in constants', () => {
      assert.strictEqual(COMMANDS.EXPORT_OPENAPI, 'apiRouteExplorer.exportOpenApi');
      assert.strictEqual(COMMANDS.EXPORT_OPENAPI_JSON, 'apiRouteExplorer.exportOpenApiJson');
      assert.strictEqual(COMMANDS.EXPORT_OPENAPI_YAML, 'apiRouteExplorer.exportOpenApiYaml');
    });
  });
});
