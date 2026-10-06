import * as vscode from 'vscode';
import { ApiRoute } from '../models/route';
import { MESSAGES } from '../utils/constants';

export class RouteTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
    public readonly route?: ApiRoute,
    description?: string
  ) {
    super(label, collapsibleState);
    this.description = description;

    if (route) {
      this.iconPath = new vscode.ThemeIcon('symbol-method');
      this.contextValue = 'route';
      this.tooltip = `${route.method} ${route.path} (${route.framework})`;
    } else {
      this.iconPath = new vscode.ThemeIcon('search');
      this.contextValue = 'placeholder';
      this.tooltip = MESSAGES.NO_ROUTES_DESCRIPTION;
    }
  }
}

export class RouteTreeProvider implements vscode.TreeDataProvider<RouteTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<RouteTreeItem | undefined | void>();
  public readonly onDidChangeTreeData: vscode.Event<RouteTreeItem | undefined | void> = this._onDidChangeTreeData.event;

  private routes: ApiRoute[] = [];

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  public setRoutes(routes: ApiRoute[]): void {
    this.routes = routes;
    this.refresh();
  }

  public getTreeItem(element: RouteTreeItem): vscode.TreeItem {
    return element;
  }

  public getChildren(element?: RouteTreeItem): Thenable<RouteTreeItem[]> {
    if (element) {
      return Promise.resolve([]);
    }

    if (this.routes.length === 0) {
      return Promise.resolve([
        new RouteTreeItem(
          MESSAGES.NO_ROUTES_TITLE,
          vscode.TreeItemCollapsibleState.None,
          undefined,
          MESSAGES.NO_ROUTES_DESCRIPTION
        ),
      ]);
    }

    return Promise.resolve(
      this.routes.map(
        (r) =>
          new RouteTreeItem(
            `${r.method} ${r.path}`,
            vscode.TreeItemCollapsibleState.None,
            r,
            r.handlerName
          )
      )
    );
  }
}
