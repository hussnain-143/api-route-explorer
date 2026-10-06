import * as path from 'path';
import { ApiRoute } from '../models/route';

/**
 * Combines a router mount prefix and a route path cleanly into a single path.
 * Handles edge cases like root '/', trailing slashes, and leading slashes.
 *
 * @param prefix Mounting prefix (e.g. '/api/v1').
 * @param routePath Relative route path (e.g. '/users' or '/').
 * @returns Combined normalized route path.
 */
export function joinRoutePaths(prefix: string, routePath: string): string {
  const cleanPrefix = (prefix || '').trim().replace(/\\/g, '/');
  const cleanPath = (routePath || '').trim().replace(/\\/g, '/');

  if (!cleanPrefix || cleanPrefix === '/') {
    return cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
  }

  // Strip trailing slash from prefix
  const basePrefix = cleanPrefix.endsWith('/') ? cleanPrefix.slice(0, -1) : cleanPrefix;
  const normalizedPrefix = basePrefix.startsWith('/') ? basePrefix : `/${basePrefix}`;

  if (!cleanPath || cleanPath === '/') {
    return normalizedPrefix;
  }

  const normalizedPath = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
  return `${normalizedPrefix}${normalizedPath}`;
}

/**
 * Information about a router mount relationship discovered in code:
 * e.g. caller.use(prefix, routerIdentifier)
 */
interface MountEntry {
  sourceFilePath: string;
  prefix: string;
  routerVar: string;
}

/**
 * Information about an imported router identifier in a source file:
 * e.g. import userRouter from './routes/userRoutes';
 */
interface ImportEntry {
  importingFilePath: string;
  varName: string;
  specifier: string;
}

/**
 * Regex matching app.use(prefix, router) or router.use(prefix, subRouter).
 * Group 1: prefix string
 * Group 2: router variable identifier
 */
