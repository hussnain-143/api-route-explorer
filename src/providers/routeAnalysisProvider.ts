import * as vscode from 'vscode';
import { ApiRoute, HttpMethod } from '../models/route';
import { RouteAnalysisResult } from '../analysis/routeAnalyzer';
import { DuplicateRouteGroup, RoutePathGroup } from '../analysis/duplicateDetector';
import { MissingHandlerWarning } from '../analysis/handlerAnalyzer';
import { COMMANDS } from '../utils/constants';
import { getMethodIcon, getRelativeFilePath } from './routeTreeProvider';

/**
 * Tree item for analysis category groups and metrics.
 */
export class AnalysisCategoryItem extends vscode.TreeItem {
  constructor(
    label: string,
    description: string,
    icon: string | vscode.ThemeIcon,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
    public readonly categoryType?: 'summary' | 'sharedPaths' | 'duplicates' | 'missingHandlers' | 'methods'
  ) {
    super(label, collapsibleState);
    this.description = description;
    this.iconPath = typeof icon === 'string' ? new vscode.ThemeIcon(icon) : icon;
  }
}

/**
 * Tree item for an individual shared route path.
 */
export class SharedPathTreeItem extends vscode.TreeItem {
  constructor(public readonly group: RoutePathGroup) {
    super(group.normalizedPath, vscode.TreeItemCollapsibleState.Collapsed);
    this.description = group.methods.join(', ');
    this.iconPath = new vscode.ThemeIcon('split-horizontal', new vscode.ThemeColor('charts.blue'));
    this.tooltip = `Shared Path: ${group.normalizedPath}\nMethods: ${group.methods.join(', ')} (${group.routes.length} routes)`;
  }
}

/**
 * Tree item for a duplicate conflict group.
 */
export class DuplicateGroupTreeItem extends vscode.TreeItem {
  constructor(public readonly group: DuplicateRouteGroup) {
    super(`${group.method} ${group.normalizedPath}`, vscode.TreeItemCollapsibleState.Collapsed);
    this.description = `${group.routes.length} occurrences`;
    this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.orange'));
    this.tooltip = `Duplicate conflict: ${group.method} ${group.normalizedPath}\n${group.routes.length} conflicting declarations found`;
  }
}

/**
 * Tree item representing an individual route occurrence inside an analysis group.
 */
export class AnalysisRouteLeafItem extends vscode.TreeItem {
  constructor(
    public readonly route: ApiRoute,
    prefixText?: string
  ) {
    const relFile = getRelativeFilePath(route.filePath);
    const label = prefixText ? `${prefixText} (${relFile}:${route.line + 1})` : `${route.method} ${route.path} (${relFile}:${route.line + 1})`;
    super(label, vscode.TreeItemCollapsibleState.None);

    this.description = `Line ${route.line + 1}`;
    this.iconPath = getMethodIcon(route.method);
    this.tooltip = `Click to jump to ${relFile} Line ${route.line + 1}`;
    this.command = {
      command: COMMANDS.OPEN_ROUTE,
      title: 'Jump to Route Definition',
      arguments: [route],
    };
  }
}

/**
 * TreeDataProvider for the dedicated Route Analysis sidebar view.
 * Provides interactive, persistent drill-downs into metrics, shared paths, duplicates, and missing handlers.
 */
