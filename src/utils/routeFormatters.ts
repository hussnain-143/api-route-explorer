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
 * Builds a clean, fully-qualified local test URL for an ApiRoute.
 */
export function buildRouteUrl(route: ApiRoute, baseUrl?: string): string {
  const base = getResolvedBaseUrl(baseUrl);
  const cleanPath = route.path.startsWith('/') ? route.path : `/${route.path}`;
  return `${base}${cleanPath}`;
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
