import { ApiRoute } from '../models/route';

/**
 * Severity level for route analysis findings.
 */
export type AnalysisSeverity = 'info' | 'warning' | 'error';

/**
 * Health assessment of a route.
 */
export type RouteHealth = 'healthy' | 'info' | 'warning' | 'error';

/**
 * Specific category of route issue identified by static analysis.
 */
export type RouteIssueType =
  | 'duplicate'
  | 'route-conflict'
  | 'shadowing'
  | 'middleware'
  | 'missing-handler'
  | 'suspicious-route'
  | 'unreachable-route';

/**
 * Finding or diagnostic issue associated with a route.
 */
export interface RouteIssue {
  type: RouteIssueType;
  severity: AnalysisSeverity;
  message: string;
  route: ApiRoute;
  relatedRoutes?: ApiRoute[];
}

/**
 * Classification of route middleware/interceptor.
 */
export type MiddlewareType =
  | 'middleware'
  | 'guard'
  | 'interceptor'
  | 'pre-handler'
  | 'unknown';

/**
 * Metadata for a middleware function attached to a route.
 */
export interface RouteMiddleware {
  name: string;
  filePath?: string;
  line?: number;
  type: MiddlewareType;
}

/**
 * Represents a potential route collision or shadowing condition between two routes.
 */
export interface RouteConflict {
  route: ApiRoute;
  conflictingRoute: ApiRoute;
  reason: string;
  isShadowing: boolean;
  severity: AnalysisSeverity;
}

/**
 * Comprehensive relationships and health status for a single route.
 */
export interface RouteRelationship {
  route: ApiRoute;
  health: RouteHealth;
  issues: RouteIssue[];
  middleware: RouteMiddleware[];
  conflicts: RouteConflict[];
  duplicates: ApiRoute[];
}

/**
 * Aggregation of routes protected or processed by a specific middleware.
 */
export interface MiddlewareUsageGroup {
  middlewareName: string;
  type: MiddlewareType;
  routes: ApiRoute[];
}
