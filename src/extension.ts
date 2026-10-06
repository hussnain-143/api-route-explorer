import * as vscode from 'vscode';
import { RouteTreeProvider } from './providers/routeTreeProvider';
import { COMMANDS, VIEWS, MESSAGES } from './utils/constants';

/**
 * Activates the API Route Explorer extension.
 */
export function activate(context: vscode.ExtensionContext): void {
  // 1. Initialize Route Tree Data Provider
  const routeTreeProvider = new RouteTreeProvider();

  // 2. Register native Tree View in Explorer sidebar
  const treeViewRegistration = vscode.window.registerTreeDataProvider(
    VIEWS.ROUTES,
    routeTreeProvider
  );

  // 3. Register 'Scan Routes' placeholder command
  const scanCommand = vscode.commands.registerCommand(
    COMMANDS.SCAN_ROUTES,
    () => {
      vscode.window.showInformationMessage(MESSAGES.SPRINT_0_SCAN_PLACEHOLDER);
    }
  );

  // 4. Register 'Refresh' command
  const refreshCommand = vscode.commands.registerCommand(
    COMMANDS.REFRESH_ROUTES,
    () => {
      routeTreeProvider.refresh();
    }
  );

  // 5. Push disposables to extension subscriptions
  context.subscriptions.push(treeViewRegistration, scanCommand, refreshCommand);
}

/**
 * Deactivates the extension.
 */
export function deactivate(): void {
  // Cleanup logic for future background watchers
}
