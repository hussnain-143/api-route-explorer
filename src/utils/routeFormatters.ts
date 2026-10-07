import * as vscode from 'vscode';
import { ApiRoute } from '../models/route';
import { getRelativeFilePath } from '../providers/routeTreeProvider';

/**
 * Resolves a normalized, valid base URL from workspace configuration.
 * Always returns a clean URL with scheme and without trailing slashes.
 */
export function getResolvedBaseUrl(customUrl?: string): string {
  let raw = customUrl;
  if (!raw) {
    try {
      const config = vscode.workspace.getConfiguration('apiRouteExplorer');
      raw = config.get<string>('baseUrl', 'http://localhost:3000');
    } catch {
      raw = 'http://localhost:3000';
    }
  }

  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    return 'http://localhost:3000';
  }

  let trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    trimmed = `http://${trimmed}`;
  }
  return trimmed;
}

/**
 * Resolves a fully-qualified URL by combining a base URL and a route path,
 * correctly eliminating overlapping prefix segments, trailing/leading slashes, and duplicate blocks.
 *
 * Examples:
 * - base: "http://localhost:5000", route: "/api/v1/health" -> "http://localhost:5000/api/v1/health"
 * - base: "http://localhost:5000/api/v1", route: "/health" -> "http://localhost:5000/api/v1/health"
 * - base: "http://localhost:5000/api/v1", route: "/api/v1/health" -> "http://localhost:5000/api/v1/health"
 * - base: "http://localhost:5000/api/v1/", route: "health" -> "http://localhost:5000/api/v1/health"
 * - base: "http://localhost:5000/api/v1", route: "/api/v1/users/{id}?page=1" -> "http://localhost:5000/api/v1/users/{id}?page=1"
 */
export function resolveFullUrl(baseUrl: string, routePath: string): string {
  const resolvedBase = getResolvedBaseUrl(baseUrl);
  const cleanRoute = (routePath || '').trim();

  // Separate path part from query string / hash
  const queryIdx = cleanRoute.indexOf('?');
  const hashIdx = cleanRoute.indexOf('#');
  let splitIdx = -1;
  if (queryIdx !== -1 && hashIdx !== -1) {
    splitIdx = Math.min(queryIdx, hashIdx);
  } else if (queryIdx !== -1) {
    splitIdx = queryIdx;
  } else if (hashIdx !== -1) {
    splitIdx = hashIdx;
  }

  const pathPart = splitIdx !== -1 ? cleanRoute.slice(0, splitIdx) : cleanRoute;
  const suffixPart = splitIdx !== -1 ? cleanRoute.slice(splitIdx) : '';

  let parsedBase: URL;
  try {
    parsedBase = new URL(resolvedBase);
  } catch {
    parsedBase = new URL('http://localhost:3000');
  }

  const origin = parsedBase.origin;
  const rawBasePath = parsedBase.pathname.replace(/\/+$/, '');

  const baseSegs = rawBasePath.split('/').filter(Boolean);
  const routeSegs = pathPart.replace(/\\/g, '/').split('/').filter(Boolean);

  if (baseSegs.length === 0) {
    const combinedPath = routeSegs.length > 0 ? `/${routeSegs.join('/')}` : '/';
    return `${origin}${combinedPath}${suffixPart}`;
  }

  // Find longest overlap between suffix of baseSegs and prefix of routeSegs
  let overlap = 0;
  const maxOverlap = Math.min(baseSegs.length, routeSegs.length);
  for (let len = maxOverlap; len > 0; len--) {
    const baseTail = baseSegs.slice(-len).join('/').toLowerCase();
    const routeHead = routeSegs.slice(0, len).join('/').toLowerCase();
    if (baseTail === routeHead) {
      overlap = len;
      break;
    }
  }

  let finalSegs: string[];
  if (overlap > 0) {
    finalSegs = [...baseSegs, ...routeSegs.slice(overlap)];
  } else {
    finalSegs = [...baseSegs, ...routeSegs];
  }

  // Also collapse any consecutive duplicate blocks
  let changed = true;
  while (changed) {
    changed = false;
    const n = finalSegs.length;
    for (let len = Math.floor(n / 2); len >= 1; len--) {
      for (let i = 0; i <= n - 2 * len; i++) {
        const b1 = finalSegs.slice(i, i + len);
        const b2 = finalSegs.slice(i + len, i + 2 * len);
        if (b1.every((s, idx) => s.toLowerCase() === b2[idx].toLowerCase())) {
          finalSegs.splice(i + len, len);
          changed = true;
          break;
        }
      }
      if (changed) {
        break;
      }
    }
  }

  const finalPath = `/${finalSegs.join('/')}`;
  return `${origin}${finalPath}${suffixPart}`;
}

/**
 * Builds a clean, fully-qualified local test URL for an ApiRoute.
 */
export function buildRouteUrl(route: ApiRoute, baseUrl?: string): string {
  const base = getResolvedBaseUrl(baseUrl);
  return resolveFullUrl(base, route.path);
}

/**
 * Builds a readable developer definition for an ApiRoute.
 * Format: "GET /users/:id -> src/routes/users.ts:42"
 */
export function buildRouteDefinition(route: ApiRoute, relativePath?: string): string {
  const rel = relativePath ?? getRelativeFilePath(route.filePath);
  return `${route.method} ${route.path} -> ${rel}:${route.line + 1}`;
}

/**
 * Builds a reproducible cURL command string for testing the endpoint.
 * Handles ANY fallback to GET, HEAD flags, and JSON payloads for mutating methods.
 */
export function buildCurlCommand(route: ApiRoute, baseUrl?: string): string {
  const url = buildRouteUrl(route, baseUrl);
  const method = route.method === 'ANY' ? 'GET' : route.method;

  if (method === 'HEAD') {
    return `curl -I "${url}"`;
  }

  let cmd = `curl -X ${method} "${url}"`;
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    cmd += ` -H "Content-Type: application/json" -d '{}'`;
  }
  return cmd;
}
