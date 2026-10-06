import * as path from 'path';
import { ApiRoute } from '../../models/route';
import { FrameworkAdapter } from '../../models/framework';
import { parseFastifyRoutes } from './fastifyRouteParser';
import { joinRoutePaths } from '../../analysis/prefixResolver';

/**
 * Adapter for discovering, parsing, and resolving Fastify API routes.
 */
export class FastifyAdapter implements FrameworkAdapter {
  public readonly framework = 'fastify' as const;
  public readonly name = 'Fastify';

  /**
   * Fast check to determine if this file contains Fastify route patterns.
   */
  public canHandle(filePath: string, source: string): boolean {
    if (!/\.[jt]sx?$/i.test(filePath)) {
      return false;
    }

    // Exclude Next.js route files
    const normalized = filePath.replace(/\\/g, '/');
    if (
      /(?:^|\/)(?:app|src\/app)\/.*\/route\.[jt]sx?$/i.test(normalized) ||
      /(?:^|\/)(?:pages\/api|src\/pages\/api)\/.*\.[jt]sx?$/i.test(normalized)
    ) {
      return false;
    }

    // Fastify detection signatures:
    // 1. require('fastify') or from 'fastify'
    // 2. fastify.get(, fastify.post(, fastify.route(
    // 3. Fastify plugin signatures: (fastify, opts) or (fastify: FastifyInstance)
    const hasFastifyImport = /\b(?:require\s*\(\s*['"]fastify['"]|from\s*['"]fastify['"])/.test(source);
    const hasFastifyDirectCalls = /\bfastify\s*\.\s*(?:get|post|put|patch|delete|head|options|route|register)\s*\(/.test(source);
    const hasFastifyPluginSignature = /\b(?:async\s+)?function\s*[a-zA-Z0-9_$]*\s*\(\s*fastify\b|\(\s*fastify\s*[,:]/.test(source);

    return hasFastifyImport || hasFastifyDirectCalls || hasFastifyPluginSignature;
  }

  /**
   * Parses Fastify routes from file source.
   */
  public parseRoutes(filePath: string, source: string): ApiRoute[] {
    return parseFastifyRoutes(source, filePath);
  }

  /**
   * Statically resolves fastify.register(plugin, { prefix: '/...' }) mounts across files.
   */
  public postProcessRoutes(
    routes: ApiRoute[],
    fileSources: Map<string, string> | Record<string, string>
  ): ApiRoute[] {
    const getSource = (fp: string): string | undefined => {
      if (fileSources instanceof Map) {
        return fileSources.get(fp);
      }
      return fileSources[fp];
    };

    const filePrefixes = new Map<string, string[]>();

    // 1. Scan files for fastify.register(..., { prefix: '/...' })
    const entries = fileSources instanceof Map ? fileSources.entries() : Object.entries(fileSources);

    for (const [sourcePath, sourceText] of entries) {
      if (!sourceText) {
        continue;
      }

      // Pattern: fastify.register(pluginVar, { prefix: '/api/users' })
      const registerRegex =
        /\b(?:fastify|server|app)\s*\.\s*register\s*\(\s*([a-zA-Z0-9_$]+)\s*,\s*\{[^}]*prefix\s*:\s*(['"`])([^'"`\r\n]+)\2/g;

      let match: RegExpExecArray | null;
      while ((match = registerRegex.exec(sourceText)) !== null) {
        const pluginVar = match[1];
        const prefix = match[3];

        // Resolve import for pluginVar in sourceText: import pluginVar from './path' or const pluginVar = require('./path')
        const importRegex = new RegExp(
          `(?:import\\s+${pluginVar}\\s+from\\s+|const\\s+${pluginVar}\\s*=\\s*require\\s*\\()\\s*['"\`]([^'"\`]+)['"\`]`,
          'g'
        );
        const importMatch = importRegex.exec(sourceText);

        if (importMatch) {
          const specifier = importMatch[1];
          if (specifier.startsWith('.')) {
            const dir = path.dirname(sourcePath);
            const resolvedBase = path.resolve(dir, specifier);
            // Match against routes having matching file path prefix (ignoring extension)
            for (const r of routes) {
              const rBase = r.filePath.replace(/\.[jt]sx?$/, '');
              if (rBase === resolvedBase || r.filePath === resolvedBase) {
                const existing = filePrefixes.get(r.filePath) || [];
                existing.push(prefix);
                filePrefixes.set(r.filePath, existing);
              }
            }
          }
        }
      }

      // Pattern direct require: fastify.register(require('./routes/users'), { prefix: '/api' })
      const directRequireRegex =
        /\b(?:fastify|server|app)\s*\.\s*register\s*\(\s*require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)\s*,\s*\{[^}]*prefix\s*:\s*(['"`])([^'"`\r\n]+)\2/g;

      while ((match = directRequireRegex.exec(sourceText)) !== null) {
        const specifier = match[1];
        const prefix = match[3];
        if (specifier.startsWith('.')) {
          const dir = path.dirname(sourcePath);
          const resolvedBase = path.resolve(dir, specifier);
          for (const r of routes) {
            const rBase = r.filePath.replace(/\.[jt]sx?$/, '');
            if (rBase === resolvedBase || r.filePath === resolvedBase) {
              const existing = filePrefixes.get(r.filePath) || [];
              existing.push(prefix);
              filePrefixes.set(r.filePath, existing);
            }
          }
        }
      }
    }

    if (filePrefixes.size === 0) {
      return routes;
    }

    // Apply resolved prefixes to Fastify routes
    return routes.map((route) => {
      if (route.framework !== 'fastify') {
        return route;
      }
      const prefixes = filePrefixes.get(route.filePath);
      if (prefixes && prefixes.length > 0) {
        return {
          ...route,
          path: joinRoutePaths(prefixes[0], route.path),
        };
      }
      return route;
    });
  }
}