export class RouteAnalysisProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
  public readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | void> = this._onDidChangeTreeData.event;

  private analysis: RouteAnalysisResult | undefined;
  private hasScanned: boolean = false;

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  public setAnalysis(analysis: RouteAnalysisResult): void {
    this.hasScanned = true;
    this.analysis = analysis;
    this.refresh();
  }

  public clear(): void {
    this.hasScanned = false;
    this.analysis = undefined;
    this.refresh();
  }

  public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  public getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
    if (!this.hasScanned || !this.analysis) {
      const placeholder = new vscode.TreeItem(
        'No analysis available',
        vscode.TreeItemCollapsibleState.None
      );
      placeholder.description = 'Scan workspace to display smart route analysis';
      placeholder.iconPath = new vscode.ThemeIcon('search');
      return Promise.resolve([placeholder]);
    }

    const { statistics, sharedPaths, duplicates, missingHandlers } = this.analysis;

    // Sub-children: Shared Path routes
    if (element instanceof SharedPathTreeItem) {
      const items = element.group.routes.map(
        (route) => new AnalysisRouteLeafItem(route, route.method)
      );
      return Promise.resolve(items);
    }

    // Sub-children: Duplicate group occurrences
    if (element instanceof DuplicateGroupTreeItem) {
      const items = element.group.routes.map(
        (route) => new AnalysisRouteLeafItem(route, `Occurrence: ${route.method}`)
      );
      return Promise.resolve(items);
    }

    // Sub-children: Category items
    if (element instanceof AnalysisCategoryItem) {
      if (element.categoryType === 'sharedPaths') {
        const items = sharedPaths.map((group) => new SharedPathTreeItem(group));
        return Promise.resolve(items);
      }

      if (element.categoryType === 'duplicates') {
        const items = duplicates.map((group) => new DuplicateGroupTreeItem(group));
        return Promise.resolve(items);
      }

      if (element.categoryType === 'missingHandlers') {
        const items = missingHandlers.map((warning: MissingHandlerWarning) => {
          const relFile = getRelativeFilePath(warning.filePath);
          const leaf = new vscode.TreeItem(
            `${warning.method} ${warning.path}`,
            vscode.TreeItemCollapsibleState.None
          );
          leaf.description = `${relFile}:${warning.line + 1}`;
          leaf.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'));
          leaf.tooltip = `Possible missing handler at ${relFile}:${warning.line + 1}`;
          leaf.command = {
            command: COMMANDS.OPEN_ROUTE,
            title: 'Jump to Suspicious Route',
            arguments: [{
              method: warning.method,
              path: warning.path,
              filePath: warning.filePath,
              line: warning.line,
              column: warning.column,
              framework: 'express',
            }],
          };
          return leaf;
        });
        return Promise.resolve(items);
      }

      if (element.categoryType === 'methods') {
        const methods: HttpMethod[] = ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS', 'HEAD'];
        const items: vscode.TreeItem[] = [];

        for (const method of methods) {
          const count = statistics.methodCounts[method] || 0;
          if (count > 0) {
            const pct = Math.round((count / (statistics.totalRoutes || 1)) * 100);
            const methodItem = new vscode.TreeItem(
              `${method}: ${count} routes`,
              vscode.TreeItemCollapsibleState.None
            );
            methodItem.description = `${pct}% of total`;
            methodItem.iconPath = getMethodIcon(method);
            methodItem.tooltip = `Click to search all ${method} routes`;
            methodItem.command = {
              command: COMMANDS.SEARCH_ROUTES,
              title: `Search ${method} Routes`,
              arguments: [method],
            };
            items.push(methodItem);
          }
        }
        return Promise.resolve(items);
      }

      return Promise.resolve([]);
    }

    // Root Level Items
    const rootItems: vscode.TreeItem[] = [];

    // 1. Summary Overview
    const summaryItem = new AnalysisCategoryItem(
      `Overview: ${statistics.totalRoutes} Routes`,
      `${statistics.totalFiles} source files • ${statistics.framework}`,
      new vscode.ThemeIcon('symbol-event', new vscode.ThemeColor('charts.purple')),
      vscode.TreeItemCollapsibleState.None,
      'summary'
    );
    summaryItem.tooltip = `Total routes: ${statistics.totalRoutes}\nTotal files: ${statistics.totalFiles}\nFramework: ${statistics.framework}`;
    rootItems.push(summaryItem);

    // 2. Shared Route Paths
    const sharedCollapsible = sharedPaths.length > 0
      ? vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.None;
    const sharedItem = new AnalysisCategoryItem(
      `Shared Paths (${sharedPaths.length})`,
      sharedPaths.length === 0 ? 'None' : `${sharedPaths.length} multi-method endpoints`,
      new vscode.ThemeIcon('split-horizontal', new vscode.ThemeColor('charts.blue')),
      sharedCollapsible,
      'sharedPaths'
    );
    rootItems.push(sharedItem);

    // 3. Duplicate Route Conflicts
    const dupCollapsible = duplicates.length > 0
      ? vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.None;
    const dupIcon = duplicates.length === 0
      ? new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'))
      : new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.orange'));
    const dupItem = new AnalysisCategoryItem(
      `Duplicate Conflicts (${duplicates.length})`,
      duplicates.length === 0 ? '✓ No collisions detected' : `⚠️ ${duplicates.length} conflict(s)`,
      dupIcon,
      dupCollapsible,
      'duplicates'
    );
    rootItems.push(dupItem);

    // 4. Missing Handlers
    const missingCollapsible = missingHandlers.length > 0
      ? vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.None;
    const missingIcon = missingHandlers.length === 0
      ? new vscode.ThemeIcon('check', new vscode.ThemeColor('charts.green'))
      : new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'));
    const missingItem = new AnalysisCategoryItem(
      `Missing Handlers (${missingHandlers.length})`,
      missingHandlers.length === 0 ? '✓ All routes have handlers' : `⚠️ ${missingHandlers.length} suspicious`,
      missingIcon,
      missingCollapsible,
      'missingHandlers'
    );
    rootItems.push(missingItem);

    // 5. Method Distribution
    const activeMethods = Object.entries(statistics.methodCounts).filter(([, count]) => count > 0);
    const methodsSummary = activeMethods.map(([m, c]) => `${m}:${c}`).join(' • ');
    const methodsItem = new AnalysisCategoryItem(
      `HTTP Methods (${activeMethods.length})`,
      methodsSummary,
      new vscode.ThemeIcon('pie-chart', new vscode.ThemeColor('charts.foreground')),
      vscode.TreeItemCollapsibleState.Collapsed,
      'methods'
    );
    rootItems.push(methodsItem);

    return Promise.resolve(rootItems);
  }
}
