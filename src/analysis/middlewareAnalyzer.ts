import { ApiRoute } from '../models/route';
import { RouteMiddleware, MiddlewareUsageGroup, MiddlewareType } from './analysisTypes';

/**
 * Extracts route-level middleware for an Express route declaration.
 */
function extractExpressRouteMiddleware(
  source: string,
  route: ApiRoute
): RouteMiddleware[] {
  const lines = source.split('\n');
  if (route.line >= lines.length) {
    return [];
  }

  // Look ahead up to 10 lines to capture multiline declaration
  const chunk = lines.slice(route.line, Math.min(lines.length, route.line + 10)).join('\n');
  const methodLower = route.method.toLowerCase();

  // Match: (app|router).method('path', ...args)
  const callRegex = new RegExp(
    `\\b(?:app|router|[a-zA-Z0-9_$]+)\\s*\\.\\s*(?:${methodLower}|all)\\s*(?:<[^>]*>)?\\s*\\(\\s*['"\`][^'"\`\r\n]+['"\`]\\s*,\\s*([\\s\\S]*?)(?:\\);|\\)$|\\n\\s*\\n)`,
    'm'
  );
  const match = chunk.match(callRegex);
  if (!match) {
    return [];
  }

  const rawArgs = match[1].trim();
  if (!rawArgs) {
    return [];
  }

  // Split arguments at top-level commas (ignoring commas inside nested parens/curlies/brackets)
  const args = splitTopLevelArguments(rawArgs);
  if (args.length <= 1) {
    // If only 1 argument, it is the handler itself (e.g. router.get('/users', getUsers))
    return [];
  }

  // The last argument is the final handler (e.g. controller or inline func).
  // Preceding arguments are middleware/guards.
  const middlewareArgs = args.slice(0, args.length - 1);
  const result: RouteMiddleware[] = [];

  for (const arg of middlewareArgs) {
    const cleaned = arg.trim();
    if (!cleaned) {
      continue;
    }

    // Check if arg is an array of middleware: [auth, verifyRole]
    if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
      const inner = cleaned.substring(1, cleaned.length - 1);
      const items = splitTopLevelArguments(inner);
      for (const item of items) {
        const name = cleanMiddlewareName(item);
        if (name) {
          result.push({ name, type: 'middleware', filePath: route.filePath, line: route.line });
        }
      }
    } else {
      const name = cleanMiddlewareName(cleaned);
      if (name) {
        result.push({ name, type: 'middleware', filePath: route.filePath, line: route.line });
      }
    }
  }

  return result;
}

/**
 * Extracts pre-handlers or middleware for Fastify routes.
 */
function extractFastifyRouteMiddleware(
  source: string,
  route: ApiRoute
): RouteMiddleware[] {
  const lines = source.split('\n');
  if (route.line >= lines.length) {
    return [];
  }

  const chunk = lines.slice(route.line, Math.min(lines.length, route.line + 15)).join('\n');
  const result: RouteMiddleware[] = [];

  // 1. Check for { preHandler: ... } or { preValidation: ... } in options object
  const preHandlerRegex = /\bpreHandler\s*:\s*(\[[^\]]+\]|[a-zA-Z0-9_$]+(?:\([^)]*\))?)/;
  const phMatch = chunk.match(preHandlerRegex);
  if (phMatch) {
    const val = phMatch[1].trim();
    if (val.startsWith('[')) {
      const inner = val.substring(1, val.length - 1);
      for (const item of splitTopLevelArguments(inner)) {
        const name = cleanMiddlewareName(item);
        if (name) {
          result.push({ name, type: 'pre-handler', filePath: route.filePath, line: route.line });
        }
      }
    } else {
      const name = cleanMiddlewareName(val);
      if (name) {
        result.push({ name, type: 'pre-handler', filePath: route.filePath, line: route.line });
      }
    }
  }

  // 2. Direct middleware chain: fastify.get('/path', auth, handler)
  const methodLower = route.method.toLowerCase();
  const directRegex = new RegExp(
    `\\b(?:fastify|server|app)\\s*\\.\\s*${methodLower}\\s*\\(\\s*['"\`][^'"\`\r\n]+['"\`]\\s*,\\s*([a-zA-Z0-9_$]+)\\s*,\\s*`,
    'm'
  );
  const directMatch = chunk.match(directRegex);
  if (directMatch && !directMatch[1].startsWith('{')) {
    const name = cleanMiddlewareName(directMatch[1]);
    if (name && !result.some((m) => m.name === name)) {
      result.push({ name, type: 'pre-handler', filePath: route.filePath, line: route.line });
    }
  }

  return result;
}

