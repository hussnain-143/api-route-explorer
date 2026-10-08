import * as vscode from 'vscode';
import { ApiRoute } from '../models/route';
import { RouteAnalysisResult } from '../analysis/routeAnalyzer';
import { generateOpenApiDocument } from './openApiGenerator';
import { serializeOpenApiToJson, serializeOpenApiToYaml } from './openApiYamlSerializer';
import { OpenApiGenerationOptions } from './openApiTypes';

/**
 * Resolves default OpenAPI generation options from workspace configuration and package.json.
 */
export async function resolveWorkspaceOpenApiOptions(): Promise<OpenApiGenerationOptions> {
  const config = vscode.workspace.getConfiguration('apiRouteExplorer');
  let title = config.get<string>('openapi.title')?.trim();
  let version = config.get<string>('openapi.version')?.trim();
  let description: string | undefined;

  const baseUrl = config.get<string>('baseUrl', 'http://localhost:3000');
  const includeSourceMetadata = config.get<boolean>('openapi.includeSourceMetadata', true);

  // Attempt to read workspace package.json if title/version are not explicitly set
  const workspaceFolders = vscode.workspace.workspaceFolders;
  let workspaceRoot: string | undefined;

  if (workspaceFolders && workspaceFolders.length > 0) {
    workspaceRoot = workspaceFolders[0].uri.fsPath;
    if (!title || !version) {
      try {
        const pkgUri = vscode.Uri.joinPath(workspaceFolders[0].uri, 'package.json');
        const pkgData = await vscode.workspace.fs.readFile(pkgUri);
        const pkgJson = JSON.parse(new TextDecoder('utf-8').decode(pkgData));
        if (!title && pkgJson.name) {
          title = String(pkgJson.name);
        }
        if (!version && pkgJson.version) {
          version = String(pkgJson.version);
        }
        if (!description && pkgJson.description) {
          description = String(pkgJson.description);
        }
      } catch {
        // Fallback silently if package.json does not exist or is invalid
      }
    }
  }

  return {
    title: title || 'API Routes Explorer API',
    version: version || '1.0.0',
    description: description || 'OpenAPI 3.0.3 specification generated from static API route discovery.',
    baseUrl: baseUrl ? baseUrl.replace(/\/+$/, '') : undefined,
    includeSourceMetadata,
    workspaceRoot,
  };
}

/**
 * Generates an OpenAPI JSON string representation for given routes.
 */
export function generateOpenApiJsonString(
  routes: ApiRoute[],
  analysis?: RouteAnalysisResult,
  options?: OpenApiGenerationOptions
): string {
  const result = generateOpenApiDocument(routes, analysis, options);
  return serializeOpenApiToJson(result.document);
}

/**
 * Generates an OpenAPI YAML string representation for given routes.
 */
export function generateOpenApiYamlString(
  routes: ApiRoute[],
  analysis?: RouteAnalysisResult,
  options?: OpenApiGenerationOptions
): string {
  const result = generateOpenApiDocument(routes, analysis, options);
  return serializeOpenApiToYaml(result.document);
}

/**
 * Shows interactive dialog to export OpenAPI specification (JSON or YAML),
 * supporting filtered route scopes and native VS Code save dialogs.
 */
export async function showExportOpenApiDialog(
  routes: ApiRoute[],
  analysis?: RouteAnalysisResult,
  filteredRoutes?: ApiRoute[],
  preferredFormat?: 'json' | 'yaml'
): Promise<void> {
  if (routes.length === 0) {
    vscode.window.showInformationMessage('No API routes available to export as OpenAPI specification.');
    return;
  }

  let targetRoutes = routes;
  let isFilteredExport = false;

  // If filtered routes are provided and differ from all routes, offer scope choice
  if (filteredRoutes && filteredRoutes.length > 0 && filteredRoutes.length < routes.length) {
    interface ScopeItem extends vscode.QuickPickItem {
      scope: 'all' | 'filtered';
    }
    const scopePick = await vscode.window.showQuickPick<ScopeItem>(
      [
        {
          label: `$(filter) Filtered Routes (${filteredRoutes.length})`,
          description: 'Generate OpenAPI contract for only the currently filtered routes',
          scope: 'filtered',
        },
        {
          label: `$(list-unordered) All Discovered Routes (${routes.length})`,
          description: 'Generate complete OpenAPI contract for all workspace routes',
          scope: 'all',
        },
      ],
      {
        title: 'OpenAPI Export: Select Route Scope',
        placeHolder: 'Choose which routes to include in the OpenAPI specification',
      }
    );

    if (!scopePick) {
      return;
    }

    if (scopePick.scope === 'filtered') {
      targetRoutes = filteredRoutes;
      isFilteredExport = true;
    }
  }

  let selectedFormat = preferredFormat;

  if (!selectedFormat) {
    interface FormatPickItem extends vscode.QuickPickItem {
      format: 'yaml' | 'json';
    }
    const pick = await vscode.window.showQuickPick<FormatPickItem>(
      [
        {
          label: '$(file-code) OpenAPI 3.0 YAML (.yaml)',
          description: `Standard human-readable OpenAPI YAML specification — ${targetRoutes.length} routes`,
          format: 'yaml',
        },
        {
          label: '$(json) OpenAPI 3.0 JSON (.json)',
          description: `Machine-readable OpenAPI JSON specification — ${targetRoutes.length} routes`,
          format: 'json',
        },
      ],
      {
        title: 'API Routes Explorer: Export OpenAPI Specification',
        placeHolder: 'Select specification format',
      }
    );

    if (!pick) {
      return;
    }
    selectedFormat = pick.format;
  }

  const defaultBaseName = isFilteredExport ? 'openapi-filtered' : 'openapi';
  const defaultFileName = selectedFormat === 'yaml' ? `${defaultBaseName}.yaml` : `${defaultBaseName}.json`;
  const fileExtLabel = selectedFormat === 'yaml' ? 'OpenAPI YAML' : 'OpenAPI JSON';
  const fileFilterExt = selectedFormat === 'yaml' ? ['yaml', 'yml'] : ['json'];

  const workspaceFolders = vscode.workspace.workspaceFolders;
  const defaultUri =
    workspaceFolders && workspaceFolders.length > 0
      ? vscode.Uri.joinPath(workspaceFolders[0].uri, defaultFileName)
      : undefined;

  const saveUri = await vscode.window.showSaveDialog({
    defaultUri,
    title: `Save ${fileExtLabel} Specification`,
    filters: {
      [fileExtLabel]: fileFilterExt,
    },
  });

  if (!saveUri) {
    return;
  }

  const options = await resolveWorkspaceOpenApiOptions();
  const content =
    selectedFormat === 'yaml'
      ? generateOpenApiYamlString(targetRoutes, analysis, options)
      : generateOpenApiJsonString(targetRoutes, analysis, options);

  const encoder = new TextEncoder();
  await vscode.workspace.fs.writeFile(saveUri, encoder.encode(content));

  const fileName = saveUri.fsPath.split(/[\/\\]/).pop();
  const action = await vscode.window.showInformationMessage(
    `Exported OpenAPI specification (${targetRoutes.length} routes) to ${fileName}`,
    'Open File'
  );

  if (action === 'Open File') {
    const doc = await vscode.workspace.openTextDocument(saveUri);
    await vscode.window.showTextDocument(doc);
  }
}
