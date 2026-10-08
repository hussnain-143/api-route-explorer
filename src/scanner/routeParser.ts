import { ApiRoute, HttpMethod } from '../models/route';

/**
 * Helper class to map string character offsets to zero-based line and column positions.
 */
export class LineIndex {
  private readonly lineStarts: number[];

  constructor(source: string) {
    this.lineStarts = [0];
    for (let i = 0; i < source.length; i++) {
      if (source[i] === '\n') {
        this.lineStarts.push(i + 1);
      }
    }
  }

  /**
   * Converts a 0-based character offset into 0-based line and column coordinates.
   */
  public getPosition(offset: number): { line: number; column: number } {
    if (offset <= 0) {
      return { line: 0, column: 0 };
    }

    let low = 0;
    let high = this.lineStarts.length - 1;
    let line = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.lineStarts[mid] <= offset) {
        line = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const column = Math.max(0, offset - this.lineStarts[line]);
    return { line, column };
  }
}

/**
 * Supported Express HTTP methods mapped to domain HttpMethod types.
 */
const SUPPORTED_EXPRESS_METHODS: Record<string, HttpMethod> = {
  get: 'GET',
  post: 'POST',
  put: 'PUT',
  patch: 'PATCH',
  delete: 'DELETE',
  all: 'ANY',
  options: 'OPTIONS',
  head: 'HEAD',
};

/**
 * Standard identifier names that commonly have .get() / .post() but are never routers.
 */
const EXCLUDED_CALLERS = new Set<string>([
  'req',
  'res',
  'response',
  'request',
  'client',
  'redisClient',
  'cache',
  'session',
  'map',
  'set',
  'localStorage',
  'sessionStorage',
  'cookies',
  'headers',
  'params',
  'query',
  'url',
  'axios',
  'prisma',
  'it',
  'test',
  'describe',
  'assert',
  'console',
  'process',
  'Math',
  'JSON',
]);

/**
 * Finds the index of the matching closing parenthesis for an opening parenthesis at openIndex.
 * Ignores parentheses inside strings.
 */
