import { ApiRoute, HttpMethod } from '../../models/route';
import { LineIndex, maskComments } from '../../scanner/routeParser';

const SUPPORTED_HTTP_METHODS: HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
];

/**
 * Normalizes a Next.js Pages Router API filepath to its public API URL path.
 *
 * Examples:
 * - pages/api/users.ts -> /api/users
 * - pages/api/users/index.js -> /api/users
 * - pages/api/users/[id].ts -> /api/users/:id
 * - src/pages/api/products/[...slug].ts -> /api/products/*slug
 */
export function pagesRouterPathToPublicUrl(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, '/');

  const match = normalized.match(/(?:^|\/)(?:src\/pages\/api|pages\/api)\/(.+?)\.[jt]sx?$/i);
  if (!match) {
    // Check root pages/api/index.ts or pages/api.ts
    if (/(?:^|\/)(?:src\/pages\/api|pages\/api)\.[jt]sx?$/i.test(normalized)) {
      return '/api';
    }
    return null;
  }

  const rawRelative = match[1];

  // Exclude internal files like _middleware or test fixtures
  const parts = rawRelative.split('/');
  const fileName = parts[parts.length - 1];
  if (fileName.startsWith('_') || fileName.includes('.test') || fileName.includes('.spec')) {
    return null;
  }

  const segments = parts.filter(Boolean);

  // If last segment is 'index', omit it
  if (segments.length > 0 && segments[segments.length - 1].toLowerCase() === 'index') {
    segments.pop();
  }

  const cleanSegments: string[] = [];
  for (const seg of segments) {
    // Catch-all parameter: [...slug] or [[...slug]]
    if (/^\[{1,2}\.\.\.[a-zA-Z0-9_$]+\]{1,2}$/.test(seg)) {
      const paramName = seg.replace(/^[\[.]+|[\]]+$/g, '');
      cleanSegments.push(`*${paramName}`);
      continue;
    }

    // Dynamic parameter: [id] -> :id
    if (/^\[[a-zA-Z0-9_$]+\]$/.test(seg)) {
      const paramName = seg.slice(1, -1);
      cleanSegments.push(`:${paramName}`);
      continue;
    }

    cleanSegments.push(seg);
  }

  const subPath = cleanSegments.length > 0 ? '/' + cleanSegments.join('/') : '';
  const publicPath = `/api${subPath}`.replace(/\/+/g, '/');
  return publicPath || '/api';
}

/**
 * Parses Next.js Pages Router API handler files.
 * Inspects default export and looks for specific req.method checks or falls back to 'ANY'.
 */
export function parseNextPagesRouterRoutes(source: string, filePath: string): ApiRoute[] {
  const publicPath = pagesRouterPathToPublicUrl(filePath);
  if (!publicPath) {
    return [];
  }

  const cleanSource = maskComments(source);
  const lineIndex = new LineIndex(source);
  const routes: ApiRoute[] = [];

  // Check for explicit req.method checks in the handler body:
  // e.g. req.method === 'GET' or case 'GET': or req.method === "POST"
  const methodCheckRegex = /(?:req\.method\s*===?\s*['"](GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)['"]|case\s+['"](GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)['"])/gi;
  const detectedMethods = new Set<HttpMethod>();

  let match: RegExpExecArray | null;
  while ((match = methodCheckRegex.exec(cleanSource)) !== null) {
    const rawMethod = (match[1] || match[2]).toUpperCase() as HttpMethod;
    if (SUPPORTED_HTTP_METHODS.includes(rawMethod) && !detectedMethods.has(rawMethod)) {
      detectedMethods.add(rawMethod);
      const pos = lineIndex.getPosition(match.index);
      routes.push({
        method: rawMethod,
        path: publicPath,
        filePath,
        line: pos.line,
        column: pos.column,
        framework: 'nextjs',
        handlerName: `handler [${rawMethod}]`,
      });
    }
  }

  // If specific methods were explicitly handled, return them
  if (routes.length > 0) {
    return routes;
  }

  // Otherwise, find default export position and assign generic 'ANY' method
  const defaultExportRegex = /\bexport\s+default\b/g;
  const defaultMatch = defaultExportRegex.exec(cleanSource);
  const pos = defaultMatch ? lineIndex.getPosition(defaultMatch.index) : { line: 0, column: 0 };

  return [
    {
      method: 'ANY',
      path: publicPath,
      filePath,
      line: pos.line,
      column: pos.column,
      framework: 'nextjs',
      handlerName: 'defaultHandler',
    },
  ];
}
