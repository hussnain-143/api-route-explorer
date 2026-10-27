import * as vscode from 'vscode';
import { ApiRoute } from '../models/route';
import { defaultFrameworkRegistry } from '../frameworks/frameworkRegistry';
import { RouteIndex } from './routeIndex';

/**
 * File search patterns for source code discovery.
 */
export const SCAN_INCLUDE_PATTERN = '**/*.{js,jsx,ts,tsx}';
export const BASE_EXCLUDE_SEGMENTS = [
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  'dist',
  'build',
  'coverage',
  'out',
  '__tests__',
];

export const SCAN_EXCLUDE_PATTERN =
  '{**/node_modules/**,**/.git/**,**/.next/**,**/.turbo/**,**/dist/**,**/build/**,**/coverage/**,**/out/**,**/__tests__/**,**/*.test.*,**/*.spec.*}';

const SCAN_BATCH_SIZE = 24;

/**
 * Determines whether a file's source text should be retained in memory for cross-file
 * router prefix resolution, handler inspection, or schema/DTO parameter extraction.
 */
export function isRelevantSourceForAnalysis(source: string, fileRoutes: ApiRoute[]): boolean {
  if (fileRoutes.length > 0) {
    return true;
  }
  return (
    source.includes('.use(') ||
    source.includes('.register(') ||
    source.includes('.route(') ||
    source.includes('@Module(') ||
    source.includes('@Controller(') ||
    source.includes('Router(') ||
    source.includes('z.object(') ||
    source.includes('Joi.object(') ||
    source.includes('req.body') ||
    source.includes('req.query') ||
    source.includes('req.params') ||
    source.includes('request.body') ||
    source.includes('export ') ||
    source.includes('module.exports')
  );
}

/**
 * Computes the active exclusion glob pattern by merging built-in safe defaults
 * with user-configured exclusions from `apiRouteExplorer.scan.exclude`.
 */
export function getScanExcludePattern(): string {
  try {
    const config = vscode.workspace.getConfiguration('apiRouteExplorer');
    const userExcludes: string[] = config.get('scan.exclude') || [];

    const allSegments = new Set<string>(BASE_EXCLUDE_SEGMENTS);
    for (const item of userExcludes) {
      const trimmed = item.trim().replace(/^[\/\*]+|[\/\*]+$/g, '');
      if (trimmed) {
        allSegments.add(trimmed);
      }
    }

    const globList = Array.from(allSegments).map((s) => `**/${s}/**`);
    globList.push('**/*.test.*', '**/*.spec.*');
    return `{${globList.join(',')}}`;
  } catch {
    return SCAN_EXCLUDE_PATTERN;
  }
}

/**
 * Raw scan data with source code mapping, route index, and cancellation flag.
 */
export interface ScannedWorkspaceData {
  routes: ApiRoute[];
  fileSources: Map<string, string>;
  routeIndex?: RouteIndex;
  cancelled?: boolean;
}

/**
 * Interface contract for workspace route scanners.
 */
export interface IRouteScanner {
  scan(workspacePath?: string): Promise<ApiRoute[]>;
}

/**
 * Parses all API routes from a single file's source code using registered framework adapters.
 *
 * @param filePath Full path to the source file.
 * @param source Content of the source file.
 * @returns Discovered ApiRoute array for this file.
 */
export function parseRoutesForFile(filePath: string, source: string): ApiRoute[] {
  const routes: ApiRoute[] = [];
  const matchedAdapters = defaultFrameworkRegistry.getAdaptersForFile(filePath, source);
  for (const adapter of matchedAdapters) {
    const fileRoutes = adapter.parseRoutes(filePath, source);
    routes.push(...fileRoutes);
  }
  return routes;
}

/**
 * Incrementally updates a single modified or created file in the route index and fileSources cache.
 *
 * @param filePath Source file path.
 * @param source Source file text content.
 * @param routeIndex In-memory route index to update.
 * @param fileSources Map of source files.
 * @returns Discovered routes for the updated file.
 */
export function scanSingleFile(
  filePath: string,
  source: string,
  routeIndex: RouteIndex,
  fileSources: Map<string, string>
): ApiRoute[] {
  const fileRoutes = parseRoutesForFile(filePath, source);
  if (isRelevantSourceForAnalysis(source, fileRoutes)) {
    fileSources.set(filePath, source);
  } else {
    fileSources.delete(filePath);
  }
  routeIndex.setFileRoutes(filePath, fileRoutes);
  return fileRoutes;
}

/**
 * Incrementally removes a deleted file from the route index and fileSources cache.
 *
 * @param filePath Source file path to remove.
 * @param routeIndex In-memory route index.
 * @param fileSources Map of source files.
 * @returns Routes that were removed.
 */
export function removeSingleFile(
  filePath: string,
  routeIndex: RouteIndex,
  fileSources: Map<string, string>
): ApiRoute[] {
  fileSources.delete(filePath);
  return routeIndex.removeFileRoutes(filePath);
}

