import * as vscode from 'vscode';
import { DuplicateRouteGroup } from './duplicateDetector';
import { MissingHandlerWarning } from './handlerAnalyzer';
import { RouteConflict } from './analysisTypes';

/**
 * Manages VS Code diagnostics for API Routes Explorer.
 * Publishes diagnostics for duplicate routes, possible missing handlers, and route conflicts/shadowing.
 */
export class RouteDiagnosticsManager implements vscode.Disposable {
  private readonly collection: vscode.DiagnosticCollection;

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection('apiRouteExplorer');
  }

  /**
   * Refreshes diagnostics based on analyzed duplicate groups, missing handler warnings, and route conflicts.
   */
  public updateDiagnostics(
    duplicates: DuplicateRouteGroup[],
    missingHandlers: MissingHandlerWarning[],
    conflicts: RouteConflict[] = []
  ): void {
    this.collection.clear();

    const diagnosticsByUri = new Map<string, { uri: vscode.Uri; items: vscode.Diagnostic[] }>();

    // 1. Duplicate route errors
    for (const group of duplicates) {
      for (const route of group.routes) {
        const uri = vscode.Uri.file(route.filePath);
        const uriKey = uri.toString();

        const line = Math.max(0, route.line);
        const col = Math.max(0, route.column);
        const length = Math.max(1, route.method.length + route.path.length + 6);
        const range = new vscode.Range(line, col, line, col + length);

        const diagnostic = new vscode.Diagnostic(
          range,
          `Duplicate route: ${route.method} ${route.path}`,
          vscode.DiagnosticSeverity.Error
        );
        diagnostic.source = 'API Routes Explorer';
        diagnostic.code = 'duplicate-route';

        const otherDuplicates = group.routes.filter((r) => r !== route);
        if (otherDuplicates.length > 0) {
          diagnostic.relatedInformation = otherDuplicates.map((other) => {
            const otherUri = vscode.Uri.file(other.filePath);
            const otherLine = Math.max(0, other.line);
            const otherCol = Math.max(0, other.column);
            return new vscode.DiagnosticRelatedInformation(
              new vscode.Location(otherUri, new vscode.Range(otherLine, otherCol, otherLine, otherCol + 1)),
              `Conflicting duplicate declaration at line ${other.line + 1}`
            );
          });
        }

        let entry = diagnosticsByUri.get(uriKey);
        if (!entry) {
          entry = { uri, items: [] };
          diagnosticsByUri.set(uriKey, entry);
        }
        entry.items.push(diagnostic);
      }
    }

    // 2. Possible missing handler warnings
    for (const warning of missingHandlers) {
      const uri = vscode.Uri.file(warning.filePath);
      const uriKey = uri.toString();

      const line = Math.max(0, warning.line);
      const col = Math.max(0, warning.column);
      const length = Math.max(1, warning.method.length + warning.path.length + 6);
      const range = new vscode.Range(line, col, line, col + length);

      const diagnostic = new vscode.Diagnostic(
        range,
        warning.message,
        vscode.DiagnosticSeverity.Warning
      );
      diagnostic.source = 'API Routes Explorer';
      diagnostic.code = 'missing-handler';

      let entry = diagnosticsByUri.get(uriKey);
      if (!entry) {
        entry = { uri, items: [] };
        diagnosticsByUri.set(uriKey, entry);
      }
      entry.items.push(diagnostic);
    }

    // 3. Route conflict & shadowing warnings
    for (const conflict of conflicts) {
      const uri = vscode.Uri.file(conflict.route.filePath);
      const uriKey = uri.toString();

      const line = Math.max(0, conflict.route.line);
      const col = Math.max(0, conflict.route.column);
      const length = Math.max(1, conflict.route.method.length + conflict.route.path.length + 6);
      const range = new vscode.Range(line, col, line, col + length);

      const diagnostic = new vscode.Diagnostic(
        range,
        conflict.reason,
        vscode.DiagnosticSeverity.Warning
      );
      diagnostic.source = 'API Routes Explorer';
      diagnostic.code = conflict.isShadowing ? 'route-shadowing' : 'route-conflict';

      if (conflict.conflictingRoute) {
        const confUri = vscode.Uri.file(conflict.conflictingRoute.filePath);
        const confLine = Math.max(0, conflict.conflictingRoute.line);
        const confCol = Math.max(0, conflict.conflictingRoute.column);
        diagnostic.relatedInformation = [
          new vscode.DiagnosticRelatedInformation(
            new vscode.Location(confUri, new vscode.Range(confLine, confCol, confLine, confCol + 1)),
            `Overlapping route: ${conflict.conflictingRoute.method} ${conflict.conflictingRoute.path} (line ${conflict.conflictingRoute.line + 1})`
          ),
        ];
      }

      let entry = diagnosticsByUri.get(uriKey);
      if (!entry) {
        entry = { uri, items: [] };
        diagnosticsByUri.set(uriKey, entry);
      }
      entry.items.push(diagnostic);
    }

    // Apply diagnostics to collection
    for (const { uri, items } of diagnosticsByUri.values()) {
      this.collection.set(uri, items);
    }
  }

  /**
   * Clears all currently published diagnostics.
   */
  public clear(): void {
    this.collection.clear();
  }

  /**
   * Retrieves currently published diagnostics for a specific URI.
   */
  public getDiagnostics(uri: vscode.Uri): readonly vscode.Diagnostic[] {
    return this.collection.get(uri) ?? [];
  }

  /**
   * Disposes the diagnostic collection.
   */
  public dispose(): void {
    this.collection.dispose();
  }
}
