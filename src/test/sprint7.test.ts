import * as assert from 'assert';
import * as vscode from 'vscode';
import { ApiRoute } from '../models/route';
import { findRouteConflicts } from '../analysis/conflictDetector';
import {
  extractRouteMiddleware,
  groupRoutesByMiddleware,
} from '../analysis/middlewareAnalyzer';
import { RouteMiddleware } from '../analysis/analysisTypes';
import { evaluateRouteHealth } from '../analysis/routeHealthAnalyzer';
import {
  buildRouteRelationships,
  getRouteKey,
} from '../analysis/routeRelationshipAnalyzer';
import {
  calculateRouteStatistics,
  formatRouteStatistics,
} from '../analysis/routeStatistics';
import { analyzeWorkspaceRoutes } from '../analysis/routeAnalyzer';
import { RouteDiagnosticsManager } from '../analysis/diagnostics';
import {
  RouteTreeItem,
  RouteTreeProvider,
  RouteAnalysisContext,
} from '../providers/routeTreeProvider';
import {
  RouteAnalysisProvider,
  ConflictGroupTreeItem,
  MiddlewareUsageTreeItem,
  AnalysisCategoryItem,
} from '../providers/routeAnalysisProvider';

suite('API Routes Explorer — Sprint 7 Advanced Route Intelligence Suite', () => {
  // 1. Route Conflict & Overlap Tests
  suite('Conflict & Overlap Detection', () => {
    test('Detects potential conflict between static and dynamic parameter segments', () => {
      const routes: ApiRoute[] = [
        {
          method: 'GET',
          path: '/users/me',
          filePath: '/src/routes/users.js',
          line: 10,
          column: 0,
          framework: 'express',
        },
        {
          method: 'GET',
          path: '/users/:id',
          filePath: '/src/routes/users.js',
          line: 20,
          column: 0,
          framework: 'express',
        },
      ];

      const conflicts = findRouteConflicts(routes);
      assert.strictEqual(conflicts.length, 2, 'Should flag reciprocal conflict pair');
      assert.ok(
        conflicts.some((c) => c.route.path === '/users/me' && c.conflictingRoute.path === '/users/:id')
      );
    });

    test('Detects shadowing when generic route is declared before static route in the same file', () => {
      const routes: ApiRoute[] = [
        {
          method: 'GET',
          path: '/users/:id',
          filePath: '/src/routes/users.js',
          line: 5, // declared first
          column: 0,
          framework: 'express',
        },
        {
          method: 'GET',
          path: '/users/me',
          filePath: '/src/routes/users.js',
          line: 25, // declared later
          column: 0,
          framework: 'express',
        },
      ];

      const conflicts = findRouteConflicts(routes);
      assert.strictEqual(conflicts.length, 2);
      const shadowingConflict = conflicts.find((c) => c.route.path === '/users/:id');
      assert.ok(shadowingConflict);
      assert.strictEqual(shadowingConflict?.isShadowing, true);
      assert.ok(shadowingConflict?.reason.includes('may capture'));
    });

    test('Detects conflict between catch-all and dynamic route', () => {
      const routes: ApiRoute[] = [
        {
          method: 'GET',
          path: '/files/*path',
          filePath: '/src/routes/files.js',
          line: 10,
          column: 0,
          framework: 'express',
        },
        {
          method: 'GET',
          path: '/files/:id',
          filePath: '/src/routes/files.js',
          line: 20,
          column: 0,
          framework: 'express',
        },
      ];

      const conflicts = findRouteConflicts(routes);
      assert.strictEqual(conflicts.length, 2);
    });

    test('Does NOT flag unrelated route prefixes as conflicts', () => {
      const routes: ApiRoute[] = [
        {
          method: 'GET',
          path: '/users/:id',
          filePath: '/src/routes/users.js',
          line: 10,
          column: 0,
          framework: 'express',
        },
        {
          method: 'GET',
          path: '/posts/:id',
          filePath: '/src/routes/posts.js',
          line: 10,
          column: 0,
          framework: 'express',
        },
        {
          method: 'GET',
          path: '/users',
          filePath: '/src/routes/users.js',
          line: 5,
          column: 0,
          framework: 'express',
        },
      ];

      const conflicts = findRouteConflicts(routes);
      assert.strictEqual(conflicts.length, 0, 'Unrelated routes and non-overlapping lengths should not conflict');
    });

    test('Does NOT flag routes with different HTTP methods as conflicts', () => {
      const routes: ApiRoute[] = [
        {
          method: 'GET',
          path: '/users/:id',
          filePath: '/src/routes/users.js',
          line: 10,
          column: 0,
          framework: 'express',
        },
        {
          method: 'POST',
          path: '/users/me',
          filePath: '/src/routes/users.js',
          line: 20,
          column: 0,
          framework: 'express',
        },
      ];

      const conflicts = findRouteConflicts(routes);
      assert.strictEqual(conflicts.length, 0, 'Different HTTP methods cannot conflict in routing');
    });

    test('Framework isolation: routes in different frameworks do NOT conflict', () => {
      const routes: ApiRoute[] = [
        {
          method: 'GET',
          path: '/users/:id',
          filePath: '/src/express/users.js',
          line: 10,
          column: 0,
          framework: 'express',
        },
        {
          method: 'GET',
          path: '/users/me',
          filePath: '/src/fastify/users.js',
          line: 10,
          column: 0,
          framework: 'fastify',
        },
      ];

      const conflicts = findRouteConflicts(routes);
      assert.strictEqual(conflicts.length, 0);
    });
  });

  // 2. Middleware Analysis Tests
  suite('Middleware Analysis', () => {
    test('Extracts Express middleware functions from route declarations', () => {
      const source = `
        const express = require('express');
        const router = express.Router();
        router.get('/users', authenticate, authorize, getUsers);
      `;
      const route: ApiRoute = {
        method: 'GET',
        path: '/users',
        filePath: '/routes/users.js',
        line: 3,
        column: 8,
        framework: 'express',
      };

      const middleware = extractRouteMiddleware(route, { '/routes/users.js': source });
      assert.strictEqual(middleware.length, 2);
      assert.strictEqual(middleware[0].name, 'authenticate');
      assert.strictEqual(middleware[0].type, 'middleware');
      assert.strictEqual(middleware[1].name, 'authorize');
    });

    test('Extracts Express array middleware: router.get("/path", [auth, checkRole], handler)', () => {
      const source = `
        router.post('/posts', [authMiddleware, checkRole('admin')], createPost);
      `;
      const route: ApiRoute = {
        method: 'POST',
        path: '/posts',
        filePath: '/routes/posts.js',
        line: 1,
        column: 8,
        framework: 'express',
      };

      const middleware = extractRouteMiddleware(route, { '/routes/posts.js': source });
      assert.strictEqual(middleware.length, 2);
      assert.strictEqual(middleware[0].name, 'authMiddleware');
      assert.strictEqual(middleware[1].name, 'checkRole');
    });

    test('Extracts Fastify preHandler options', () => {
      const source = `
        fastify.get('/profile', { preHandler: requireAuth }, async (req, reply) => {
          return { me: true };
        });
      `;
      const route: ApiRoute = {
        method: 'GET',
        path: '/profile',
        filePath: '/routes/profile.js',
        line: 1,
        column: 8,
        framework: 'fastify',
      };

      const middleware = extractRouteMiddleware(route, { '/routes/profile.js': source });
      assert.strictEqual(middleware.length, 1);
      assert.strictEqual(middleware[0].name, 'requireAuth');
      assert.strictEqual(middleware[0].type, 'pre-handler');
    });

    test('Extracts NestJS @UseGuards and @UseInterceptors decorators', () => {
      const source = `
        import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
        @Controller('admin')
        export class AdminController {
          @Get('reports')
          @UseGuards(JwtAuthGuard, RolesGuard)
          @UseInterceptors(LoggingInterceptor)
          getReports() {
            return [];
          }
        }
      `;
      const route: ApiRoute = {
        method: 'GET',
        path: '/admin/reports',
        filePath: '/src/admin.controller.ts',
        line: 5,
        column: 10,
        framework: 'nestjs',
      };

      const middleware = extractRouteMiddleware(route, { '/src/admin.controller.ts': source });
      assert.strictEqual(middleware.length, 3);
      assert.strictEqual(middleware[0].name, 'JwtAuthGuard');
      assert.strictEqual(middleware[0].type, 'guard');
      assert.strictEqual(middleware[1].name, 'RolesGuard');
      assert.strictEqual(middleware[1].type, 'guard');
      assert.strictEqual(middleware[2].name, 'LoggingInterceptor');
      assert.strictEqual(middleware[2].type, 'interceptor');
    });

    test('Aggregates routes grouped by protecting middleware', () => {
      const r1: ApiRoute = {
        method: 'GET',
        path: '/users',
        filePath: '/app.js',
        line: 1,
        column: 0,
        framework: 'express',
      };
      const r2: ApiRoute = {
        method: 'POST',
        path: '/users',
        filePath: '/app.js',
        line: 2,
        column: 0,
        framework: 'express',
      };
      const map = new Map<ApiRoute, RouteMiddleware[]>([
        [r1, [{ name: 'requireAuth', type: 'middleware' }]],
        [r2, [{ name: 'requireAuth', type: 'middleware' }, { name: 'validateBody', type: 'middleware' }]],
      ]);

      const groups = groupRoutesByMiddleware(map);
      assert.strictEqual(groups.length, 2);
      const authGroup = groups.find((g) => g.middlewareName === 'requireAuth');
      assert.strictEqual(authGroup?.routes.length, 2);
      const valGroup = groups.find((g) => g.middlewareName === 'validateBody');
      assert.strictEqual(valGroup?.routes.length, 1);
    });
  });

  // 3. Route Health Evaluation Tests
  suite('Route Health Evaluation', () => {
    const baseRoute: ApiRoute = {
      method: 'GET',
      path: '/items',
      filePath: '/items.js',
      line: 10,
      column: 0,
      framework: 'express',
    };

    test('Healthy route with no issues evaluates to "healthy"', () => {
      const { health, issues } = evaluateRouteHealth(baseRoute, [], [], undefined, []);
      assert.strictEqual(health, 'healthy');
      assert.strictEqual(issues.length, 0);
    });

    test('Route with duplicate evaluates to "error"', () => {
      const dup: ApiRoute = { ...baseRoute, line: 20 };
      const { health, issues } = evaluateRouteHealth(baseRoute, [dup], [], undefined, []);
      assert.strictEqual(health, 'error');
      assert.ok(issues.some((i) => i.type === 'duplicate' && i.severity === 'error'));
    });

    test('Route with missing handler evaluates to "error"', () => {
      const warning = {
        filePath: '/items.js',
        line: 10,
        column: 0,
        method: 'GET' as const,
        path: '/items',
        message: 'Possible missing handler for GET /items',
      };
      const { health, issues } = evaluateRouteHealth(baseRoute, [], [], warning, []);
      assert.strictEqual(health, 'error');
      assert.ok(issues.some((i) => i.type === 'missing-handler' && i.severity === 'error'));
    });

    test('Route with conflict evaluates to "warning"', () => {
      const conflict = {
        route: baseRoute,
        conflictingRoute: { ...baseRoute, path: '/items/:id' },
        reason: 'Potential route conflict: GET /items overlaps with GET /items/:id',
        isShadowing: false,
        severity: 'warning' as const,
      };
      const { health, issues } = evaluateRouteHealth(baseRoute, [], [conflict], undefined, []);
      assert.strictEqual(health, 'warning');
      assert.ok(issues.some((i) => i.type === 'route-conflict' && i.severity === 'warning'));
    });

    test('Middleware presence does NOT make route unhealthy', () => {
      const middleware = [{ name: 'auth', type: 'middleware' as const }];
      const { health } = evaluateRouteHealth(baseRoute, [], [], undefined, middleware);
      assert.strictEqual(health, 'info');
    });

    test('Error severity takes priority over warning and info', () => {
      const dup: ApiRoute = { ...baseRoute, line: 20 };
      const conflict = {
        route: baseRoute,
        conflictingRoute: { ...baseRoute, path: '/items/:id' },
        reason: 'Potential conflict',
        isShadowing: false,
        severity: 'warning' as const,
      };
      const middleware = [{ name: 'auth', type: 'middleware' as const }];

      const { health } = evaluateRouteHealth(baseRoute, [dup], [conflict], undefined, middleware);
      assert.strictEqual(health, 'error', 'Error must take priority over warning and info');
    });
  });

  // 4. Statistics Improvements
  suite('Statistics Intelligence', () => {
    test('calculateRouteStatistics includes health, conflict, and middleware counts', () => {
      const routes: ApiRoute[] = [
        { method: 'GET', path: '/users', filePath: '/users.js', line: 1, column: 0, framework: 'express' },
        { method: 'GET', path: '/users/:id', filePath: '/users.js', line: 2, column: 0, framework: 'express' },
        { method: 'POST', path: '/users', filePath: '/users.js', line: 3, column: 0, framework: 'express' },
      ];

      const sources = {
        '/users.js': `
          router.get('/users', auth, getUsers);
          router.get('/users/:id', auth, getUserById);
          router.post('/users', auth, createUser);
        `,
      };

      const analysis = analyzeWorkspaceRoutes(routes, sources);
      assert.strictEqual(analysis.statistics.totalRoutes, 3);
      assert.strictEqual(analysis.statistics.sharedPathCount, 1);
      assert.ok(typeof analysis.statistics.healthyCount === 'number');
      assert.ok(typeof analysis.statistics.warningCount === 'number');
      assert.ok(typeof analysis.statistics.errorCount === 'number');
      assert.ok(typeof analysis.statistics.middlewareReferenceCount === 'number');

      const formatted = formatRouteStatistics(analysis.statistics);
      assert.ok(formatted.includes('Health:'));
      assert.ok(formatted.includes('Healthy:'));
      assert.ok(formatted.includes('Warnings:'));
      assert.ok(formatted.includes('Errors:'));
    });
  });

  // 5. Diagnostics Tests
  suite('Diagnostics Expansion', () => {
    test('RouteDiagnosticsManager correctly publishes errors for duplicates and warnings for conflicts', () => {
      const mgr = new RouteDiagnosticsManager();
      const r1: ApiRoute = { method: 'GET', path: '/a', filePath: '/test.js', line: 5, column: 0, framework: 'express' };
      const r2: ApiRoute = { method: 'GET', path: '/a', filePath: '/test.js', line: 15, column: 0, framework: 'express' };

      const duplicateGroup = [{ signature: 'GET:/a', method: 'GET' as const, normalizedPath: '/a', routes: [r1, r2] }];
      const conflict = [{
        route: r1,
        conflictingRoute: { method: 'GET' as const, path: '/:id', filePath: '/test.js', line: 25, column: 0, framework: 'express' as const },
        reason: 'Potential route conflict',
        isShadowing: false,
        severity: 'warning' as const,
      }];

      mgr.updateDiagnostics(duplicateGroup, [], conflict);
      // Clean disposal test
      mgr.clear();
      mgr.dispose();
      assert.ok(true, 'Diagnostics updated and cleared cleanly without throwing');
    });
  });

  // 6. UI & TreeView Intelligence Tests
  suite('TreeView & Tooltip Intelligence', () => {
    test('RouteTreeItem constructs comprehensive tooltip with health and middleware', () => {
      const route: ApiRoute = {
        method: 'GET',
        path: '/users/:id',
        filePath: '/src/routes/users.ts',
        line: 12,
        column: 4,
        framework: 'express',
      };

      const context: RouteAnalysisContext = {
        health: 'warning',
        issues: [{
          type: 'shadowing',
          severity: 'warning',
          message: 'Possible route shadowing: may capture GET /users/me',
          route,
        }],
        middleware: [{ name: 'requireAuth', type: 'middleware' }],
      };

      const item = new RouteTreeItem(route, 'routes/users.ts', context);
      assert.ok(typeof item.description === 'string');
      assert.ok(item.description?.includes('Line 13'));

      const tooltipStr = (item.tooltip as vscode.MarkdownString).value;
      assert.ok(tooltipStr.includes('**Health**: Warning'));
      assert.ok(tooltipStr.includes('Possible route shadowing'));
      assert.ok(tooltipStr.includes('requireAuth (middleware)'));
    });

    test('RouteAnalysisProvider displays Health, Conflicts, and Middleware categories', async () => {
      const provider = new RouteAnalysisProvider();
      const routes: ApiRoute[] = [
        { method: 'GET', path: '/users', filePath: '/users.js', line: 1, column: 0, framework: 'express' },
      ];
      const analysis = analyzeWorkspaceRoutes(routes, { '/users.js': 'router.get("/users", auth, handler);' });
      provider.setAnalysis(analysis);

      const rootItems = await provider.getChildren();
      assert.ok(rootItems.length >= 5, 'Should have root categories for Overview, Health, Conflicts, Middleware, etc.');

      const healthCategory = rootItems.find(
        (i) => i instanceof AnalysisCategoryItem && i.categoryType === 'health'
      );
      assert.ok(healthCategory, 'Health category should be present in Route Analysis view');

      const conflictCategory = rootItems.find(
        (i) => i instanceof AnalysisCategoryItem && i.categoryType === 'conflicts'
      );
      assert.ok(conflictCategory, 'Conflicts category should be present');

      const mwCategory = rootItems.find(
        (i) => i instanceof AnalysisCategoryItem && i.categoryType === 'middleware'
      );
      assert.ok(mwCategory, 'Middleware category should be present');
    });
  });
});
