import * as path from 'path';
import * as vscode from 'vscode';
import { ApiRoute, HttpMethod } from '../models/route';
import { COMMANDS, MESSAGES } from '../utils/constants';

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
    default:
      return new vscode.ThemeIcon('symbol-method');
  }
}

/**
 * Level 1 TreeItem: Represents a source file grouping routes.
 */
export class RouteFileGroupItem extends vscode.TreeItem {
  constructor(
    public readonly filePath: string,
    public readonly relativeFilePath: string,
    public readonly routes: ApiRoute[]
  ) {
    super(relativeFilePath, vscode.TreeItemCollapsibleState.Expanded);

    const countLabel = `${routes.length} route${routes.length === 1 ? '' : 's'}`;
    this.description = countLabel;
    this.iconPath = vscode.ThemeIcon.File;
    this.tooltip = `${relativeFilePath} (${countLabel})`;
    this.contextValue = 'routeFileGroup';
  }
}

/**
 * Level 2 TreeItem: Represents an individual HTTP API route.
 */
export class RouteTreeItem extends vscode.TreeItem {
  constructor(
    public readonly route: ApiRoute,
    public readonly relativeFilePath: string
  ) {
    // METHOD + PATH compact display
    super(`${route.method} ${route.path}`, vscode.TreeItemCollapsibleState.None);

    // Display 1-based line number for developer readability
    this.description = `Line ${route.line + 1}`;
    this.iconPath = getMethodIcon(route.method);
    this.contextValue = 'route';

    // Rich Markdown tooltip
    const tooltip = new vscode.MarkdownString();
    tooltip.appendMarkdown(`### \`${route.method}\` ${route.path}\n\n`);
    tooltip.appendMarkdown(`- **File**: \`${relativeFilePath}\`\n`);
    tooltip.appendMarkdown(`- **Location**: Line ${route.line + 1}, Column ${route.column + 1}\n`);
    tooltip.appendMarkdown(`- **Framework**: Express\n`);
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
  constructor(label: string, description: string, icon: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
    this.iconPath = new vscode.ThemeIcon(icon);
    this.contextValue = 'placeholder';
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

  /**
   * Refreshes the TreeView without altering route data.
   */
  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Replaces current route collection, caches pre-sorted file groups, and triggers refresh.
   */
  public setRoutes(routes: ApiRoute[]): void {
    this.hasScanned = true;
    this.routes = routes;
    this.buildFileGroups();
    this.refresh();
  }

  /**
   * Resets scanner state and clears routes.
   */
  public clear(): void {
    this.hasScanned = false;
    this.routes = [];
    this.fileGroups = [];
    this.refresh();
  }

  public getRoutes(): ApiRoute[] {
    return this.routes;
  }

  public getHasScanned(): boolean {
    return this.hasScanned;
  }

  public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  public getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
    // Sub-children for File Groups
    if (element instanceof RouteFileGroupItem) {
      const items = element.routes.map(
        (route) => new RouteTreeItem(route, element.relativeFilePath)
      );
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

    // Root level: Return pre-computed file groups
    return Promise.resolve(this.fileGroups);
  }

  /**
   * Groups routes by source file, sorts routes by path then method,
   * and sorts file groups alphabetically.
   *
   * Sorting strategy:
   * 1. File groups: Alphabetical by relative file path for predictable file browsing.
   * 2. Routes in file: Sorted primarily by path, then by HTTP method to group related endpoints.
   */
  private buildFileGroups(): void {
    const groupMap = new Map<string, ApiRoute[]>();

    for (const route of this.routes) {
      const existing = groupMap.get(route.filePath);
      if (existing) {
        existing.push(route);
      } else {
        groupMap.set(route.filePath, [route]);
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

      groups.push(new RouteFileGroupItem(filePath, relativePath, fileRoutes));
    }

    // Sort file groups alphabetically by relative path
    groups.sort((a, b) => a.relativeFilePath.localeCompare(b.relativeFilePath));
    this.fileGroups = groups;
  }
}
