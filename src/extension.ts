import * as vscode from 'vscode';
import { RouteTreeProvider } from './providers/routeTreeProvider';
import { scanWorkspaceRoutes } from './scanner/routeScanner';
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
    vscode.commands.registerCommand(COMMANDS.SCAN_ROUTES, async () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showWarningMessage(MESSAGES.NO_WORKSPACE);
        return;
      }

      try {
        const routes = await scanWorkspaceRoutes();
        console.log('Discovered routes:', routes);

        if (routes.length === 0) {
          vscode.window.showInformationMessage(MESSAGES.NO_ROUTES_DISCOVERED);
        } else {
          vscode.window.showInformationMessage(`Discovered ${routes.length} API routes.`);
        }
      } catch (error) {
        console.error('[API Route Explorer] Route scan failed:', error);
        vscode.window.showErrorMessage('Failed to scan API routes. See developer console for details.');
      }
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
