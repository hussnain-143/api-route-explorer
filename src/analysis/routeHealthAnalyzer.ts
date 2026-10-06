import { ApiRoute } from '../models/route';
import {
  RouteHealth,
  RouteIssue,
  RouteConflict,
  RouteMiddleware,
} from './analysisTypes';
import { MissingHandlerWarning } from './handlerAnalyzer';

/**
 * Evaluates the health and generates issues for a single route.
 *
 * Severity precedence:
 * error > warning > info > healthy
 */
export function evaluateRouteHealth(
  route: ApiRoute,
  duplicates: ApiRoute[],
  conflicts: RouteConflict[],
  missingHandler: MissingHandlerWarning | undefined,
  middleware: RouteMiddleware[]
): { health: RouteHealth; issues: RouteIssue[] } {
  const issues: RouteIssue[] = [];

  // 1. Errors: Duplicates
  if (duplicates.length > 0) {
    issues.push({
      type: 'duplicate',
      severity: 'error',
      message: `Duplicate route: ${route.method} ${route.path}`,
      route,
      relatedRoutes: duplicates,
    });
  }

  // 2. Errors: Missing Handler
  if (missingHandler) {
    issues.push({
      type: 'missing-handler',
      severity: 'error',
      message: missingHandler.message,
      route,
    });
  }

  // 3. Warnings: Shadowing & Overlaps
  for (const conflict of conflicts) {
    if (conflict.isShadowing) {
      issues.push({
        type: 'shadowing',
        severity: 'warning',
        message: conflict.reason,
        route,
        relatedRoutes: [conflict.conflictingRoute],
      });
    } else {
      issues.push({
        type: 'route-conflict',
        severity: 'warning',
        message: conflict.reason,
        route,
        relatedRoutes: [conflict.conflictingRoute],
      });
    }
  }

  // 4. Info: Middleware attached (informational, does NOT indicate a problem)
  if (middleware.length > 0) {
    issues.push({
      type: 'middleware',
      severity: 'info',
      message: `Middleware: ${middleware.map((m) => m.name).join(', ')}`,
      route,
    });
  }

  // Calculate overall health by highest severity
  let health: RouteHealth = 'healthy';
  if (issues.some((i) => i.severity === 'error')) {
    health = 'error';
  } else if (issues.some((i) => i.severity === 'warning')) {
    health = 'warning';
  } else if (issues.some((i) => i.severity === 'info')) {
    health = 'info';
  }

  return { health, issues };
}
