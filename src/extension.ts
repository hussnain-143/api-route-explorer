import * as vscode from 'vscode';
import { ApiRoute, HttpMethod } from './models/route';
import {
  RouteFileGroupItem,
  RouteTreeItem,
  RouteTreeProvider,
} from './providers/routeTreeProvider';
import { RouteAnalysisProvider } from './providers/routeAnalysisProvider';
import { createRouteFileWatcher } from './scanner/routeWatcher';
import { scanWorkspaceDetailed } from './scanner/routeScanner';
import { showRouteQuickPick } from './scanner/routeSearch';
import {
  analyzeWorkspaceRoutes,
  RouteAnalysisResult,
} from './analysis/routeAnalyzer';
import { RouteDiagnosticsManager } from './analysis/diagnostics';
import { showRouteStatisticsModal } from './analysis/routeStatistics';
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
  const routeAnalysisProvider = new RouteAnalysisProvider();
  const diagnosticsManager = new RouteDiagnosticsManager();

  // Create dedicated TreeView instances for Activity Bar
  const routesTreeView = vscode.window.createTreeView(VIEWS.ROUTES, {
    treeDataProvider: routeTreeProvider,
    showCollapseAll: true,
  });

  const analysisTreeView = vscode.window.createTreeView(VIEWS.ANALYSIS, {
    treeDataProvider: routeAnalysisProvider,
    showCollapseAll: true,
  });

  // Dedicated Status Bar Item for real-time route counts and quick actions
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = COMMANDS.STATUS_BAR_MENU;
  statusBarItem.tooltip = 'API Route Explorer: Click for route actions & search';

  // Track scanning state and latest smart analysis result
  let isScanning = false;
  let scanPending = false;
  let currentAnalysis: RouteAnalysisResult | undefined;

  const updateStatusBar = (): void => {
    if (!currentAnalysis || currentAnalysis.routes.length === 0) {
      statusBarItem.text = '$(symbol-event) 0 Routes';
      statusBarItem.tooltip = 'API Route Explorer: 0 routes discovered. Click to open menu.';
    } else {
      const count = currentAnalysis.routes.length;
      const filter = routeTreeProvider.getMethodFilter();
      if (filter) {
        statusBarItem.text = `$(symbol-event) ${count} Routes [${filter}]`;
        statusBarItem.tooltip = `API Route Explorer: Filtered by ${filter}. Click to open menu.`;
      } else {
        statusBarItem.text = `$(symbol-event) ${count} Routes`;
        statusBarItem.tooltip = `API Route Explorer: ${count} routes discovered in ${currentAnalysis.statistics.totalFiles} files. Click to open menu.`;
      }
    }
    statusBarItem.show();
  };

  /**
   * Scans the workspace, executes smart analysis (prefixes, duplicates, missing handlers, stats),
   * and refreshes TreeView, diagnostics, and search state.
   */
  const executeScan = async (showFeedback: boolean = true): Promise<void> => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      routeTreeProvider.clear();
      routeAnalysisProvider.clear();
      diagnosticsManager.clear();
      routesTreeView.description = undefined;
      routesTreeView.badge = undefined;
      analysisTreeView.description = undefined;
      statusBarItem.hide();
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
      const { routes: rawRoutes, fileSources } = await scanWorkspaceDetailed();
      const analysis = analyzeWorkspaceRoutes(rawRoutes, fileSources);
      currentAnalysis = analysis;

      console.log('Discovered routes with resolved prefixes:', analysis.routes);
      routeTreeProvider.setRoutes(analysis.routes, analysis);
      routeAnalysisProvider.setAnalysis(analysis);
      diagnosticsManager.updateDiagnostics(
        analysis.duplicates,
        analysis.missingHandlers,
        analysis.conflicts
      );

      routesTreeView.description = `${analysis.routes.length} routes (${analysis.statistics.totalFiles} files)`;
      routesTreeView.badge = {
        value: analysis.routes.length,
        tooltip: `${analysis.routes.length} discovered API routes`,
      };

      const errorCount = analysis.statistics.errorCount;
      const warningCount = analysis.statistics.warningCount;
      analysisTreeView.description =
        errorCount === 0 && warningCount === 0
          ? `${analysis.statistics.healthyCount} Healthy • ${analysis.sharedPaths.length} shared`
          : errorCount > 0
          ? `❌ ${errorCount} error(s) • ⚠️ ${warningCount} warning(s)`
          : `⚠️ ${warningCount} warning(s) • ${analysis.statistics.healthyCount} Healthy`;

      updateStatusBar();

      if (showFeedback) {
        if (analysis.routes.length === 0) {
          vscode.window.showInformationMessage(MESSAGES.NO_ROUTES_FOUND);
        } else {
          vscode.window.showInformationMessage(`Discovered ${analysis.routes.length} API routes.`);
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
      routesTreeView
        .reveal(match.routeItem, {
          select: true,
          focus: false,
          expand: true,
        })
        .then(undefined, () => {
          // Safe: ignore any reveal errors if tree is not visible or ready
        });
    }
  };

  context.subscriptions.push(
    routesTreeView,
    analysisTreeView,
    statusBarItem,
    diagnosticsManager,

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
    }),

    // 8. Copy as cURL command (copies reproducible curl command)
    vscode.commands.registerCommand(COMMANDS.COPY_CURL, async (arg: unknown) => {
      const route = extractRouteFromArg(arg);
      if (route) {
        let curlCmd = `curl -X ${route.method} "http://localhost:3000${route.path}"`;
        if (route.method === 'POST' || route.method === 'PUT' || route.method === 'PATCH') {
          curlCmd += ` -H "Content-Type: application/json" -d '{}'`;
        }
        await vscode.env.clipboard.writeText(curlCmd);
        vscode.window.showInformationMessage(`Copied cURL command: ${route.method} ${route.path}`);
      }
    }),

    // 9. Filter routes by HTTP method or analysis context
    vscode.commands.registerCommand(COMMANDS.FILTER_BY_METHOD, async () => {
      const allRoutes = routeTreeProvider.getRoutes();
      if (allRoutes.length === 0) {
        vscode.window.showInformationMessage(MESSAGES.SEARCH_NO_SCAN);
        return;
      }

      const currentFilter = routeTreeProvider.getMethodFilter();
      const getCount = (m: string) => allRoutes.filter((r) => r.method === m).length;

      interface FilterPickItem extends vscode.QuickPickItem {
        filterValue?: HttpMethod | 'SHARED' | 'DUPLICATES';
      }

      const items: FilterPickItem[] = [
        {
          label: '$(list-unordered) All Methods',
          description: `${allRoutes.length} routes`,
          detail: currentFilter === undefined ? '✓ Currently showing all routes' : undefined,
          filterValue: undefined,
        },
        {
          label: '$(arrow-down) GET',
          description: `${getCount('GET')} routes`,
          detail: currentFilter === 'GET' ? '✓ Currently filtered by GET' : undefined,
          filterValue: 'GET',
        },
        {
          label: '$(add) POST',
          description: `${getCount('POST')} routes`,
          detail: currentFilter === 'POST' ? '✓ Currently filtered by POST' : undefined,
          filterValue: 'POST',
        },
        {
          label: '$(edit) PUT',
          description: `${getCount('PUT')} routes`,
          detail: currentFilter === 'PUT' ? '✓ Currently filtered by PUT' : undefined,
          filterValue: 'PUT',
        },
        {
          label: '$(diff) PATCH',
          description: `${getCount('PATCH')} routes`,
          detail: currentFilter === 'PATCH' ? '✓ Currently filtered by PATCH' : undefined,
          filterValue: 'PATCH',
        },
        {
          label: '$(trash) DELETE',
          description: `${getCount('DELETE')} routes`,
          detail: currentFilter === 'DELETE' ? '✓ Currently filtered by DELETE' : undefined,
          filterValue: 'DELETE',
        },
        {
          label: '$(git-merge) Shared Path Endpoints',
          description: currentAnalysis ? `${currentAnalysis.sharedPaths.length} routes` : undefined,
          detail: currentFilter === 'SHARED' ? '✓ Currently filtered by shared paths' : 'Endpoints supporting multiple HTTP methods',
          filterValue: 'SHARED',
        },
        {
          label: '$(warning) Duplicate Conflicts',
          description: currentAnalysis ? `${currentAnalysis.duplicates.length} conflicts` : undefined,
          detail: currentFilter === 'DUPLICATES' ? '✓ Currently filtered by duplicates' : 'Identical method and path declarations',
          filterValue: 'DUPLICATES',
        },
      ];

      const pick = await vscode.window.showQuickPick(items, {
        title: 'Filter API Routes by Method',
        placeHolder: 'Select an HTTP method or condition to filter the sidebar',
      });

      if (pick !== undefined) {
        routeTreeProvider.setMethodFilter(pick.filterValue);
        if (pick.filterValue) {
          routesTreeView.description = `[Filter: ${pick.filterValue}]`;
        } else if (currentAnalysis) {
          routesTreeView.description = `${currentAnalysis.routes.length} routes (${currentAnalysis.statistics.totalFiles} files)`;
        } else {
          routesTreeView.description = undefined;
        }
        updateStatusBar();
      }
    }),

    // 10. Status Bar Quick Menu
    vscode.commands.registerCommand(COMMANDS.STATUS_BAR_MENU, async () => {
      const totalRoutes = routeTreeProvider.getRoutes().length;
      const filter = routeTreeProvider.getMethodFilter();
      const filterLabel = filter ? ` (Filter: ${filter})` : '';

      interface MenuActionItem extends vscode.QuickPickItem {
        action: () => Promise<void> | void;
      }

      const items: MenuActionItem[] = [
        {
          label: '$(search) Search Routes...',
          description: `${totalRoutes} routes available`,
          detail: 'Fuzzy search by path, HTTP method, or file name',
          action: async () => {
            await vscode.commands.executeCommand(COMMANDS.SEARCH_ROUTES);
          },
        },
        {
          label: `$(filter) Filter by HTTP Method...${filterLabel}`,
          description: filter ? `Active: ${filter}` : 'All methods shown',
          detail: 'Show only GET, POST, PUT, DELETE, Duplicates, or Shared endpoints',
          action: async () => {
            await vscode.commands.executeCommand(COMMANDS.FILTER_BY_METHOD);
          },
        },
        {
          label: '$(graph) Route Statistics & Diagnostics...',
          description: currentAnalysis ? `${currentAnalysis.routes.length} routes, ${currentAnalysis.statistics.totalFiles} files` : '',
          detail: 'View breakdown by method, duplicates, and shared paths',
          action: async () => {
            await vscode.commands.executeCommand(COMMANDS.SHOW_STATISTICS);
          },
        },
        {
          label: '$(refresh) Rescan Workspace Routes',
          description: 'Discover newly added or modified routes',
          detail: 'Scans JavaScript and TypeScript files in workspace',
          action: async () => {
            await executeScan(true);
          },
        },
      ];

      const pick = await vscode.window.showQuickPick(items, {
        title: 'API Route Explorer — Quick Hub',
        placeHolder: 'Select an action to inspect or navigate API routes',
      });

      if (pick) {
        await pick.action();
      }
    }),

    // 11. Show Route Statistics command (Sprint 4: modal breakdown of routes, methods, duplicates, shared paths)
    vscode.commands.registerCommand(COMMANDS.SHOW_STATISTICS, async () => {
      if (!routeTreeProvider.getHasScanned() || !currentAnalysis) {
        await executeScan(false);
      }

      if (!currentAnalysis || currentAnalysis.routes.length === 0) {
        vscode.window.showInformationMessage(MESSAGES.NO_ROUTES_FOUND);
        return;
      }

      await showRouteStatisticsModal(currentAnalysis.statistics, currentAnalysis);
    })
  );
}

/**
 * Deactivates the extension.
 */
export function deactivate(): void {}
