import * as vscode from 'vscode';
import { ApiRoute } from '../models/route';
import { MESSAGES } from '../utils/constants';

/**
 * Visual tree representation item for the API Routes sidebar.
 */
export class RouteTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly route?: ApiRoute,
    description?: string
  ) {
    super(label, collapsibleState);

    if (description) {
      this.description = description;
    }

    if (!route) {
      // Empty placeholder state
      this.iconPath = new vscode.ThemeIcon('search');
      this.contextValue = 'placeholder';
      this.tooltip = MESSAGES.NO_ROUTES_DESCRIPTION;
    } else {
      // Future route node
      this.iconPath = new vscode.ThemeIcon('symbol-method');
      this.contextValue = 'route';
      this.tooltip = `${route.method} ${route.path} (${route.framework})`;
    }
  }
}

/**
 * TreeDataProvider implementing native VS Code TreeView API for API Routes.
 */
export class RouteTreeProvider implements vscode.TreeDataProvider<RouteTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<RouteTreeItem | undefined | void>();
  public readonly onDidChangeTreeData: vscode.Event<RouteTreeItem | undefined | void> = this._onDidChangeTreeData.event;

  private routes: ApiRoute[] = [];

  /**
   * Refreshes the tree view display.
   */
  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Sets discovered routes and triggers tree refresh.
   */
  public setRoutes(routes: ApiRoute[]): void {
    this.routes = routes;
    this.refresh();
  }

  public getTreeItem(element: RouteTreeItem): vscode.TreeItem {
    return element;
  }

  public getChildren(element?: RouteTreeItem): Thenable<RouteTreeItem[]> {
    // Top-level children
    if (!element) {
      if (this.routes.length === 0) {
        // Sprint 0 intentional placeholder state
        const placeholderItem = new RouteTreeItem(
          MESSAGES.NO_ROUTES_TITLE,
          vscode.TreeItemCollapsibleState.None,
          undefined,
          MESSAGES.NO_ROUTES_DESCRIPTION
        );
        return Promise.resolve([placeholderItem]);
      }

      // Map routes (prepared for Sprint 1)
      const items = this.routes.map(
        (r) =>
          new RouteTreeItem(
            `${r.method} ${r.path}`,
            vscode.TreeItemCollapsibleState.None,
            r,
            r.handlerName
          )
      );
      return Promise.resolve(items);
    }

    return Promise.resolve([]);
  }
}
