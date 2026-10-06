import { ApiRoute, HttpMethod } from '../../models/route';
import { LineIndex, maskComments } from '../../scanner/routeParser';

const SUPPORTED_FASTIFY_METHODS: Record<string, HttpMethod> = {
  get: 'GET',
  post: 'POST',
  put: 'PUT',
  patch: 'PATCH',
  delete: 'DELETE',
  head: 'HEAD',
  options: 'OPTIONS',
  all: 'ANY',
};

/**
 * Regex matching standard Fastify method calls:
 * e.g. fastify.get('/users', handler)
 * or app.post('/users/:id', opts, handler)
 * or server.delete('/users/:id', handler)
 */
const FASTIFY_METHOD_REGEX =
  /\b(fastify|server|app|instance|api)\s*\.\s*(get|post|put|patch|delete|head|options|all)\s*(?:<[^>]*>)?\s*\(\s*(['"`])([^'"`\r\n]+)\3/g;

/**
 * Regex matching the start of fastify.route({ declarations.
 */
const FASTIFY_ROUTE_CALL_REGEX =
  /\b(?:fastify|server|app|instance|api)\s*\.\s*route\s*\(\s*\{/g;

/**
 * Extracts balanced object content between matching { and }.
 */
function extractMatchingObject(source: string, openBraceIndex: number): string | null {
  let depth = 0;
  for (let i = openBraceIndex; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return source.substring(openBraceIndex + 1, i);
      }
    }
  }
  return null;
}

/**
 * Parses Fastify routes from source code.
 * Supports standard methods (.get, .post, etc.) and fastify.route({ method, url, handler }).
 */
export function parseFastifyRoutes(source: string, filePath: string): ApiRoute[] {
  if (!source || typeof source !== 'string') {
    return [];
  }

  const cleanSource = maskComments(source);
  const lineIndex = new LineIndex(source);
  const routes: ApiRoute[] = [];

  // 1. Standard method calls: fastify.get('/path', ...)
  FASTIFY_METHOD_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FASTIFY_METHOD_REGEX.exec(cleanSource)) !== null) {
    const rawMethod = match[2].toLowerCase();
    const routePath = match[4].trim();

    if (rawMethod in SUPPORTED_FASTIFY_METHODS) {
      const method = SUPPORTED_FASTIFY_METHODS[rawMethod];
      const pos = lineIndex.getPosition(match.index);

      routes.push({
        method,
        path: routePath.startsWith('/') ? routePath : `/${routePath}`,
        filePath,
        line: pos.line,
        column: pos.column,
        framework: 'fastify',
      });
    }
  }

  // 2. Route object options: fastify.route({ method: 'GET', url: '/users', handler })
  FASTIFY_ROUTE_CALL_REGEX.lastIndex = 0;
  while ((match = FASTIFY_ROUTE_CALL_REGEX.exec(cleanSource)) !== null) {
    const callOffset = match.index;
    const braceIndex = cleanSource.indexOf('{', callOffset);
    if (braceIndex === -1) {
      continue;
    }
    const body = extractMatchingObject(cleanSource, braceIndex);
    if (!body) {
      continue;
    }
    FASTIFY_ROUTE_CALL_REGEX.lastIndex = braceIndex + body.length + 1;

    // Extract url or path
    const urlMatch = body.match(/\b(?:url|path)\s*:\s*(['"`])([^'"`\r\n]+)\1/);
    if (!urlMatch) {
      continue;
    }
    const routePath = urlMatch[2].trim();
    const normalizedPath = routePath.startsWith('/') ? routePath : `/${routePath}`;

    // Extract method: can be string ("GET") or array (["GET", "POST"])
    const singleMethodMatch = body.match(/\bmethod\s*:\s*(['"`])([a-zA-Z]+)\1/);
    const arrayMethodMatch = body.match(/\bmethod\s*:\s*\[([^\]]+)\]/);

    const methods: HttpMethod[] = [];

    if (singleMethodMatch) {
      const m = singleMethodMatch[2].toUpperCase() as HttpMethod;
      if (['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(m)) {
        methods.push(m);
      }
    } else if (arrayMethodMatch) {
      const items = arrayMethodMatch[1].split(',');
      for (const item of items) {
        const cleanItem = item.trim().replace(/['"`]/g, '').toUpperCase() as HttpMethod;
        if (['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(cleanItem)) {
          methods.push(cleanItem);
        }
      }
    }

    const pos = lineIndex.getPosition(callOffset);

    for (const method of methods) {
      routes.push({
        method,
        path: normalizedPath,
        filePath,
        line: pos.line,
        column: pos.column,
        framework: 'fastify',
      });
    }
  }

  return routes;
}
