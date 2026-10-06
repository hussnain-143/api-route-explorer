import * as assert from 'assert';
import * as vscode from 'vscode';
import { ApiRoute } from '../models/route';
import {
  RouteTreeProvider,
  RoutePlaceholderItem,
  RouteTreeItem,
} from '../providers/routeTreeProvider';
import { RouteAnalysisResult } from '../analysis/routeAnalyzer';
import {
  buildCurlCommand,
  buildRouteDefinition,
  buildRouteUrl,
  getResolvedBaseUrl,
} from '../utils/routeFormatters';
import { RouteDiagnosticsManager } from '../analysis/diagnostics';
import { DuplicateRouteGroup } from '../analysis/duplicateDetector';
import { RouteConflict } from '../analysis/analysisTypes';
import { isIgnoredFile } from '../scanner/routeWatcher';
import { COMMANDS } from '../utils/constants';

suite('API Route Explorer — Sprint 11 Product Refinement & Stability Suite', () => {
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
      method: 'HEAD',
      path: '/api/ping',
      filePath: '/workspace/src/routes/ping.ts',
      line: 5,
      column: 0,
      framework: 'fastify',
    },
    {
      method: 'ANY',
      path: '/api/wildcard',
      filePath: '/workspace/src/pages/api/wildcard.ts',
      line: 8,
      column: 0,
      framework: 'nextjs',
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
      totalRoutes: 7,
      totalFiles: 4,
      framework: 'multi-framework',
      frameworkCounts: { express: 3, nestjs: 2, fastify: 1, nextjs: 1 },
      methodCounts: { GET: 3, POST: 1, DELETE: 1, HEAD: 1, ANY: 1, PUT: 0, PATCH: 0, OPTIONS: 0 },
      duplicateCount: 0,
      sharedPathCount: 1,
      potentialConflictCount: 0,
      healthyCount: 7,
      warningCount: 0,
      errorCount: 0,
      middlewareReferenceCount: 0,
    },
    relationships: new Map(),
  };

  suite('1. Centralized Route Formatters (URL, Definition, cURL)', () => {
    test('getResolvedBaseUrl normalizes URL schemes and trims slashes', () => {
      assert.strictEqual(getResolvedBaseUrl('http://localhost:3000/'), 'http://localhost:3000');
      assert.strictEqual(getResolvedBaseUrl('https://api.example.com///'), 'https://api.example.com');
      assert.strictEqual(getResolvedBaseUrl('localhost:8080/'), 'http://localhost:8080');
      assert.strictEqual(getResolvedBaseUrl(''), 'http://localhost:3000');
      assert.strictEqual(getResolvedBaseUrl('   '), 'http://localhost:3000');
      assert.strictEqual(getResolvedBaseUrl(undefined), 'http://localhost:3000');
    });

    test('buildRouteUrl handles trailing and leading slashes safely without inventing params', () => {
      const route = sampleRoutes[2]; // GET /api/users/:id
      const url1 = buildRouteUrl(route, 'http://localhost:5000/');
      assert.strictEqual(url1, 'http://localhost:5000/api/users/:id');

      const routeNoSlash: ApiRoute = {
        ...route,
        path: 'api/users/:id',
      };
      const url2 = buildRouteUrl(routeNoSlash, 'http://localhost:5000');
      assert.strictEqual(url2, 'http://localhost:5000/api/users/:id');
    });

    test('buildRouteDefinition formats method, path, and 1-based line number', () => {
      const route = sampleRoutes[0];
      const def = buildRouteDefinition(route);
      assert.ok(def.startsWith('GET /api/users -> '));
      assert.ok(def.endsWith(':11')); // line is 10 (0-based) -> 11 (1-based)
    });

    test('buildCurlCommand generates standard GET, POST (with body), and HEAD commands', () => {
      // GET
      const getCurl = buildCurlCommand(sampleRoutes[0], 'http://localhost:3000');
      assert.strictEqual(getCurl, 'curl -X GET "http://localhost:3000/api/users"');

      // POST with payload
      const postCurl = buildCurlCommand(sampleRoutes[1], 'http://localhost:3000');
      assert.strictEqual(
        postCurl,
        'curl -X POST "http://localhost:3000/api/users" -H "Content-Type: application/json" -d \'{}\''
      );

      // HEAD
      const headCurl = buildCurlCommand(sampleRoutes[5], 'http://localhost:3000');
      assert.strictEqual(headCurl, 'curl -I "http://localhost:3000/api/ping"');

      // ANY method falls back to GET in curl
      const anyCurl = buildCurlCommand(sampleRoutes[6], 'http://localhost:3000');
      assert.strictEqual(anyCurl, 'curl -X GET "http://localhost:3000/api/wildcard"');
    });
  });

  suite('2. RouteTreeProvider UX States & Interactive Placeholders', () => {
    test('Initial unscanned state provides actionable Scan command', async () => {
      const provider = new RouteTreeProvider();
      const items = await provider.getChildren();
      assert.strictEqual(items.length, 1);
      assert.ok(items[0] instanceof RoutePlaceholderItem);
      const placeholder = items[0] as RoutePlaceholderItem;
      assert.strictEqual(placeholder.label, 'No routes discovered yet');
      assert.ok(placeholder.command);
      assert.strictEqual(placeholder.command?.command, COMMANDS.SCAN_ROUTES);
    });

    test('Scanned state with 0 routes provides actionable Scan command', async () => {
      const provider = new RouteTreeProvider();
      provider.setRoutes([], {
        ...sampleAnalysis,
        routes: [],
        statistics: { ...sampleAnalysis.statistics, totalRoutes: 0, totalFiles: 0 },
      });
      const items = await provider.getChildren();
      assert.strictEqual(items.length, 1);
      assert.ok(items[0] instanceof RoutePlaceholderItem);
      const placeholder = items[0] as RoutePlaceholderItem;
      assert.strictEqual(placeholder.label, 'No API routes found.');
      assert.ok(placeholder.command);
      assert.strictEqual(placeholder.command?.command, COMMANDS.SCAN_ROUTES);
    });

    test('Filtered state with 0 matches provides actionable Filter command', async () => {
      const provider = new RouteTreeProvider();
      provider.setRoutes(sampleRoutes, sampleAnalysis);
      provider.setMethodFilter('PATCH'); // No PATCH routes in sample

      const items = await provider.getChildren();
      assert.strictEqual(items.length, 1);
      assert.ok(items[0] instanceof RoutePlaceholderItem);
      const placeholder = items[0] as RoutePlaceholderItem;
      assert.strictEqual(placeholder.label, 'No routes match active filter');
      assert.ok(placeholder.command);
      assert.strictEqual(placeholder.command?.command, COMMANDS.FILTER_ROUTES);
    });

    test('isScanning state provides visual progress placeholder', async () => {
      const provider = new RouteTreeProvider();
      provider.setIsScanning(true);
      assert.strictEqual(provider.getIsScanning(), true);

      const items = await provider.getChildren();
      assert.strictEqual(items.length, 1);
      assert.ok(items[0] instanceof RoutePlaceholderItem);
      const placeholder = items[0] as RoutePlaceholderItem;
      assert.strictEqual(placeholder.label, 'Scanning workspace routes...');

      provider.setIsScanning(false);
      assert.strictEqual(provider.getIsScanning(), false);
    });

    test('Synchronized method and advanced filter options', () => {
      const provider = new RouteTreeProvider();
      provider.setRoutes(sampleRoutes, sampleAnalysis);

      // setMethodFilter should update filterOptions
      provider.setMethodFilter('POST');
      assert.strictEqual(provider.getMethodFilter(), 'POST');
      assert.strictEqual(provider.getFilterOptions().method, 'POST');

      // setFilterOptions with method should update getMethodFilter
      provider.setFilterOptions({ method: 'DELETE' });
      assert.strictEqual(provider.getMethodFilter(), 'DELETE');
      assert.strictEqual(provider.getFilterOptions().method, 'DELETE');

      // clearFilters resets both
      provider.clearFilters();
      assert.strictEqual(provider.getMethodFilter(), undefined);
      assert.strictEqual(provider.getFilterOptions().method, undefined);
    });

    test('getFilteredRoutesList accurately reflects active filters', () => {
      const provider = new RouteTreeProvider();
      provider.setRoutes(sampleRoutes, sampleAnalysis);

      assert.strictEqual(provider.getFilteredRoutesList().length, 7);

      provider.setFilterOptions({ framework: 'nestjs' });
      const nestRoutes = provider.getFilteredRoutesList();
      assert.strictEqual(nestRoutes.length, 2);
      assert.ok(nestRoutes.every((r) => r.framework === 'nestjs'));

      provider.clearFilters();
      assert.strictEqual(provider.getFilteredRoutesList().length, 7);
    });
  });

  suite('3. Diagnostic Related Information for Conflicts and Duplicates', () => {
    test('Duplicates generate diagnostics with relatedInformation', () => {
      const manager = new RouteDiagnosticsManager();
      const dupGroup: DuplicateRouteGroup = {
        signature: 'GET /api/users',
        normalizedPath: '/api/users',
        method: 'GET',
        routes: [
          {
            method: 'GET',
            path: '/api/users',
            filePath: '/workspace/src/routes/users1.ts',
            line: 12,
            column: 4,
            framework: 'express',
          },
          {
            method: 'GET',
            path: '/api/users',
            filePath: '/workspace/src/routes/users2.ts',
            line: 22,
            column: 4,
            framework: 'express',
          },
        ],
      };

      manager.updateDiagnostics([dupGroup], [], []);
      const file1Uri = vscode.Uri.file('/workspace/src/routes/users1.ts');
      const diags = manager.getDiagnostics(file1Uri);
      assert.strictEqual(diags.length, 1);
      assert.strictEqual(diags[0].severity, vscode.DiagnosticSeverity.Error);
      assert.ok(diags[0].message.includes('Duplicate route: GET /api/users'));
      // Verify relatedInformation is attached pointing to second route
      assert.ok(diags[0].relatedInformation);
      assert.strictEqual(diags[0].relatedInformation.length, 1);
      assert.strictEqual(
        diags[0].relatedInformation[0].location.uri.fsPath,
        '/workspace/src/routes/users2.ts'
      );
      manager.dispose();
    });

    test('Conflicts generate diagnostics with relatedInformation', () => {
      const manager = new RouteDiagnosticsManager();
      const conflict: RouteConflict = {
        route: sampleRoutes[2], // /api/users/:id
        conflictingRoute: sampleRoutes[0], // /api/users
        reason: 'Potential route conflict: /users/:id shadows /users/profile',
        isShadowing: true,
        severity: 'warning',
      };

      manager.updateDiagnostics([], [], [conflict]);
      const fileUri = vscode.Uri.file(sampleRoutes[2].filePath);
      const diags = manager.getDiagnostics(fileUri);
      assert.strictEqual(diags.length, 1);
      assert.strictEqual(diags[0].severity, vscode.DiagnosticSeverity.Warning);
      assert.ok(diags[0].relatedInformation);
      assert.strictEqual(diags[0].relatedInformation.length, 1);
      manager.dispose();
    });
  });

  suite('4. Watcher User Configuration Exclusion Filter', () => {
    test('isIgnoredFile respects standard segments', () => {
      assert.strictEqual(
        isIgnoredFile(vscode.Uri.file('/workspace/node_modules/express/index.js')),
        true
      );
      assert.strictEqual(
        isIgnoredFile(vscode.Uri.file('/workspace/.git/config')),
        true
      );
      assert.strictEqual(
        isIgnoredFile(vscode.Uri.file('/workspace/src/routes/users.ts')),
        false
      );
    });
  });
});
