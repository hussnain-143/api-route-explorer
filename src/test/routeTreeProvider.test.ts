import * as assert from 'assert';
import * as vscode from 'vscode';
import { ApiRoute } from '../models/route';
import {
  RouteTreeProvider,
  RouteFileGroupItem,
  RouteTreeItem,
  RoutePlaceholderItem,
  getRelativeFilePath,
  getMethodIcon,
  getFolderDisplayLabel,
} from '../providers/routeTreeProvider';
import { COMMANDS, MESSAGES } from '../utils/constants';

suite('API Route Explorer — RouteTreeProvider Suite', () => {
  test('Initial unscanned state shows "No routes discovered yet" placeholder', async () => {
    const provider = new RouteTreeProvider();
    const children = await provider.getChildren();

    assert.strictEqual(children.length, 1);
    assert.ok(children[0] instanceof RoutePlaceholderItem);
    assert.strictEqual(children[0].label, MESSAGES.NO_ROUTES_TITLE);
    assert.strictEqual(children[0].description, MESSAGES.NO_ROUTES_DESCRIPTION);
  });

  test('Scanned state with zero routes shows "No API routes found" placeholder', async () => {
    const provider = new RouteTreeProvider();
    provider.setRoutes([]);

    const children = await provider.getChildren();
    assert.strictEqual(children.length, 1);
    assert.ok(children[0] instanceof RoutePlaceholderItem);
    assert.strictEqual(children[0].label, MESSAGES.NO_ROUTES_FOUND);
    assert.strictEqual(children[0].description, MESSAGES.NO_ROUTES_EMPTY_DESCRIPTION);
  });

  test('Groups routes by source file and sorts file groups alphabetically', async () => {
    const provider = new RouteTreeProvider();
    const routes: ApiRoute[] = [
      {
        method: 'GET',
        path: '/users',
        filePath: '/workspace/routes/userRoutes.js',
        line: 10,
        column: 0,
        framework: 'express',
      },
      {
        method: 'GET',
        path: '/auth/login',
        filePath: '/workspace/routes/authRoutes.js',
        line: 5,
        column: 0,
        framework: 'express',
      },
      {
        method: 'POST',
        path: '/users',
        filePath: '/workspace/routes/userRoutes.js',
        line: 20,
        column: 0,
        framework: 'express',
      },
      {
        method: 'GET',
        path: '/health',
        filePath: '/workspace/app.js',
        line: 4,
        column: 0,
        framework: 'express',
      },
    ];

    provider.setRoutes(routes);
    const rootItems = await provider.getChildren();

    // 3 unique files: app.js, routes/authRoutes.js, routes/userRoutes.js
    assert.strictEqual(rootItems.length, 3);

    const group0 = rootItems[0] as RouteFileGroupItem;
    const group1 = rootItems[1] as RouteFileGroupItem;
    const group2 = rootItems[2] as RouteFileGroupItem;

    assert.ok(group0 instanceof RouteFileGroupItem);
    assert.ok(group1 instanceof RouteFileGroupItem);
    assert.ok(group2 instanceof RouteFileGroupItem);

    // Alphabetical order of filenames/relative paths
    assert.ok(group0.label!.toString().includes('app.js'));
    assert.ok(group1.label!.toString().includes('authRoutes.js'));
    assert.ok(group2.label!.toString().includes('userRoutes.js'));

    assert.strictEqual(group0.routes.length, 1);
    assert.strictEqual(group1.routes.length, 1);
    assert.strictEqual(group2.routes.length, 2);
  });

  test('Renders RouteTreeItems under file group sorted by path then method', async () => {
    const provider = new RouteTreeProvider();
    const routes: ApiRoute[] = [
      {
        method: 'POST',
        path: '/users',
        filePath: '/workspace/routes/userRoutes.js',
        line: 15,
        column: 0,
        framework: 'express',
      },
      {
        method: 'GET',
        path: '/users',
        filePath: '/workspace/routes/userRoutes.js',
        line: 5,
        column: 0,
        framework: 'express',
      },
      {
        method: 'DELETE',
        path: '/users/:id',
        filePath: '/workspace/routes/userRoutes.js',
        line: 25,
        column: 0,
        framework: 'express',
      },
    ];

    provider.setRoutes(routes);
    const rootItems = await provider.getChildren();
    assert.strictEqual(rootItems.length, 1);

    const fileGroup = rootItems[0] as RouteFileGroupItem;
    const routeItems = await provider.getChildren(fileGroup);

    assert.strictEqual(routeItems.length, 3);

    const item0 = routeItems[0] as RouteTreeItem;
    const item1 = routeItems[1] as RouteTreeItem;
    const item2 = routeItems[2] as RouteTreeItem;

    // /users GET comes before /users POST
    assert.strictEqual(item0.label, 'GET /users');
    assert.strictEqual(item0.description, 'Line 6'); // 1-based display
    assert.strictEqual(item0.command?.command, COMMANDS.OPEN_ROUTE);
    assert.deepStrictEqual(item0.command?.arguments, [routes[1]]);

    assert.strictEqual(item1.label, 'POST /users');
    assert.strictEqual(item1.description, 'Line 16');

    // /users/:id DELETE comes after /users
    assert.strictEqual(item2.label, 'DELETE /users/:id');
    assert.strictEqual(item2.description, 'Line 26');
  });

  test('RouteTreeItem constructs informative Markdown tooltip', () => {
    const route: ApiRoute = {
      method: 'GET',
      path: '/profile',
      filePath: '/workspace/routes/userRoutes.js',
      line: 11,
      column: 2,
      framework: 'express',
    };

    const treeItem = new RouteTreeItem(route, 'routes/userRoutes.js');
    assert.ok(treeItem.tooltip instanceof vscode.MarkdownString);
    const value = treeItem.tooltip.value;

    assert.ok(value.includes('`GET` /profile'));
    assert.ok(value.includes('routes/userRoutes.js'));
    assert.ok(value.includes('Line 12, Column 3'));
    assert.ok(value.includes('Express'));
  });

  test('Preserves duplicate routes without deduplication', async () => {
    const provider = new RouteTreeProvider();
    const routes: ApiRoute[] = [
      {
        method: 'GET',
        path: '/users',
        filePath: '/workspace/routes/userRoutes.js',
        line: 10,
        column: 0,
        framework: 'express',
      },
      {
        method: 'GET',
        path: '/users',
        filePath: '/workspace/routes/userRoutes.js',
        line: 45,
        column: 0,
        framework: 'express',
      },
    ];

    provider.setRoutes(routes);
    const rootItems = await provider.getChildren();
    const fileGroup = rootItems[0] as RouteFileGroupItem;
    const routeItems = await provider.getChildren(fileGroup);

    assert.strictEqual(routeItems.length, 2, 'Duplicate routes must both be preserved');
  });

  test('clear() resets provider state back to initial unscanned state', async () => {
    const provider = new RouteTreeProvider();
    provider.setRoutes([
      {
        method: 'GET',
        path: '/test',
        filePath: '/workspace/test.js',
        line: 1,
        column: 0,
        framework: 'express',
      },
    ]);

    assert.strictEqual((await provider.getChildren()).length, 1);
    assert.ok((await provider.getChildren())[0] instanceof RouteFileGroupItem);

    provider.clear();
    const cleared = await provider.getChildren();
    assert.strictEqual(cleared.length, 1);
    assert.ok(cleared[0] instanceof RoutePlaceholderItem);
    assert.strictEqual(cleared[0].label, MESSAGES.NO_ROUTES_TITLE);
  });

  test('getMethodIcon returns distinct ThemeIcons for all HTTP methods', () => {
    const getIcon = getMethodIcon('GET');
    const postIcon = getMethodIcon('POST');
    const putIcon = getMethodIcon('PUT');
    const patchIcon = getMethodIcon('PATCH');
    const deleteIcon = getMethodIcon('DELETE');

    assert.strictEqual(getIcon.id, 'arrow-down');
    assert.strictEqual(postIcon.id, 'add');
    assert.strictEqual(putIcon.id, 'edit');
    assert.strictEqual(patchIcon.id, 'diff-modified');
    assert.strictEqual(deleteIcon.id, 'trash');
  });

  test('getRelativeFilePath falls back cleanly to basename if outside workspace', () => {
    const relative = getRelativeFilePath('/var/logs/server.js');
    assert.ok(relative.includes('server.js'));
  });

  test('getFolderDisplayLabel extracts last folder name instead of full path', () => {
    const allPaths = [
      'src/modules/admin/booking/admin.booking.routes.js',
      'src/modules/booking/booking.routes.js',
      'src/modules/admin/complaint/admin.complaint.routes.js',
      'routes/authRoutes.js',
      'server.js',
    ];

    // Single folder: complaint
    const complaintDisplay = getFolderDisplayLabel(
      'src/modules/admin/complaint/admin.complaint.routes.js',
      allPaths
    );
    assert.strictEqual(complaintDisplay.label, 'complaint');
    assert.strictEqual(complaintDisplay.description, '');

    // Duplicate folders: admin/booking vs booking
    const adminBookingDisplay = getFolderDisplayLabel(
      'src/modules/admin/booking/admin.booking.routes.js',
      allPaths
    );
    assert.strictEqual(adminBookingDisplay.label, 'booking');
    assert.strictEqual(adminBookingDisplay.description, 'admin');

    const bookingDisplay = getFolderDisplayLabel(
      'src/modules/booking/booking.routes.js',
      allPaths
    );
    assert.strictEqual(bookingDisplay.label, 'booking');

    // Generic folder: routes/authRoutes.js
    const genericDisplay = getFolderDisplayLabel('routes/authRoutes.js', allPaths);
    assert.strictEqual(genericDisplay.label, 'authRoutes.js');

    // Root file: server.js
    const rootDisplay = getFolderDisplayLabel('server.js', allPaths);
    assert.strictEqual(rootDisplay.label, 'server.js');
  });

  test('RouteTreeProvider setMethodFilter filters routes dynamically', async () => {
    const provider = new RouteTreeProvider();
    const routes: ApiRoute[] = [
      {
        method: 'GET',
        path: '/users',
        filePath: '/workspace/src/modules/user/user.routes.js',
        line: 10,
        column: 0,
        framework: 'express',
      },
      {
        method: 'POST',
        path: '/users',
        filePath: '/workspace/src/modules/user/user.routes.js',
        line: 20,
        column: 0,
        framework: 'express',
      },
      {
        method: 'DELETE',
        path: '/users/:id',
        filePath: '/workspace/src/modules/user/user.routes.js',
        line: 30,
        column: 0,
        framework: 'express',
      },
    ];

    provider.setRoutes(routes);

    // Initial state: all routes
    let rootGroups = await provider.getChildren();
    assert.strictEqual(rootGroups.length, 1);
    let childRoutes = await provider.getChildren(rootGroups[0]);
    assert.strictEqual(childRoutes.length, 3);

    // Filter by GET
    provider.setMethodFilter('GET');
    assert.strictEqual(provider.getMethodFilter(), 'GET');
    rootGroups = await provider.getChildren();
    assert.strictEqual(rootGroups.length, 1);
    childRoutes = await provider.getChildren(rootGroups[0]);
    assert.strictEqual(childRoutes.length, 1);
    assert.strictEqual((childRoutes[0] as RouteTreeItem).route.method, 'GET');

    // Filter by POST
    provider.setMethodFilter('POST');
    rootGroups = await provider.getChildren();
    assert.strictEqual(rootGroups.length, 1);
    childRoutes = await provider.getChildren(rootGroups[0]);
    assert.strictEqual(childRoutes.length, 1);
    assert.strictEqual((childRoutes[0] as RouteTreeItem).route.method, 'POST');

    // Clear filter
    provider.setMethodFilter(undefined);
    assert.strictEqual(provider.getMethodFilter(), undefined);
    rootGroups = await provider.getChildren();
    childRoutes = await provider.getChildren(rootGroups[0]);
    assert.strictEqual(childRoutes.length, 3);
  });
});
