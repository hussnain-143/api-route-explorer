import * as path from 'path';
import * as vscode from 'vscode';
import { ApiFramework, ApiRoute, HttpMethod } from '../models/route';
import { RouteAnalysisResult } from '../analysis/routeAnalyzer';
import {
  RouteHealth,
  RouteIssue,
  RouteMiddleware,
  RouteConflict,
} from '../analysis/analysisTypes';
import { getRouteKey } from '../analysis/routeRelationshipAnalyzer';
import { COMMANDS, CONTEXT_VALUES, MESSAGES, RouteGroupingMode } from '../utils/constants';

/**
 * Computes a readable path relative to the workspace root.
 * Falls back to the filename if workspace context is unavailable.
 */
export function getRelativeFilePath(filePath: string): string {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    for (const folder of workspaceFolders) {
      const folderPath = folder.uri.fsPath;
      if (filePath.startsWith(folderPath)) {
        const relative = path.relative(folderPath, filePath);
        return relative.replace(/\\/g, '/');
      }
    }
  }
  return path.basename(filePath);
}

/**
 * Provides distinct ThemeIcon glyphs with semantic ThemeColors for HTTP methods.
 * Ensures accessibility and visual differentiation without relying solely on color.
 */
export function getMethodIcon(method: HttpMethod): vscode.ThemeIcon {
  switch (method) {
    case 'GET':
      return new vscode.ThemeIcon('arrow-down', new vscode.ThemeColor('charts.blue'));
    case 'POST':
      return new vscode.ThemeIcon('add', new vscode.ThemeColor('charts.green'));
    case 'PUT':
      return new vscode.ThemeIcon('edit', new vscode.ThemeColor('charts.orange'));
    case 'PATCH':
      return new vscode.ThemeIcon('diff-modified', new vscode.ThemeColor('charts.yellow'));
    case 'DELETE':
      return new vscode.ThemeIcon('trash', new vscode.ThemeColor('charts.red'));
    case 'ANY':
      return new vscode.ThemeIcon('globe', new vscode.ThemeColor('charts.purple'));
    default:
      return new vscode.ThemeIcon('symbol-method');
  }
}

/**
 * Computes a developer-friendly folder display label for file groups.
 * Replaces long repetitive paths (e.g. `src/modules/admin/booking/admin.booking.routes.js`)
 * with clean module folder names (e.g. `booking` or `admin/booking`).
 */
export function getFolderDisplayLabel(
  relativeFilePath: string,
  allRelativeFilePaths?: string[] | Map<string, number>
): { label: string; description: string; tooltip: string } {
  const normalized = relativeFilePath.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  const fileName = parts.length > 0 ? parts[parts.length - 1] : relativeFilePath;

  // Root level file (e.g. "app.js")
  if (parts.length <= 1) {
    return {
      label: fileName,
      description: '',
      tooltip: normalized,
    };
  }

  const lastFolder = parts[parts.length - 2];

  // If the folder is generic (e.g. "routes", "src", "api") and there is no custom module name,
  // display the filename for clean clarity (e.g. routes/authRoutes.js -> authRoutes.js).
  const genericFolders = ['routes', 'src', 'api', 'controllers', 'handlers', 'endpoints'];
  if (genericFolders.includes(lastFolder.toLowerCase())) {
    return {
      label: fileName,
      description: lastFolder,
      tooltip: normalized,
    };
  }

  // Strictly show only the last folder name as the main label (e.g. "booking", "dash", "auth")
  // If multiple route files in the workspace share the same last folder (e.g. admin/booking vs booking),
  // disambiguate in the description with parent folder or filename.
  let contextHint = '';
  let hasMultiple = false;

  if (allRelativeFilePaths instanceof Map) {
    hasMultiple = (allRelativeFilePaths.get(lastFolder) || 0) > 1;
  } else if (Array.isArray(allRelativeFilePaths) && allRelativeFilePaths.length > 0) {
    let count = 0;
    for (const p of allRelativeFilePaths) {
      const segs = p.replace(/\\/g, '/').split('/').filter(Boolean);
      if (segs.length > 1 && segs[segs.length - 2] === lastFolder) {
        count++;
        if (count > 1) {
          hasMultiple = true;
          break;
        }
      }
    }
  }

  if (hasMultiple) {
    const parentFolder = parts.length >= 3 ? parts[parts.length - 3] : '';
    if (parentFolder && !['src', 'modules', 'api', 'routes'].includes(parentFolder.toLowerCase())) {
      contextHint = parentFolder;
    } else {
      contextHint = fileName;
    }
  }

  return {
    label: lastFolder,
    description: contextHint,
    tooltip: normalized,
  };
}