/**
 * Extracts @UseGuards() and @UseInterceptors() attached to NestJS route methods.
 */
function extractNestjsRouteMiddleware(
  source: string,
  route: ApiRoute
): RouteMiddleware[] {
  const lines = source.split('\n');
  if (route.line >= lines.length) {
    return [];
  }

  // Look back up to 8 lines before route decorator to check method decorators
  const startLine = Math.max(0, route.line - 8);
  const chunk = lines.slice(startLine, route.line + 2).join('\n');
  const result: RouteMiddleware[] = [];

  // @UseGuards(AuthGuard, RolesGuard)
  const guardRegex = /@UseGuards\s*\(([^)]+)\)/g;
  let gMatch: RegExpExecArray | null;
  while ((gMatch = guardRegex.exec(chunk)) !== null) {
    const items = splitTopLevelArguments(gMatch[1]);
    for (const item of items) {
      const name = cleanMiddlewareName(item);
      if (name) {
        result.push({ name, type: 'guard', filePath: route.filePath, line: route.line });
      }
    }
  }

  // @UseInterceptors(LoggingInterceptor)
  const interceptorRegex = /@UseInterceptors\s*\(([^)]+)\)/g;
  let iMatch: RegExpExecArray | null;
  while ((iMatch = interceptorRegex.exec(chunk)) !== null) {
    const items = splitTopLevelArguments(iMatch[1]);
    for (const item of items) {
      const name = cleanMiddlewareName(item);
      if (name) {
        result.push({ name, type: 'interceptor', filePath: route.filePath, line: route.line });
      }
    }
  }

  return result;
}

/**
 * Splits argument string by commas while preserving nested parentheses, brackets, or braces.
 */
function splitTopLevelArguments(input: string): string[] {
  const results: string[] = [];
  let current = '';
  let parenDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '(') {
      parenDepth++;
    } else if (ch === ')') {
      parenDepth--;
    } else if (ch === '{') {
      braceDepth++;
    } else if (ch === '}') {
      braceDepth--;
    } else if (ch === '[') {
      bracketDepth++;
    } else if (ch === ']') {
      bracketDepth--;
    }

    if (ch === ',' && parenDepth === 0 && braceDepth === 0 && bracketDepth === 0) {
      results.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  if (current.trim()) {
    results.push(current.trim());
  }

  return results;
}

/**
 * Strips call invocation parenthesis and formatting from middleware identifier (e.g. authMiddleware() -> authMiddleware).
 */
function cleanMiddlewareName(arg: string): string {
  const trimmed = arg.trim();
  // Strip invocation e.g. authenticate() -> authenticate
  const match = trimmed.match(/^([a-zA-Z0-9_$]+)(?:\s*\([^)]*\))?$/);
  if (match) {
    return match[1];
  }
  return '';
}

/**
 * Extracts all statically identifiable route-level middleware for a given route.
 */
