import { ApiRoute } from '../../models/route';
import { FrameworkAdapter } from '../../models/framework';
import { parseExpressRoutes } from './expressRouteParser';
import { resolveRouterPrefixes } from './expressPrefixResolver';

/**
 * Adapter for discovering and parsing Express.js routes.
 */
export class ExpressAdapter implements FrameworkAdapter {
  public readonly framework = 'express' as const;
  public readonly name = 'Express.js';

  /**
   * Fast check to determine if this file contains Express route patterns.
   */
  public canHandle(filePath: string, source: string): boolean {
    if (!/\.[jt]sx?$/i.test(filePath)) {
      return false;
    }

    // Exclude Next.js special route handler files from Express processing
    const normalized = filePath.replace(/\\/g, '/');
    if (
      /(?:^|\/)(?:app|src\/app)\/.*\/route\.[jt]sx?$/i.test(normalized) ||
      /(?:^|\/)(?:pages\/api|src\/pages\/api)\/.*\.[jt]sx?$/i.test(normalized)
    ) {
      return false;
    }

    // Express route detection indicators
    const hasExpressImport = /\b(?:require\s*\(\s*['"]express['"]|from\s*['"]express['"])/.test(source);
    const hasExpressCalls = /\b(?:app|router|[a-zA-Z0-9_$]+Router|[a-zA-Z0-9_$]+Routes)\s*\.\s*(?:get|post|put|patch|delete|all|use|route)\s*\(/.test(source);
    const hasRouteRegex = /\b(?:app|router|[a-zA-Z0-9_$]+)\s*\.\s*(?:get|post|put|patch|delete|all|route)\s*\(\s*['"`\[]/.test(source);

    return hasExpressImport || hasExpressCalls || hasRouteRegex;
  }

  /**
   * Parses Express routes from file source.
   */
  public parseRoutes(filePath: string, source: string): ApiRoute[] {
    return parseExpressRoutes(source, filePath);
  }

  /**
   * Resolves Express router mounts across files.
   */
  public postProcessRoutes(
    routes: ApiRoute[],
    fileSources: Map<string, string> | Record<string, string>
  ): ApiRoute[] {
    return resolveRouterPrefixes(routes, fileSources);
  }
}
