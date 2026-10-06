import { ApiRoute, HttpMethod } from '../../models/route';
import { LineIndex, maskComments } from '../../scanner/routeParser';

const SUPPORTED_NEXT_METHODS: HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
];

/**
 * Normalizes a Next.js App Router filepath to its public API URL path.
 *
 * Rules:
 * - Extracts path relative to app/ or src/app/.
 * - Strips trailing /route.(ts|js|tsx|jsx).
 * - Strips route groups (parentheses like `(dashboard)`, `(marketing)`).
 * - Strips parallel route segments (e.g. `@modal`).
 * - Converts `[id]` -> `:id`.
 * - Converts `[...slug]` and `[[...slug]]` -> `*slug`.
 * - Ensures leading slash and no trailing slash.
 */
export function appRouterPathToPublicUrl(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, '/');

  // Match files named route.ext inside an app directory
  const appMatch = normalized.match(/(?:^|\/)(?:src\/app|app)\/(.+?)\/route\.[jt]sx?$/i);
  if (!appMatch) {
    // Also support root app/route.ts
    const rootAppMatch = normalized.match(/(?:^|\/)(?:src\/app|app)\/route\.[jt]sx?$/i);
    if (rootAppMatch) {
      return '/';
    }
    return null;
  }

  const rawRelative = appMatch[1];
  const segments = rawRelative.split('/').filter(Boolean);

  const cleanSegments: string[] = [];

  for (const seg of segments) {
    // 1. Ignore route groups: e.g. (dashboard), (auth), (marketing)
    if (seg.startsWith('(') && seg.endsWith(')')) {
      continue;
    }

    // 2. Ignore parallel routes: e.g. @modal, @slot
    if (seg.startsWith('@')) {
      continue;
    }

    // 3. Catch-all parameter: [...slug] or [[...slug]]
    if (/^\[{1,2}\.\.\.[a-zA-Z0-9_$]+\]{1,2}$/.test(seg)) {
      const paramName = seg.replace(/^[\[.]+|[\]]+$/g, '');
      cleanSegments.push(`*${paramName}`);
      continue;
    }

    // 4. Dynamic parameter: [id] -> :id
    if (/^\[[a-zA-Z0-9_$]+\]$/.test(seg)) {
      const paramName = seg.slice(1, -1);
      cleanSegments.push(`:${paramName}`);
      continue;
    }

    cleanSegments.push(seg);
  }

  const publicPath = '/' + cleanSegments.join('/');
  return publicPath.replace(/\/+/g, '/') || '/';
}

/**
 * Parses Next.js App Router route handler files (route.ts / route.js).
 * Detects named method exports (GET, POST, etc.) and records exact line and column numbers.
 */
export function parseNextAppRouterRoutes(source: string, filePath: string): ApiRoute[] {
  const publicPath = appRouterPathToPublicUrl(filePath);
  if (!publicPath) {
    return [];
  }

  const cleanSource = maskComments(source);
  const lineIndex = new LineIndex(source);
  const routes: ApiRoute[] = [];
  const foundMethods = new Set<HttpMethod>();

  // 1. Detect: export [async] function GET/POST/etc.
  const functionRegex = /\bexport\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g;
  let match: RegExpExecArray | null;

  while ((match = functionRegex.exec(cleanSource)) !== null) {
    const method = match[1].toUpperCase() as HttpMethod;
    if (SUPPORTED_NEXT_METHODS.includes(method) && !foundMethods.has(method)) {
      foundMethods.add(method);
      const pos = lineIndex.getPosition(match.index);
      routes.push({
        method,
        path: publicPath,
        filePath,
        line: pos.line,
        column: pos.column,
        framework: 'nextjs',
        handlerName: method,
      });
    }
  }

  // 2. Detect: export const/let/var GET/POST = ...
  const constRegex = /\bexport\s+(?:const|let|var)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g;
  while ((match = constRegex.exec(cleanSource)) !== null) {
    const method = match[1].toUpperCase() as HttpMethod;
    if (SUPPORTED_NEXT_METHODS.includes(method) && !foundMethods.has(method)) {
      foundMethods.add(method);
      const pos = lineIndex.getPosition(match.index);
      routes.push({
        method,
        path: publicPath,
        filePath,
        line: pos.line,
        column: pos.column,
        framework: 'nextjs',
        handlerName: method,
      });
    }
  }

  // 3. Detect named re-exports: export { GET, POST } or export { handler as GET }
  const exportListRegex = /\bexport\s*\{([^}]+)\}/g;
  while ((match = exportListRegex.exec(cleanSource)) !== null) {
    const listBody = match[1];
    const listOffset = match.index;
    const entries = listBody.split(',');

    for (const entry of entries) {
      const parts = entry.trim().split(/\s+as\s+/);
      const exportedName = (parts.length > 1 ? parts[1] : parts[0]).trim();
      const method = exportedName.toUpperCase() as HttpMethod;

      if (SUPPORTED_NEXT_METHODS.includes(method) && !foundMethods.has(method)) {
        foundMethods.add(method);
        // Find approximate position of entry in export block
        const entryOffset = cleanSource.indexOf(entry, listOffset);
        const pos = lineIndex.getPosition(entryOffset >= 0 ? entryOffset : listOffset);
        routes.push({
          method,
          path: publicPath,
          filePath,
          line: pos.line,
          column: pos.column,
          framework: 'nextjs',
          handlerName: method,
        });
      }
    }
  }

  return routes;
}
