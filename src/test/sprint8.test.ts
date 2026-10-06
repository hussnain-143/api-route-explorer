import * as assert from 'assert';
import * as vscode from 'vscode';
import { ApiRoute } from '../models/route';
import { RouteIndex } from '../scanner/routeIndex';
import {
  scanSingleFile,
  removeSingleFile,
  scanWorkspaceDetailed,
  postProcessAllRoutes,
} from '../scanner/routeScanner';
import {
  createRouteFileWatcher,
  isIgnoredFile,
  RouteFileChangeEvent,
} from '../scanner/routeWatcher';
import { analyzeWorkspaceRoutes } from '../analysis/routeAnalyzer';
import { findRouteConflicts } from '../analysis/conflictDetector';
import {
  RouteTreeProvider,
  getFolderDisplayLabel,
  RouteFileGroupItem,
} from '../providers/routeTreeProvider';

suite('API Route Explorer — Sprint 8 Performance & Large Project Suite', () => {
  suite('RouteIndex In-Memory Indexing', () => {
    test('Indexes routes and enables fast lookups across multiple dimensions', () => {
      const index = new RouteIndex();

      const file1Routes: ApiRoute[] = [
        {
          method: 'GET',
          path: '/api/users',
          filePath: '/workspace/src/users.js',
          line: 10,
          column: 0,
          framework: 'express',
        },
        {
          method: 'POST',
          path: '/api/users',
          filePath: '/workspace/src/users.js',
          line: 25,
          column: 0,
          framework: 'express',
        },
      ];

      const file2Routes: ApiRoute[] = [
        {
          method: 'GET',
          path: '/api/users/:id',
          filePath: '/workspace/src/usersDetail.js',
          line: 15,
          column: 0,
          framework: 'fastify',
        },
      ];

      index.setFileRoutes('/workspace/src/users.js', file1Routes);
      index.setFileRoutes('/workspace/src/usersDetail.js', file2Routes);

      assert.strictEqual(index.size(), 3);
      assert.strictEqual(index.fileCount(), 2);

      // File lookup
      assert.strictEqual(index.getRoutesForFile('/workspace/src/users.js').length, 2);
      assert.strictEqual(index.getRoutesForFile('/workspace/src/usersDetail.js').length, 1);

      // Method lookup
      assert.strictEqual(index.getRoutesByMethod('GET').length, 2);
      assert.strictEqual(index.getRoutesByMethod('POST').length, 1);
      assert.strictEqual(index.getRoutesByMethod('DELETE').length, 0);

      // Framework lookup
      assert.strictEqual(index.getRoutesByFramework('express').length, 2);
      assert.strictEqual(index.getRoutesByFramework('fastify').length, 1);

      // Path lookup
      assert.strictEqual(index.getRoutesByPath('/api/users').length, 2);

      // Normalized path lookup
      assert.strictEqual(index.getRoutesByNormalizedPath('/api/users/:param').length, 1);

      // Signature lookup
      assert.strictEqual(index.getRoutesBySignature('GET:/api/users').length, 1);
      assert.strictEqual(index.getRoutesBySignature('POST:/api/users').length, 1);
    });

    test('removeFileRoutes cleans up all secondary indexes without leaving stale references', () => {
      const index = new RouteIndex();
      const routes: ApiRoute[] = [
        {
          method: 'GET',
          path: '/api/orders',
          filePath: '/workspace/src/orders.js',
          line: 5,
          column: 0,
          framework: 'express',
        },
      ];

      index.setFileRoutes('/workspace/src/orders.js', routes);
      assert.strictEqual(index.size(), 1);

      const removed = index.removeFileRoutes('/workspace/src/orders.js');
      assert.strictEqual(removed.length, 1);
      assert.strictEqual(index.size(), 0);
      assert.strictEqual(index.fileCount(), 0);
      assert.strictEqual(index.getRoutesForFile('/workspace/src/orders.js').length, 0);
      assert.strictEqual(index.getRoutesByMethod('GET').length, 0);
      assert.strictEqual(index.getRoutesByFramework('express').length, 0);
      assert.strictEqual(index.getRoutesByPath('/api/orders').length, 0);
      assert.strictEqual(index.getRoutesByNormalizedPath('/api/orders').length, 0);
    });

    test('renameFile updates file paths and indices seamlessly', () => {
      const index = new RouteIndex();
      const routes: ApiRoute[] = [
        {
          method: 'GET',
          path: '/api/items',
          filePath: '/workspace/src/oldItems.js',
          line: 12,
          column: 0,
          framework: 'express',
        },
      ];

      index.setFileRoutes('/workspace/src/oldItems.js', routes);
      index.renameFile('/workspace/src/oldItems.js', '/workspace/src/newItems.js');

      assert.strictEqual(index.hasFile('/workspace/src/oldItems.js'), false);
      assert.strictEqual(index.hasFile('/workspace/src/newItems.js'), true);
      const updated = index.getRoutesForFile('/workspace/src/newItems.js');
      assert.strictEqual(updated.length, 1);
      assert.strictEqual(updated[0].filePath, '/workspace/src/newItems.js');
    });

    test('clear() resets all index structures completely', () => {
      const index = new RouteIndex();
      index.setFileRoutes('/a.js', [
        { method: 'GET', path: '/a', filePath: '/a.js', line: 1, column: 0, framework: 'express' },
      ]);
      index.clear();

      assert.strictEqual(index.size(), 0);
      assert.strictEqual(index.fileCount(), 0);
      assert.strictEqual(index.getAllRoutes().length, 0);
    });
  });

  suite('Incremental Route Processing', () => {
    test('scanSingleFile parses and updates only the target file in the route index', () => {
      const index = new RouteIndex();
      const fileSources = new Map<string, string>();

      const expressCode = `
        const express = require('express');
        const router = express.Router();
        router.get('/profile', getProfile);
        router.put('/profile', updateProfile);
        module.exports = router;
      `;

      const routes = scanSingleFile('/src/profile.js', expressCode, index, fileSources);
      assert.strictEqual(routes.length, 2);
      assert.strictEqual(fileSources.get('/src/profile.js'), expressCode);
      assert.strictEqual(index.getRoutesForFile('/src/profile.js').length, 2);
    });

    test('removeSingleFile purges file source and routes', () => {
      const index = new RouteIndex();
      const fileSources = new Map<string, string>();

      scanSingleFile(
        '/src/temp.js',
        'router.get("/temp", handler);',
        index,
        fileSources
      );
      assert.strictEqual(index.size(), 1);

      removeSingleFile('/src/temp.js', index, fileSources);
      assert.strictEqual(index.size(), 0);
      assert.strictEqual(fileSources.has('/src/temp.js'), false);
    });

    test('postProcessAllRoutes applies framework prefix composition across routes', () => {
      const fileSources = new Map<string, string>();
      fileSources.set(
        '/src/app.js',
        `
        const express = require('express');
        const app = express();
        const userRoutes = require('./routes/users');
        app.use('/api/v2', userRoutes);
        `
      );
      fileSources.set(
        '/src/routes/users.js',
        `
        const express = require('express');
        const router = express.Router();
        router.get('/list', (req, res) => {});
        module.exports = router;
        `
      );

      const rawRoutes: ApiRoute[] = [
        {
          method: 'GET',
          path: '/list',
          filePath: '/src/routes/users.js',
          line: 10,
          column: 0,
          framework: 'express',
        },
      ];

      const processed = postProcessAllRoutes(rawRoutes, fileSources);
      assert.strictEqual(processed.length, 1);
      assert.strictEqual(processed[0].path, '/api/v2/list');
    });
  });

  suite('Scan Cancellation & Progress', () => {
    test('scanWorkspaceDetailed respects cancellation token and returns immediately', async () => {
      const cts = new vscode.CancellationTokenSource();
      cts.cancel(); // Pre-cancel

      const result = await scanWorkspaceDetailed(cts.token);
      assert.strictEqual(result.cancelled, true);
      assert.strictEqual(result.routes.length, 0);
      cts.dispose();
    });
  });

  suite('Large Project Stress Scalability', () => {
    test('Analyzes 1,000 simulated routes rapidly without memory or CPU bottleneck', () => {
      const routes: ApiRoute[] = [];
      const fileSources = new Map<string, string>();

      // Generate 100 files with 10 routes each = 1,000 routes
      for (let f = 0; f < 100; f++) {
        const filePath = `/workspace/src/module${f}/routes.js`;
        fileSources.set(filePath, 'module.exports = router;');

        for (let r = 0; r < 10; r++) {
          routes.push({
            method: r % 2 === 0 ? 'GET' : 'POST',
            path: `/api/resource${f}/item${r}`,
            filePath,
            line: r * 5,
            column: 0,
            framework: 'express',
          });
        }
      }

      assert.strictEqual(routes.length, 1000);

      const tStart = Date.now();
      const analysis = analyzeWorkspaceRoutes(routes, fileSources);
      const duration = Date.now() - tStart;

      assert.strictEqual(analysis.routes.length, 1000);
      assert.strictEqual(analysis.duplicates.length, 0);
      assert.ok(duration < 1000, `Analysis should complete rapidly, took ${duration}ms`);
    });

    test('Conflict detector handles prepared routes with static and wildcard segments accurately', () => {
      const routes: ApiRoute[] = [
        {
          method: 'GET',
          path: '/api/v1/users/me',
          filePath: '/src/users.js',
          line: 10,
          column: 0,
          framework: 'express',
        },
        {
          method: 'GET',
          path: '/api/v1/users/:id',
          filePath: '/src/users.js',
          line: 20,
          column: 0,
          framework: 'express',
        },
      ];

      const conflicts = findRouteConflicts(routes);
      assert.ok(conflicts.length > 0, 'Should detect overlap between /users/me and /users/:id');
    });
  });

  suite('File Watcher Batching & Filtering', () => {
    test('isIgnoredFile rejects build artifacts and version control folders', () => {
      assert.strictEqual(isIgnoredFile(vscode.Uri.file('/proj/node_modules/pkg/index.js')), true);
      assert.strictEqual(isIgnoredFile(vscode.Uri.file('/proj/.git/objects/abc')), true);
      assert.strictEqual(isIgnoredFile(vscode.Uri.file('/proj/.next/server/pages/api.js')), true);
      assert.strictEqual(isIgnoredFile(vscode.Uri.file('/proj/dist/bundle.js')), true);
      assert.strictEqual(isIgnoredFile(vscode.Uri.file('/proj/build/output.js')), true);
      assert.strictEqual(isIgnoredFile(vscode.Uri.file('/proj/coverage/lcov.info')), true);
      assert.strictEqual(isIgnoredFile(vscode.Uri.file('/proj/out/extension.js')), true);

      // Legitimate source files
      assert.strictEqual(isIgnoredFile(vscode.Uri.file('/proj/src/routes/users.js')), false);
      assert.strictEqual(isIgnoredFile(vscode.Uri.file('/proj/app/api/auth/route.ts')), false);
    });

    test('createRouteFileWatcher creates disposable watcher and disposes cleanly', () => {
      let callbackInvoked = false;
      const watcher = createRouteFileWatcher(() => {
        callbackInvoked = true;
      }, 50);

      assert.ok(watcher);
      assert.strictEqual(typeof watcher.dispose, 'function');
      watcher.dispose();
      assert.strictEqual(callbackInvoked, false);
    });
  });

  suite('TreeView Performance Optimization', () => {
    test('getFolderDisplayLabel works with precomputed occurrence Map', () => {
      const occurrences = new Map<string, number>();
      occurrences.set('booking', 2);
      occurrences.set('auth', 1);

      const label1 = getFolderDisplayLabel('src/modules/admin/booking/routes.js', occurrences);
      assert.strictEqual(label1.label, 'booking');
      assert.strictEqual(label1.description, 'admin'); // Disambiguated

      const label2 = getFolderDisplayLabel('src/modules/auth/routes.js', occurrences);
      assert.strictEqual(label2.label, 'auth');
      assert.strictEqual(label2.description, ''); // Unique, no disambiguation needed
    });

    test('RouteTreeProvider setRoutes generates file groups rapidly for large route sets', () => {
      const provider = new RouteTreeProvider();
      const routes: ApiRoute[] = [];

      for (let f = 0; f < 50; f++) {
        for (let r = 0; r < 20; r++) {
          routes.push({
            method: 'GET',
            path: `/api/mod${f}/sub${r}`,
            filePath: `/src/mod${f}/routes.js`,
            line: r,
            column: 0,
            framework: 'express',
          });
        }
      }

      const tStart = Date.now();
      provider.setRoutes(routes);
      const elapsed = Date.now() - tStart;

      assert.strictEqual(provider.getRoutes().length, 1000);
      assert.strictEqual(provider.getFileGroups().length, 50);
      assert.ok(elapsed < 100, `TreeView setRoutes took ${elapsed}ms, should be < 100ms`);
    });
  });
});
