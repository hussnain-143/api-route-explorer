import * as assert from 'assert';
import * as vscode from 'vscode';
import { RouteTreeProvider } from '../providers/routeTreeProvider';
import { COMMANDS, MESSAGES } from '../utils/constants';

suite('API Route Explorer — Sprint 0 Test Suite', () => {
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
  });

  test('RouteTreeProvider renders clean empty state when no routes discovered', async () => {
    const provider = new RouteTreeProvider();
    const children = await provider.getChildren();

    assert.strictEqual(children.length, 1, 'Expected 1 placeholder child in Sprint 0');
    assert.strictEqual(children[0].label, MESSAGES.NO_ROUTES_TITLE);
    assert.strictEqual(children[0].description, MESSAGES.NO_ROUTES_DESCRIPTION);
  });
});
