import * as vscode from 'vscode';
import { RouteTreeProvider } from './providers/routeTreeProvider';
import { COMMANDS, VIEWS, MESSAGES } from './utils/constants';

/**
 * Activates the API Route Explorer extension.
 */
export function activate(context: vscode.ExtensionContext): void {
  const routeTreeProvider = new RouteTreeProvider();

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(VIEWS.ROUTES, routeTreeProvider),
    vscode.commands.registerCommand(COMMANDS.SCAN_ROUTES, () => {
      vscode.window.showInformationMessage(MESSAGES.SPRINT_0_SCAN_PLACEHOLDER);
    }),
    vscode.commands.registerCommand(COMMANDS.REFRESH_ROUTES, () => {
      routeTreeProvider.refresh();
    })
  );
}

/**
 * Deactivates the extension.
 */
export function deactivate(): void {}
