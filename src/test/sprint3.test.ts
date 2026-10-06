import * as assert from 'assert';
import * as vscode from 'vscode';
import { ApiRoute } from '../models/route';
import {
  extractRouteFromArg,
  extractFilePathFromArg,
} from '../extension';
import {
  RouteFileGroupItem,
  RouteTreeItem,
  RouteTreeProvider,
} from '../providers/routeTreeProvider';
import { isIgnoredFile } from '../scanner/routeWatcher';
import {
  createRouteQuickPickItem,
  showRouteQuickPick,
} from '../scanner/routeSearch';
import { openFile, openRoute } from '../utils/navigation';
import { COMMANDS } from '../utils/constants';

suite('API Route Explorer — Sprint 3 Developer UX & Navigation Suite', function () {
  this.timeout(10000);

  const sampleRoute: ApiRoute = {
    method: 'GET',
    path: '/api/users/:id',
    filePath: '/workspace/src/routes/user.routes.js',
    line: 20,
    column: 0,
    framework: 'express',
  };

  test('createRouteQuickPickItem accurately creates searchable items', () => {
    const item = createRouteQuickPickItem(sampleRoute);

    // Matches route method and path
    assert.strictEqual(item.label, 'GET /api/users/:id');

    // Matches file name
    assert.ok(item.description!.includes('user.routes.js'));

    // Matches line and framework
    assert.strictEqual(item.detail, 'Line 21 • Express');
    assert.strictEqual(item.route, sampleRoute);
  });

  test('Search item matches query against method, route path, and filename', () => {
    const item = createRouteQuickPickItem(sampleRoute);

    const queryPath = 'users';
    const queryMethod = 'GET';
    const queryFile = 'user.routes.js';
    const queryExact = '/api/users/:id';

    // Verify search target containment
    assert.ok(item.label.toLowerCase().includes(queryPath.toLowerCase()));
    assert.ok(item.label.toLowerCase().includes(queryMethod.toLowerCase()));
    assert.ok(item.label.toLowerCase().includes(queryExact.toLowerCase()));
    assert.ok(item.description!.toLowerCase().includes(queryFile.toLowerCase()));
  });

  test('showRouteQuickPick safely handles unscanned and empty route states', async () => {
    await assert.doesNotReject(async () => {
      // Unscanned state
      await showRouteQuickPick([], false);
      // Scanned with zero routes
      await showRouteQuickPick([], true);
    });
  });

  test('extractRouteFromArg parses RouteTreeItem, wrapper object, and raw ApiRoute', () => {
    const treeItem = new RouteTreeItem(sampleRoute, 'src/routes/user.routes.js');

    assert.deepStrictEqual(extractRouteFromArg(treeItem), sampleRoute);
    assert.deepStrictEqual(extractRouteFromArg({ route: sampleRoute }), sampleRoute);
    assert.deepStrictEqual(extractRouteFromArg(sampleRoute), sampleRoute);
    assert.strictEqual(extractRouteFromArg(null), undefined);
    assert.strictEqual(extractRouteFromArg({}), undefined);
  });

  test('extractFilePathFromArg parses string, RouteTreeItem, RouteFileGroupItem, and wrappers', () => {
    const treeItem = new RouteTreeItem(sampleRoute, 'src/routes/user.routes.js');
    const groupItem = new RouteFileGroupItem(
      '/workspace/src/routes/user.routes.js',
      'src/routes/user.routes.js',
      [sampleRoute]
    );

    assert.strictEqual(
      extractFilePathFromArg('/workspace/src/routes/user.routes.js'),
      '/workspace/src/routes/user.routes.js'
    );
    assert.strictEqual(
      extractFilePathFromArg(treeItem),
      '/workspace/src/routes/user.routes.js'
    );
    assert.strictEqual(
      extractFilePathFromArg(groupItem),
      '/workspace/src/routes/user.routes.js'
    );
    assert.strictEqual(
      extractFilePathFromArg({ filePath: '/test/path.js' }),
      '/test/path.js'
    );
    assert.strictEqual(extractFilePathFromArg(null), undefined);
  });

  test('isIgnoredFile correctly filters build and dependency paths', () => {
    assert.strictEqual(
      isIgnoredFile(vscode.Uri.file('/project/node_modules/express/index.js')),
      true
    );
    assert.strictEqual(
      isIgnoredFile(vscode.Uri.file('/project/.git/HEAD')),
      true
    );
    assert.strictEqual(
      isIgnoredFile(vscode.Uri.file('/project/.next/server/pages.js')),
      true
    );
    assert.strictEqual(
      isIgnoredFile(vscode.Uri.file('/project/dist/bundle.js')),
      true
    );
    assert.strictEqual(
      isIgnoredFile(vscode.Uri.file('/project/build/index.js')),
      true
    );
    assert.strictEqual(
      isIgnoredFile(vscode.Uri.file('/project/coverage/lcov.info')),
      true
    );
    assert.strictEqual(
      isIgnoredFile(vscode.Uri.file('/project/out/extension.js')),
      true
    );

    // Normal source file
    assert.strictEqual(
      isIgnoredFile(vscode.Uri.file('/project/src/routes/user.routes.js')),
      false
    );
  });

  test('Multiple consecutive scans do not duplicate routes or file groups', async () => {
    const provider = new RouteTreeProvider();
    const routes: ApiRoute[] = [
      sampleRoute,
      {
        method: 'POST',
        path: '/api/users',
        filePath: '/workspace/src/routes/user.routes.js',
        line: 35,
        column: 0,
        framework: 'express',
      },
    ];

    // Scan 1
    provider.setRoutes(routes);
    let rootItems = await provider.getChildren();
    assert.strictEqual(rootItems.length, 1);
    let childItems = await provider.getChildren(rootItems[0]);
    assert.strictEqual(childItems.length, 2);

    // Scan 2 with same routes
    provider.setRoutes(routes);
    rootItems = await provider.getChildren();
    assert.strictEqual(rootItems.length, 1, 'File group count must not duplicate');
    childItems = await provider.getChildren(rootItems[0]);
    assert.strictEqual(childItems.length, 2, 'Route count must not duplicate');
  });

  test('Navigation functions openRoute and openFile handle missing/invalid files safely', async () => {
    await assert.doesNotReject(async () => {
      await openRoute({
        method: 'GET',
        path: '/nonexistent',
        filePath: '/does/not/exist/file.js',
        line: 10,
        column: 0,
        framework: 'express',
      });
    });

    await assert.doesNotReject(async () => {
      await openFile('/does/not/exist/file.js');
    });
  });

  test('Copy commands execute cleanly via command registry', async () => {
    await assert.doesNotReject(async () => {
      await vscode.commands.executeCommand(COMMANDS.COPY_ROUTE_PATH, sampleRoute);
      const clipboardPath = await vscode.env.clipboard.readText();
      assert.strictEqual(clipboardPath, '/api/users/:id');

      await vscode.commands.executeCommand(COMMANDS.COPY_ROUTE, sampleRoute);
      const clipboardSig = await vscode.env.clipboard.readText();
      assert.strictEqual(clipboardSig, 'GET /api/users/:id');
    });
  });
});
