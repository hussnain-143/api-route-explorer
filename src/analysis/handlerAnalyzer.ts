import { ApiRoute, HttpMethod } from '../models/route';
import { maskComments, LineIndex } from '../scanner/routeParser';

/**
 * Diagnostic warning indicating a route declaration may be missing a handler function or middleware.
 */
export interface MissingHandlerWarning {
  method: HttpMethod;
  path: string;
  filePath: string;
  line: number;
  column: number;
  message: string;
}

/**
 * Regex matching route calls that supply only the path argument with no subsequent handler:
 * e.g. router.get("/users") or app.post("/users", )
 */
const SUSPICIOUS_NO_HANDLER_REGEX =
  /\b(app|router|fastify|server)\s*\.\s*(get|post|put|patch|delete|head|options)\s*(?:<[^>]*>)?\s*\(\s*(?:'([^'\r\n]*)'|"([^"\r\n]*)"|`([^`\r\n]*)`)\s*(?:,\s*)?\)/gi;

/**
 * Analyzes source code for suspicious Express route declarations that appear to lack
 * any handler or middleware argument.
 *
 * Rules:
 * - Flags `router.get("/users");` or `app.post("/users")`.
 * - Does NOT flag `router.get("/users", handler)`.
 * - Does NOT flag middleware chains `router.get("/users", auth, validate, handler)`.
 * - Does NOT flag multiline route declarations.
 * - Always uses conservative wording: "Possible missing handler".
 *
 * @param source Source code of the file.
 * @param filePath File path of the source code.
 * @returns Array of MissingHandlerWarning objects.
 */
export function analyzeMissingHandlers(
  source: string,
  filePath: string
): MissingHandlerWarning[] {
  if (!source || typeof source !== 'string') {
    return [];
  }

  const warnings: MissingHandlerWarning[] = [];
  const cleanSource = maskComments(source);
  const lineIndex = new LineIndex(source);

  SUSPICIOUS_NO_HANDLER_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null = SUSPICIOUS_NO_HANDLER_REGEX.exec(cleanSource);

  while (match !== null) {
    const rawMethod = match[2].toUpperCase() as HttpMethod;
    const rawPath = match[3] ?? match[4] ?? match[5];

    if (rawPath !== undefined) {
      const { line, column } = lineIndex.getPosition(match.index);
      warnings.push({
        method: rawMethod,
        path: rawPath,
        filePath,
        line,
        column,
        message: `Possible missing handler for ${rawMethod} ${rawPath}`,
      });
    }

    match = SUSPICIOUS_NO_HANDLER_REGEX.exec(cleanSource);
  }

  return warnings;
}

/**
 * Analyzes an array of already-discovered ApiRoute objects against their file sources.
 *
 * @param routes All discovered API routes.
 * @param fileSources Map of filePath -> source code.
 * @returns Filtered MissingHandlerWarning list matching discovered routes.
 */
export function analyzeRouteHandlers(
  routes: ApiRoute[],
  fileSources: Map<string, string> | Record<string, string>
): MissingHandlerWarning[] {
  const sourcesMap =
    fileSources instanceof Map
      ? fileSources
      : new Map(Object.entries(fileSources));

  const allWarnings: MissingHandlerWarning[] = [];

  for (const [filePath, source] of sourcesMap.entries()) {
    const fileWarnings = analyzeMissingHandlers(source, filePath);
    allWarnings.push(...fileWarnings);
  }

  return allWarnings;
}
