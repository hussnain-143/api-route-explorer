import { ApiRoute, HttpMethod } from '../models/route';

/**
 * Normalizes an Express route path for semantic comparison and duplicate detection.
 *
 * Rules:
 * - Collapses redundant consecutive slashes (e.g. `//api///users` -> `/api/users`).
 * - Strips trailing slashes, preserving root `/` (e.g. `/api/users/` -> `/api/users`).
 * - Normalizes dynamic route parameters (`:id`, `:userId`, `:slug`) to `:param`.
 * - Ensures leading slash.
 *
 * @param routePath Raw route path string.
 * @returns Normalized route path.
 */
export function normalizeRoutePath(routePath: string): string {
  if (!routePath || typeof routePath !== 'string') {
    return '/';
  }

  let cleaned = routePath.trim().replace(/\\/g, '/');

  // Collapse consecutive slashes
  cleaned = cleaned.replace(/\/+/g, '/');

  // Ensure leading slash
  if (!cleaned.startsWith('/')) {
    cleaned = `/${cleaned}`;
  }

  // Remove trailing slash if length > 1
  if (cleaned.length > 1 && cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1);
  }

  // Normalize route parameter names (e.g. :id, :userId, :orderId -> :param)
  cleaned = cleaned.replace(/\/:[a-zA-Z0-9_$]+/g, '/:param');

  return cleaned;
}

/**
 * Generates a unique signature for duplicate detection: `${METHOD}:${NORMALIZED_PATH}`.
 * A route is ONLY a duplicate if both the HTTP method and normalized path are identical.
 */
export function getDuplicateSignature(route: ApiRoute): string {
  const normalized = normalizeRoutePath(route.path);
  return `${route.method}:${normalized}`;
}

/**
 * Represents a group of identical routes colliding on HTTP method and normalized path.
 */
export interface DuplicateRouteGroup {
  method: HttpMethod;
  normalizedPath: string;
  signature: string;
  routes: ApiRoute[];
}

/**
 * Represents a shared route path supporting multiple HTTP methods (e.g. GET + POST on /api/users).
 * These are valid API design patterns, NOT duplicate warnings.
 */
export interface RoutePathGroup {
  normalizedPath: string;
  routes: ApiRoute[];
  methods: HttpMethod[];
}

/**
 * Discovers duplicate routes where both the HTTP method and normalized path collide.
 *
 * @param routes Discovered API routes.
 * @returns Array of DuplicateRouteGroup containing 2 or more conflicting routes.
 */
export function findDuplicateRoutes(routes: ApiRoute[]): DuplicateRouteGroup[] {
  const signatureMap = new Map<string, ApiRoute[]>();

  for (const route of routes) {
    const fw = route.framework || 'express';
    const key = `${fw}:${getDuplicateSignature(route)}`;
    const existing = signatureMap.get(key);
    if (existing) {
      existing.push(route);
    } else {
      signatureMap.set(key, [route]);
    }
  }

  const duplicates: DuplicateRouteGroup[] = [];

  for (const [, groupRoutes] of signatureMap.entries()) {
    if (groupRoutes.length > 1) {
      const firstRoute = groupRoutes[0];
      const method = firstRoute.method;
      const normalizedPath = normalizeRoutePath(firstRoute.path);
      duplicates.push({
        method,
        normalizedPath,
        signature: getDuplicateSignature(firstRoute),
        routes: groupRoutes,
      });
    }
  }

  return duplicates;
}

/**
 * Groups routes that share the same normalized route path across different HTTP methods.
 *
 * @param routes Discovered API routes.
 * @returns Array of RoutePathGroup where 2 or more HTTP methods target the same endpoint.
 */
export function findSharedPathGroups(routes: ApiRoute[]): RoutePathGroup[] {
  const pathMap = new Map<string, ApiRoute[]>();

  for (const route of routes) {
    const normalized = normalizeRoutePath(route.path);
    const existing = pathMap.get(normalized);
    if (existing) {
      existing.push(route);
    } else {
      pathMap.set(normalized, [route]);
    }
  }

  const sharedGroups: RoutePathGroup[] = [];

  for (const [normalizedPath, groupRoutes] of pathMap.entries()) {
    const uniqueMethods = Array.from(new Set(groupRoutes.map((r) => r.method)));
    if (uniqueMethods.length > 1) {
      sharedGroups.push({
        normalizedPath,
        routes: groupRoutes,
        methods: uniqueMethods,
      });
    }
  }

  return sharedGroups;
}