/**
 * Level 1 TreeItem: Represents a source file grouping routes.
 */
export class RouteFileGroupItem extends vscode.TreeItem {
  constructor(
    public readonly filePath: string,
    public readonly relativeFilePath: string,
    public readonly routes: ApiRoute[],
    allRelativeFilePaths?: string[] | Map<string, number>
  ) {
    const { label, description: contextHint, tooltip: fullPath } =
      getFolderDisplayLabel(relativeFilePath, allRelativeFilePaths);

    super(label, vscode.TreeItemCollapsibleState.Expanded);

    const countLabel = `${routes.length} route${routes.length === 1 ? '' : 's'}`;
    this.description = contextHint ? `${countLabel} • ${contextHint}` : countLabel;
    this.iconPath = vscode.ThemeIcon.Folder;
    this.tooltip = `${fullPath} (${countLabel})`;
    this.contextValue = CONTEXT_VALUES.FILE_GROUP;
  }
}

/**
 * Level 1 TreeItem: Represents a framework grouping routes.
 */
export class RouteFrameworkGroupItem extends vscode.TreeItem {
  constructor(
    public readonly framework: ApiFramework,
    public readonly routes: ApiRoute[]
  ) {
    let title = 'Express';
    if (framework === 'nextjs' || framework === 'next') {
      title = 'Next.js';
    } else if (framework === 'fastify') {
      title = 'Fastify';
    } else if (framework === 'nestjs') {
      title = 'NestJS';
    }

    super(title, vscode.TreeItemCollapsibleState.Expanded);

    const countLabel = `${routes.length} route${routes.length === 1 ? '' : 's'}`;
    this.description = countLabel;
    this.iconPath = new vscode.ThemeIcon('server', new vscode.ThemeColor('charts.blue'));
    this.tooltip = `${title} (${countLabel})`;
    this.contextValue = CONTEXT_VALUES.FRAMEWORK_GROUP;
  }
}

/**
 * Level 1 TreeItem: Represents an HTTP method grouping routes.
 */
export class RouteMethodGroupItem extends vscode.TreeItem {
  constructor(
    public readonly method: HttpMethod,
    public readonly routes: ApiRoute[]
  ) {
    super(method, vscode.TreeItemCollapsibleState.Expanded);

    const countLabel = `${routes.length} route${routes.length === 1 ? '' : 's'}`;
    this.description = countLabel;
    this.iconPath = getMethodIcon(method);
    this.tooltip = `${method} Endpoints (${countLabel})`;
    this.contextValue = CONTEXT_VALUES.METHOD_GROUP;
  }
}

/**
 * Level 1 TreeItem: Represents a health status grouping routes.
 */
export class RouteHealthGroupItem extends vscode.TreeItem {
  constructor(
    public readonly health: RouteHealth,
    public readonly routes: ApiRoute[]
  ) {
    let title = 'Healthy';
    let icon = new vscode.ThemeIcon('pass', new vscode.ThemeColor('charts.green'));
    if (health === 'error') {
      title = 'Errors';
      icon = new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
    } else if (health === 'warning') {
      title = 'Warnings';
      icon = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'));
    } else if (health === 'info') {
      title = 'Info';
      icon = new vscode.ThemeIcon('info', new vscode.ThemeColor('charts.blue'));
    }

    super(title, vscode.TreeItemCollapsibleState.Expanded);

    const countLabel = `${routes.length} route${routes.length === 1 ? '' : 's'}`;
    this.description = countLabel;
    this.iconPath = icon;
    this.tooltip = `${title} (${countLabel})`;
    this.contextValue = CONTEXT_VALUES.HEALTH_GROUP;
  }
}

/**
 * Filter configuration for in-memory route filtering.
 */
export interface RouteFilterOptions {
  framework?: ApiFramework | 'ALL';
  method?: HttpMethod | 'ALL';
  health?: RouteHealth | 'ALL';
  state?: 'ALL' | 'DUPLICATES' | 'SHARED' | 'CONFLICTS' | 'SHADOWED' | 'MISSING_HANDLER';
  filePath?: string;
  query?: string;
}