export function extractRouteMiddleware(
  route: ApiRoute,
  fileSources: Map<string, string> | Record<string, string>,
  linesCache?: Map<string, string[]>
): RouteMiddleware[] {
  const source =
    fileSources instanceof Map
      ? fileSources.get(route.filePath)
      : fileSources[route.filePath];

  if (!source) {
    return [];
  }

  let lines: string[] | undefined;
  if (linesCache) {
    lines = linesCache.get(route.filePath);
    if (!lines) {
      lines = source.split('\n');
      linesCache.set(route.filePath, lines);
    }
  } else {
    lines = source.split('\n');
  }

  if (route.line >= lines.length) {
    return [];
  }

  switch (route.framework) {
    case 'express': {
      // Look ahead up to 10 lines to capture multiline declaration
      const chunk = lines.slice(route.line, Math.min(lines.length, route.line + 10)).join('\n');
      const methodLower = route.method.toLowerCase();

      // Match: (app|router).method('path', ...args)
      const callRegex = new RegExp(
        `\\b(?:app|router|[a-zA-Z0-9_$]+)\\s*\\.\\s*(?:${methodLower}|all)\\s*(?:<[^>]*>)?\\s*\\(\\s*['"\`][^'"\`\r\n]+['"\`]\\s*,\\s*([\\s\\S]*?)(?:\\);|\\)$|\\n\\s*\\n)`,
        'm'
      );
      const match = chunk.match(callRegex);
      if (!match) {
        return [];
      }

      const rawArgs = match[1].trim();
      if (!rawArgs) {
        return [];
      }

      const args = splitTopLevelArguments(rawArgs);
      if (args.length <= 1) {
        return [];
      }

      const middlewareArgs = args.slice(0, args.length - 1);
      const result: RouteMiddleware[] = [];

      for (const arg of middlewareArgs) {
        const cleaned = arg.trim();
        if (!cleaned) {
          continue;
        }

        if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
          const inner = cleaned.substring(1, cleaned.length - 1);
          const items = splitTopLevelArguments(inner);
          for (const item of items) {
            const name = cleanMiddlewareName(item);
            if (name) {
              result.push({ name, type: 'middleware', filePath: route.filePath, line: route.line });
            }
          }
        } else {
          const name = cleanMiddlewareName(cleaned);
          if (name) {
            result.push({ name, type: 'middleware', filePath: route.filePath, line: route.line });
          }
        }
      }

      return result;
    }
    case 'fastify': {
      const chunk = lines.slice(route.line, Math.min(lines.length, route.line + 15)).join('\n');
      const result: RouteMiddleware[] = [];

      const preHandlerRegex = /\bpreHandler\s*:\s*(\[[^\]]+\]|[a-zA-Z0-9_$]+(?:\([^)]*\))?)/;
      const phMatch = chunk.match(preHandlerRegex);
      if (phMatch) {
        const val = phMatch[1].trim();
        if (val.startsWith('[')) {
          const inner = val.substring(1, val.length - 1);
          for (const item of splitTopLevelArguments(inner)) {
            const name = cleanMiddlewareName(item);
            if (name) {
              result.push({ name, type: 'pre-handler', filePath: route.filePath, line: route.line });
            }
          }
        } else {
          const name = cleanMiddlewareName(val);
          if (name) {
            result.push({ name, type: 'pre-handler', filePath: route.filePath, line: route.line });
          }
        }
      }

      const methodLower = route.method.toLowerCase();
      const directRegex = new RegExp(
        `\\b(?:fastify|server|app)\\s*\\.\\s*${methodLower}\\s*\\(\\s*['"\`][^'"\`\r\n]+['"\`]\\s*,\\s*([a-zA-Z0-9_$]+)\\s*,\\s*`,
        'm'
      );
      const directMatch = chunk.match(directRegex);
      if (directMatch && !directMatch[1].startsWith('{')) {
        const name = cleanMiddlewareName(directMatch[1]);
        if (name && !result.some((m) => m.name === name)) {
          result.push({ name, type: 'pre-handler', filePath: route.filePath, line: route.line });
        }
      }

      return result;
    }
    case 'nestjs': {
      const startLine = Math.max(0, route.line - 8);
      const chunk = lines.slice(startLine, route.line + 2).join('\n');
      const result: RouteMiddleware[] = [];

      const guardRegex = /@UseGuards\s*\(([^)]+)\)/g;
      let gMatch: RegExpExecArray | null;
      while ((gMatch = guardRegex.exec(chunk)) !== null) {
        const items = splitTopLevelArguments(gMatch[1]);
        for (const item of items) {
          const name = cleanMiddlewareName(item);
          if (name) {
            result.push({ name, type: 'guard', filePath: route.filePath, line: route.line });
          }
        }
      }

      const interceptorRegex = /@UseInterceptors\s*\(([^)]+)\)/g;
      let iMatch: RegExpExecArray | null;
      while ((iMatch = interceptorRegex.exec(chunk)) !== null) {
        const items = splitTopLevelArguments(iMatch[1]);
        for (const item of items) {
          const name = cleanMiddlewareName(item);
          if (name) {
            result.push({ name, type: 'interceptor', filePath: route.filePath, line: route.line });
          }
        }
      }

      return result;
    }
    default:
      return [];
  }
}

/**
 * Aggregates all routes by the middleware protecting/processing them.
 */
export function groupRoutesByMiddleware(
  routesWithMiddleware: Map<ApiRoute, RouteMiddleware[]>
): MiddlewareUsageGroup[] {
  const groupMap = new Map<string, { type: MiddlewareType; routes: ApiRoute[] }>();

  for (const [route, middlewareList] of routesWithMiddleware.entries()) {
    for (const mw of middlewareList) {
      const existing = groupMap.get(mw.name);
      if (existing) {
        if (!existing.routes.includes(route)) {
          existing.routes.push(route);
        }
      } else {
        groupMap.set(mw.name, {
          type: mw.type,
          routes: [route],
        });
      }
    }
  }

  const results: MiddlewareUsageGroup[] = [];
  for (const [name, data] of groupMap.entries()) {
    results.push({
      middlewareName: name,
      type: data.type,
      routes: data.routes,
    });
  }

  // Sort alphabetically by middleware name
  results.sort((a, b) => a.middlewareName.localeCompare(b.middlewareName));
  return results;
}
