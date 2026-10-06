import { ApiRoute } from '../models/route';
import {
  findDuplicateRoutes,
  findSharedPathGroups,
  DuplicateRouteGroup,
  RoutePathGroup,
} from './duplicateDetector';
import { resolveRouterPrefixes } from './prefixResolver';
import {
  analyzeRouteHandlers,
  MissingHandlerWarning,
} from './handlerAnalyzer';
import {
  calculateRouteStatistics,
  RouteStatistics,
} from './routeStatistics';
import { findRouteConflicts } from './conflictDetector';
import {
  buildRouteRelationships,
} from './routeRelationshipAnalyzer';
import {
  RouteConflict,
  RouteRelationship,
  MiddlewareUsageGroup,
} from './analysisTypes';

/**
 * Complete result of the smart route analysis pipeline.
 */
export interface RouteAnalysisResult {
  routes: ApiRoute[];
  duplicates: DuplicateRouteGroup[];
  sharedPaths: RoutePathGroup[];
  missingHandlers: MissingHandlerWarning[];
  conflicts: RouteConflict[];
  relationships: Map<string, RouteRelationship>;
  middlewareGroups: MiddlewareUsageGroup[];
  statistics: RouteStatistics;
}

/**
 * Runs the full Smart Route Intelligence pipeline:
 * 1. Resolves Express & Fastify router mount prefixes.
 * 2. Detects duplicate routes (colliding on method + normalized path).
 * 3. Identifies shared route paths with multiple HTTP methods.
 * 4. Detects possible missing handlers in route declarations.
 * 5. Identifies potential route conflicts and shadowing patterns.
 * 6. Extracts route middleware, builds relationships and health assessments.
 * 7. Calculates comprehensive route statistics.
 *
 * @param rawRoutes Raw routes discovered by the route parser.
 * @param fileSources Map of filePath -> source code across inspected files.
 * @returns Comprehensive RouteAnalysisResult.
 */
export function analyzeWorkspaceRoutes(
  rawRoutes: ApiRoute[],
  fileSources: Map<string, string> | Record<string, string>
): RouteAnalysisResult {
  // 1. Prefix resolution
  const resolvedRoutes = resolveRouterPrefixes(rawRoutes, fileSources);

  // 2. Duplicate detection
  const duplicates = findDuplicateRoutes(resolvedRoutes);

  // 3. Shared path grouping
  const sharedPaths = findSharedPathGroups(resolvedRoutes);

  // 4. Missing handler analysis
  const missingHandlers = analyzeRouteHandlers(resolvedRoutes, fileSources);

  // 5. Conflict & shadowing detection
  const conflicts = findRouteConflicts(resolvedRoutes);

  // 6. Middleware extraction and route relationships
  const { relationships, middlewareGroups } = buildRouteRelationships(
    resolvedRoutes,
    duplicates,
    conflicts,
    missingHandlers,
    fileSources
  );

  // 7. Statistics calculation
  const statistics = calculateRouteStatistics(
    resolvedRoutes,
    duplicates,
    sharedPaths,
    conflicts,
    relationships
  );

  return {
    routes: resolvedRoutes,
    duplicates,
    sharedPaths,
    missingHandlers,
    conflicts,
    relationships,
    middlewareGroups,
    statistics,
  };
}