/**
 * Contextual analysis flags for an individual route tree item.
 */
export interface RouteAnalysisContext {
  isDuplicate?: boolean;
  isShared?: boolean;
  isMissingHandler?: boolean;
  sharedMethods?: HttpMethod[];
  health?: RouteHealth;
  issues?: RouteIssue[];
  middleware?: RouteMiddleware[];
  conflicts?: RouteConflict[];
}

/**
 * Level 2 TreeItem: Represents an individual HTTP API route.
 */
export class RouteTreeItem extends vscode.TreeItem {
  constructor(
    public readonly route: ApiRoute,
    public readonly relativeFilePath: string,
    public readonly analysisContext?: RouteAnalysisContext,
    public readonly showFileInDescription: boolean = false
  ) {
    // METHOD + PATH compact display
    super(`${route.method} ${route.path}`, vscode.TreeItemCollapsibleState.None);

    let baseDesc = `Line ${route.line + 1}`;
    let icon = getMethodIcon(route.method);

    if (analysisContext?.isDuplicate) {
      baseDesc = `Line ${route.line + 1} • ⚠️ Duplicate`;
      icon = new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
    } else if (analysisContext?.isMissingHandler) {
      baseDesc = `Line ${route.line + 1} • ⚠️ Missing handler`;
      icon = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'));
    } else if (analysisContext?.conflicts && analysisContext.conflicts.length > 0) {
      const isShadow = analysisContext.conflicts.some((c) => c.isShadowing);
      baseDesc = `Line ${route.line + 1} • ${isShadow ? '⚠️ Shadowed' : '⚠️ Conflict'}`;
      icon = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.orange'));
    } else if (analysisContext?.health === 'warning') {
      baseDesc = `Line ${route.line + 1} • ⚠️ Warning`;
      icon = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.orange'));
    } else if (analysisContext?.isShared) {
      baseDesc = `Line ${route.line + 1} • Shared`;
    }

    if (showFileInDescription) {
      const fileName = path.basename(route.filePath);
      this.description = `${baseDesc} • ${fileName}`;
    } else {
      this.description = baseDesc;
    }

    this.iconPath = icon;
    this.contextValue = CONTEXT_VALUES.ROUTE;

    // Rich Markdown tooltip
    const tooltip = new vscode.MarkdownString();
    tooltip.appendMarkdown(`### \`${route.method}\` ${route.path}\n\n`);
    tooltip.appendMarkdown(`- **File**: \`${relativeFilePath}\`\n`);
    let fwName = 'Express';
    if (route.framework === 'nextjs' || route.framework === 'next') {
      fwName = 'Next.js';
    } else if (route.framework === 'fastify') {
      fwName = 'Fastify';
    } else if (route.framework === 'nestjs') {
      fwName = 'NestJS';
    }
    tooltip.appendMarkdown(`- **Location**: Line ${route.line + 1}, Column ${route.column + 1}\n`);
    tooltip.appendMarkdown(`- **Framework**: ${fwName}\n`);

    const healthLabel =
      analysisContext?.health === 'error'
        ? 'Error'
        : analysisContext?.health === 'warning'
        ? 'Warning'
        : analysisContext?.health === 'info'
        ? 'Info'
        : 'Healthy';
    tooltip.appendMarkdown(`- **Health**: ${healthLabel}\n`);

    if (analysisContext?.isDuplicate) {
      tooltip.appendMarkdown(`\n\n> ⚠️ **Duplicate Route**: Another route with method \`${route.method}\` and identical normalized path exists.`);
    } else if (analysisContext?.isMissingHandler) {
      tooltip.appendMarkdown(`\n\n> ⚠️ **Possible Missing Handler**: No controller or middleware appears to be supplied.`);
    }

    if (analysisContext?.issues && analysisContext.issues.length > 0) {
      tooltip.appendMarkdown(`\n**Issues**:\n`);
      for (const issue of analysisContext.issues) {
        tooltip.appendMarkdown(`• ${issue.message}\n`);
      }
    }

    if (analysisContext?.middleware && analysisContext.middleware.length > 0) {
      tooltip.appendMarkdown(`\n**Middleware**:\n`);
      for (const mw of analysisContext.middleware) {
        tooltip.appendMarkdown(`• ${mw.name} (${mw.type})\n`);
      }
    }

    if (analysisContext?.isShared) {
      const methodsStr = analysisContext.sharedMethods ? analysisContext.sharedMethods.join(', ') : 'multiple HTTP methods';
      tooltip.appendMarkdown(`\n\n> 🔄 **Shared Route Path**: Endpoint mounted with ${methodsStr}.`);
    }

    this.tooltip = tooltip;

    // Click command to navigate directly to code line/column
    this.command = {
      command: COMMANDS.OPEN_ROUTE,
      title: 'Jump to Route Definition',
      arguments: [route],
    };
  }
}

