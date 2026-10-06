import { ApiRoute } from '../models/route';
import {
  RouteRelationship,
  RouteConflict,
  RouteMiddleware,
  MiddlewareUsageGroup,
} from './analysisTypes';
import { DuplicateRouteGroup } from './duplicateDetector';
import { MissingHandlerWarning } from './handlerAnalyzer';
import { extractRouteMiddleware, groupRoutesByMiddleware } from './middlewareAnalyzer';
import { evaluateRouteHealth } from './routeHealthAnalyzer';

/**
 * Unique identifier for a route instance.
 */
export function getRouteKey(route: ApiRoute): string {
  return `${route.framework}:${route.method}:${route.filePath}:${route.line}:${route.column}`;
}

/**
 * Builds comprehensive route relationships, health analysis, and middleware usage groups.
 */
export function buildRouteRelationships(
  routes: ApiRoute[],
  duplicateGroups: DuplicateRouteGroup[],
  conflicts: RouteConflict[],
  missingHandlers: MissingHandlerWarning[],
  fileSources: Map<string, string> | Record<string, string>
): {
  relationships: Map<string, RouteRelationship>;
  middlewareGroups: MiddlewareUsageGroup[];
} {
  // 1. Index duplicates by route key
  const duplicatesByRouteKey = new Map<string, ApiRoute[]>();
  for (const group of duplicateGroups) {
    for (const r of group.routes) {
      const key = getRouteKey(r);
      const others = group.routes.filter((other) => other !== r);
      duplicatesByRouteKey.set(key, others);
    }
  }

  // 2. Index conflicts by route key
  const conflictsByRouteKey = new Map<string, RouteConflict[]>();
  for (const conflict of conflicts) {
    const key = getRouteKey(conflict.route);
    let list = conflictsByRouteKey.get(key);
    if (!list) {
      list = [];
      conflictsByRouteKey.set(key, list);
    }
    list.push(conflict);
  }

  // 3. Index missing handlers by route key using O(1) map
  const routeLocationMap = new Map<string, ApiRoute>();
  for (const r of routes) {
    routeLocationMap.set(`${r.filePath}:${r.line}:${r.method}`, r);
  }

  const missingByRouteKey = new Map<string, MissingHandlerWarning>();
  for (const warning of missingHandlers) {
    const match = routeLocationMap.get(`${warning.filePath}:${warning.line}:${warning.method}`);
    if (match) {
      missingByRouteKey.set(getRouteKey(match), warning);
    }
  }

  // 4. Extract middleware for each route
  const routesWithMiddleware = new Map<ApiRoute, RouteMiddleware[]>();
  const relationships = new Map<string, RouteRelationship>();
  const linesCache = new Map<string, string[]>();

  for (const route of routes) {
    const key = getRouteKey(route);
    const middleware = extractRouteMiddleware(route, fileSources, linesCache);
    routesWithMiddleware.set(route, middleware);

    const dups = duplicatesByRouteKey.get(key) || [];
    const confluents = conflictsByRouteKey.get(key) || [];
    const missing = missingByRouteKey.get(key);

    const { health, issues } = evaluateRouteHealth(
      route,
      dups,
      confluents,
      missing,
      middleware
    );

    relationships.set(key, {
      route,
      health,
      issues,
      middleware,
      conflicts: confluents,
      duplicates: dups,
    });
  }

  // 5. Aggregate middleware usage
  const middlewareGroups = groupRoutesByMiddleware(routesWithMiddleware);

  return { relationships, middlewareGroups };
}
