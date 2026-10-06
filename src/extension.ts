import * as vscode from 'vscode';
import { ApiRoute } from './models/route';
import { RouteTreeProvider } from './providers/routeTreeProvider';
import { scanWorkspaceRoutes } from './scanner/routeScanner';
import { COMMANDS, VIEWS, MESSAGES } from './utils/constants';

/**
 * Activates the API Route Explorer extension.
 */
export function activate(context: vscode.ExtensionContext): void {
  const routeTreeProvider = new RouteTreeProvider();

  /**
   * Scans the workspace, passes discovered routes to RouteTreeProvider, and alerts the user.
   */
  const executeScan = async (showFeedback: boolean = true): Promise<void> => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      if (showFeedback) {
        vscode.window.showWarningMessage(MESSAGES.NO_WORKSPACE);
      }
      return;
    }

    try {
      const routes = await scanWorkspaceRoutes();
      console.log('Discovered routes:', routes);
      routeTreeProvider.setRoutes(routes);

      if (showFeedback) {
        if (routes.length === 0) {
          vscode.window.showInformationMessage(MESSAGES.NO_ROUTES_FOUND);
        } else {
          vscode.window.showInformationMessage(`Discovered ${routes.length} API routes.`);
        }
      }
    } catch (error) {
      console.error('[API Route Explorer] Route scan failed:', error);
      vscode.window.showErrorMessage('Failed to scan API routes. See developer console for details.');
    }
  };

  context.subscriptions.push(
    // 1. Dedicated Activity Bar View
    vscode.window.registerTreeDataProvider(VIEWS.ROUTES, routeTreeProvider),

    // 2. File Explorer sidebar section
    vscode.window.registerTreeDataProvider(VIEWS.EXPLORER_ROUTES, routeTreeProvider),

    // 3. Scan Routes command
    vscode.commands.registerCommand(COMMANDS.SCAN_ROUTES, async () => {
      await executeScan(true);
    }),

    // 4. Refresh command (re-scans and updates the tree view)
    vscode.commands.registerCommand(COMMANDS.REFRESH_ROUTES, async () => {
      await executeScan(true);
    }),

    // 5. Jump to Route Definition command (triggered when clicking a route in the tree)
    vscode.commands.registerCommand(COMMANDS.OPEN_ROUTE, async (route: ApiRoute) => {
      if (!route || !route.filePath) {
        return;
      }

      try {
        const fileUri = vscode.Uri.file(route.filePath);
        const document = await vscode.workspace.openTextDocument(fileUri);
        const editor = await vscode.window.showTextDocument(document, {
          preview: true,
          preserveFocus: false,
        });

        const targetLine = Math.max(0, route.line);
        const targetColumn = Math.max(0, route.column);
        const position = new vscode.Position(targetLine, targetColumn);
        const selection = new vscode.Selection(position, position);

        editor.selection = selection;
        editor.revealRange(
          new vscode.Range(position, position),
          vscode.TextEditorRevealType.InCenter
        );
      } catch (error) {
        console.error(`[API Route Explorer] Could not open route source file: ${route.filePath}`, error);
        vscode.window.showErrorMessage(MESSAGES.FILE_NOT_FOUND);
      }
    })
  );
}

/**
 * Deactivates the extension.
 */
export function deactivate(): void {}
