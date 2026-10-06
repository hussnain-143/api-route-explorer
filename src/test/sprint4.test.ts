import * as assert from 'assert';
import * as vscode from 'vscode';
import { ApiRoute } from '../models/route';
import {
  normalizeRoutePath,
  getDuplicateSignature,
  findDuplicateRoutes,
  findSharedPathGroups,
} from '../analysis/duplicateDetector';
import {
  joinRoutePaths,
  resolveRouterPrefixes,
} from '../analysis/prefixResolver';
import {
  analyzeMissingHandlers,
  analyzeRouteHandlers,
} from '../analysis/handlerAnalyzer';
import {
  calculateRouteStatistics,
  formatRouteStatistics,
} from '../analysis/routeStatistics';
import { RouteDiagnosticsManager } from '../analysis/diagnostics';
import { analyzeWorkspaceRoutes } from '../analysis/routeAnalyzer';
import { RouteAnalysisProvider } from '../providers/routeAnalysisProvider';
import { RouteTreeItem } from '../providers/routeTreeProvider';

suite('API Route Explorer — Sprint 4 Smart Route Analysis Suite', () => {
  // =========================================================================
  // 1. ROUTE NORMALIZATION & DUPLICATE DETECTION TESTS
  // =========================================================================
  test('normalizeRoutePath handles slashes, trailing slashes, and route parameters', () => {
    assert.strictEqual(normalizeRoutePath('/api/users/'), '/api/users');
    assert.strictEqual(normalizeRoutePath('//api///users'), '/api/users');
    assert.strictEqual(normalizeRoutePath('/api/users/:id'), '/api/users/:param');
    assert.strictEqual(normalizeRoutePath('/api/users/:userId'), '/api/users/:param');
    assert.strictEqual(
      normalizeRoutePath('/api/users/:userId/posts/:postId'),
      '/api/users/:param/posts/:param'
    );
    assert.strictEqual(normalizeRoutePath('/'), '/');
    assert.strictEqual(normalizeRoutePath(''), '/');
  });

  test('Duplicate detection: same method + same path is flagged as duplicate', () => {
    const routes: ApiRoute[] = [
      {
        method: 'GET',
        path: '/users',
        filePath: '/src/routes/userRoutes.ts',
        line: 10,
        column: 0,
        framework: 'express',
      },
      {
        method: 'GET',
        path: '/users',
        filePath: '/src/routes/adminRoutes.ts',
        line: 25,
        column: 0,
        framework: 'express',
      },
    ];

    const duplicates = findDuplicateRoutes(routes);
    assert.strictEqual(duplicates.length, 1);
    assert.strictEqual(duplicates[0].method, 'GET');
    assert.strictEqual(duplicates[0].normalizedPath, '/users');
    assert.strictEqual(duplicates[0].routes.length, 2);
  });

  test('Duplicate detection: same path + different method is NOT duplicate', () => {
    const routes: ApiRoute[] = [
      {
        method: 'GET',
        path: '/users',
        filePath: '/src/routes/userRoutes.ts',
        line: 10,
        column: 0,
        framework: 'express',
      },
      {
        method: 'POST',
        path: '/users',
        filePath: '/src/routes/userRoutes.ts',
        line: 20,
        column: 0,
        framework: 'express',
      },
    ];

    const duplicates = findDuplicateRoutes(routes);
    assert.strictEqual(duplicates.length, 0, 'Different methods must not be flagged as duplicates');
  });

  test('Duplicate detection: parameter name variations are recognized as duplicates', () => {
    const routes: ApiRoute[] = [
      {
        method: 'GET',
        path: '/users/:id',
        filePath: '/src/routes/userRoutes.ts',
        line: 10,
        column: 0,
        framework: 'express',
      },
      {
        method: 'GET',
        path: '/users/:userId',
        filePath: '/src/routes/userRoutes.ts',
        line: 30,
        column: 0,
        framework: 'express',
      },
    ];

    const duplicates = findDuplicateRoutes(routes);
    assert.strictEqual(duplicates.length, 1);
    assert.strictEqual(duplicates[0].normalizedPath, '/users/:param');
    assert.strictEqual(duplicates[0].routes.length, 2);
  });

  test('Duplicate detection: trailing slash variations are recognized as duplicates', () => {
    const routes: ApiRoute[] = [
      {
        method: 'GET',
        path: '/users',
        filePath: '/src/routes/userRoutes.ts',
        line: 10,
        column: 0,
        framework: 'express',
      },
      {
        method: 'GET',
        path: '/users/',
        filePath: '/src/routes/userRoutes.ts',
        line: 20,
        column: 0,
        framework: 'express',
      },
    ];

    const duplicates = findDuplicateRoutes(routes);
    assert.strictEqual(duplicates.length, 1);
    assert.strictEqual(duplicates[0].normalizedPath, '/users');
  });

  // =========================================================================
  // 2. SHARED PATH TESTS (MANDATORY)
  // =========================================================================
  test('Shared path: GET, POST, PUT, DELETE on same path produce 1 shared path, 0 duplicates', () => {
    const routes: ApiRoute[] = [
      {
        method: 'GET',
        path: '/users',
        filePath: '/src/routes/userRoutes.ts',
        line: 5,
        column: 0,
        framework: 'express',
      },
      {
        method: 'POST',
        path: '/users',
        filePath: '/src/routes/userRoutes.ts',
        line: 15,
        column: 0,
        framework: 'express',
      },
      {
        method: 'PUT',
        path: '/users',
        filePath: '/src/routes/userRoutes.ts',
        line: 25,
        column: 0,
        framework: 'express',
      },
      {
        method: 'DELETE',
        path: '/users',
        filePath: '/src/routes/userRoutes.ts',
        line: 35,
        column: 0,
        framework: 'express',
      },
    ];

    const duplicates = findDuplicateRoutes(routes);
    assert.strictEqual(duplicates.length, 0, 'Zero duplicate warnings expected');

    const sharedPaths = findSharedPathGroups(routes);
    assert.strictEqual(sharedPaths.length, 1, 'Expected exactly one shared path');
    assert.strictEqual(sharedPaths[0].normalizedPath, '/users');
    assert.strictEqual(sharedPaths[0].methods.length, 4);
    assert.ok(sharedPaths[0].methods.includes('GET'));
    assert.ok(sharedPaths[0].methods.includes('POST'));
    assert.ok(sharedPaths[0].methods.includes('PUT'));
    assert.ok(sharedPaths[0].methods.includes('DELETE'));
  });

  // =========================================================================
  // 3. EXPRESS ROUTER PREFIX RESOLUTION TESTS
  // =========================================================================
  test('joinRoutePaths correctly composes prefix and relative paths', () => {
    assert.strictEqual(joinRoutePaths('/api/v1', '/users'), '/api/v1/users');
    assert.strictEqual(joinRoutePaths('/api/v1/', '/users'), '/api/v1/users');
    assert.strictEqual(joinRoutePaths('/api/v1', '/'), '/api/v1');
    assert.strictEqual(joinRoutePaths('/api', '/users/:id'), '/api/users/:id');
    assert.strictEqual(joinRoutePaths('', '/users'), '/users');
    assert.strictEqual(joinRoutePaths('/', '/health'), '/health');
  });

  test('Prefix resolution: app.use("/api/v1", router) resolves router.get("/users")', () => {
    const rawRoutes: ApiRoute[] = [
      {
        method: 'GET',
        path: '/users',
        filePath: '/app/routes/userRoutes.js',
        line: 4,
        column: 0,
        framework: 'express',
      },
      {
        method: 'POST',
        path: '/users',
        filePath: '/app/routes/userRoutes.js',
        line: 12,
        column: 0,
        framework: 'express',
      },
    ];

    const fileSources = {
      '/app/app.js': `
        const express = require("express");
        const app = express();
        const userRouter = require("./routes/userRoutes.js");
        app.use("/api/v1", userRouter);
      `,
      '/app/routes/userRoutes.js': `
        const router = express.Router();
        router.get("/users", getUsers);
        router.post("/users", createUser);
        module.exports = router;
      `,
    };

    const resolved = resolveRouterPrefixes(rawRoutes, fileSources);

    assert.strictEqual(resolved.length, 2);
    assert.strictEqual(resolved[0].path, '/api/v1/users');
    assert.strictEqual(resolved[1].path, '/api/v1/users');
    // Navigation coordinates remain intact
    assert.strictEqual(resolved[0].line, 4);
    assert.strictEqual(resolved[0].filePath, '/app/routes/userRoutes.js');
  });

  test('Prefix resolution: app.use("/api", router) resolves router.get("/users/:id")', () => {
    const rawRoutes: ApiRoute[] = [
      {
        method: 'GET',
        path: '/users/:id',
        filePath: '/app/routes/userRoutes.ts',
        line: 15,
        column: 0,
        framework: 'express',
      },
    ];

    const fileSources = {
      '/app/app.ts': `
        import express from "express";
        import userRouter from "./routes/userRoutes";
        const app = express();
        app.use("/api", userRouter);
      `,
      '/app/routes/userRoutes.ts': `
        import { Router } from "express";
        const router = Router();
        router.get("/users/:id", getUser);
        export default router;
      `,
    };

    const resolved = resolveRouterPrefixes(rawRoutes, fileSources);
    assert.strictEqual(resolved.length, 1);
    assert.strictEqual(resolved[0].path, '/api/users/:id');
  });

  test('Prefix resolution: multi-level prefix chaining (app.js -> v1/index.js -> search.routes.js)', () => {
    const rawRoutes: ApiRoute[] = [
      {
        method: 'GET',
        path: '/suggestions',
        filePath: '/app/modules/search/search.routes.js',
        line: 8,
        column: 0,
        framework: 'express',
      },
    ];

    const fileSources = {
      '/app/app.js': `
        import v1Router from "./routes/v1/index.js";
        app.use("/api/v1", v1Router);
      `,
      '/app/routes/v1/index.js': `
        import searchRouter from "../../modules/search/search.routes.js";
        v1Router.use("/search", searchRouter);
      `,
      '/app/modules/search/search.routes.js': `
        router.get("/suggestions", getSearchSuggestions);
      `,
    };

    const resolved = resolveRouterPrefixes(rawRoutes, fileSources);
    assert.strictEqual(resolved.length, 1);
    assert.strictEqual(resolved[0].path, '/api/v1/search/suggestions');
  });

  test('Prefix resolution: uncertain prefix leaves original route unchanged without guessing', () => {
    const rawRoutes: ApiRoute[] = [
      {
        method: 'GET',
        path: '/health',
        filePath: '/app/standalone.js',
        line: 2,
        column: 0,
        framework: 'express',
      },
    ];

    const fileSources = {
      '/app/standalone.js': `
        app.get("/health", healthHandler);
      `,
    };

    const resolved = resolveRouterPrefixes(rawRoutes, fileSources);
    assert.strictEqual(resolved.length, 1);
    assert.strictEqual(resolved[0].path, '/health', 'Standalone route must remain unchanged');
  });

  // =========================================================================
  // 4. MISSING HANDLER DETECTION TESTS
  // =========================================================================
  test('Missing handler: flags suspicious calls lacking handler arguments', () => {
    const source = `
      router.get("/users");
      app.post("/items");
      router.delete("/old", );
    `;

    const warnings = analyzeMissingHandlers(source, '/test/app.js');
    assert.strictEqual(warnings.length, 3);
    assert.strictEqual(warnings[0].message, 'Possible missing handler for GET /users');
    assert.strictEqual(warnings[1].message, 'Possible missing handler for POST /items');
    assert.strictEqual(warnings[2].message, 'Possible missing handler for DELETE /old');
  });

  test('Missing handler: does NOT flag valid routes with middleware and handlers', () => {
    const source = `
      router.get("/users", authMiddleware, getUsers);
      app.post("/users", createUser);
    `;

    const warnings = analyzeMissingHandlers(source, '/test/app.js');
    assert.strictEqual(warnings.length, 0, 'Valid routes must produce no warnings');
  });

  test('Missing handler: does NOT flag valid multiline route declarations', () => {
    const source = `
      router.get(
        "/users",
        authenticate,
        validateUser,
        getUsers
      );
    `;

    const warnings = analyzeMissingHandlers(source, '/test/app.js');
    assert.strictEqual(warnings.length, 0, 'Multiline declarations must produce no false positives');
  });

  // =========================================================================
  // 5. ROUTE STATISTICS TESTS
  // =========================================================================
  test('calculateRouteStatistics matches required breakdown exactly', () => {
    const routes: ApiRoute[] = [
      {
        method: 'GET',
        path: '/users',
        filePath: '/routes/users.js',
        line: 1,
        column: 0,
        framework: 'express',
      },
      {
        method: 'POST',
        path: '/users',
        filePath: '/routes/users.js',
        line: 10,
        column: 0,
        framework: 'express',
      },
      {
        method: 'GET',
        path: '/users/:id',
        filePath: '/routes/users.js',
        line: 20,
        column: 0,
        framework: 'express',
      },
      {
        method: 'DELETE',
        path: '/users/:id',
        filePath: '/routes/users.js',
        line: 30,
        column: 0,
        framework: 'express',
      },
    ];

    const stats = calculateRouteStatistics(routes);

    assert.strictEqual(stats.totalRoutes, 4);
    assert.strictEqual(stats.totalFiles, 1);
    assert.strictEqual(stats.methodCounts.GET, 2);
    assert.strictEqual(stats.methodCounts.POST, 1);
    assert.strictEqual(stats.methodCounts.DELETE, 1);
    assert.strictEqual(stats.methodCounts.PUT, 0);
    assert.strictEqual(stats.sharedPathCount, 2); // /users (GET, POST) and /users/:param (GET, DELETE)
    assert.strictEqual(stats.duplicateCount, 0);
    assert.strictEqual(stats.framework, 'Express');

    const formatted = formatRouteStatistics(stats);
    assert.ok(formatted.includes('Routes: 4'));
    assert.ok(formatted.includes('GET: 2'));
    assert.ok(formatted.includes('Shared paths: 2'));
  });

  // =========================================================================
  // 6. FULL SMART ANALYSIS PIPELINE & DIAGNOSTICS LIFECYCLE
  // =========================================================================
  test('analyzeWorkspaceRoutes integrates prefixes, duplicates, shared paths, and stats', () => {
    const rawRoutes: ApiRoute[] = [
      {
        method: 'GET',
        path: '/users',
        filePath: '/routes/users.js',
        line: 5,
        column: 0,
        framework: 'express',
      },
      {
        method: 'POST',
        path: '/users',
        filePath: '/routes/users.js',
        line: 15,
        column: 0,
        framework: 'express',
      },
    ];

    const sources = {
      '/app.js': `
        const userRouter = require("./routes/users");
        app.use("/api/v1", userRouter);
      `,
      '/routes/users.js': `
        router.get("/users", getUsers);
        router.post("/users", createUser);
      `,
    };

    const result = analyzeWorkspaceRoutes(rawRoutes, sources);

    assert.strictEqual(result.routes[0].path, '/api/v1/users');
    assert.strictEqual(result.routes[1].path, '/api/v1/users');
    assert.strictEqual(result.duplicates.length, 0);
    assert.strictEqual(result.sharedPaths.length, 1);
    assert.strictEqual(result.statistics.totalRoutes, 2);
  });

  test('RouteDiagnosticsManager lifecycle operates safely', () => {
    const manager = new RouteDiagnosticsManager();
    assert.doesNotThrow(() => {
      manager.updateDiagnostics([], []);
      manager.clear();
      manager.dispose();
    });
  });

  test('RouteAnalysisProvider correctly structures and displays analysis overview and drilldowns', async () => {
    const provider = new RouteAnalysisProvider();

    // 1. Unscanned state
    const unscanned = await provider.getChildren();
    assert.strictEqual(unscanned.length, 1);
    assert.strictEqual(unscanned[0].label, 'No analysis available');

    // 2. Populated analysis
    const rawRoutes: ApiRoute[] = [
      { method: 'GET', path: '/api/v1/users', filePath: '/src/routes.js', line: 10, column: 0, framework: 'express' },
      { method: 'POST', path: '/api/v1/users', filePath: '/src/routes.js', line: 20, column: 0, framework: 'express' },
    ];
    const analysis = analyzeWorkspaceRoutes(rawRoutes, {
      '/src/routes.js': 'router.get("/api/v1/users"); router.post("/api/v1/users");',
    });

    provider.setAnalysis(analysis);
    const rootItems = await provider.getChildren();

    assert.strictEqual(rootItems.length, 5); // Overview, Shared Paths, Duplicates, Missing Handlers, Methods
    assert.ok(rootItems[0].label!.toString().includes('Overview: 2 Routes'));
    assert.ok(rootItems[1].label!.toString().includes('Shared Paths (1)'));
    assert.ok(rootItems[2].label!.toString().includes('Duplicate Conflicts (0)'));

    // Test drill-down for shared paths
    const sharedPathChildren = await provider.getChildren(rootItems[1]);
    assert.strictEqual(sharedPathChildren.length, 1);
    assert.strictEqual(sharedPathChildren[0].label, '/api/v1/users');

    const routeLeaves = await provider.getChildren(sharedPathChildren[0]);
    assert.strictEqual(routeLeaves.length, 2);

    // Test clear
    provider.clear();
    const cleared = await provider.getChildren();
    assert.strictEqual(cleared[0].label, 'No analysis available');
  });

  test('RouteTreeItem visually decorates items based on analysis context flags', () => {
    const route: ApiRoute = {
      method: 'GET',
      path: '/api/users',
      filePath: '/routes.js',
      line: 14,
      column: 0,
      framework: 'express',
    };

    // Shared path
    const sharedItem = new RouteTreeItem(route, 'routes.js', { isShared: true, sharedMethods: ['GET', 'POST'] });
    assert.strictEqual(sharedItem.description, 'Line 15 • Shared');
    assert.ok(sharedItem.tooltip instanceof vscode.MarkdownString);
    assert.ok(sharedItem.tooltip.value.includes('Shared Route Path'));

    // Duplicate
    const dupItem = new RouteTreeItem(route, 'routes.js', { isDuplicate: true });
    assert.strictEqual(dupItem.description, 'Line 15 • ⚠️ Duplicate');
    assert.ok(dupItem.tooltip instanceof vscode.MarkdownString);
    assert.ok(dupItem.tooltip.value.includes('Duplicate Route'));

    // Missing handler
    const missingItem = new RouteTreeItem(route, 'routes.js', { isMissingHandler: true });
    assert.strictEqual(missingItem.description, 'Line 15 • ⚠️ Missing handler');
    assert.ok(missingItem.tooltip instanceof vscode.MarkdownString);
    assert.ok(missingItem.tooltip.value.includes('Possible Missing Handler'));

    // Default without analysis
    const defaultItem = new RouteTreeItem(route, 'routes.js');
    assert.strictEqual(defaultItem.description, 'Line 15');
  });
});

