import * as vscode from 'vscode';
import { ApiRoute } from '../models/route';
import { parseExpressRoutes } from './routeParser';

/**
 * File search patterns for source code discovery.
 */
export const SCAN_INCLUDE_PATTERN = '**/*.{js,jsx,ts,tsx}';
export const SCAN_EXCLUDE_PATTERN =
  '{**/node_modules/**,**/.git/**,**/.next/**,**/dist/**,**/build/**,**/coverage/**,**/out/**}';

/**
 * Interface contract for workspace route scanners.
 */
export interface IRouteScanner {
  scan(workspacePath?: string): Promise<ApiRoute[]>;
}

/**
 * Scans the currently opened VS Code workspace for Express.js routes.
 *
 * Safe execution guarantees:
 * - Returns [] if no workspace is opened or workspace is empty.
 * - Gracefully catches and logs unreadable or invalid source files without crashing.
 *
 * @returns Array of discovered ApiRoute objects across all inspected workspace source files.
 */
export async function scanWorkspaceRoutes(): Promise<ApiRoute[]> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return [];
  }

  const routes: ApiRoute[] = [];

  try {
    const fileUris = await vscode.workspace.findFiles(
      SCAN_INCLUDE_PATTERN,
      SCAN_EXCLUDE_PATTERN
    );

    if (!fileUris || fileUris.length === 0) {
      return [];
    }

    const textDecoder = new TextDecoder('utf-8');

    for (const uri of fileUris) {
      try {
        const fileBytes = await vscode.workspace.fs.readFile(uri);
        const source = textDecoder.decode(fileBytes);
        const fileRoutes = parseExpressRoutes(source, uri.fsPath);
        routes.push(...fileRoutes);
      } catch (fileError) {
        // Safe error handling: log diagnostic information and proceed without crashing
        console.warn(`[API Route Explorer] Could not process file: ${uri.fsPath}`, fileError);
      }
    }
  } catch (error) {
    console.error('[API Route Explorer] Workspace scan failed:', error);
    return [];
  }

  return routes;
}

/**
 * RouteScanner class implementing IRouteScanner.
 */
export class RouteScanner implements IRouteScanner {
  public async scan(_workspacePath?: string): Promise<ApiRoute[]> {
    return scanWorkspaceRoutes();
  }
}