const MOUNT_USE_REGEX = /\b(?:app|[a-zA-Z0-9_$]+)\s*\.\s*use\s*\(\s*(['"`])([^'"`\r\n]+)\1\s*,\s*([a-zA-Z0-9_$]+)\s*[\),]/g;

/**
 * Regex matching ESM imports:
 * import routerVar from 'specifier'
 */
const ESM_IMPORT_REGEX = /import\s+([a-zA-Z0-9_$]+)\s+from\s+['"]([^'"]+)['"]/g;

/**
 * Regex matching CJS requires:
 * const routerVar = require('specifier')
 */
const CJS_REQUIRE_REGEX = /(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/**
 * Attempts to resolve an imported specifier to a known file path in the workspace.
 */
function resolveSpecifierToFilePath(
  importingFilePath: string,
  specifier: string,
  knownFilePaths: string[]
): string | undefined {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
    return undefined;
  }

  const importingDir = path.dirname(importingFilePath);
  const absoluteCandidate = path.resolve(importingDir, specifier).replace(/\\/g, '/');

  // Exact match
  for (const known of knownFilePaths) {
    const normalizedKnown = known.replace(/\\/g, '/');
    if (normalizedKnown === absoluteCandidate) {
      return known;
    }
  }

  // Extensions: .js, .ts, .jsx, .tsx
  const extensions = ['.js', '.ts', '.jsx', '.tsx', '/index.js', '/index.ts', '/index.jsx', '/index.tsx'];
  for (const ext of extensions) {
    const candidateWithExt = `${absoluteCandidate}${ext}`;
    for (const known of knownFilePaths) {
      const normalizedKnown = known.replace(/\\/g, '/');
      if (normalizedKnown === candidateWithExt) {
        return known;
      }
    }
  }

  // Basename matching without extension
  const candidateBase = absoluteCandidate.replace(/\.(js|ts|jsx|tsx)$/, '');
  for (const known of knownFilePaths) {
    const knownBase = known.replace(/\\/g, '/').replace(/\.(js|ts|jsx|tsx)$/, '');
    if (knownBase === candidateBase) {
      return known;
    }
  }

  return undefined;
}

/**
 * Statically analyzes workspace source files to discover Express router mounting
 * hierarchies and prefixes, and composes final route paths.
 *
 * Supported Patterns:
 * - `app.use('/api/v1', router)`
 * - `router.use('/users', userRouter)`
 * - Chained prefixes across imported router files (e.g. app.js -> v1/index.js -> search.routes.js).
 * - Same-file router mounts.
 *
 * Conservative Safety Guarantees:
 * - If a relationship cannot be resolved with certainty, the route remains unchanged.
 * - Does not invent false prefixes.
 * - Preserves original filePath, line, and column for exact code navigation.
 *
 * @param routes Discovered API routes.
 * @param fileSources Map or record of filePath -> source code across scanned workspace files.
 * @returns Array of ApiRoute objects with resolved prefixes.
 */
export function resolveRouterPrefixes(
  routes: ApiRoute[],
  fileSources: Map<string, string> | Record<string, string>
): ApiRoute[] {
  const sourcesMap =
    fileSources instanceof Map
      ? fileSources
      : new Map(Object.entries(fileSources));

  const knownFilePaths = Array.from(sourcesMap.keys());
  const mounts: MountEntry[] = [];
  const imports: ImportEntry[] = [];
  const sameFileMounts = new Map<string, Map<string, string[]>>(); // filePath -> Map<routerVar, prefixes[]>

  // 1. Parse mounts and imports from all source files
  for (const [filePath, source] of sourcesMap.entries()) {
    // Extract mounts: app.use('/api', router)
    MOUNT_USE_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null = MOUNT_USE_REGEX.exec(source);
    while (match !== null) {
      const prefix = match[2].trim();
      const routerVar = match[3].trim();
      if (prefix && routerVar) {
        mounts.push({
          sourceFilePath: filePath,
          prefix,
          routerVar,
        });

        // Record same-file mounts
        let fileMap = sameFileMounts.get(filePath);
        if (!fileMap) {
          fileMap = new Map();
          sameFileMounts.set(filePath, fileMap);
        }
        const existingPrefixes = fileMap.get(routerVar) ?? [];
        existingPrefixes.push(prefix);
        fileMap.set(routerVar, existingPrefixes);
      }
      match = MOUNT_USE_REGEX.exec(source);
    }

    // Extract ESM imports
    ESM_IMPORT_REGEX.lastIndex = 0;
    let esmMatch: RegExpExecArray | null = ESM_IMPORT_REGEX.exec(source);
    while (esmMatch !== null) {
      imports.push({
        importingFilePath: filePath,
        varName: esmMatch[1].trim(),
        specifier: esmMatch[2].trim(),
      });
      esmMatch = ESM_IMPORT_REGEX.exec(source);
    }

    // Extract CJS requires
    CJS_REQUIRE_REGEX.lastIndex = 0;
    let cjsMatch: RegExpExecArray | null = CJS_REQUIRE_REGEX.exec(source);
    while (cjsMatch !== null) {
      imports.push({
        importingFilePath: filePath,
        varName: cjsMatch[1].trim(),
        specifier: cjsMatch[2].trim(),
      });
      cjsMatch = CJS_REQUIRE_REGEX.exec(source);
    }
  }

  // 2. Build file-to-file mount graph: parentFile -> { childFile: prefix }
  const fileMountPrefixes = new Map<string, string[]>(); // childFilePath -> array of prefixes applied to it

  for (const mount of mounts) {
    // Find if routerVar was imported in sourceFilePath
    const matchedImport = imports.find(
      (imp) =>
        imp.importingFilePath === mount.sourceFilePath &&
        imp.varName === mount.routerVar
    );

    if (matchedImport) {
      const resolvedChildPath = resolveSpecifierToFilePath(
        mount.sourceFilePath,
        matchedImport.specifier,
        knownFilePaths
      );

      if (resolvedChildPath) {
        const existing = fileMountPrefixes.get(resolvedChildPath) ?? [];
        if (!existing.includes(mount.prefix)) {
          existing.push(mount.prefix);
          fileMountPrefixes.set(resolvedChildPath, existing);
        }
      }
    }
  }

  // 3. Resolve prefix chains (e.g. app.js -> v1Router -> userRouter)
  const fullPrefixesByFile = new Map<string, string[]>();

  function getFilePrefixes(targetFile: string, visited: Set<string>): string[] {
    if (visited.has(targetFile)) {
      return [];
    }
    visited.add(targetFile);

    const directPrefixes = fileMountPrefixes.get(targetFile) ?? [];
    if (directPrefixes.length === 0) {
      return [];
    }

    // Find any file that mounts targetFile to check for parent prefixes
    const parentMounts: string[] = [];
    for (const mount of mounts) {
      const matchedImport = imports.find(
        (imp) =>
          imp.importingFilePath === mount.sourceFilePath &&
          imp.varName === mount.routerVar
      );

      if (matchedImport) {
        const resolved = resolveSpecifierToFilePath(
          mount.sourceFilePath,
          matchedImport.specifier,
          knownFilePaths
        );
        if (resolved === targetFile) {
          const parentPrefixes = getFilePrefixes(mount.sourceFilePath, new Set(visited));
          if (parentPrefixes.length > 0) {
            for (const parentPrefix of parentPrefixes) {
              parentMounts.push(joinRoutePaths(parentPrefix, mount.prefix));
            }
          } else {
            parentMounts.push(mount.prefix);
          }
        }
      }
    }

    return parentMounts.length > 0 ? parentMounts : directPrefixes;
  }

  for (const filePath of knownFilePaths) {
    const prefixes = getFilePrefixes(filePath, new Set());
    if (prefixes.length > 0) {
      fullPrefixesByFile.set(filePath, prefixes);
    }
  }

  // 4. Apply resolved prefixes to routes
  const resolvedRoutes: ApiRoute[] = [];

  for (const route of routes) {
    const filePrefixes = fullPrefixesByFile.get(route.filePath);
    const sameFilePrefixes = sameFileMounts.get(route.filePath);

    if (filePrefixes && filePrefixes.length > 0) {
      // Route belongs to a mounted router file: apply composed prefix
      for (const prefix of filePrefixes) {
        resolvedRoutes.push({
          ...route,
          path: joinRoutePaths(prefix, route.path),
        });
      }
    } else if (sameFilePrefixes && sameFilePrefixes.size > 0) {
      // In-file router mount: e.g. const router = Router(); app.use('/api', router);
      let applied = false;
      for (const prefixes of sameFilePrefixes.values()) {
        for (const prefix of prefixes) {
          resolvedRoutes.push({
            ...route,
            path: joinRoutePaths(prefix, route.path),
          });
          applied = true;
        }
      }
      if (!applied) {
        resolvedRoutes.push(route);
      }
    } else {
      // Unprefixed or standalone route: preserve original route
      resolvedRoutes.push(route);
    }
  }

  return resolvedRoutes;
}
