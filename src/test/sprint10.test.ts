import * as assert from 'assert';
import * as vscode from 'vscode';
import { ApiRoute } from '../models/route';
import {
  RouteTreeProvider,
  RouteFileGroupItem,
  RouteFrameworkGroupItem,
  RouteMethodGroupItem,
  RouteHealthGroupItem,
  RouteTreeItem,
} from '../providers/routeTreeProvider';
import { RouteAnalysisResult } from '../analysis/routeAnalyzer';
import {
  createRouteQuickPickItem,
  findSimilarRoutes,
} from '../scanner/routeSearch';
import {
  exportRoutesToJson,
  exportRoutesToMarkdown,
} from '../utils/routeExporter';
import {
  getScanExcludePattern,
  BASE_EXCLUDE_SEGMENTS,
} from '../scanner/routeScanner';
import { getRouteKey } from '../analysis/routeRelationshipAnalyzer';
import { COMMANDS } from '../utils/constants';

suite('API Route Explorer — Sprint 10 Developer Experience Suite', () => {
  const sampleRoutes: ApiRoute[] = [
    {
      method: 'GET',
      path: '/api/users',
      filePath: '/workspace/src/routes/users.ts',
      line: 10,
      column: 2,
      framework: 'express',
      handlerName: 'getUsers',
    },
    {
      method: 'POST',
      path: '/api/users',
      filePath: '/workspace/src/routes/users.ts',
      line: 25,
      column: 2,
      framework: 'express',
      handlerName: 'createUser',
    },
    {
      method: 'GET',
      path: '/api/users/:id',
      filePath: '/workspace/src/routes/users.ts',
      line: 40,
      column: 2,
      framework: 'express',
      handlerName: 'getUserById',
    },
    {
      method: 'GET',
      path: '/api/products',
      filePath: '/workspace/src/modules/products.controller.ts',
      line: 15,
      column: 0,
      framework: 'nestjs',
      handlerName: 'findAll',
    },
    {
      method: 'DELETE',
      path: '/api/products/:id',
      filePath: '/workspace/src/modules/products.controller.ts',
      line: 30,
      column: 0,
      framework: 'nestjs',
      handlerName: 'remove',
    },
    {
      method: 'GET',
      path: '/api/health',
      filePath: '/workspace/src/server.ts',
      line: 5,
      column: 0,
      framework: 'fastify',
    },
  ];

  const sampleAnalysis: RouteAnalysisResult = {
    routes: sampleRoutes,
    duplicates: [],
    sharedPaths: [
      {
        normalizedPath: '/api/users',
        methods: ['GET', 'POST'],
        routes: [sampleRoutes[0], sampleRoutes[1]],
      },
    ],
    missingHandlers: [],
    conflicts: [],
    middlewareGroups: [],
    statistics: {
      totalRoutes: 6,
      totalFiles: 3,
      methodCounts: { GET: 4, POST: 1, DELETE: 1, PUT: 0, PATCH: 0, OPTIONS: 0, HEAD: 0, ANY: 0 },
      duplicateCount: 0,
      sharedPathCount: 1,
      framework: 'multi-framework',
      frameworkCounts: { express: 3, nestjs: 2, fastify: 1 },
      healthyCount: 5,
      warningCount: 1,
      errorCount: 0,
      potentialConflictCount: 0,
      middlewareReferenceCount: 1,
    },
    relationships: new Map([
      [
        getRouteKey(sampleRoutes[0]),
        {
          route: sampleRoutes[0],
          health: 'healthy',
          issues: [],
          middleware: [{ name: 'authGuard', type: 'guard' }],
          conflicts: [],
          duplicates: [],
        },
      ],
      [
        getRouteKey(sampleRoutes[2]),
        {
          route: sampleRoutes[2],
          health: 'warning',
          issues: [
            {
              type: 'suspicious-route',
              severity: 'warning',
              message: 'Parameter naming overlap with parent resource',
              route: sampleRoutes[2],
            },
          ],
          middleware: [],
          conflicts: [],
          duplicates: [],
        },
      ],
    ]),
  };

  suite('1. Multi-Dimensional Route Grouping Modes', () => {
    test('Default file grouping generates RouteFileGroupItem elements', async () => {
      const provider = new RouteTreeProvider();
      provider.setRoutes(sampleRoutes, sampleAnalysis);
      assert.strictEqual(provider.getGroupingMode(), 'file');

      const roots = await provider.getChildren();
      assert.strictEqual(roots.length, 3, 'Should group into 3 file groups');
      assert.ok(roots[0] instanceof RouteFileGroupItem);

      // Verify children under file group
      const children = await provider.getChildren(roots[0]);
      assert.ok(children.length > 0);
      assert.ok(children[0] instanceof RouteTreeItem);
    });

    test('Framework grouping organizes routes by Express, Next.js, Fastify, NestJS', async () => {
      const provider = new RouteTreeProvider();
      provider.setRoutes(sampleRoutes, sampleAnalysis);
      provider.setGroupingMode('framework');
      assert.strictEqual(provider.getGroupingMode(), 'framework');

      const roots = await provider.getChildren();
      assert.strictEqual(roots.length, 3, 'Should produce Express, NestJS, and Fastify groups');
      assert.ok(roots.every((r) => r instanceof RouteFrameworkGroupItem));

      const expressGroup = roots.find(
        (r) => r instanceof RouteFrameworkGroupItem && r.framework === 'express'
      ) as RouteFrameworkGroupItem;
      assert.ok(expressGroup);
      assert.strictEqual(expressGroup.routes.length, 3);

      const nestGroup = roots.find(
        (r) => r instanceof RouteFrameworkGroupItem && r.framework === 'nestjs'
      ) as RouteFrameworkGroupItem;
      assert.ok(nestGroup);
      assert.strictEqual(nestGroup.routes.length, 2);

      // Inspect children under framework group
      const nestChildren = (await provider.getChildren(nestGroup)) as RouteTreeItem[];
      assert.strictEqual(nestChildren.length, 2);
      assert.ok(nestChildren[0].description?.toString().includes('products.controller.ts'));
    });

    test('HTTP Method grouping organizes routes by GET, POST, DELETE', async () => {
      const provider = new RouteTreeProvider();
      provider.setRoutes(sampleRoutes, sampleAnalysis);
      provider.setGroupingMode('method');
      assert.strictEqual(provider.getGroupingMode(), 'method');

      const roots = await provider.getChildren();
      assert.strictEqual(roots.length, 3, 'Should produce GET, POST, DELETE method groups');
      assert.ok(roots.every((r) => r instanceof RouteMethodGroupItem));

      const getGroup = roots.find(
        (r) => r instanceof RouteMethodGroupItem && r.method === 'GET'
      ) as RouteMethodGroupItem;
      assert.ok(getGroup);
      assert.strictEqual(getGroup.routes.length, 4);

      const postGroup = roots.find(
        (r) => r instanceof RouteMethodGroupItem && r.method === 'POST'
      ) as RouteMethodGroupItem;
      assert.ok(postGroup);
      assert.strictEqual(postGroup.routes.length, 1);
    });

    test('Health grouping organizes routes by Healthy and Warnings', async () => {
      const provider = new RouteTreeProvider();
      provider.setRoutes(sampleRoutes, sampleAnalysis);
      provider.setGroupingMode('health');
      assert.strictEqual(provider.getGroupingMode(), 'health');

      const roots = await provider.getChildren();
      assert.ok(roots.length >= 2, 'Should group by healthy and warning');
      assert.ok(roots.every((r) => r instanceof RouteHealthGroupItem));

      const warningGroup = roots.find(
        (r) => r instanceof RouteHealthGroupItem && r.health === 'warning'
      ) as RouteHealthGroupItem;
      assert.ok(warningGroup);
      assert.strictEqual(warningGroup.routes.length, 1);
      assert.strictEqual(warningGroup.routes[0].path, '/api/users/:id');
    });

    test('Switching grouping mode does not reset route data and preserves fast in-memory switching', async () => {
      const provider = new RouteTreeProvider();
      provider.setRoutes(sampleRoutes, sampleAnalysis);

      provider.setGroupingMode('method');
      let roots = await provider.getChildren();
      assert.ok(roots[0] instanceof RouteMethodGroupItem);

      provider.setGroupingMode('file');
      roots = await provider.getChildren();
      assert.ok(roots[0] instanceof RouteFileGroupItem);
      assert.strictEqual(provider.getRoutes().length, 6);
    });
  });

  suite('2. Advanced Route Filtering', () => {
    test('Filtering by framework restricts tree to matching framework routes', async () => {
      const provider = new RouteTreeProvider();
      provider.setRoutes(sampleRoutes, sampleAnalysis);

      provider.setFilterOptions({ framework: 'nestjs' });
      assert.strictEqual(provider.hasActiveFilter(), true);

      const roots = await provider.getChildren();
      assert.strictEqual(roots.length, 1, 'Only products.controller.ts should remain');
      const children = (await provider.getChildren(roots[0])) as RouteTreeItem[];
      assert.strictEqual(children.length, 2);
      assert.ok(children.every((c) => c.route.framework === 'nestjs'));
    });

    test('Filtering by HTTP method restricts displayed routes across groups', async () => {
      const provider = new RouteTreeProvider();
      provider.setRoutes(sampleRoutes, sampleAnalysis);

      provider.setFilterOptions({ method: 'DELETE' });
      const roots = await provider.getChildren();
      assert.strictEqual(roots.length, 1);
      const children = (await provider.getChildren(roots[0])) as RouteTreeItem[];
      assert.strictEqual(children.length, 1);
      assert.strictEqual(children[0].route.method, 'DELETE');
    });

    test('Filtering by route state (SHARED) filters to shared endpoint paths', async () => {
      const provider = new RouteTreeProvider();
      provider.setRoutes(sampleRoutes, sampleAnalysis);

      provider.setFilterOptions({ state: 'SHARED' });
      const roots = await provider.getChildren();
      assert.strictEqual(roots.length, 1);
      const children = (await provider.getChildren(roots[0])) as RouteTreeItem[];
      assert.strictEqual(children.length, 2);
      assert.strictEqual(children[0].route.path, '/api/users');
      assert.strictEqual(children[1].route.path, '/api/users');
    });

    test('Filtering by search query tokens matches method, path, and handler', async () => {
      const provider = new RouteTreeProvider();
      provider.setRoutes(sampleRoutes, sampleAnalysis);

      provider.setFilterOptions({ query: 'get users' });
      const roots = await provider.getChildren();
      assert.strictEqual(roots.length, 1);
      const children = (await provider.getChildren(roots[0])) as RouteTreeItem[];
      assert.strictEqual(children.length, 2, 'GET /api/users and GET /api/users/:id');
    });

    test('Clear filters restores full route inventory view', async () => {
      const provider = new RouteTreeProvider();
      provider.setRoutes(sampleRoutes, sampleAnalysis);

      provider.setFilterOptions({ framework: 'fastify' });
      assert.strictEqual(provider.hasActiveFilter(), true);

      provider.clearFilters();
      assert.strictEqual(provider.hasActiveFilter(), false);
      const roots = await provider.getChildren();
      assert.strictEqual(roots.length, 3);
    });
  });

  suite('3. Enhanced Route Search & QuickPick Matching', () => {
    test('createRouteQuickPickItem includes handler name in description for fuzzy matching', () => {
      const item = createRouteQuickPickItem(sampleRoutes[0]);
      assert.ok(item.description?.includes('getUsers'));
      assert.ok(item.label.includes('GET /api/users'));
      assert.ok(item.detail?.includes('Express'));
    });

    test('findSimilarRoutes finds routes sharing root resource path', () => {
      const target = sampleRoutes[0]; // /api/users
      const similar = findSimilarRoutes(target, sampleRoutes);

      assert.ok(similar.length > 0);
      assert.ok(similar.some((r) => r.path === '/api/users/:id'));
    });
  });

  suite('4. Route Inventory Export (JSON & Markdown)', () => {
    test('exportRoutesToJson outputs deterministic, structured route JSON', () => {
      const jsonStr = exportRoutesToJson(sampleRoutes, sampleAnalysis);
      assert.ok(jsonStr);

      const parsed = JSON.parse(jsonStr);
      assert.strictEqual(parsed.length, 6);
      assert.strictEqual(parsed[0].method, 'GET');
      assert.strictEqual(parsed[0].path, '/api/users');
      assert.strictEqual(parsed[0].framework, 'express');
      assert.ok(parsed[0].isShared, 'Endpoint should be flagged as shared in export');
    });

    test('exportRoutesToMarkdown generates developer-readable documentation with health & issues', () => {
      const mdStr = exportRoutesToMarkdown(sampleRoutes, sampleAnalysis);
      assert.ok(mdStr.includes('# API Routes Inventory'));
      assert.ok(mdStr.includes('## Express'));
      assert.ok(mdStr.includes('## NestJS'));
      assert.ok(mdStr.includes('### `GET` /api/users'));
      assert.ok(mdStr.includes('### ⚠️ `GET` /api/users/:id'));
      assert.ok(mdStr.includes('Parameter naming overlap'));
      assert.ok(mdStr.includes('`authGuard`'));
    });
  });

  suite('5. User Configuration & Safe Scan Exclusions', () => {
    test('BASE_EXCLUDE_SEGMENTS contains all standard safe build directories', () => {
      assert.ok(BASE_EXCLUDE_SEGMENTS.includes('node_modules'));
      assert.ok(BASE_EXCLUDE_SEGMENTS.includes('.git'));
      assert.ok(BASE_EXCLUDE_SEGMENTS.includes('.next'));
      assert.ok(BASE_EXCLUDE_SEGMENTS.includes('dist'));
      assert.ok(BASE_EXCLUDE_SEGMENTS.includes('build'));
      assert.ok(BASE_EXCLUDE_SEGMENTS.includes('coverage'));
      assert.ok(BASE_EXCLUDE_SEGMENTS.includes('out'));
    });

    test('getScanExcludePattern creates valid glob incorporating safe segments', () => {
      const pattern = getScanExcludePattern();
      assert.ok(pattern.includes('node_modules'));
      assert.ok(pattern.includes('dist'));
      assert.ok(pattern.includes('build'));
      assert.ok(pattern.startsWith('{') && pattern.endsWith('}'));
    });

    test('New command IDs are registered in COMMANDS constant', () => {
      assert.strictEqual(COMMANDS.EXPORT_ROUTES, 'apiRouteExplorer.exportRoutes');
      assert.strictEqual(COMMANDS.COPY_ROUTE_URL, 'apiRouteExplorer.copyRouteUrl');
      assert.strictEqual(COMMANDS.COPY_ROUTE_DEFINITION, 'apiRouteExplorer.copyRouteDefinition');
      assert.strictEqual(COMMANDS.GROUP_BY, 'apiRouteExplorer.groupBy');
      assert.strictEqual(COMMANDS.SEARCH_SIMILAR_ROUTES, 'apiRouteExplorer.searchSimilarRoutes');
      assert.strictEqual(COMMANDS.FILTER_ROUTES, 'apiRouteExplorer.filterRoutes');
    });
  });
});
