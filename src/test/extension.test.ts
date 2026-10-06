import * as assert from 'assert';
import * as vscode from 'vscode';
import { RouteTreeProvider } from '../providers/routeTreeProvider';
import { COMMANDS, MESSAGES } from '../utils/constants';

suite('API Route Explorer — Extension & Scanner Suite', () => {
  test('Commands are registered', async () => {
    const allCommands = await vscode.commands.getCommands(true);

    assert.ok(
      allCommands.includes(COMMANDS.SCAN_ROUTES),
      `Expected ${COMMANDS.SCAN_ROUTES} to be registered`
    );
    assert.ok(
      allCommands.includes(COMMANDS.REFRESH_ROUTES),
      `Expected ${COMMANDS.REFRESH_ROUTES} to be registered`
    );
    assert.ok(
      allCommands.includes(COMMANDS.OPEN_ROUTE),
      `Expected ${COMMANDS.OPEN_ROUTE} to be registered`
    );
  });

  test('RouteTreeProvider renders clean empty state when no routes discovered', async () => {
    const provider = new RouteTreeProvider();
    const children = await provider.getChildren();

    assert.strictEqual(children.length, 1, 'Expected 1 placeholder child');
    assert.strictEqual(children[0].label, MESSAGES.NO_ROUTES_TITLE);
    assert.strictEqual(children[0].description, MESSAGES.NO_ROUTES_DESCRIPTION);
  });

  test('Scan routes command executes cleanly without throwing', async () => {
    await assert.doesNotReject(async () => {
      await vscode.commands.executeCommand(COMMANDS.SCAN_ROUTES);
    });
  });

  test('Open route command handles missing file safely without crashing', async () => {
    await assert.doesNotReject(async () => {
      await vscode.commands.executeCommand(COMMANDS.OPEN_ROUTE, {
        method: 'GET',
        path: '/missing',
        filePath: '/does/not/exist.js',
        line: 0,
        column: 0,
        framework: 'express',
      });
    });
  });
});
