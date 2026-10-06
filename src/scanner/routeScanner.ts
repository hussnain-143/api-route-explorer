import * as vscode from 'vscode';
import { ApiRoute } from '../models/route';
import { parseExpressRoutes } from './routeParser';
import { resolveRouterPrefixes } from '../analysis/prefixResolver';

/**
 * File search patterns for source code discovery.
 */
export const SCAN_INCLUDE_PATTERN = '**/*.{js,jsx,ts,tsx}';
export const SCAN_EXCLUDE_PATTERN =
  '{**/node_modules/**,**/.git/**,**/.next/**,**/dist/**,**/build/**,**/coverage/**,**/out/**}';

/**
 * Raw scan data with source code mapping.
 */
export interface ScannedWorkspaceData {
  routes: ApiRoute[];
  fileSources: Map<string, string>;
}

/**
 * Interface contract for workspace route scanners.
 */
export interface IRouteScanner {
  scan(workspacePath?: string): Promise<ApiRoute[]>;
}

/**
 * Scans the workspace, collecting raw parsed routes and file source text.
 */
export async function scanWorkspaceDetailed(): Promise<ScannedWorkspaceData> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return { routes: [], fileSources: new Map() };
  }

  const routes: ApiRoute[] = [];
  const fileSources = new Map<string, string>();

  try {
    const fileUris = await vscode.workspace.findFiles(
      SCAN_INCLUDE_PATTERN,
      SCAN_EXCLUDE_PATTERN
    );

    if (!fileUris || fileUris.length === 0) {
      return { routes: [], fileSources: new Map() };
    }

    const textDecoder = new TextDecoder('utf-8');

    for (const uri of fileUris) {
      try {
        const fileBytes = await vscode.workspace.fs.readFile(uri);
        const source = textDecoder.decode(fileBytes);
        fileSources.set(uri.fsPath, source);

        const fileRoutes = parseExpressRoutes(source, uri.fsPath);
        routes.push(...fileRoutes);
      } catch (fileError) {
        // Safe error handling: log diagnostic information and proceed without crashing
        console.warn(`[API Route Explorer] Could not process file: ${uri.fsPath}`, fileError);
      }
    }
  } catch (error) {
    console.error('[API Route Explorer] Workspace scan failed:', error);
    return { routes: [], fileSources: new Map() };
  }

  return { routes, fileSources };
}

/**
 * Scans the currently opened VS Code workspace for Express.js routes
 * and applies static router mount prefix resolution.
 *
 * Safe execution guarantees:
 * - Returns [] if no workspace is opened or workspace is empty.
 * - Gracefully catches and logs unreadable or invalid source files without crashing.
 *
 * @returns Array of discovered ApiRoute objects with resolved prefixes.
 */
export async function scanWorkspaceRoutes(): Promise<ApiRoute[]> {
  const { routes, fileSources } = await scanWorkspaceDetailed();
  if (routes.length === 0) {
    return [];
  }
  return resolveRouterPrefixes(routes, fileSources);
}

/**
 * RouteScanner class implementing IRouteScanner.
 */
export class RouteScanner implements IRouteScanner {
  public async scan(_workspacePath?: string): Promise<ApiRoute[]> {
    return scanWorkspaceRoutes();
  }
}