export function findMatchingParen(source: string, openIndex: number): number {
  let depth = 0;
  let inQuote: string | null = null;
  const len = source.length;

  for (let i = openIndex; i < len; i++) {
    const char = source[i];
    if (inQuote !== null) {
      if (char === '\\') {
        i++;
      } else if (char === inQuote) {
        inQuote = null;
      }
      continue;
    }

    if (char === '\'' || char === '"' || char === '`') {
      inQuote = char;
      continue;
    }

    if (char === '(') {
      depth++;
    } else if (char === ')') {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
}

/**
 * Masks single-line and multi-line comments with whitespace.
 * Preserves line breaks and exact character offsets so calculated line and column numbers remain accurate.
 */
export function maskComments(source: string): string {
  const chars = source.split('');
  let i = 0;
  const len = chars.length;

  while (i < len) {
    const char = chars[i];
    const nextChar = i + 1 < len ? chars[i + 1] : '';

    // Skip string literals to avoid treating "//" or "/*" inside strings as comments
    if (char === '\'' || char === '"' || char === '`') {
      const quote = char;
      i++;
      while (i < len) {
        if (chars[i] === '\\') {
          i += 2;
          continue;
        }
        if (chars[i] === quote) {
          i++;
          break;
        }
        i++;
      }
      continue;
    }

    // Single-line comment: // ...
    if (char === '/' && nextChar === '/') {
      chars[i] = ' ';
      chars[i + 1] = ' ';
      i += 2;
      while (i < len && chars[i] !== '\n') {
        if (chars[i] !== '\r') {
          chars[i] = ' ';
        }
        i++;
      }
      continue;
    }

    // Multi-line block comment: /* ... */
    if (char === '/' && nextChar === '*') {
      chars[i] = ' ';
      chars[i + 1] = ' ';
      i += 2;
      while (i < len) {
        if (chars[i] === '*' && i + 1 < len && chars[i + 1] === '/') {
          chars[i] = ' ';
          chars[i + 1] = ' ';
          i += 2;
          break;
        }
        if (chars[i] !== '\n' && chars[i] !== '\r') {
          chars[i] = ' ';
        }
        i++;
      }
      continue;
    }

    i++;
  }

  return chars.join('');
}

/**
 * Regex matching direct Express route method calls on any valid identifier:
 * caller.verb('<path>' | "<path>" | `<path>`)
 */
const DIRECT_METHOD_REGEX = /\b([a-zA-Z0-9_$]+)\s*\.\s*(get|post|put|patch|delete|all|options|head)\s*(?:<[^>]*>)?\s*\(\s*(?:'([^'\r\n]*)'|"([^"\r\n]*)"|`([^`\r\n]*)`)/gi;

/**
 * Regex matching caller.route(path) calls
 */
const ROUTE_CALL_REGEX = /\b([a-zA-Z0-9_$]+)\s*\.\s*route\s*\(/gi;

/**
 * Parses Express.js routes from JavaScript or TypeScript source code.
 *
 * Supports:
 * - Application methods: app.get(), app.post(), app.put(), app.patch(), app.delete(), app.all()
 * - Router methods on any identifier: router.get(), chatRouter.post(), helpCenterAdminRouter.delete(), etc.
 * - Chained route definitions: router.route('/path').get(...).post(...)
 * - Multiline chained route definitions across newlines
 * - Array route paths: router.route(['/path1', '/path2']).get(...)
 * - Single quotes, double quotes, and simple template literals without interpolation.
 *
 * @param source The source code of the file.
 * @param filePath The absolute or relative path to the file.
 * @returns Array of discovered ApiRoute definitions.
 */
export function parseExpressRoutes(source: string, filePath: string): ApiRoute[] {
  if (!source || typeof source !== 'string') {
    return [];
  }

  const routes: ApiRoute[] = [];
  const lineIndex = new LineIndex(source);
  const cleanSource = maskComments(source);

  // 1. Parse direct method calls: caller.verb(path, ...)
  DIRECT_METHOD_REGEX.lastIndex = 0;
  let directMatch: RegExpExecArray | null = DIRECT_METHOD_REGEX.exec(cleanSource);

  while (directMatch !== null) {
    const caller = directMatch[1];
    const rawMethod = directMatch[2].toLowerCase();
    const httpMethod = SUPPORTED_EXPRESS_METHODS[rawMethod];

    // Path can be captured from group 3 (single-quote), group 4 (double-quote), or group 5 (backtick)
    const rawPath = directMatch[3] ?? directMatch[4] ?? directMatch[5];

    const isTemplateLiteral = directMatch[5] !== undefined;
    const hasInterpolation = isTemplateLiteral && rawPath !== undefined && rawPath.includes('${');

    if (
      !EXCLUDED_CALLERS.has(caller) &&
      httpMethod &&
      rawPath !== undefined &&
      (rawPath.startsWith('/') || rawPath === '*') &&
      !hasInterpolation
    ) {
      const { line, column } = lineIndex.getPosition(directMatch.index);

      routes.push({
        method: httpMethod,
        path: rawPath,
        filePath,
        line,
        column,
        framework: 'express',
      });
    }

    directMatch = DIRECT_METHOD_REGEX.exec(cleanSource);
  }

  // 2. Parse router.route(...) chained methods: router.route('/path').get(...).post(...)
  ROUTE_CALL_REGEX.lastIndex = 0;
  let routeMatch: RegExpExecArray | null = ROUTE_CALL_REGEX.exec(cleanSource);

  while (routeMatch !== null) {
    const caller = routeMatch[1];
    if (EXCLUDED_CALLERS.has(caller)) {
      routeMatch = ROUTE_CALL_REGEX.exec(cleanSource);
      continue;
    }

    const openParenIdx = routeMatch.index + routeMatch[0].length - 1;
    const closeParenIdx = findMatchingParen(cleanSource, openParenIdx);
    if (closeParenIdx === -1) {
      routeMatch = ROUTE_CALL_REGEX.exec(cleanSource);
      continue;
    }

    const argContent = cleanSource.slice(openParenIdx + 1, closeParenIdx).trim();
    const paths: string[] = [];

    // Check single string literal: '/path' or "/path" or `/path`
    const stringMatch = argContent.match(/^(['"`])([^\r\n]*?)\1$/);
    if (stringMatch) {
      const candidatePath = stringMatch[2];
      if (!candidatePath.includes('${') && (candidatePath.startsWith('/') || candidatePath === '*')) {
        paths.push(candidatePath);
      }
    } else if (argContent.startsWith('[') && argContent.endsWith(']')) {
      // Array literal: ['/path1', '/path2']
      const arrayItemRegex = /(['"`])([^\r\n]*?)\1/g;
      let am: RegExpExecArray | null = arrayItemRegex.exec(argContent);
      while (am !== null) {
        const candidatePath = am[2];
        if (!candidatePath.includes('${') && (candidatePath.startsWith('/') || candidatePath === '*')) {
          paths.push(candidatePath);
        }
        am = arrayItemRegex.exec(argContent);
      }
    }

    if (paths.length > 0) {
      // Scan forward for chained .verb(...) calls
      let searchIdx = closeParenIdx + 1;
      while (searchIdx < cleanSource.length) {
        // Skip whitespace and newlines
        while (searchIdx < cleanSource.length && /\s/.test(cleanSource[searchIdx])) {
          searchIdx++;
        }

        if (cleanSource[searchIdx] !== '.') {
          break;
        }

        const remainingText = cleanSource.slice(searchIdx);
        const verbMatch = remainingText.match(/^\.\s*(get|post|put|patch|delete|all|options|head)\s*(?:<[^>]*>)?\s*\(/i);
        if (!verbMatch) {
          break;
        }

        const rawVerb = verbMatch[1].toLowerCase();
        const httpMethod = SUPPORTED_EXPRESS_METHODS[rawVerb];
        const verbOpenParen = searchIdx + verbMatch[0].length - 1;
        const verbCloseParen = findMatchingParen(cleanSource, verbOpenParen);
        if (verbCloseParen === -1) {
          break;
        }

        if (httpMethod) {
          const { line, column } = lineIndex.getPosition(searchIdx);
          for (const p of paths) {
            routes.push({
              method: httpMethod,
              path: p,
              filePath,
              line,
              column,
              framework: 'express',
            });
          }
        }

        searchIdx = verbCloseParen + 1;
      }
    }

    routeMatch = ROUTE_CALL_REGEX.exec(cleanSource);
  }

  return routes;
}

