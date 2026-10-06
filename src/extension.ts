import * as vscode from 'vscode';
import { ApiRoute } from './models/route';
import {
  RouteFileGroupItem,
  RouteTreeItem,
  RouteTreeProvider,
} from './providers/routeTreeProvider';
import { createRouteFileWatcher } from './scanner/routeWatcher';
import { scanWorkspaceRoutes } from './scanner/routeScanner';
import { showRouteQuickPick } from './scanner/routeSearch';
import { COMMANDS, MESSAGES, VIEWS } from './utils/constants';
import { openFile, openRoute } from './utils/navigation';

/**
 * Extracts an ApiRoute from various possible command argument formats.
 */
export function extractRouteFromArg(arg: unknown): ApiRoute | undefined {
  if (!arg) {
    return undefined;
  }
  if (arg instanceof RouteTreeItem) {
    return arg.route;
  }
  if (typeof arg === 'object' && 'route' in arg) {
    return (arg as { route: ApiRoute }).route;
  }
  if (
    typeof arg === 'object' &&
    'path' in arg &&
    'method' in arg &&
    'filePath' in arg
  ) {
    return arg as ApiRoute;
  }
  return undefined;
}

/**
 * Extracts a file path string from various possible command argument formats.
 */
export function extractFilePathFromArg(arg: unknown): string | undefined {
  if (!arg) {
    return undefined;
  }
  if (typeof arg === 'string') {
    return arg;
  }
  if (arg instanceof RouteTreeItem) {
    return arg.route.filePath;
  }
  if (arg instanceof RouteFileGroupItem) {
    return arg.filePath;
  }
  if (typeof arg === 'object' && 'filePath' in arg) {
    return (arg as { filePath: string }).filePath;
  }
  if (typeof arg === 'object' && 'route' in arg) {
    return (arg as { route: ApiRoute }).route.filePath;
  }
  return undefined;
}

/**
 * Activates the API Route Explorer extension.
 */
export function activate(context: vscode.ExtensionContext): void {
  const routeTreeProvider = new RouteTreeProvider();

  // Create dedicated TreeView instance for Activity Bar to enable reveal & selection
  const routesTreeView = vscode.window.createTreeView(VIEWS.ROUTES, {
    treeDataProvider: routeTreeProvider,
    showCollapseAll: true,
  });

  // Track scanning state to avoid concurrent scans and race conditions
  let isScanning = false;
  let scanPending = false;

  /**
   * Scans the workspace, passes discovered routes to RouteTreeProvider, and provides feedback.
   */
  const executeScan = async (showFeedback: boolean = true): Promise<void> => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      if (showFeedback) {
        vscode.window.showWarningMessage(MESSAGES.NO_WORKSPACE);
      }
      return;
    }

    if (isScanning) {
      scanPending = true;
      return;
    }

    isScanning = true;
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
      if (showFeedback) {
        vscode.window.showErrorMessage('Failed to scan API routes. See developer console for details.');
      }
    } finally {
      isScanning = false;
      if (scanPending) {
        scanPending = false;
        // Run queued background scan silently
        void executeScan(false);
      }
    }
  };

  // Active editor route awareness: safely highlight or expand matching route in TreeView
  const updateActiveEditorRoute = () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !routeTreeProvider.getHasScanned() || !routesTreeView.visible) {
      return;
    }

    const currentFilePath = editor.document.uri.fsPath;
    const currentLine = editor.selection.active.line;

    const match = routeTreeProvider.findRouteItemAt(currentFilePath, currentLine);
    if (match) {
      routesTreeView.reveal(match.routeItem, {
        select: true,
        focus: false,
        expand: true,
      }).then(undefined, () => {
        // Safe: ignore any reveal errors if tree is not visible or ready
      });
    }
  };

  context.subscriptions.push(
    routesTreeView,

    // File Explorer sidebar section
    vscode.window.registerTreeDataProvider(VIEWS.EXPLORER_ROUTES, routeTreeProvider),

    // Active editor listeners for route awareness
    vscode.window.onDidChangeActiveTextEditor(updateActiveEditorRoute),
    vscode.window.onDidChangeTextEditorSelection(updateActiveEditorRoute),

    // Auto-refresh file watcher with debouncing (750ms)
    createRouteFileWatcher(() => executeScan(false), 750),

    // 1. Scan Routes command
    vscode.commands.registerCommand(COMMANDS.SCAN_ROUTES, async () => {
      await executeScan(true);
    }),

    // 2. Refresh command (re-scans and updates the tree view)
    vscode.commands.registerCommand(COMMANDS.REFRESH_ROUTES, async () => {
      await executeScan(true);
    }),

    // 3. Search Routes command (QuickPick modal with method, path, and file matching)
    vscode.commands.registerCommand(COMMANDS.SEARCH_ROUTES, async () => {
      await showRouteQuickPick(
        routeTreeProvider.getRoutes(),
        routeTreeProvider.getHasScanned()
      );
    }),

    // 4. Jump to Route Definition command (opens file + exact line/col)
    vscode.commands.registerCommand(COMMANDS.OPEN_ROUTE, async (arg: unknown) => {
      const route = extractRouteFromArg(arg);
      if (route) {
        await openRoute(route);
      }
    }),

    // 5. Open File command (opens source file without jumping to specific line)
    vscode.commands.registerCommand(COMMANDS.OPEN_FILE, async (arg: unknown) => {
      const filePath = extractFilePathFromArg(arg);
      if (filePath) {
        await openFile(filePath);
      }
    }),

    // 6. Copy Route Path command (copies e.g. "/api/users/:id")
    vscode.commands.registerCommand(COMMANDS.COPY_ROUTE_PATH, async (arg: unknown) => {
      const route = extractRouteFromArg(arg);
      if (route) {
        await vscode.env.clipboard.writeText(route.path);
        vscode.window.showInformationMessage(MESSAGES.ROUTE_PATH_COPIED);
      }
    }),

    // 7. Copy Route Signature command (copies e.g. "GET /api/users/:id")
    vscode.commands.registerCommand(COMMANDS.COPY_ROUTE, async (arg: unknown) => {
      const route = extractRouteFromArg(arg);
      if (route) {
        await vscode.env.clipboard.writeText(`${route.method} ${route.path}`);
        vscode.window.showInformationMessage(MESSAGES.ROUTE_COPIED);
      }
    })
  );
}

/**
 * Deactivates the extension.
 */
export function deactivate(): void {}
