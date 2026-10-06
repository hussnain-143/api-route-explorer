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
};

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
 * Regex matching Express application and router route registrations:
 * Matches: (app|router).(get|post|put|patch|delete)('<path>' | "<path>" | `<path>`)
 * Optionally supports TypeScript generic type arguments before the opening parenthesis.
 */
const EXPRESS_ROUTE_REGEX = /\b(app|router)\s*\.\s*(get|post|put|patch|delete)\s*(?:<[^>]*>)?\s*\(\s*(?:'([^'\r\n]*)'|"([^"\r\n]*)"|`([^`\r\n]*)`)/gi;

/**
 * Parses Express.js routes from JavaScript or TypeScript source code.
 *
 * Supports:
 * - Application methods: app.get(), app.post(), app.put(), app.patch(), app.delete()
 * - Router methods: router.get(), router.post(), router.put(), router.patch(), router.delete()
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

  // Reset regex state
  EXPRESS_ROUTE_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null = EXPRESS_ROUTE_REGEX.exec(cleanSource);

  while (match !== null) {
    const rawMethod = match[2].toLowerCase();
    const httpMethod = SUPPORTED_EXPRESS_METHODS[rawMethod];

    // Path can be captured from group 3 (single-quote), group 4 (double-quote), or group 5 (backtick)
    const rawPath = match[3] ?? match[4] ?? match[5];

    // If backticks were used, reject dynamic interpolation (${...}) for Sprint 1
    const isTemplateLiteral = match[5] !== undefined;
    const hasInterpolation = isTemplateLiteral && rawPath !== undefined && rawPath.includes('${');

    if (httpMethod && rawPath !== undefined && !hasInterpolation) {
      const { line, column } = lineIndex.getPosition(match.index);

      routes.push({
        method: httpMethod,
        path: rawPath,
        filePath,
        line,
        column,
        framework: 'express',
      });
    }

    match = EXPRESS_ROUTE_REGEX.exec(cleanSource);
  }

  return routes;
}
