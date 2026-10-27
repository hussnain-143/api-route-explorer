import * as vscode from 'vscode';
import { ApiRoute } from '../models/route';
import { COMMANDS } from '../utils/constants';

/**
 * Provides inline CodeLens actions (`Test API`, `Analyze`, `OpenAPI`) above
 * discovered API route declarations in JavaScript and TypeScript editors.
 */
export class RouteCodeLensProvider implements vscode.CodeLensProvider {
  private _routesByFile = new Map<string, ApiRoute[]>();
  private readonly _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  /**
   * Updates the active routes indexed by normalized file path and refreshes CodeLenses.
   */
  public setRoutes(routes: ApiRoute[]): void {
    this._routesByFile.clear();
    for (const route of routes) {
      const normPath = route.filePath.replace(/\\/g, '/');
      let list = this._routesByFile.get(normPath);
      if (!list) {
        list = [];
        this._routesByFile.set(normPath, list);
      }
      // Deduplicate routes at the same line + method + path in the same file
      if (!list.some((r) => r.line === route.line && r.method === route.method && r.path === route.path)) {
        list.push(route);
      }
    }
    this._onDidChangeCodeLenses.fire();
  }

  /**
   * Clears all indexed routes and refreshes CodeLenses.
   */
  public clear(): void {
    this._routesByFile.clear();
    this._onDidChangeCodeLenses.fire();
  }

  /**
   * Manually triggers a CodeLens refresh (e.g. when configuration changes).
   */
  public refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  /**
   * Computes CodeLens items for the given document.
   */
  public provideCodeLenses(
    document: vscode.TextDocument,
    token?: vscode.CancellationToken
  ): vscode.CodeLens[] {
    if (token?.isCancellationRequested) {
      return [];
    }

    const enabled = vscode.workspace
      .getConfiguration('apiRouteExplorer')
      .get<boolean>('codeLens.enabled', true);
    if (!enabled) {
      return [];
    }

    const normDocPath = document.uri.fsPath.replace(/\\/g, '/');
    const fileRoutes = this._routesByFile.get(normDocPath);
    if (!fileRoutes || fileRoutes.length === 0) {
      return [];
    }

    const lenses: vscode.CodeLens[] = [];

    for (const route of fileRoutes) {
      const lineIndex = Math.max(0, Math.min(route.line, Math.max(0, document.lineCount - 1)));
      const range = new vscode.Range(lineIndex, 0, lineIndex, 0);

      // 1. Primary Action: Test API in HTTP Client
      lenses.push(
        new vscode.CodeLens(range, {
          title: `$(send) Test ${route.method} ${route.path}`,
          tooltip: `Open ${route.method} ${route.path} in API Routes Explorer HTTP Client`,
          command: COMMANDS.OPEN_HTTP_CLIENT,
          arguments: [route],
        })
      );

      // 2. Analyze Route
      lenses.push(
        new vscode.CodeLens(range, {
          title: '$(pulse) Analyze',
          tooltip: `Inspect route health, middleware, and conflicts for ${route.method} ${route.path}`,
          command: COMMANDS.ANALYZE_ROUTE,
          arguments: [route],
        })
      );

      // 3. View OpenAPI Operation
      lenses.push(
        new vscode.CodeLens(range, {
          title: '$(file-code) OpenAPI',
          tooltip: `Preview OpenAPI 3.0.3 YAML operation for ${route.method} ${route.path}`,
          command: COMMANDS.VIEW_ROUTE_OPENAPI,
          arguments: [route],
        })
      );
    }

    return lenses;
  }

  public dispose(): void {
    this._onDidChangeCodeLenses.dispose();
  }
}

