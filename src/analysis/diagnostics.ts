import * as vscode from 'vscode';
import { DuplicateRouteGroup } from './duplicateDetector';
import { MissingHandlerWarning } from './handlerAnalyzer';

/**
 * Manages VS Code diagnostics for API Route Explorer.
 * Publishes warnings for duplicate routes and possible missing handlers.
 */
export class RouteDiagnosticsManager implements vscode.Disposable {
  private readonly collection: vscode.DiagnosticCollection;

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection('apiRouteExplorer');
  }

  /**
   * Refreshes diagnostics based on analyzed duplicate groups and missing handler warnings.
   */
  public updateDiagnostics(
    duplicates: DuplicateRouteGroup[],
    missingHandlers: MissingHandlerWarning[]
  ): void {
    this.collection.clear();

    const diagnosticsByUri = new Map<string, { uri: vscode.Uri; items: vscode.Diagnostic[] }>();

    // 1. Duplicate route warnings
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
          `Duplicate route detected: ${route.method} ${route.path}`,
          vscode.DiagnosticSeverity.Warning
        );
        diagnostic.source = 'API Route Explorer';
        diagnostic.code = 'duplicate-route';

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
      diagnostic.source = 'API Route Explorer';
      diagnostic.code = 'missing-handler';

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
   * Disposes the diagnostic collection.
   */
  public dispose(): void {
    this.collection.dispose();
  }
}
