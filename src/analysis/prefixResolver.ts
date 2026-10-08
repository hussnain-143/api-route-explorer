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

  // If normalizedPath already equals or starts with normalizedPrefix, avoid duplication
  if (normalizedPath === normalizedPrefix) {
    return normalizedPrefix;
  }
  if (normalizedPath.startsWith(normalizedPrefix + '/')) {
    return normalizedPath;
  }

  // Extract path segments for overlap detection
  const prefixSegs = normalizedPrefix.split('/').filter(Boolean);
  const pathSegs = normalizedPath.split('/').filter(Boolean);

  let overlap = 0;
  const maxOverlap = Math.min(prefixSegs.length, pathSegs.length);
  for (let len = maxOverlap; len > 0; len--) {
    const prefixTail = prefixSegs.slice(-len).join('/').toLowerCase();
    const pathHead = pathSegs.slice(0, len).join('/').toLowerCase();
    if (prefixTail === pathHead) {
      overlap = len;
      break;
    }
  }

  let finalSegs: string[];
  if (overlap > 0) {
    finalSegs = [...prefixSegs, ...pathSegs.slice(overlap)];
  } else {
    finalSegs = [...prefixSegs, ...pathSegs];
  }

  // Collapse accidental consecutive repeating blocks (e.g. /api/v1/api/v1)
  finalSegs = collapseRepeatingSegments(finalSegs);

  return `/${finalSegs.join('/')}`;
}

/**
 * Collapses consecutive duplicate segment sequences of length >= 1.
 * e.g. ['api', 'v1', 'admin', 'auth', 'api', 'v1', 'admin', 'auth', 'signin']
 * -> ['api', 'v1', 'admin', 'auth', 'signin']
 */
export function collapseRepeatingSegments(segments: string[]): string[] {
  let result = [...segments];
  let changed = true;

  while (changed) {
    changed = false;
    const n = result.length;
    for (let len = Math.floor(n / 2); len >= 1; len--) {
      for (let i = 0; i <= n - 2 * len; i++) {
        const block1 = result.slice(i, i + len);
        const block2 = result.slice(i + len, i + 2 * len);
        const isMatch = block1.every((seg, idx) => seg.toLowerCase() === block2[idx].toLowerCase());
        if (isMatch) {
          result.splice(i + len, len);
          changed = true;
          break;
        }
      }
      if (changed) {
        break;
      }
    }
  }

  return result;
}

/**
 * Information about a router mount relationship discovered in code:
 * e.g. caller.use(prefix, ...middlewares, routerIdentifier)
 */
interface MountEntry {
  sourceFilePath: string;
  callerVar: string;
  prefix: string;
  routerVar: string;
}

/**
 * Information about an imported router identifier in a source file:
 * e.g. import userRouter from './routes/userRoutes';
 * or import { helpCenterAdminRouter } from './helpCenter.routes';
 */
interface ImportEntry {
  importingFilePath: string;
  varName: string;
  specifier: string;
  exportedName: string; // 'default', '*', or specific named export identifier
}

/**
 * Internal diagnostics information for route and router discovery.
 */
export interface RouteDiscoveryDiagnostics {
  discoveredFiles: string[];
  discoveredRouters: { filePath: string; routerVar: string }[];
  discoveredImports: { importingFilePath: string; varName: string; specifier: string; resolvedPath?: string }[];
  discoveredMounts: { sourceFilePath: string; prefix: string; routerVar: string; targetFilePath?: string }[];
  unresolvedRelationships: { sourceFilePath: string; routerVar: string; reason: string }[];
}

let lastDiscoveryDiagnostics: RouteDiscoveryDiagnostics = {
  discoveredFiles: [],
  discoveredRouters: [],
  discoveredImports: [],
  discoveredMounts: [],
  unresolvedRelationships: [],
};

/**
 * Returns the diagnostic details from the most recent route prefix resolution.
 */
export function getLastDiscoveryDiagnostics(): RouteDiscoveryDiagnostics {
  return lastDiscoveryDiagnostics;
}

/**
 * Masks single-line and multi-line comments with whitespace.
 */