/**
 * Applies all framework adapter post-processing (e.g. prefix resolution) to raw routes.
 *
 * @param rawRoutes Discovered raw routes.
 * @param fileSources Map of source code.
 * @returns Post-processed routes.
 */
export function postProcessAllRoutes(
  rawRoutes: ApiRoute[],
  fileSources: Map<string, string>
): ApiRoute[] {
  let processed = rawRoutes;
  for (const adapter of defaultFrameworkRegistry.getAdapters()) {
    if (adapter.postProcessRoutes) {
      processed = adapter.postProcessRoutes(processed, fileSources);
    }
  }
  return processed;
}

/**
 * Scans the workspace, collecting raw parsed routes, populating a RouteIndex,
 * and mapping file source text. Supports cancellation tokens and progress reporting.
 *
 * @param token Optional CancellationToken to abort long-running scans.
 * @param progress Optional Progress reporter for user feedback.
 */
export async function scanWorkspaceDetailed(
  token?: vscode.CancellationToken,
  progress?: vscode.Progress<{ message?: string; increment?: number }>
): Promise<ScannedWorkspaceData> {
  if (token?.isCancellationRequested) {
    return { routes: [], fileSources: new Map(), routeIndex: new RouteIndex(), cancelled: true };
  }

  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return { routes: [], fileSources: new Map(), routeIndex: new RouteIndex(), cancelled: false };
  }

  const routes: ApiRoute[] = [];
  const fileSources = new Map<string, string>();
  const routeIndex = new RouteIndex();

  try {
    if (token?.isCancellationRequested) {
      return { routes: [], fileSources, routeIndex, cancelled: true };
    }

    const fileUris = await vscode.workspace.findFiles(
      SCAN_INCLUDE_PATTERN,
      getScanExcludePattern()
    );

    if (!fileUris || fileUris.length === 0) {
      return { routes: [], fileSources, routeIndex, cancelled: false };
    }

    const totalFiles = fileUris.length;
    const textDecoder = new TextDecoder('utf-8');

    for (let batchStart = 0; batchStart < totalFiles; batchStart += SCAN_BATCH_SIZE) {
      if (token?.isCancellationRequested) {
        return { routes: [], fileSources, routeIndex, cancelled: true };
      }

      const batchUris = fileUris.slice(batchStart, Math.min(batchStart + SCAN_BATCH_SIZE, totalFiles));
      const batchResults = await Promise.all(
        batchUris.map(async (uri) => {
          try {
            const fileBytes = await vscode.workspace.fs.readFile(uri);
            const source = textDecoder.decode(fileBytes);
            const fileRoutes = parseRoutesForFile(uri.fsPath, source);
            return { uri, source, fileRoutes, ok: true as const };
          } catch (fileError) {
            console.warn(`[API Routes Explorer] Could not process file: ${uri.fsPath}`, fileError);
            return { uri, source: '', fileRoutes: [] as ApiRoute[], ok: false as const };
          }
        })
      );

      for (const item of batchResults) {
        if (!item.ok) {
          continue;
        }
        if (isRelevantSourceForAnalysis(item.source, item.fileRoutes)) {
          fileSources.set(item.uri.fsPath, item.source);
        }
        if (item.fileRoutes.length > 0) {
          routes.push(...item.fileRoutes);
          routeIndex.setFileRoutes(item.uri.fsPath, item.fileRoutes);
        } else {
          routeIndex.setFileRoutes(item.uri.fsPath, []);
        }
      }

      if (progress) {
        const processedCount = Math.min(batchStart + batchUris.length, totalFiles);
        progress.report({
          message: `${processedCount} / ${totalFiles} files`,
          increment: (batchUris.length / totalFiles) * 100,
        });
      }
    }
  } catch (error) {
    console.error('[API Routes Explorer] Workspace scan failed:', error);
    return { routes: [], fileSources, routeIndex, cancelled: false };
  }

  return { routes, fileSources, routeIndex, cancelled: false };
}

/**
 * Scans the currently opened VS Code workspace for API routes across all supported frameworks
 * and applies framework-specific post-processing (e.g. router prefix composition).
 *
 * @param token Optional CancellationToken to abort scan.
 * @returns Array of discovered ApiRoute objects with resolved prefixes.
 */
export async function scanWorkspaceRoutes(token?: vscode.CancellationToken): Promise<ApiRoute[]> {
  const { routes, fileSources, cancelled } = await scanWorkspaceDetailed(token);
  if (cancelled || routes.length === 0) {
    return [];
  }

  return postProcessAllRoutes(routes, fileSources);
}

/**
 * RouteScanner class implementing IRouteScanner.
 */
export class RouteScanner implements IRouteScanner {
  public async scan(_workspacePath?: string): Promise<ApiRoute[]> {
    return scanWorkspaceRoutes();
  }
}
