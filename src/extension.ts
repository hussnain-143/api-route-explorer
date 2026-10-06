import * as vscode from 'vscode';
import { RouteTreeProvider } from './providers/routeTreeProvider';
import { COMMANDS, VIEWS, MESSAGES } from './utils/constants';

/**
 * Activates the API Route Explorer extension.
 */
export function activate(context: vscode.ExtensionContext): void {
  const routeTreeProvider = new RouteTreeProvider();

  context.subscriptions.push(
    // 1. Dedicated Activity Bar View
    vscode.window.registerTreeDataProvider(VIEWS.ROUTES, routeTreeProvider),
    // 2. File Explorer sidebar section
    vscode.window.registerTreeDataProvider(VIEWS.EXPLORER_ROUTES, routeTreeProvider),
    // 3. Scan Routes command
    vscode.commands.registerCommand(COMMANDS.SCAN_ROUTES, () => {
      vscode.window.showInformationMessage(MESSAGES.SPRINT_0_SCAN_PLACEHOLDER);
    }),
    // 4. Refresh command
    vscode.commands.registerCommand(COMMANDS.REFRESH_ROUTES, () => {
      routeTreeProvider.refresh();
    })
  );
}

/**
 * Deactivates the extension.
 */
export function deactivate(): void {}