function maskComments(source: string): string {
  if (!source.includes('//') && !source.includes('/*')) {
    return source;
  }
  const chars = source.split('');
  let i = 0;
  const len = chars.length;

  while (i < len) {
    const char = chars[i];
    const nextChar = i + 1 < len ? chars[i + 1] : '';

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
 * Finds index of matching closing parenthesis.
 */
function findMatchingParen(source: string, openIndex: number): number {
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
 * Extracts ESM and CJS imports from a source file.
 */
export function extractImports(source: string, filePath: string): ImportEntry[] {
  if (!source.includes('import') && !source.includes('require')) {
    return [];
  }
  const imports: ImportEntry[] = [];
  const clean = maskComments(source);

  // ESM Imports: import ... from 'specifier'
  const ESM_REGEX = /import\s+(?:([a-zA-Z0-9_$]+)\s*,?\s*)?(?:\{([^}]+)\})?(?:\*\s*as\s*([a-zA-Z0-9_$]+))?\s*from\s*['"]([^'"]+)['"]/g;
  let esmMatch: RegExpExecArray | null = ESM_REGEX.exec(clean);
  while (esmMatch !== null) {
    const defaultVar = esmMatch[1]?.trim();
    const namedBlock = esmMatch[2]?.trim();
    const starVar = esmMatch[3]?.trim();
    const specifier = esmMatch[4]?.trim();

    if (specifier) {
      if (defaultVar) {
        imports.push({ importingFilePath: filePath, varName: defaultVar, specifier, exportedName: 'default' });
      }
      if (starVar) {
        imports.push({ importingFilePath: filePath, varName: starVar, specifier, exportedName: '*' });
      }
      if (namedBlock) {
        const parts = namedBlock.split(',');
        for (const part of parts) {
          const item = part.trim();
          if (!item) {
            continue;
          }
          if (item.includes(' as ')) {
            const [orig, alias] = item.split(/\s+as\s+/).map((s) => s.trim());
            if (alias) {
              imports.push({ importingFilePath: filePath, varName: alias, specifier, exportedName: orig });
            }
          } else {
            imports.push({ importingFilePath: filePath, varName: item, specifier, exportedName: item });
          }
        }
      }
    }
    esmMatch = ESM_REGEX.exec(clean);
  }

  // CJS Requires: const x = require('...')
  const CJS_DEF_REGEX = /(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let cjsMatch: RegExpExecArray | null = CJS_DEF_REGEX.exec(clean);
  while (cjsMatch !== null) {
    imports.push({
      importingFilePath: filePath,
      varName: cjsMatch[1].trim(),
      specifier: cjsMatch[2].trim(),
      exportedName: 'default',
    });
    cjsMatch = CJS_DEF_REGEX.exec(clean);
  }

  // CJS Destructuring: const { a, b: c } = require('...')
  const CJS_DEST_REGEX = /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let cjsDestMatch: RegExpExecArray | null = CJS_DEST_REGEX.exec(clean);
  while (cjsDestMatch !== null) {
    const block = cjsDestMatch[1].trim();
    const specifier = cjsDestMatch[2].trim();
    for (const part of block.split(',')) {
      const item = part.trim();
      if (!item) {
        continue;
      }
      if (item.includes(':')) {
        const [orig, alias] = item.split(':').map((s) => s.trim());
        if (alias) {
          imports.push({ importingFilePath: filePath, varName: alias, specifier, exportedName: orig });
        }
      } else {
        imports.push({ importingFilePath: filePath, varName: item, specifier, exportedName: item });
      }
    }
    cjsDestMatch = CJS_DEST_REGEX.exec(clean);
  }

  return imports;
}

const NON_ROUTER_IDENTIFIERS = new Set<string>([
  'express',
  'static',
  'urlencoded',
  'json',
  'raw',
  'cors',
  'helmet',
  'compression',
  'next',
  'req',
  'res',
  'err',
  'error',
  'logger',
  'cookieParser',
  'path',
  'fs',
  'url',
  'crypto',
  'http',
  'https',
  'util',
  'buffer',
  'process',
]);

/**
 * Splits argument string at top-level commas, respecting quotes, parens, brackets, and braces.
 */
function splitTopLevelArgs(argsText: string): string[] {
  const args: string[] = [];
  let depthParen = 0;
  let depthBrace = 0;
  let depthBracket = 0;
  let inQuote: string | null = null;
  let current = '';

  for (let i = 0; i < argsText.length; i++) {
    const ch = argsText[i];
    if (inQuote !== null) {
      current += ch;
      if (ch === '\\') {
        i++;
        if (i < argsText.length) {
          current += argsText[i];
        }
      } else if (ch === inQuote) {
        inQuote = null;
      }
      continue;
    }

    if (ch === '\'' || ch === '"' || ch === '`') {
      inQuote = ch;
      current += ch;
      continue;
    }

    if (ch === '(') {
      depthParen++;
    } else if (ch === ')') {
      depthParen--;
    } else if (ch === '{') {
      depthBrace++;
    } else if (ch === '}') {
      depthBrace--;
    } else if (ch === '[') {
      depthBracket++;
    } else if (ch === ']') {
      depthBracket--;
    }

    if (ch === ',' && depthParen === 0 && depthBrace === 0 && depthBracket === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  if (current.trim()) {
    args.push(current.trim());
  }

  return args;
}

/**
 * Extracts router mount calls from source code: caller.use(prefix, ...middlewares, router)
 */
export function extractMounts(source: string, filePath: string): MountEntry[] {
  if (!source.includes('.use')) {
    return [];
  }
  const mounts: MountEntry[] = [];
  const clean = maskComments(source);
  const USE_REGEX = /\b([a-zA-Z0-9_$]+)\s*\.\s*use\s*\(/g;

  let match: RegExpExecArray | null = USE_REGEX.exec(clean);
  while (match !== null) {
    const callerVar = match[1];
    const openParen = match.index + match[0].length - 1;
    const closeParen = findMatchingParen(clean, openParen);
    if (closeParen === -1) {
      match = USE_REGEX.exec(clean);
      continue;
    }

    const argsText = clean.slice(openParen + 1, closeParen).trim();
    const args = splitTopLevelArgs(argsText);
    if (args.length < 2) {
      match = USE_REGEX.exec(clean);
      continue;
    }

    const firstArgMatch = args[0].match(/^(['"`])([^'"`\r\n]+)\1$/);
    if (!firstArgMatch) {
      match = USE_REGEX.exec(clean);
      continue;
    }

    const prefix = firstArgMatch[2].trim();
    const handlerArgs = args.slice(1);

    for (const arg of handlerArgs) {
      // Discard function expressions, object literals, or static asset calls
      if (
        arg.includes('=>') ||
        arg.startsWith('function') ||
        arg.startsWith('{') ||
        arg.includes('express.static') ||
        arg.includes('serveStatic')
      ) {
        continue;
      }

      // Check simple identifier: e.g. v1Router, adminRouter, complaintRouter
      const idMatch = arg.match(/^([a-zA-Z0-9_$]+)$/);
      if (idMatch) {
        const id = idMatch[1];
        if (id !== callerVar && !NON_ROUTER_IDENTIFIERS.has(id)) {
          mounts.push({
            sourceFilePath: filePath,
            callerVar,
            prefix,
            routerVar: id,
          });
        }
      }
    }

    match = USE_REGEX.exec(clean);
  }

  return mounts;
}

/**
 * Information about router exports and declarations within a source file.
 */
interface FileRouterDetails {
  defaultVar?: string;
  namedExports: Map<string, string>;
  declaredRouters: Set<string>;
}

/**
 * Extracts declared router variables and exports from a source file.
 */
function extractFileRouterDetails(source: string): FileRouterDetails {
  const clean = maskComments(source);
  let defaultVar: string | undefined;
  const namedExports = new Map<string, string>();
  const declaredRouters = new Set<string>();

  const DEF_REGEX = /(?:export\s+default|module\.exports\s*=)\s*([a-zA-Z0-9_$]+)/;
  const dm = DEF_REGEX.exec(clean);
  if (dm) {
    defaultVar = dm[1];
  }

  const NAMED_EXPORT_CONST = /export\s+(?:const|let|var)\s+([a-zA-Z0-9_$]+)/g;
  let nm: RegExpExecArray | null = NAMED_EXPORT_CONST.exec(clean);
  while (nm !== null) {
    namedExports.set(nm[1], nm[1]);
    nm = NAMED_EXPORT_CONST.exec(clean);
  }

  const NAMED_EXPORT_BLOCK = /export\s*\{([^}]+)\}/g;
  let bm: RegExpExecArray | null = NAMED_EXPORT_BLOCK.exec(clean);
  while (bm !== null) {
    for (const part of bm[1].split(',')) {
      const p = part.trim();
      if (!p) {
        continue;
      }
      if (p.includes(' as ')) {
        const [orig, alias] = p.split(/\s+as\s+/).map((s) => s.trim());
        if (alias === 'default') {
          defaultVar = orig;
        } else {
          namedExports.set(alias, orig);
        }
      } else {
        namedExports.set(p, p);
      }
    }
    bm = NAMED_EXPORT_BLOCK.exec(clean);
  }

  // Detect routers declared in this file: const x = Router(); or const x = express.Router();
  const ROUTER_DECL = /(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:Router|express\.Router)\s*\(/g;
  let rm: RegExpExecArray | null = ROUTER_DECL.exec(clean);
  while (rm !== null) {
    declaredRouters.add(rm[1]);
    rm = ROUTER_DECL.exec(clean);
  }

  return { defaultVar, namedExports, declaredRouters };
}

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

  // Extensions: .js, .ts, .jsx, .tsx, /index.js, /index.ts
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
 * Graph edge representing a mounted router relation.
 */
interface MountEdge {
  parentFilePath: string;
  parentCallerVar: string;
  prefix: string;
  childFilePath: string;
  childExportName: string;
  childVarName: string;
}

/**
 * Statically analyzes workspace source files to discover Express router mounting
 * hierarchies and prefixes, and composes final route paths.
 *
 * Supported Patterns:
 * - `app.use('/api/v1', router)`
 * - `router.use('/users', userRouter)`
 * - Named imports: `import { helpCenterAdminRouter } from './helpCenter.routes'`
 * - Multi-level nested routers: app.js -> v1/index.js -> admin.routes.js -> submodules
 * - Multiple mount parents (e.g. unified complaint router mounted by v1, customer, and professional)
 * - Safe cycle detection
 * - Same-file router mounts without polluting root application routes
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
  const allImports: ImportEntry[] = [];
  const allMounts: MountEntry[] = [];
  const fileDetailsMap = new Map<string, FileRouterDetails>();

  // Reset diagnostics state
  lastDiscoveryDiagnostics = {
    discoveredFiles: [...knownFilePaths],
    discoveredRouters: [],
    discoveredImports: [],
    discoveredMounts: [],
    unresolvedRelationships: [],
  };

  // 1. Parse mounts, imports, and router details across all source files
  for (const [filePath, source] of sourcesMap.entries()) {
    const imports = extractImports(source, filePath);
    const mounts = extractMounts(source, filePath);
    const details = extractFileRouterDetails(source);

    allImports.push(...imports);
    allMounts.push(...mounts);
    fileDetailsMap.set(filePath, details);

    for (const r of details.declaredRouters) {
      lastDiscoveryDiagnostics.discoveredRouters.push({ filePath, routerVar: r });
    }
  }

  // 2. Build cross-file mount edges and same-file mounts
  const sameFileMounts = new Map<string, Map<string, { prefix: string; callerVar: string }[]>>();
  const mountEdges: MountEdge[] = [];

  for (const mount of allMounts) {
    const matchedImp = allImports.find(
      (imp) => imp.importingFilePath === mount.sourceFilePath && imp.varName === mount.routerVar
    );

    if (matchedImp) {
      const resolvedChild = resolveSpecifierToFilePath(
        mount.sourceFilePath,
        matchedImp.specifier,
        knownFilePaths
      );

      if (resolvedChild) {
        mountEdges.push({
          parentFilePath: mount.sourceFilePath,
          parentCallerVar: mount.callerVar,
          prefix: mount.prefix,
          childFilePath: resolvedChild,
          childExportName: matchedImp.exportedName,
          childVarName: mount.routerVar,
        });

        lastDiscoveryDiagnostics.discoveredMounts.push({
          sourceFilePath: mount.sourceFilePath,
          prefix: mount.prefix,
          routerVar: mount.routerVar,
          targetFilePath: resolvedChild,
        });

        lastDiscoveryDiagnostics.discoveredImports.push({
          importingFilePath: mount.sourceFilePath,
          varName: matchedImp.varName,
          specifier: matchedImp.specifier,
          resolvedPath: resolvedChild,
        });

        continue;
      } else {
        lastDiscoveryDiagnostics.unresolvedRelationships.push({
          sourceFilePath: mount.sourceFilePath,
          routerVar: mount.routerVar,
          reason: `Could not resolve import specifier "${matchedImp.specifier}" to a workspace file.`,
        });
      }
    }

    // Same-file mount: if routerVar is not imported from another file
    let fileMap = sameFileMounts.get(mount.sourceFilePath);
    if (!fileMap) {
      fileMap = new Map();
      sameFileMounts.set(mount.sourceFilePath, fileMap);
    }
    const existing = fileMap.get(mount.routerVar) || [];
    existing.push({ prefix: mount.prefix, callerVar: mount.callerVar });
    fileMap.set(mount.routerVar, existing);

    lastDiscoveryDiagnostics.discoveredMounts.push({
      sourceFilePath: mount.sourceFilePath,
      prefix: mount.prefix,
      routerVar: mount.routerVar,
      targetFilePath: mount.sourceFilePath,
    });
  }

  function detectCallerVarForRoute(route: ApiRoute, fileSource?: string): string {
    if (route.routerVar) {
      return route.routerVar;
    }
    if (!fileSource) {
      return 'router';
    }
    const lines = fileSource.split(/\r?\n/);
    const start = Math.max(0, route.line - 6);
    for (let l = route.line; l >= start; l--) {
      const text = lines[l];
      if (!text) {
        continue;
      }
      const match = text.match(/\b([a-zA-Z0-9_$]+)\s*\.\s*(?:get|post|put|patch|delete|all|options|head|route)\b/);
      if (match) {
        return match[1];
      }
    }
    return 'router';
  }

  // 3. Resolve prefix chains via recursive graph traversal with cycle safety
  function resolvePrefixChains(
    targetFilePath: string,
    targetCallerVar: string | undefined,
    visited: Set<string> = new Set()
  ): string[] {
    const visitKey = `${targetFilePath}::${targetCallerVar || 'default'}`;
    if (visited.has(visitKey)) {
      return [];
    }
    const nextVisited = new Set(visited);
    nextVisited.add(visitKey);

    const details = fileDetailsMap.get(targetFilePath);
    const isDefault =
      !targetCallerVar ||
      targetCallerVar === 'default' ||
      targetCallerVar === 'router' ||
      (details && details.defaultVar === targetCallerVar);
    const matchingNamed = details?.namedExports.has(targetCallerVar || '') ? targetCallerVar : undefined;

    // A. Cross-file incoming mounts to targetFilePath
    const fileSameMounts = sameFileMounts.get(targetFilePath);
    const isLocallyMounted = fileSameMounts && targetCallerVar && fileSameMounts.has(targetCallerVar);

    const incomingEdges = mountEdges.filter((e) => {
      if (e.childFilePath !== targetFilePath) {
        return false;
      }
      if (isLocallyMounted) {
        return false;
      }
      const isNamedMatch = matchingNamed !== undefined && e.childExportName === matchingNamed;
      const isDirectExportMatch = targetCallerVar !== undefined && e.childExportName === targetCallerVar;
      const isDefaultMatch =
        (e.childExportName === 'default' || e.childExportName === '*') &&
        targetCallerVar !== 'app' &&
        (!details ||
          details.namedExports.size === 0 ||
          !details.namedExports.has(targetCallerVar || '') ||
          details.defaultVar === targetCallerVar ||
          isDefault);

      if (isDefaultMatch && (e.childExportName === 'default' || e.childExportName === '*')) {
        return true;
      }
      if (isNamedMatch && e.childExportName === matchingNamed) {
        return true;
      }
      if (isDirectExportMatch && e.childExportName === targetCallerVar) {
        return true;
      }
      return false;
    });

    const results: string[] = [];
    for (const edge of incomingEdges) {
      const parentChains = resolvePrefixChains(edge.parentFilePath, edge.parentCallerVar, nextVisited);
      if (parentChains.length > 0) {
        for (const p of parentChains) {
          results.push(joinRoutePaths(p, edge.prefix));
        }
      } else {
        results.push(edge.prefix);
      }
    }

    // B. Same-file mounts
    if (fileSameMounts && targetCallerVar && fileSameMounts.has(targetCallerVar)) {
      const internalMounts = fileSameMounts.get(targetCallerVar);
      if (internalMounts) {
        for (const im of internalMounts) {
          const callerChains = resolvePrefixChains(targetFilePath, im.callerVar, nextVisited);
          if (callerChains.length > 0) {
            for (const p of callerChains) {
              results.push(joinRoutePaths(p, im.prefix));
            }
          } else {
            results.push(im.prefix);
          }
        }
      }
    }

    return Array.from(new Set(results));
  }

  // 4. Apply composed prefixes to discovered routes
  const resolvedRoutes: ApiRoute[] = [];

  for (const route of routes) {
    const source = sourcesMap.get(route.filePath);
    const callerVar = detectCallerVarForRoute(route, source);
    let prefixes = resolvePrefixChains(route.filePath, callerVar);
    if (prefixes.length === 0 && callerVar !== 'app') {
      prefixes = resolvePrefixChains(route.filePath, 'default');
    }

    if (prefixes.length > 0) {
      for (const prefix of prefixes) {
        resolvedRoutes.push({
          ...route,
          path: joinRoutePaths(prefix, route.path),
        });
      }
    } else {
      // Standalone or root route (e.g. app.get('/health', ...) in app.js)
      resolvedRoutes.push(route);
    }
  }

  return resolvedRoutes;
}

