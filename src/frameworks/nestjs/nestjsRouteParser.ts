import { ApiRoute, HttpMethod } from '../../models/route';
import { LineIndex, maskComments } from '../../scanner/routeParser';
import { joinRoutePaths } from '../../analysis/prefixResolver';

const SUPPORTED_NEST_METHODS: Record<string, HttpMethod> = {
  get: 'GET',
  post: 'POST',
  put: 'PUT',
  patch: 'PATCH',
  delete: 'DELETE',
  head: 'HEAD',
  options: 'OPTIONS',
  all: 'ANY',
};

interface NestController {
  prefix: string;
  index: number;
}

/**
 * Parses NestJS routes from TypeScript/JavaScript controller source code.
 * Extracts @Controller(prefix) and HTTP decorators (@Get, @Post, etc.) with exact positions.
 */
export function parseNestjsRoutes(source: string, filePath: string): ApiRoute[] {
  if (!source || typeof source !== 'string') {
    return [];
  }

  const cleanSource = maskComments(source);
  const lineIndex = new LineIndex(source);
  const routes: ApiRoute[] = [];

  // 1. Discover all @Controller(...) positions and prefixes
  const controllerRegex =
    /@Controller\s*(?:\(\s*(?:['"`]([^'"`]*)['"`]|(?:\{[^}]*path\s*:\s*['"`]([^'"`]*)['"`][^}]*\})?)?\s*\))?/g;

  const controllers: NestController[] = [];
  let cMatch: RegExpExecArray | null;

  while ((cMatch = controllerRegex.exec(cleanSource)) !== null) {
    const rawPrefix = cMatch[1] ?? cMatch[2] ?? '';
    controllers.push({
      prefix: rawPrefix.trim(),
      index: cMatch.index,
    });
  }

  // If no controllers found, check if file contains HTTP decorators
  const findClosestController = (offset: number): string => {
    let bestPrefix = '';
    let bestIndex = -1;

    for (const c of controllers) {
      if (c.index <= offset && c.index > bestIndex) {
        bestIndex = c.index;
        bestPrefix = c.prefix;
      }
    }

    return bestPrefix;
  };

  // 2. Discover all HTTP method decorators: @Get, @Post, @Put, @Patch, @Delete, @Head, @Options, @All
  const methodDecoratorRegex =
    /@(Get|Post|Put|Patch|Delete|Head|Options|All)\s*(?:\(\s*(?:['"`]([^'"`]*)['"`]|(?:\{[^}]*path\s*:\s*['"`]([^'"`]*)['"`][^}]*\})?)?\s*\))?/g;

  let mMatch: RegExpExecArray | null;
  while ((mMatch = methodDecoratorRegex.exec(cleanSource)) !== null) {
    const rawMethod = mMatch[1].toLowerCase();
    const rawSubPath = (mMatch[2] ?? mMatch[3] ?? '').trim();

    if (rawMethod in SUPPORTED_NEST_METHODS) {
      const method = SUPPORTED_NEST_METHODS[rawMethod];
      const controllerPrefix = findClosestController(mMatch.index);

      // Compose controller prefix and decorator subpath
      let fullPath = joinRoutePaths(controllerPrefix, rawSubPath);
      if (!fullPath || fullPath === '') {
        fullPath = '/';
      }

      // Try to extract following method name
      const remainingSource = cleanSource.slice(mMatch.index + mMatch[0].length);
      const methodDeclarationMatch = remainingSource.match(
        /^[^\w@]*?(?:(?:public|private|protected|async|static|readonly)\s+)*([a-zA-Z0-9_$]+)\s*\(/
      );
      const handlerName = methodDeclarationMatch ? methodDeclarationMatch[1] : undefined;

      const pos = lineIndex.getPosition(mMatch.index);

      routes.push({
        method,
        path: fullPath,
        filePath,
        line: pos.line,
        column: pos.column,
        framework: 'nestjs',
        handlerName,
      });
    }
  }

  return routes;
}
