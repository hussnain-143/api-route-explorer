import * as vscode from 'vscode';
import { ApiFramework, ApiRoute, HttpMethod } from './models/route';
import {
  RouteFileGroupItem,
  RouteFilterOptions,
  RouteTreeItem,
  RouteTreeProvider,
} from './providers/routeTreeProvider';
import { RouteAnalysisProvider } from './providers/routeAnalysisProvider';
import { createRouteFileWatcher, RouteFileChangeEvent } from './scanner/routeWatcher';
import {
  scanWorkspaceDetailed,
  scanSingleFile,
  removeSingleFile,
} from './scanner/routeScanner';
import { RouteIndex } from './scanner/routeIndex';
import { showRouteQuickPick } from './scanner/routeSearch';
import {
  analyzeWorkspaceRoutes,
  RouteAnalysisResult,
} from './analysis/routeAnalyzer';
import { RouteDiagnosticsManager } from './analysis/diagnostics';
import { showRouteStatisticsModal } from './analysis/routeStatistics';
import { showExportRoutesDialog } from './utils/routeExporter';
import { COMMANDS, MESSAGES, RouteGroupingMode, VIEWS } from './utils/constants';
import { openFile, openRoute } from './utils/navigation';
import {
  buildCurlCommand,
  buildRouteDefinition,
  buildRouteUrl,
} from './utils/routeFormatters';
import { RouteHealth } from './analysis/analysisTypes';

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

  // Initialize grouping mode from configuration
  const initialGrouping = vscode.workspace
    .getConfiguration('apiRouteExplorer')
    .get<RouteGroupingMode>('defaultGrouping', 'file');
  routeTreeProvider.setGroupingMode(initialGrouping);

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

  // In-memory state tracking
  let isScanning = false;
  let scanPending = false;
  let activeCts: vscode.CancellationTokenSource | undefined;
  let currentAnalysis: RouteAnalysisResult | undefined;
  let currentRouteIndex = new RouteIndex();
  let currentFileSources = new Map<string, string>();

  const updateTreeViewDescription = (): void => {
    if (!currentAnalysis || currentAnalysis.routes.length === 0) {
      routesTreeView.description = undefined;
      return;
    }
    const mode = routeTreeProvider.getGroupingMode();
    const modeLabel = mode === 'file' ? '' : ` [By ${mode.charAt(0).toUpperCase() + mode.slice(1)}]`;
    const filter = routeTreeProvider.getMethodFilter();
    const filterOpts = routeTreeProvider.getFilterOptions();

    let activeFilterLabel = '';
    if (filter) {
      activeFilterLabel = ` [Filter: ${filter}]`;
    } else if (filterOpts.framework && filterOpts.framework !== 'ALL') {
      activeFilterLabel = ` [Filter: ${filterOpts.framework}]`;
    } else if (filterOpts.method && filterOpts.method !== 'ALL') {
      activeFilterLabel = ` [Filter: ${filterOpts.method}]`;
    } else if (filterOpts.health && filterOpts.health !== 'ALL') {
      activeFilterLabel = ` [Filter: ${filterOpts.health}]`;
    } else if (filterOpts.state && filterOpts.state !== 'ALL') {
      activeFilterLabel = ` [Filter: ${filterOpts.state}]`;
    }

    routesTreeView.description = `${currentAnalysis.routes.length} routes (${currentAnalysis.statistics.totalFiles} files)${modeLabel}${activeFilterLabel}`;
  };

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

  const applyAnalysis = (analysis: RouteAnalysisResult): void => {
    currentAnalysis = analysis;
    routeTreeProvider.setRoutes(analysis.routes, analysis);
    routeAnalysisProvider.setAnalysis(analysis);
    diagnosticsManager.updateDiagnostics(
      analysis.duplicates,
      analysis.missingHandlers,
      analysis.conflicts
    );

    updateTreeViewDescription();
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
  };

  /**
   * Scans the workspace, executes smart analysis (prefixes, duplicates, missing handlers, stats),
   * and refreshes TreeView, diagnostics, and search state. Supports cancellation and progress reporting.
   */
  const executeScan = async (showFeedback: boolean = true): Promise<void> => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      routeTreeProvider.clear();
      routeAnalysisProvider.clear();
      diagnosticsManager.clear();
      currentRouteIndex.clear();
      currentFileSources.clear();
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
      activeCts?.cancel();
      scanPending = true;
      return;
    }

    isScanning = true;
    routeTreeProvider.setIsScanning(true);
    const cts = new vscode.CancellationTokenSource();
    activeCts = cts;

    try {
      const scanPromise = async (
        progress?: vscode.Progress<{ message?: string; increment?: number }>
      ) => {
        progress?.report({ message: 'Discovering routes...' });

        const scanResult = await scanWorkspaceDetailed(
          cts.token,
          progress
        );

        if (cts.token.isCancellationRequested) {
          return;
        }

        // Cache RouteIndex and fileSources in memory
        currentRouteIndex = scanResult.routeIndex ?? new RouteIndex();
        currentFileSources = scanResult.fileSources;

        progress?.report({ message: 'Analyzing route relationships and health...' });
        const analysis = analyzeWorkspaceRoutes(
          currentRouteIndex.getAllRoutes(),
          currentFileSources
        );

        if (cts.token.isCancellationRequested) {
          return;
        }

        applyAnalysis(analysis);

        if (showFeedback) {
          const count = analysis.routes.length;
          const msg =
            count === 1
              ? `Found ${count} API route.`
              : `Found ${count} API routes.`;
          vscode.window.showInformationMessage(msg);
        }
      };

      if (showFeedback) {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'API Route Explorer',
            cancellable: true,
          },
          async (progress, token) => {
            token.onCancellationRequested(() => {
              cts.cancel();
            });
            await scanPromise(progress);
          }
        );
      } else {
        await scanPromise();
      }
    } catch (error) {
      if (cts.token.isCancellationRequested) {
        return;
      }
      console.error('[API Route Explorer] Scan failed:', error);
      if (showFeedback) {
        vscode.window.showErrorMessage('Failed to scan workspace routes.');
      }
    } finally {
      isScanning = false;
      routeTreeProvider.setIsScanning(false);
      cts.dispose();
      if (activeCts === cts) {
        activeCts = undefined;
      }
      if (scanPending) {
        scanPending = false;
        void executeScan(false);
      }
    }
  };

  /**
   * Evaluates if a changed file is a top-level prefix mounting file (app.js, server.ts, etc.)
   * where modifications may alter route prefixes globally across multiple router files.
   */
  const isPrefixAffectingFile = (filePath: string, content?: string): boolean => {
    const base = filePath.toLowerCase();
    if (
      base.endsWith('app.js') ||
      base.endsWith('app.ts') ||
      base.endsWith('server.js') ||
      base.endsWith('server.ts') ||
      base.endsWith('main.ts') ||
      base.endsWith('main.js') ||
      base.endsWith('index.js') ||
      base.endsWith('index.ts')
    ) {
      return true;
    }
    if (content) {
      if (
        content.includes('.use(') ||
        content.includes('.register(') ||
        content.includes('@Module(')
      ) {
        return true;
      }
    }
    return false;
  };

  /**
   * Incrementally updates routes and analysis for specific changed files without rescanning
   * the entire workspace filesystem.
   */
  const executeIncrementalUpdate = async (events?: RouteFileChangeEvent[]): Promise<void> => {
    if (isScanning) {
      scanPending = true;
      return;
    }

    if (!events || events.length === 0 || !routeTreeProvider.getHasScanned()) {
      await executeScan(false);
      return;
    }

    if (events.length > 20) {
      await executeScan(false);
      return;
    }

    const textDecoder = new TextDecoder('utf-8');
    let requiresFullScan = false;
    const contentsToApply = new Map<string, { type: 'change' | 'create' | 'delete'; content?: string }>();

    for (const evt of events) {
      if (evt.type === 'delete') {
        if (isPrefixAffectingFile(evt.uri.fsPath)) {
          requiresFullScan = true;
          break;
        }
        contentsToApply.set(evt.uri.fsPath, { type: 'delete' });
      } else {
        try {
          const fileBytes = await vscode.workspace.fs.readFile(evt.uri);
          const content = textDecoder.decode(fileBytes);
          if (isPrefixAffectingFile(evt.uri.fsPath, content)) {
            requiresFullScan = true;
            break;
          }
          contentsToApply.set(evt.uri.fsPath, { type: evt.type, content });
        } catch {
          requiresFullScan = true;
          break;
        }
      }
    }

    if (requiresFullScan) {
      await executeScan(false);
      return;
    }

    // Apply incremental changes to in-memory RouteIndex and fileSources cache
    for (const [filePath, data] of contentsToApply.entries()) {
      if (data.type === 'delete') {
        removeSingleFile(filePath, currentRouteIndex, currentFileSources);
      } else if (data.content !== undefined) {
        scanSingleFile(filePath, data.content, currentRouteIndex, currentFileSources);
      }
    }

    // Re-run route analysis on updated route index
    const analysis = analyzeWorkspaceRoutes(currentRouteIndex.getAllRoutes(), currentFileSources);
    applyAnalysis(analysis);
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

    // Workspace configuration change listener
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('apiRouteExplorer.defaultGrouping')) {
        const mode = vscode.workspace
          .getConfiguration('apiRouteExplorer')
          .get<RouteGroupingMode>('defaultGrouping', 'file');
        routeTreeProvider.setGroupingMode(mode);
        updateTreeViewDescription();
      }
      if (e.affectsConfiguration('apiRouteExplorer.scan.exclude')) {
        void executeScan(false);
      }
    }),

    // Auto-refresh file watcher with debouncing and incremental updates (750ms)
    createRouteFileWatcher((events) => {
      const autoRefresh = vscode.workspace
        .getConfiguration('apiRouteExplorer')
        .get<boolean>('autoRefresh', true);
      if (autoRefresh) {
        void executeIncrementalUpdate(events);
      }
    }, 750),

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
        const config = vscode.workspace.getConfiguration('apiRouteExplorer');
        const baseUrl = config.get<string>('baseUrl', 'http://localhost:3000');
        const curlCmd = buildCurlCommand(route, baseUrl);
        await vscode.env.clipboard.writeText(curlCmd);
        vscode.window.showInformationMessage(`Copied cURL command: ${route.method} ${route.path}`);
      }
    }),

    // 9. Copy Route URL command (e.g. "http://localhost:3000/api/users/:id")
    vscode.commands.registerCommand(COMMANDS.COPY_ROUTE_URL, async (arg: unknown) => {
      const route = extractRouteFromArg(arg);
      if (route) {
        const config = vscode.workspace.getConfiguration('apiRouteExplorer');
        const baseUrl = config.get<string>('baseUrl', 'http://localhost:3000');
        const url = buildRouteUrl(route, baseUrl);
        await vscode.env.clipboard.writeText(url);
        vscode.window.showInformationMessage(`Copied Route URL: ${url}`);
      }
    }),

    // 10. Copy Route Definition command (e.g. "GET /users/:id -> routes.ts:42")
    vscode.commands.registerCommand(COMMANDS.COPY_ROUTE_DEFINITION, async (arg: unknown) => {
      const route = extractRouteFromArg(arg);
      if (route) {
        const def = buildRouteDefinition(route);
        await vscode.env.clipboard.writeText(def);
        vscode.window.showInformationMessage(`Copied Route Definition: ${def}`);
      }
    }),

    // 11. Group Routes By... command (File, Framework, Method, Health)
    vscode.commands.registerCommand(COMMANDS.GROUP_BY, async () => {
      interface GroupPickItem extends vscode.QuickPickItem {
        mode: RouteGroupingMode;
      }
      const currentMode = routeTreeProvider.getGroupingMode();
      const items: GroupPickItem[] = [
        {
          label: '$(file-code) Group by File',
          description: 'Default view: organized by source files and modules',
          detail: currentMode === 'file' ? '✓ Currently active' : undefined,
          mode: 'file',
        },
        {
          label: '$(server) Group by Framework',
          description: 'Organize by Express, Next.js, Fastify, NestJS',
          detail: currentMode === 'framework' ? '✓ Currently active' : undefined,
          mode: 'framework',
        },
        {
          label: '$(symbol-method) Group by HTTP Method',
          description: 'Organize by GET, POST, PUT, DELETE, etc.',
          detail: currentMode === 'method' ? '✓ Currently active' : undefined,
          mode: 'method',
        },
        {
          label: '$(heart) Group by Route Health',
          description: 'Organize by Errors, Warnings, Info, and Healthy',
          detail: currentMode === 'health' ? '✓ Currently active' : undefined,
          mode: 'health',
        },
      ];

      const pick = await vscode.window.showQuickPick(items, {
        title: 'API Route Explorer: Group Routes',
        placeHolder: 'Select how routes should be grouped in the tree view',
      });

      if (pick) {
        routeTreeProvider.setGroupingMode(pick.mode);
        updateTreeViewDescription();
      }
    }),

    // 12. Search Similar Routes command
    vscode.commands.registerCommand(COMMANDS.SEARCH_SIMILAR_ROUTES, async (arg: unknown) => {
      const route = extractRouteFromArg(arg);
      const allRoutes = routeTreeProvider.getRoutes();
      if (route) {
        const segments = route.path.split('/').filter(Boolean);
        const query = segments.length > 0 ? segments[0] : route.path;
        await showRouteQuickPick(allRoutes, true, query);
      } else {
        await showRouteQuickPick(allRoutes, routeTreeProvider.getHasScanned());
      }
    }),

    // 13. Export Routes command (JSON & Markdown)
    vscode.commands.registerCommand(COMMANDS.EXPORT_ROUTES, async () => {
      const routes = routeTreeProvider.getRoutes();
      if (routes.length === 0) {
        vscode.window.showInformationMessage(MESSAGES.NO_ROUTES_FOUND);
        return;
      }
      const filteredRoutes = routeTreeProvider.getFilteredRoutesList();
      await showExportRoutesDialog(routes, routeTreeProvider.getAnalysis(), filteredRoutes);
    }),

    // 14. Filter routes by HTTP method
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
        updateTreeViewDescription();
        updateStatusBar();
      }
    }),

    // 15. Advanced Filter Routes Hub
    vscode.commands.registerCommand(COMMANDS.FILTER_ROUTES, async () => {
      const allRoutes = routeTreeProvider.getRoutes();
      if (allRoutes.length === 0) {
        vscode.window.showInformationMessage(MESSAGES.SEARCH_NO_SCAN);
        return;
      }

      interface FilterActionItem extends vscode.QuickPickItem {
        action: () => Promise<void> | void;
      }

      const items: FilterActionItem[] = [
        {
          label: '$(clear-all) Clear All Filters',
          description: 'Reset all filters and display all routes',
          action: () => {
            routeTreeProvider.clearFilters();
            updateTreeViewDescription();
            updateStatusBar();
          },
        },
        {
          label: '$(server) Filter by Framework...',
          description: 'Express, Next.js, Fastify, NestJS',
          action: async () => {
            const fwPick = await vscode.window.showQuickPick(
              [
                { label: 'All Frameworks', value: 'ALL' },
                { label: 'Express', value: 'express' },
                { label: 'Next.js', value: 'nextjs' },
                { label: 'Fastify', value: 'fastify' },
                { label: 'NestJS', value: 'nestjs' },
              ],
              { title: 'Filter Routes by Framework' }
            );
            if (fwPick) {
              const current = routeTreeProvider.getFilterOptions();
              routeTreeProvider.setFilterOptions({
                ...current,
                framework: fwPick.value as ApiFramework | 'ALL',
              });
              updateTreeViewDescription();
              updateStatusBar();
            }
          },
        },
        {
          label: '$(symbol-method) Filter by HTTP Method...',
          description: 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD',
          action: async () => {
            await vscode.commands.executeCommand(COMMANDS.FILTER_BY_METHOD);
          },
        },
        {
          label: '$(heart) Filter by Health...',
          description: 'Healthy, Warnings, Errors, Info',
          action: async () => {
            const healthPick = await vscode.window.showQuickPick(
              [
                { label: 'All Health Statuses', value: 'ALL' },
                { label: '$(pass) Healthy', value: 'healthy' },
                { label: '$(warning) Warnings', value: 'warning' },
                { label: '$(error) Errors', value: 'error' },
                { label: '$(info) Info', value: 'info' },
              ],
              { title: 'Filter Routes by Health' }
            );
            if (healthPick) {
              const current = routeTreeProvider.getFilterOptions();
              routeTreeProvider.setFilterOptions({
                ...current,
                health: healthPick.value as RouteHealth | 'ALL',
              });
              updateTreeViewDescription();
              updateStatusBar();
            }
          },
        },
        {
          label: '$(issues) Filter by Route State...',
          description: 'Duplicates, Shared Paths, Conflicts, Shadowed, Missing Handler',
          action: async () => {
            const statePick = await vscode.window.showQuickPick(
              [
                { label: 'All States', value: 'ALL' },
                { label: 'Duplicate Routes', value: 'DUPLICATES' },
                { label: 'Shared Path Endpoints', value: 'SHARED' },
                { label: 'Potential Route Conflicts', value: 'CONFLICTS' },
                { label: 'Shadowed Routes', value: 'SHADOWED' },
                { label: 'Missing Handlers', value: 'MISSING_HANDLER' },
              ],
              { title: 'Filter Routes by State' }
            );
            if (statePick) {
              const current = routeTreeProvider.getFilterOptions();
              routeTreeProvider.setFilterOptions({
                ...current,
                state: statePick.value as RouteFilterOptions['state'],
              });
              updateTreeViewDescription();
              updateStatusBar();
            }
          },
        },
      ];

      const selected = await vscode.window.showQuickPick(items, {
        title: 'API Route Explorer: Filter Routes',
        placeHolder: 'Select a filter category',
      });
      if (selected) {
        await selected.action();
      }
    }),

    // 16. Status Bar Quick Menu
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
          detail: 'Fuzzy search by path, HTTP method, framework, or file name',
          action: async () => {
            await vscode.commands.executeCommand(COMMANDS.SEARCH_ROUTES);
          },
        },
        {
          label: '$(list-tree) Group Routes By...',
          description: `Current: ${routeTreeProvider.getGroupingMode()}`,
          detail: 'Switch between File, Framework, Method, and Health grouping',
          action: async () => {
            await vscode.commands.executeCommand(COMMANDS.GROUP_BY);
          },
        },
        {
          label: `$(filter) Filter Routes...${filterLabel}`,
          description: filter ? `Active: ${filter}` : 'Filter by framework, method, health, or state',
          detail: 'Filter route collection in-memory',
          action: async () => {
            await vscode.commands.executeCommand(COMMANDS.FILTER_ROUTES);
          },
        },
        {
          label: '$(export) Export Routes...',
          description: 'Export routes as JSON or Markdown documentation',
          detail: 'Save route inventory with health and middleware details',
          action: async () => {
            await vscode.commands.executeCommand(COMMANDS.EXPORT_ROUTES);
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
        placeHolder: 'Select an action to inspect, filter, or export API routes',
      });

      if (pick) {
        await pick.action();
      }
    }),

    // 17. Show Route Statistics command
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