/**
 * Informational placeholder TreeItem for empty/unscanned states.
 */
export class RoutePlaceholderItem extends vscode.TreeItem {
  constructor(
    label: string,
    description: string,
    icon: string = 'info',
    command?: vscode.Command
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.iconPath = new vscode.ThemeIcon(icon);
    this.contextValue = CONTEXT_VALUES.PLACEHOLDER;
    this.tooltip = `${label}: ${description}`;
    if (command) {
      this.command = command;
    }
  }
}

/**
 * TreeDataProvider implementing the API Routes Explorer hierarchy:
 * Supports dynamic grouping by File, Framework, Method, or Health.
 */
export class RouteTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
  public readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | void> = this._onDidChangeTreeData.event;

  private routes: ApiRoute[] = [];
  private hasScanned: boolean = false;
  private isScanning: boolean = false;
  private groupingMode: RouteGroupingMode = 'file';
  private filterOptions: RouteFilterOptions = {};
  private activeMethodFilter?: HttpMethod | 'SHARED' | 'DUPLICATES';

  private fileGroups: RouteFileGroupItem[] = [];
  private frameworkGroups: RouteFrameworkGroupItem[] = [];
  private methodGroups: RouteMethodGroupItem[] = [];
  private healthGroups: RouteHealthGroupItem[] = [];

  private analysis: RouteAnalysisResult | undefined;
  private duplicateKeys = new Set<string>();
  private sharedPathMap = new Map<string, HttpMethod[]>();
  private missingHandlerKeys = new Set<string>();

  /**
   * Refreshes the TreeView without altering route data.
   */
  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Sets the scanning status and triggers a responsive tree view refresh.
   */
  public setIsScanning(scanning: boolean): void {
    if (this.isScanning !== scanning) {
      this.isScanning = scanning;
      this.refresh();
    }
  }

  public getIsScanning(): boolean {
    return this.isScanning;
  }

  /**
   * Replaces current route collection, caches pre-sorted groups, and triggers refresh.
   */
  public setRoutes(routes: ApiRoute[], analysis?: RouteAnalysisResult): void {
    this.hasScanned = true;
    this.isScanning = false;
    this.routes = routes;
    this.analysis = analysis;
    this.indexAnalysis(analysis);
    this.rebuildGroups();
    this.refresh();
  }

  /**
   * Sets grouping mode without rescanning the workspace.
   */
  public setGroupingMode(mode: RouteGroupingMode): void {
    if (this.groupingMode !== mode) {
      this.groupingMode = mode;
      this.rebuildGroups();
      this.refresh();
    }
  }

  public getGroupingMode(): RouteGroupingMode {
    return this.groupingMode;
  }

  /**
   * Sets route filter options and updates TreeView in-memory.
   */
  public setFilterOptions(options: RouteFilterOptions): void {
    this.filterOptions = { ...options };
    if (options.method && options.method !== 'ALL') {
      this.activeMethodFilter = options.method;
    } else if (options.method === 'ALL') {
      this.activeMethodFilter = undefined;
    }
    this.rebuildGroups();
    this.refresh();
  }

  public getFilterOptions(): RouteFilterOptions {
    return this.filterOptions;
  }

  public clearFilters(): void {
    this.filterOptions = {};
    this.activeMethodFilter = undefined;
    this.rebuildGroups();
    this.refresh();
  }

  public hasActiveFilter(): boolean {
    return Boolean(
      this.activeMethodFilter ||
      (this.filterOptions.framework && this.filterOptions.framework !== 'ALL') ||
      (this.filterOptions.method && this.filterOptions.method !== 'ALL') ||
      (this.filterOptions.health && this.filterOptions.health !== 'ALL') ||
      (this.filterOptions.state && this.filterOptions.state !== 'ALL') ||
      this.filterOptions.filePath ||
      this.filterOptions.query
    );
  }

  /**
   * Indexes analysis findings for O(1) route lookup in the TreeView.
   */
  private indexAnalysis(analysis?: RouteAnalysisResult): void {
    this.duplicateKeys.clear();
    this.sharedPathMap.clear();
    this.missingHandlerKeys.clear();

    if (!analysis) {
      return;
    }

    for (const group of analysis.duplicates) {
      for (const r of group.routes) {
        this.duplicateKeys.add(`${r.method}:${r.filePath}:${r.line}`);
      }
    }

    for (const group of analysis.sharedPaths) {
      for (const r of group.routes) {
        this.sharedPathMap.set(`${r.method}:${r.filePath}:${r.line}`, group.methods);
      }
    }

    for (const warning of analysis.missingHandlers) {
      this.missingHandlerKeys.add(`${warning.method}:${warning.filePath}:${warning.line}`);
    }
  }

  /**
   * Resets scanner state and clears routes.
   */
  public clear(): void {
    this.hasScanned = false;
    this.routes = [];
    this.analysis = undefined;
    this.duplicateKeys.clear();
    this.sharedPathMap.clear();
    this.missingHandlerKeys.clear();
    this.fileGroups = [];
    this.frameworkGroups = [];
    this.methodGroups = [];
    this.healthGroups = [];
    this.refresh();
  }

  public getRoutes(): ApiRoute[] {
    return this.routes;
  }

  public getAnalysis(): RouteAnalysisResult | undefined {
    return this.analysis;
  }

  public getHasScanned(): boolean {
    return this.hasScanned;
  }

  public getFileGroups(): RouteFileGroupItem[] {
    return this.fileGroups;
  }

  public getFrameworkGroups(): RouteFrameworkGroupItem[] {
    return this.frameworkGroups;
  }

  public getMethodGroups(): RouteMethodGroupItem[] {
    return this.methodGroups;
  }

  public getHealthGroups(): RouteHealthGroupItem[] {
    return this.healthGroups;
  }

  public getRouteHealth(route: ApiRoute): RouteHealth {
    const relKey = getRouteKey(route);
    const rel = this.analysis?.relationships?.get(relKey);
    return rel?.health ?? 'healthy';
  }

  public createRouteTreeItem(
    route: ApiRoute,
    relativeFilePath?: string,
    showFileInDescription: boolean = false
  ): RouteTreeItem {
    const relPath = relativeFilePath ?? getRelativeFilePath(route.filePath);
    const key = `${route.method}:${route.filePath}:${route.line}`;
    const relKey = getRouteKey(route);
    const rel = this.analysis?.relationships?.get(relKey);

    const analysisContext: RouteAnalysisContext = {
      isDuplicate: this.duplicateKeys.has(key),
      isShared: this.sharedPathMap.has(key),
      isMissingHandler: this.missingHandlerKeys.has(key),
      sharedMethods: this.sharedPathMap.get(key),
      health: rel?.health,
      issues: rel?.issues,
      middleware: rel?.middleware,
      conflicts: rel?.conflicts,
    };

    return new RouteTreeItem(route, relPath, analysisContext, showFileInDescription);
  }

  public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  public getParent(element: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem> {
    if (element instanceof RouteTreeItem) {
      switch (this.groupingMode) {
        case 'framework': {
          const fw = element.route.framework === 'next' ? 'nextjs' : element.route.framework;
          return this.frameworkGroups.find(
            (g) => (g.framework === 'next' ? 'nextjs' : g.framework) === fw
          );
        }
        case 'method':
          return this.methodGroups.find((g) => g.method === element.route.method);
        case 'health': {
          const health = this.getRouteHealth(element.route);
          return this.healthGroups.find((g) => g.health === health);
        }
        case 'file':
        default:
          return this.fileGroups.find((g) => g.filePath === element.route.filePath);
      }
    }
    return undefined;
  }

  public getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
    if (element instanceof RouteFileGroupItem) {
      const items = element.routes.map((route) =>
        this.createRouteTreeItem(route, element.relativeFilePath, false)
      );
      return Promise.resolve(items);
    }

    if (element instanceof RouteFrameworkGroupItem) {
      const items = element.routes.map((route) =>
        this.createRouteTreeItem(route, undefined, true)
      );
      return Promise.resolve(items);
    }

    if (element instanceof RouteMethodGroupItem) {
      const items = element.routes.map((route) =>
        this.createRouteTreeItem(route, undefined, true)
      );
      return Promise.resolve(items);
    }

    if (element instanceof RouteHealthGroupItem) {
      const items = element.routes.map((route) =>
        this.createRouteTreeItem(route, undefined, true)
      );
      return Promise.resolve(items);
    }

    if (element) {
      return Promise.resolve([]);
    }

    // Root level: Scanning in progress
    if (this.isScanning && !this.hasScanned) {
      return Promise.resolve([
        new RoutePlaceholderItem(
          'Scanning workspace routes...',
          'Discovering API routes across workspace files...',
          'loading~spin'
        ),
      ]);
    }

    // Root level: Unscanned state
    if (!this.hasScanned) {
      return Promise.resolve([
        new RoutePlaceholderItem(
          MESSAGES.NO_ROUTES_TITLE,
          MESSAGES.NO_ROUTES_DESCRIPTION,
          'search',
          {
            command: COMMANDS.SCAN_ROUTES,
            title: 'Scan Routes',
          }
        ),
      ]);
    }

    // Root level: Scanned but 0 routes found
    if (this.routes.length === 0) {
      return Promise.resolve([
        new RoutePlaceholderItem(
          MESSAGES.NO_ROUTES_FOUND,
          MESSAGES.NO_ROUTES_EMPTY_DESCRIPTION,
          'info',
          {
            command: COMMANDS.SCAN_ROUTES,
            title: 'Rescan Routes',
          }
        ),
      ]);
    }

    const currentGroups = this.getCurrentGroups();

    // Root level: Filter applied but 0 routes matched filter
    if (currentGroups.length === 0 && this.hasActiveFilter()) {
      return Promise.resolve([
        new RoutePlaceholderItem(
          'No routes match active filter',
          'Click to adjust filter criteria or reset filters.',
          'filter',
          {
            command: COMMANDS.FILTER_ROUTES,
            title: 'Filter Routes',
          }
        ),
      ]);
    }

    return Promise.resolve(currentGroups);
  }

  private getCurrentGroups(): vscode.TreeItem[] {
    switch (this.groupingMode) {
      case 'framework':
        return this.frameworkGroups;
      case 'method':
        return this.methodGroups;
      case 'health':
        return this.healthGroups;
      case 'file':
      default:
        return this.fileGroups;
    }
  }

  /**
   * Finds the route item at or near a specific line in a source file.
   * Useful for active-editor route awareness.
   */
  public findRouteItemAt(
    filePath: string,
    line: number
  ): { fileGroup: RouteFileGroupItem; routeItem: RouteTreeItem } | undefined {
    const group = this.fileGroups.find((g) => g.filePath === filePath);
    if (!group) {
      return undefined;
    }

    let closestRoute: ApiRoute | undefined;
    let minDiff = Infinity;

    for (const r of group.routes) {
      const diff = Math.abs(r.line - line);
      if (diff < minDiff && diff <= 3) {
        minDiff = diff;
        closestRoute = r;
      }
    }

    if (closestRoute) {
      return {
        fileGroup: group,
        routeItem: this.createRouteTreeItem(closestRoute, group.relativeFilePath, false),
      };
    }

    return undefined;
  }

  public setMethodFilter(filter?: HttpMethod | 'SHARED' | 'DUPLICATES'): void {
    this.activeMethodFilter = filter;
    if (filter === 'SHARED' || filter === 'DUPLICATES') {
      this.filterOptions.state = filter;
      this.filterOptions.method = undefined;
    } else if (filter) {
      this.filterOptions.method = filter;
      if (this.filterOptions.state === 'SHARED' || this.filterOptions.state === 'DUPLICATES') {
        this.filterOptions.state = undefined;
      }
    } else {
      this.filterOptions.method = undefined;
      if (this.filterOptions.state === 'SHARED' || this.filterOptions.state === 'DUPLICATES') {
        this.filterOptions.state = undefined;
      }
    }
    this.rebuildGroups();
    this.refresh();
  }

  public getMethodFilter(): HttpMethod | 'SHARED' | 'DUPLICATES' | undefined {
    return this.activeMethodFilter;
  }

  /**
   * Returns the current array of routes matching all active filters.
   */
  public getFilteredRoutesList(): ApiRoute[] {
    return this.getFilteredRoutes();
  }

  /**
   * Filters cached routes in memory without workspace scanning.
   */
  private getFilteredRoutes(): ApiRoute[] {
    return this.routes.filter((route) => {
      const key = `${route.method}:${route.filePath}:${route.line}`;
      const relKey = getRouteKey(route);
      const rel = this.analysis?.relationships?.get(relKey);

      // Legacy method filter compatibility
      if (this.activeMethodFilter) {
        if (this.activeMethodFilter === 'SHARED') {
          if (!this.sharedPathMap.has(key)) {
            return false;
          }
        } else if (this.activeMethodFilter === 'DUPLICATES') {
          if (!this.duplicateKeys.has(key)) {
            return false;
          }
        } else if (route.method !== this.activeMethodFilter) {
          return false;
        }
      }

      // Framework filter
      if (this.filterOptions.framework && this.filterOptions.framework !== 'ALL') {
        const fw = route.framework === 'next' ? 'nextjs' : route.framework;
        const targetFw = this.filterOptions.framework === 'next' ? 'nextjs' : this.filterOptions.framework;
        if (fw !== targetFw) {
          return false;
        }
      }

      // Method filter
      if (this.filterOptions.method && this.filterOptions.method !== 'ALL') {
        if (route.method !== this.filterOptions.method) {
          return false;
        }
      }

      // Health filter
      if (this.filterOptions.health && this.filterOptions.health !== 'ALL') {
        const health = rel?.health ?? 'healthy';
        if (health !== this.filterOptions.health) {
          return false;
        }
      }

      // State filter
      if (this.filterOptions.state && this.filterOptions.state !== 'ALL') {
        switch (this.filterOptions.state) {
          case 'DUPLICATES':
            if (!this.duplicateKeys.has(key)) {
              return false;
            }
            break;
          case 'SHARED':
            if (!this.sharedPathMap.has(key)) {
              return false;
            }
            break;
          case 'MISSING_HANDLER':
            if (!this.missingHandlerKeys.has(key)) {
              return false;
            }
            break;
          case 'CONFLICTS':
            if (!rel?.conflicts || rel.conflicts.length === 0) {
              return false;
            }
            break;
          case 'SHADOWED':
            if (!rel?.conflicts || !rel.conflicts.some((c) => c.isShadowing)) {
              return false;
            }
            break;
        }
      }

      // File/folder filter
      if (this.filterOptions.filePath) {
        const term = this.filterOptions.filePath.toLowerCase();
        const relPath = getRelativeFilePath(route.filePath).toLowerCase();
        const absPath = route.filePath.toLowerCase();
        if (!relPath.includes(term) && !absPath.includes(term)) {
          return false;
        }
      }

      // Free text search query
      if (this.filterOptions.query) {
        const query = this.filterOptions.query.toLowerCase().trim();
        const tokens = query.split(/\s+/).filter(Boolean);
        const routeStr = `${route.method} ${route.path} ${route.filePath} ${route.framework} ${route.handlerName || ''}`.toLowerCase();
        for (const token of tokens) {
          if (!routeStr.includes(token)) {
            return false;
          }
        }
      }

      return true;
    });
  }

  /**
   * Rebuilds all grouping collections based on filtered routes.
   */
  private rebuildGroups(): void {
    const filtered = this.getFilteredRoutes();
    this.buildFileGroups(filtered);
    this.buildFrameworkGroups(filtered);
    this.buildMethodGroups(filtered);
    this.buildHealthGroups(filtered);
  }

  /**
   * Groups routes by source file.
   */
  private buildFileGroups(targetRoutes: ApiRoute[]): void {
    const groupMap = new Map<string, ApiRoute[]>();

    for (const route of targetRoutes) {
      const existing = groupMap.get(route.filePath);
      if (existing) {
        existing.push(route);
      } else {
        groupMap.set(route.filePath, [route]);
      }
    }

    const allRelativePaths = Array.from(groupMap.keys()).map((p) => getRelativeFilePath(p));
    const folderOccurrences = new Map<string, number>();
    for (const relPath of allRelativePaths) {
      const segs = relPath.replace(/\\/g, '/').split('/').filter(Boolean);
      if (segs.length > 1) {
        const f = segs[segs.length - 2];
        folderOccurrences.set(f, (folderOccurrences.get(f) || 0) + 1);
      }
    }

    const groups: RouteFileGroupItem[] = [];

    for (const [filePath, fileRoutes] of groupMap.entries()) {
      const relativePath = getRelativeFilePath(filePath);

      // Consistent route sorting within each file: Path ascending, then Method
      fileRoutes.sort((a, b) => {
        const pathComparison = a.path.localeCompare(b.path);
        if (pathComparison !== 0) {
          return pathComparison;
        }
        return a.method.localeCompare(b.method);
      });

      groups.push(new RouteFileGroupItem(filePath, relativePath, fileRoutes, folderOccurrences));
    }

    // Sort file groups alphabetically by clean folder label
    groups.sort((a, b) => a.label!.toString().localeCompare(b.label!.toString()));
    this.fileGroups = groups;
  }

  /**
   * Groups routes by Framework (Express, Next.js, Fastify, NestJS).
   */
  private buildFrameworkGroups(targetRoutes: ApiRoute[]): void {
    const fwMap = new Map<ApiFramework, ApiRoute[]>();

    for (const route of targetRoutes) {
      const fw: ApiFramework = (route.framework === 'next' ? 'nextjs' : route.framework) || 'express';
      const list = fwMap.get(fw) || [];
      list.push(route);
      fwMap.set(fw, list);
    }

    const frameworkOrder: ApiFramework[] = ['express', 'nextjs', 'fastify', 'nestjs'];
    const groups: RouteFrameworkGroupItem[] = [];

    for (const fw of frameworkOrder) {
      const list = fwMap.get(fw);
      if (list && list.length > 0) {
        list.sort((a, b) => {
          const pathComp = a.path.localeCompare(b.path);
          if (pathComp !== 0) {
            return pathComp;
          }
          return a.method.localeCompare(b.method);
        });
        groups.push(new RouteFrameworkGroupItem(fw, list));
      }
    }

    // Catch any remaining unexpected frameworks
    for (const [fw, list] of fwMap.entries()) {
      if (!frameworkOrder.includes(fw) && list.length > 0) {
        groups.push(new RouteFrameworkGroupItem(fw, list));
      }
    }

    this.frameworkGroups = groups;
  }

  /**
   * Groups routes by HTTP Method (GET, POST, PUT, PATCH, DELETE, etc.).
   */
  private buildMethodGroups(targetRoutes: ApiRoute[]): void {
    const methodMap = new Map<HttpMethod, ApiRoute[]>();

    for (const route of targetRoutes) {
      const list = methodMap.get(route.method) || [];
      list.push(route);
      methodMap.set(route.method, list);
    }

    const methodOrder: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', 'ANY'];
    const groups: RouteMethodGroupItem[] = [];

    for (const method of methodOrder) {
      const list = methodMap.get(method);
      if (list && list.length > 0) {
        list.sort((a, b) => {
          const pathComp = a.path.localeCompare(b.path);
          if (pathComp !== 0) {
            return pathComp;
          }
          return a.filePath.localeCompare(b.filePath);
        });
        groups.push(new RouteMethodGroupItem(method, list));
      }
    }

    // Catch any other method types
    for (const [method, list] of methodMap.entries()) {
      if (!methodOrder.includes(method) && list.length > 0) {
        groups.push(new RouteMethodGroupItem(method, list));
      }
    }

    this.methodGroups = groups;
  }

  /**
   * Groups routes by Health status (Errors, Warnings, Info, Healthy).
   */
  private buildHealthGroups(targetRoutes: ApiRoute[]): void {
    const healthMap = new Map<RouteHealth, ApiRoute[]>();

    for (const route of targetRoutes) {
      const health = this.getRouteHealth(route);
      const list = healthMap.get(health) || [];
      list.push(route);
      healthMap.set(health, list);
    }

    const healthOrder: RouteHealth[] = ['error', 'warning', 'info', 'healthy'];
    const groups: RouteHealthGroupItem[] = [];

    for (const health of healthOrder) {
      const list = healthMap.get(health);
      if (list && list.length > 0) {
        list.sort((a, b) => {
          const pathComp = a.path.localeCompare(b.path);
          if (pathComp !== 0) {
            return pathComp;
          }
          return a.method.localeCompare(b.method);
        });
        groups.push(new RouteHealthGroupItem(health, list));
      }
    }

    this.healthGroups = groups;
  }
}
