import * as path from 'path';
import * as vscode from 'vscode';
import { ApiRoute, HttpMethod } from '../models/route';
import { RouteAnalysisResult } from '../analysis/routeAnalyzer';
import { getRouteKey } from '../analysis/routeRelationshipAnalyzer';
import { COMMANDS, CONTEXT_VALUES, MESSAGES } from '../utils/constants';

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

import {
  RouteHealth,
  RouteIssue,
  RouteMiddleware,
  RouteConflict,
} from '../analysis/analysisTypes';

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
    public readonly analysisContext?: RouteAnalysisContext
  ) {
    // METHOD + PATH compact display
    super(`${route.method} ${route.path}`, vscode.TreeItemCollapsibleState.None);

    let desc = `Line ${route.line + 1}`;
    let icon = getMethodIcon(route.method);

    if (analysisContext?.isDuplicate) {
      desc = `Line ${route.line + 1} • ⚠️ Duplicate`;
      icon = new vscode.ThemeIcon('error', new vscode.ThemeColor('charts.red'));
    } else if (analysisContext?.isMissingHandler) {
      desc = `Line ${route.line + 1} • ⚠️ Missing handler`;
      icon = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'));
    } else if (analysisContext?.conflicts && analysisContext.conflicts.length > 0) {
      const isShadow = analysisContext.conflicts.some((c) => c.isShadowing);
      desc = `Line ${route.line + 1} • ${isShadow ? '⚠️ Shadowed' : '⚠️ Conflict'}`;
      icon = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.orange'));
    } else if (analysisContext?.health === 'warning') {
      desc = `Line ${route.line + 1} • ⚠️ Warning`;
      icon = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.orange'));
    } else if (analysisContext?.isShared) {
      desc = `Line ${route.line + 1} • Shared`;
    }

    this.description = desc;
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
  constructor(label: string, description: string, icon: string = 'info') {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.iconPath = new vscode.ThemeIcon(icon);
    this.contextValue = CONTEXT_VALUES.PLACEHOLDER;
    this.tooltip = `${label}: ${description}`;
  }
}

/**
 * TreeDataProvider implementing the 2-level API Route Explorer hierarchy:
 * Level 1: File Group (e.g. routes/userRoutes.js)
 * Level 2: Route Item (e.g. GET /users)
 */
export class RouteTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
  public readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | void> = this._onDidChangeTreeData.event;

  private routes: ApiRoute[] = [];
  private hasScanned: boolean = false;
  private fileGroups: RouteFileGroupItem[] = [];
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
   * Replaces current route collection, caches pre-sorted file groups, and triggers refresh.
   */
  public setRoutes(routes: ApiRoute[], analysis?: RouteAnalysisResult): void {
    this.hasScanned = true;
    this.routes = routes;
    this.analysis = analysis;
    this.indexAnalysis(analysis);
    this.buildFileGroups();
    this.refresh();
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

  public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  public getParent(element: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem> {
    if (element instanceof RouteTreeItem) {
      return this.fileGroups.find((group) => group.filePath === element.route.filePath);
    }
    return undefined;
  }

  public getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
    // Sub-children for File Groups
    if (element instanceof RouteFileGroupItem) {
      const items = element.routes.map((route) => {
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
        return new RouteTreeItem(route, element.relativeFilePath, analysisContext);
      });
      return Promise.resolve(items);
    }

    if (element) {
      return Promise.resolve([]);
    }

    // Root level: Unscanned state
    if (!this.hasScanned) {
      return Promise.resolve([
        new RoutePlaceholderItem(
          MESSAGES.NO_ROUTES_TITLE,
          MESSAGES.NO_ROUTES_DESCRIPTION,
          'search'
        ),
      ]);
    }

    // Root level: Scanned but 0 routes found
    if (this.routes.length === 0) {
      return Promise.resolve([
        new RoutePlaceholderItem(
          MESSAGES.NO_ROUTES_FOUND,
          MESSAGES.NO_ROUTES_EMPTY_DESCRIPTION,
          'info'
        ),
      ]);
    }

    // Root level: Filter applied but 0 routes matched filter
    if (this.fileGroups.length === 0 && this.activeMethodFilter) {
      return Promise.resolve([
        new RoutePlaceholderItem(
          `No ${this.activeMethodFilter} routes found`,
          'Click the filter icon in the view title bar to clear or change filter.',
          'filter'
        ),
      ]);
    }

    // Root level: Return pre-computed file groups
    return Promise.resolve(this.fileGroups);
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
      const key = `${closestRoute.method}:${closestRoute.filePath}:${closestRoute.line}`;
      const analysisContext: RouteAnalysisContext = {
        isDuplicate: this.duplicateKeys.has(key),
        isShared: this.sharedPathMap.has(key),
        isMissingHandler: this.missingHandlerKeys.has(key),
        sharedMethods: this.sharedPathMap.get(key),
      };
      return {
        fileGroup: group,
        routeItem: new RouteTreeItem(closestRoute, group.relativeFilePath, analysisContext),
      };
    }

    return undefined;
  }

  private activeMethodFilter?: HttpMethod | 'SHARED' | 'DUPLICATES';

  public setMethodFilter(filter?: HttpMethod | 'SHARED' | 'DUPLICATES'): void {
    this.activeMethodFilter = filter;
    this.buildFileGroups();
    this.refresh();
  }

  public getMethodFilter(): HttpMethod | 'SHARED' | 'DUPLICATES' | undefined {
    return this.activeMethodFilter;
  }

  /**
   * Groups routes by source file, sorts routes by path then method,
   * and sorts file groups alphabetically.
   *
   * Sorting strategy:
   * 1. File groups: Alphabetical by clean folder label for predictable browsing.
   * 2. Routes in file: Sorted primarily by path, then by HTTP method to group related endpoints.
   */
  private buildFileGroups(): void {
    const groupMap = new Map<string, ApiRoute[]>();

    const targetRoutes = this.routes.filter((route) => {
      if (!this.activeMethodFilter) {
        return true;
      }
      if (this.activeMethodFilter === 'SHARED') {
        const key = `${route.method}:${route.filePath}:${route.line}`;
        return this.sharedPathMap.has(key);
      }
      if (this.activeMethodFilter === 'DUPLICATES') {
        const key = `${route.method}:${route.filePath}:${route.line}`;
        return this.duplicateKeys.has(key);
      }
      return route.method === this.activeMethodFilter;
    });

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
}

