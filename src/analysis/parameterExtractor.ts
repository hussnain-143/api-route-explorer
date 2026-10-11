import * as fs from 'fs';
import * as path from 'path';
import { ApiRoute, HttpMethod } from '../models/route';
import { ApiParameter, ParameterLocation, ParameterType } from '../models/parameter';
import { maskComments, findMatchingParen } from '../scanner/routeParser';
import { suggestParameterValue } from './parameterSuggester';

/**
 * Parses ESM and CJS import declarations from a source file.
 */
interface ImportSpec {
  localName: string;
  importedName: string;
  specifier: string;
}

function parseImports(source: string): ImportSpec[] {
  const imports: ImportSpec[] = [];
  const clean = maskComments(source);

  // ESM: import { a, b as c } from '...'
  const ESM_REGEX = /import\s+(?:([a-zA-Z0-9_$]+)\s*,?\s*)?(?:\{([^}]+)\})?(?:\*\s*as\s*([a-zA-Z0-9_$]+))?\s*from\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null = ESM_REGEX.exec(clean);
  while (match !== null) {
    const defaultVar = match[1]?.trim();
    const namedBlock = match[2]?.trim();
    const starVar = match[3]?.trim();
    const specifier = match[4]?.trim();

    if (specifier) {
      if (defaultVar) {
        imports.push({ localName: defaultVar, importedName: 'default', specifier });
      }
      if (starVar) {
        imports.push({ localName: starVar, importedName: '*', specifier });
      }
      if (namedBlock) {
        for (const item of namedBlock.split(',')) {
          const trimmed = item.trim();
          if (!trimmed) {continue;}
          if (trimmed.includes(' as ')) {
            const [orig, alias] = trimmed.split(/\s+as\s+/).map((s) => s.trim());
            if (alias) {
              imports.push({ localName: alias, importedName: orig, specifier });
            }
          } else {
            imports.push({ localName: trimmed, importedName: trimmed, specifier });
          }
        }
      }
    }
    match = ESM_REGEX.exec(clean);
  }

  // CJS: const x = require('...')
  const CJS_DEF_REGEX = /(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let cjsMatch: RegExpExecArray | null = CJS_DEF_REGEX.exec(clean);
  while (cjsMatch !== null) {
    imports.push({
      localName: cjsMatch[1].trim(),
      importedName: 'default',
      specifier: cjsMatch[2].trim(),
    });
    cjsMatch = CJS_DEF_REGEX.exec(clean);
  }

  // CJS: const { a, b: c } = require('...')
  const CJS_DEST_REGEX = /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let cjsDestMatch: RegExpExecArray | null = CJS_DEST_REGEX.exec(clean);
  while (cjsDestMatch !== null) {
    const block = cjsDestMatch[1].trim();
    const specifier = cjsDestMatch[2].trim();
    for (const part of block.split(',')) {
      const item = part.trim();
      if (!item) {continue;}
      if (item.includes(':')) {
        const [orig, alias] = item.split(':').map((s) => s.trim());
        if (alias) {
          imports.push({ localName: alias, importedName: orig, specifier });
        }
      } else {
        imports.push({ localName: item, importedName: item, specifier });
      }
    }
    cjsDestMatch = CJS_DEST_REGEX.exec(clean);
  }

  return imports;
}

/**
 * Resolves a module specifier to an existing file in fileSources or on the file system.
 */
function resolveModuleFile(
  importingFilePath: string,
  specifier: string,
  fileSources?: Map<string, string> | Record<string, string>
): { filePath: string; source: string } | undefined {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) {
    return undefined;
  }

  const importingDir = path.dirname(importingFilePath);
  const candidateBase = path.resolve(importingDir, specifier).replace(/\\/g, '/');

  const getSourceForPath = (targetPath: string): string | undefined => {
    const norm = targetPath.replace(/\\/g, '/');
    if (fileSources) {
      if (fileSources instanceof Map) {
        for (const [k, v] of fileSources.entries()) {
          if (k.replace(/\\/g, '/') === norm) {return v;}
        }
      } else {
        for (const [k, v] of Object.entries(fileSources)) {
          if (k.replace(/\\/g, '/') === norm) {return v;}
        }
      }
    }
    if (fs.existsSync(targetPath)) {
      try {
        return fs.readFileSync(targetPath, 'utf8');
      } catch {
        return undefined;
      }
    }
    return undefined;
  };

  const extensions = ['', '.ts', '.js', '.mjs', '.cjs', '.jsx', '.tsx', '/index.ts', '/index.js', '/index.mjs'];
  for (const ext of extensions) {
    const candidate = `${candidateBase}${ext}`;
    const src = getSourceForPath(candidate);
    if (src !== undefined) {
      return { filePath: candidate, source: src };
    }
  }

  return undefined;
}

/**
 * Retrieves the source code for a given file path from memory cache or disk.
 */
function getSource(
  filePath: string,
  fileSources?: Map<string, string> | Record<string, string>
): string | undefined {
  if (!filePath) {return undefined;}
  const norm = filePath.replace(/\\/g, '/');

  if (fileSources) {
    if (fileSources instanceof Map) {
      for (const [k, v] of fileSources.entries()) {
        if (k.replace(/\\/g, '/') === norm) {return v;}
      }
    } else {
      for (const [k, v] of Object.entries(fileSources)) {
        if (k.replace(/\\/g, '/') === norm) {return v;}
      }
    }
  }

  if (fs.existsSync(filePath)) {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch {
      return undefined;
    }
  }

  return undefined;
}

/**
 * Splits argument string at top-level commas, respecting quotes, parens, brackets, and braces.
 */
function splitTopLevelArguments(input: string): string[] {
  const results: string[] = [];
  let current = '';
  let parenDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  let inQuote: string | null = null;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inQuote !== null) {
      current += ch;
      if (ch === '\\') {
        i++;
        if (i < input.length) {current += input[i];}
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

    if (ch === '(') {parenDepth++;}
    else if (ch === ')') {parenDepth--;}
    else if (ch === '{') {braceDepth++;}
    else if (ch === '}') {braceDepth--;}
    else if (ch === '[') {bracketDepth++;}
    else if (ch === ']') {bracketDepth--;}

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
 * Safely splits a route URL into its path component and query string component,
 * taking care not to confuse Express optional path parameter tokens (:param?)
 * with the query delimiter (?).
 */
export function splitPathAndQuery(routePath: string): { pathPart: string; queryPart: string } {
  if (!routePath || !routePath.includes('?')) {
    return { pathPart: routePath || '', queryPart: '' };
  }

  // 1. Look for '?' followed by key=value (e.g. ?status=active or ?page=1)
  const kvQueryMatch = routePath.match(/\?([a-zA-Z0-9_$-]+=[^/]*)/);
  if (kvQueryMatch && kvQueryMatch.index !== undefined) {
    return {
      pathPart: routePath.slice(0, kvQueryMatch.index),
      queryPart: routePath.slice(kvQueryMatch.index + 1),
    };
  }

  // 2. Look for '?' that is preceded by a regular slash/segment rather than a colon identifier
  // e.g. /users?status vs /users/:id?
  const nonColonQuestion = /(?<!:[a-zA-Z0-9_$]+)\?/;
  const nonColonMatch = nonColonQuestion.exec(routePath);
  if (nonColonMatch) {
    return {
      pathPart: routePath.slice(0, nonColonMatch.index),
      queryPart: routePath.slice(nonColonMatch.index + 1),
    };
  }

  // 3. Look for a second '?' after an optional param token, e.g. /users/:id??notify=true
  const secondQuestion = /(?<=:[a-zA-Z0-9_$]+\?)\?/;
  const secondMatch = secondQuestion.exec(routePath);
  if (secondMatch) {
    return {
      pathPart: routePath.slice(0, secondMatch.index),
      queryPart: routePath.slice(secondMatch.index + 1),
    };
  }

  // 4. Otherwise, any single '?' after :param is an optional parameter token like /users/:id?
  return { pathPart: routePath, queryPart: '' };
}

/**
 * Extracts path parameters from the route path string.
 */
export function extractPathParameters(routePath: string): ApiParameter[] {
  if (!routePath) {return [];}

  const { pathPart } = splitPathAndQuery(routePath);
  const pathOnly = pathPart;

  const result: ApiParameter[] = [];
  const seen = new Set<string>();
  let idCounter = 0;

  // 1. Next.js optional catch-all: [[...slug]]
  const optCatchAllRegex = /\[\[\.\.\.([a-zA-Z0-9_$]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = optCatchAllRegex.exec(pathOnly)) !== null) {
    const name = m[1];
    if (!seen.has(name)) {
      seen.add(name);
      const sugg = suggestParameterValue(name, 'path', undefined, idCounter++);
      result.push({
        name,
        location: 'path',
        required: false,
        isOptional: true,
        type: sugg.type,
        placeholder: sugg.placeholder,
        value: sugg.value,
        defaultValue: sugg.value,
      });
    }
  }

  // 2. Next.js catch-all: [...slug]
  const catchAllRegex = /\[\.\.\.([a-zA-Z0-9_$]+)\]/g;
  while ((m = catchAllRegex.exec(pathOnly)) !== null) {
    const name = m[1];
    if (!seen.has(name)) {
      seen.add(name);
      const sugg = suggestParameterValue(name, 'path', undefined, idCounter++);
      result.push({
        name,
        location: 'path',
        required: true,
        isOptional: false,
        type: sugg.type,
        placeholder: sugg.placeholder,
        value: sugg.value,
        defaultValue: sugg.value,
      });
    }
  }

  // 3. Next.js standard dynamic: [id]
  const bracketRegex = /\[([a-zA-Z0-9_$]+)\]/g;
  while ((m = bracketRegex.exec(pathOnly)) !== null) {
    const name = m[1];
    if (!seen.has(name)) {
      seen.add(name);
      const sugg = suggestParameterValue(name, 'path', undefined, idCounter++);
      result.push({
        name,
        location: 'path',
        required: true,
        isOptional: false,
        type: sugg.type,
        placeholder: sugg.placeholder,
        value: sugg.value,
        defaultValue: sugg.value,
      });
    }
  }

  // 4. Curly braces (OpenAPI style): {id} or {userId}
  const curlyRegex = /\{([a-zA-Z0-9_$]+)\}/g;
  while ((m = curlyRegex.exec(pathOnly)) !== null) {
    const name = m[1];
    if (!seen.has(name)) {
      seen.add(name);
      const sugg = suggestParameterValue(name, 'path', undefined, idCounter++);
      result.push({
        name,
        location: 'path',
        required: true,
        isOptional: false,
        type: sugg.type,
        placeholder: sugg.placeholder,
        value: sugg.value,
        defaultValue: sugg.value,
      });
    }
  }

  // 5. Express/Fastify/NestJS colon parameters: :userId or :id?
  const colonRegex = /:([a-zA-Z0-9_$]+)(\?)?/g;
  while ((m = colonRegex.exec(pathOnly)) !== null) {
    const name = m[1];
    const isOptional = m[2] === '?';
    if (!seen.has(name)) {
      seen.add(name);
      const sugg = suggestParameterValue(name, 'path', undefined, idCounter++);
      result.push({
        name,
        location: 'path',
        required: !isOptional,
        isOptional,
        type: sugg.type,
        placeholder: sugg.placeholder,
        value: sugg.value,
        defaultValue: sugg.value,
      });
    }
  }

  return result;
}

/**
 * Extracts query parameters from the route path URL if present.
 */
export function extractQueryParametersFromPath(routePath: string): ApiParameter[] {
  if (!routePath) {return [];}
  const { queryPart } = splitPathAndQuery(routePath);
  if (!queryPart) {return [];}

  const result: ApiParameter[] = [];
  const seen = new Set<string>();

  const pairs = queryPart.split('&');
  for (const pair of pairs) {
    const [rawKey, rawVal] = pair.split('=');
    if (!rawKey || !rawKey.trim()) {continue;}
    const key = decodeURIComponent(rawKey.trim());
    if (seen.has(key)) {continue;}
    seen.add(key);

    const decodedVal = rawVal !== undefined ? decodeURIComponent(rawVal.trim()) : undefined;
    let inferredType: ParameterType = 'string';
    let defaultValue: unknown = decodedVal;

    if (decodedVal !== undefined) {
      if (decodedVal === 'true' || decodedVal === 'false') {
        inferredType = 'boolean';
        defaultValue = decodedVal === 'true';
      } else if (!isNaN(Number(decodedVal)) && decodedVal !== '') {
        inferredType = 'number';
        defaultValue = Number(decodedVal);
      }
    } else {
      const sugg = suggestParameterValue(key, 'query');
      defaultValue = sugg.value;
      inferredType = sugg.type;
    }

    result.push({
      name: key,
      location: 'query',
      required: false,
      type: inferredType,
      value: defaultValue,
      defaultValue,
      placeholder: decodedVal || key,
    });
  }

  return result;
}

/**
 * Scans JavaScript code from startIndex forward to extract balanced call arguments,
 * tracking nested parens, braces, brackets, quotes, and comments.
 */
function extractBalancedCallArguments(source: string, startIndex: number): string | undefined {
  let parenDepth = 1; // Assuming caller already matched opening '('
  let braceDepth = 0;
  let bracketDepth = 0;
  let inQuote: string | null = null;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = startIndex; i < source.length; i++) {
    const ch = source[i];
    const next = i + 1 < source.length ? source[i + 1] : '';

    if (inLineComment) {
      if (ch === '\n') {inLineComment = false;}
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inQuote !== null) {
      if (ch === '\\') {
        i++; // skip escaped character
      } else if (ch === inQuote) {
        inQuote = null;
      }
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }

    if (ch === '\'' || ch === '"' || ch === '`') {
      inQuote = ch;
      continue;
    }

    if (ch === '(') {
      parenDepth++;
    } else if (ch === ')') {
      parenDepth--;
      if (parenDepth === 0) {
        return source.slice(startIndex, i).trim();
      }
    } else if (ch === '{') {
      braceDepth++;
    } else if (ch === '}') {
      braceDepth--;
    } else if (ch === '[') {
      bracketDepth++;
    } else if (ch === ']') {
      bracketDepth--;
    }
  }

  return undefined;
}

/**
 * Searches a source file for validation schema definitions matching schemaName.
 */
function findSchemaInSource(source: string, schemaName: string): string | undefined {
  if (!source || !schemaName) {return undefined;}
  const escaped = schemaName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const schemaRegex = new RegExp(
    `(?:const|let|var|export\\s+const)\\s+${escaped}\\s*=\\s*(?:z|Joi|yup|schema)\\.[a-zA-Z0-9_$]+\\s*\\(`,
    'm'
  );
  const m = source.match(schemaRegex);
  if (m && m.index !== undefined) {
    const startIdx = m.index + m[0].length;
    let parenDepth = 1;
    let i = startIdx;
    while (i < source.length && parenDepth > 0) {
      if (source[i] === '(') {
        parenDepth++;
      } else if (source[i] === ')') {
        parenDepth--;
      }
      i++;
    }
    return source.slice(m.index, i);
  }

  const genericSchemaRegex = new RegExp(
    `(?:const|let|var|export\\s+const)\\s+${escaped}\\s*=\\s*([\\s\\S]*?)(?:;|\\n\\s*\\n)`,
    'm'
  );
  const gm = source.match(genericSchemaRegex);
  if (gm) {return gm[0];}

  return undefined;
}

/**
 * Locates the handler function body or code snippet for a given route.
 */
function findHandlerCodeSnippet(
  route: ApiRoute,
  fileSources?: Map<string, string> | Record<string, string>
): { code: string; handlerName?: string } | undefined {
  const source = getSource(route.filePath, fileSources);
  if (!source) {return undefined;}

  // Case 1: Next.js App Router (route.ts / route.js)
  if (route.framework === 'nextjs' || route.filePath.endsWith('route.ts') || route.filePath.endsWith('route.js')) {
    const methodUpper = (route.method || 'GET').toUpperCase();
    const funcRegex = new RegExp(`export\\s+(?:async\\s+)?function\\s+${methodUpper}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)(?:\\n\\}|$)`, 'm');
    const fm = source.match(funcRegex);
    if (fm) {
      return { code: fm[0], handlerName: methodUpper };
    }
    const constRegex = new RegExp(`export\\s+const\\s+${methodUpper}\\s*=\\s*(?:async\\s*)?(?:\\([^)]*\\)|[a-zA-Z0-9_$]+)\\s*=>\\s*\\{([\\s\\S]*?)(?:\\n\\}|$)`, 'm');
    const cm = source.match(constRegex);
    if (cm) {
      return { code: cm[0], handlerName: methodUpper };
    }
  }

  // Case 2: Express / Fastify / NestJS Route Call Detection
  const methodLower = (route.method || 'get').toLowerCase();
  const cleanPath = route.path.split('?')[0];
  const pathsToTry = [route.path, cleanPath];

  // Try unmounted path suffixes (e.g. /api/v1/admin/auth/change-password -> /change-password)
  const segments = cleanPath.split('/').filter(Boolean);
  for (let i = 1; i < segments.length; i++) {
    const suffix = '/' + segments.slice(i).join('/');
    if (!pathsToTry.includes(suffix)) {
      pathsToTry.push(suffix);
    }
  }

  // Check direct call on route.line if available in source
  const sourceLines = source.split('\n');
  if (route.line !== undefined && route.line >= 0 && route.line < sourceLines.length) {
    const targetLine = sourceLines[route.line];
    const lineCallRegex = new RegExp(`\\.\\s*(?:${methodLower}|all)\\s*(?:<[^>]*>)?\\s*\\(\\s*['"\`]([^'"\`]+)['"\`]\\s*,`);
    const lm = targetLine.match(lineCallRegex);
    if (lm && lm[1] && !pathsToTry.includes(lm[1])) {
      pathsToTry.push(lm[1]);
    }
  }

  for (const p of pathsToTry) {
    if (!p) {continue;}
    const escapedP = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Standard call: .post('/login', ...
    const callStartRegex = new RegExp(
      `\\.\\s*(?:${methodLower}|all)\\s*(?:<[^>]*>)?\\s*\\(\\s*['"\`]${escapedP}['"\`]\\s*,`,
      'g'
    );

    let match: RegExpExecArray | null;
    let bestArgs: string | undefined;
    let minLineDiff = Infinity;

    while ((match = callStartRegex.exec(source)) !== null) {
      const argsStartIndex = match.index + match[0].length;
      const extractedArgs = extractBalancedCallArguments(source, argsStartIndex);
      if (extractedArgs !== undefined) {
        const lineNum = source.slice(0, match.index).split('\n').length - 1;
        const lineDiff = Math.abs(lineNum - (route.line || 0));
        if (lineDiff < minLineDiff) {
          minLineDiff = lineDiff;
          bestArgs = extractedArgs;
        }
      }
    }

    if (bestArgs !== undefined) {
      return resolveArgumentToHandler(bestArgs, route, source, fileSources);
    }

    // Chained call: .route('/login').post(...
    const chainedStartRegex = new RegExp(
      `\\.route\\s*\\(\\s*['"\`]${escapedP}['"\`]\\s*\\)[\\s\\S]*?\\.\\s*(?:${methodLower}|all)\\s*(?:<[^>]*>)?\\s*\\(`,
      'g'
    );
    while ((match = chainedStartRegex.exec(source)) !== null) {
      const argsStartIndex = match.index + match[0].length;
      const extractedArgs = extractBalancedCallArguments(source, argsStartIndex);
      if (extractedArgs !== undefined) {
        return resolveArgumentToHandler(extractedArgs, route, source, fileSources);
      }
    }
  }

  // Fallback: If no explicit route call was matched but file contains relevant code,
  // check if file itself is a handler module or contains the handler
  return { code: source };
}

/**
 * Resolves the argument string of a route call to its implementation code.
 */
function resolveArgumentToHandler(
  argsString: string,
  route: ApiRoute,
  fileSource: string,
  fileSources?: Map<string, string> | Record<string, string>
): { code: string; handlerName?: string } | undefined {
  const args = splitTopLevelArguments(argsString);
  if (args.length === 0) {return undefined;}

  // The last argument is the route handler (any earlier ones are middlewares)
  const lastArg = args[args.length - 1].trim();

  // Collect any referenced schemas in earlier middleware arguments (e.g. validate(loginSchema))
  let extraSchemaCode = '';
  for (const arg of args.slice(0, -1)) {
    const idMatches = arg.match(/\b([a-zA-Z0-9_$]*(?:[sS]chema|[vV]alidat[a-zA-Z0-9_$]*|[mM]odel))\b/g);
    if (idMatches) {
      for (const id of idMatches) {
        let schemaDef = findSchemaInSource(fileSource, id);
        if (!schemaDef) {
          const imports = parseImports(fileSource);
          const matchedImport = imports.find((imp) => imp.localName === id);
          if (matchedImport) {
            const resolved = resolveModuleFile(route.filePath, matchedImport.specifier, fileSources);
            if (resolved) {
              schemaDef = findSchemaInSource(
                resolved.source,
                matchedImport.importedName !== 'default' && matchedImport.importedName !== '*'
                  ? matchedImport.importedName
                  : id
              );
            }
          }
        }
        if (schemaDef) {
          extraSchemaCode += '\n' + schemaDef;
        }
      }
    }
    if (arg.includes('z.object') || arg.includes('Joi.object') || arg.includes('yup.object')) {
      extraSchemaCode += '\n' + arg;
    }
  }

  // Also check if any schema in file matches route path
  const routeBaseName = route.path.split('/').filter(Boolean).pop()?.split('?')[0] || '';
  if (routeBaseName) {
    const candidateSchemas = [
      `${routeBaseName}Schema`,
      `${routeBaseName}Validation`,
      `${route.method.toLowerCase()}${routeBaseName.charAt(0).toUpperCase() + routeBaseName.slice(1)}Schema`,
    ];
    for (const sName of candidateSchemas) {
      const sDef = findSchemaInSource(fileSource, sName);
      if (sDef) {
        extraSchemaCode += '\n' + sDef;
        break;
      }
    }
  }

  // 1. Inline Arrow Function or Function Expression
  if (
    lastArg.includes('=>') ||
    lastArg.startsWith('function') ||
    lastArg.startsWith('async function') ||
    lastArg.startsWith('async (') ||
    lastArg.startsWith('(')
  ) {
    return { code: lastArg + extraSchemaCode };
  }

  // 2. Named Identifier: e.g. "login" or "authController.login"
  const idMatch = lastArg.match(/^([a-zA-Z0-9_$]+)(?:\.([a-zA-Z0-9_$]+))?$/);
  if (!idMatch) {
    return { code: lastArg + extraSchemaCode };
  }

  const rootId = idMatch[1];
  const propId = idMatch[2];

  // Search local file first
  const localCode = findFunctionOrObjectInSource(fileSource, rootId, propId);
  if (localCode) {
    return { code: localCode + extraSchemaCode, handlerName: lastArg };
  }

  // Search imports in this file
  const imports = parseImports(fileSource);
  const matchedImport = imports.find((imp) => imp.localName === rootId);
  if (matchedImport) {
    const resolved = resolveModuleFile(route.filePath, matchedImport.specifier, fileSources);
    if (resolved) {
      const foreignCode = findFunctionOrObjectInSource(
        resolved.source,
        propId ? propId : (matchedImport.importedName !== 'default' && matchedImport.importedName !== '*' ? matchedImport.importedName : rootId),
        undefined
      );
      if (foreignCode) {
        return { code: foreignCode + extraSchemaCode, handlerName: lastArg };
      }
      return { code: resolved.source + extraSchemaCode, handlerName: lastArg };
    }
  }

  return { code: lastArg + extraSchemaCode, handlerName: lastArg };
}

/**
 * Finds the definition of a function or object method in source code.
 */
function findFunctionOrObjectInSource(source: string, rootId: string, propId?: string): string | undefined {
  if (!source) {return undefined;}

  if (propId) {
    // Look for object method: const authController = { login: (req, res) => { ... } }
    const objRegex = new RegExp(`(?:const|let|var|export\\s+const)\\s+${rootId}\\s*=\\s*\\{([\\s\\S]*?)\\};`, 'm');
    const om = source.match(objRegex);
    if (om) {
      const methodRegex = new RegExp(`(?:async\\s+)?${propId}\\s*(?:\\([^)]*\\)|:\\s*(?:async\\s*)?\\([^)]*\\))\\s*[{=]>?[\\s\\S]*?(?:,|\\n\\s*\\})`, 'm');
      const mm = om[1].match(methodRegex);
      if (mm) {return mm[0];}
      return om[0];
    }
    // Look for class method: class AuthController { login(req, res) { ... } }
    const classMethodRegex = new RegExp(`(?:async\\s+)?${propId}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\s*\\}`);
    const cm = source.match(classMethodRegex);
    if (cm) {return cm[0];}
  }

  // Look for direct function declaration: function login(...) { ... }
  const funcRegex = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${rootId}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\s*\\}`);
  const fm = source.match(funcRegex);
  if (fm) {return fm[0];}

  // Look for const login = (req, res) => { ... } or const login = asyncHandler(async (req, res) => { ... })
  const constRegex = new RegExp(
    `(?:export\\s+)?(?:const|let|var)\\s+${rootId}\\s*=\\s*(?:[a-zA-Z0-9_$]+\\s*\\(\\s*)?(?:async\\s*)?(?:\\([^)]*\\)|[a-zA-Z0-9_$]+)\\s*=>\\s*\\{([\\s\\S]*?)(?:\\n\\s*\\}|\\n\\s*\\}\\s*\\))`
  );
  const km = source.match(constRegex);
  if (km) {return km[0];}

  return undefined;
}

/**
 * Extracts query parameters from handler code.
 */
export function extractQueryParametersFromHandler(handlerCode: string): ApiParameter[] {
  if (!handlerCode) {return [];}
  const results: ApiParameter[] = [];
  const seen = new Set<string>();

  // 1. Destructuring: const { status, page, limit } = req.query;
  const destRegex = /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*(?:req|request|ctx)\.query\b/g;
  let m: RegExpExecArray | null = destRegex.exec(handlerCode);
  while (m !== null) {
    const block = m[1];
    for (const rawItem of block.split(',')) {
      const item = rawItem.trim();
      if (!item) {continue;}
      const [keyName, defaultVal] = item.split('=').map((s) => s.trim());
      const cleanKey = keyName.includes(':') ? keyName.split(':')[0].trim() : keyName;
      if (!seen.has(cleanKey)) {
        seen.add(cleanKey);
        const sugg = suggestParameterValue(cleanKey, 'query');
        results.push({
          name: cleanKey,
          location: 'query',
          required: false,
          type: sugg.type,
          placeholder: sugg.placeholder,
          value: defaultVal ? parseLiteralValue(defaultVal) : sugg.value,
          defaultValue: defaultVal ? parseLiteralValue(defaultVal) : sugg.value,
        });
      }
    }
    m = destRegex.exec(handlerCode);
  }

  // 2. Direct property access: req.query.status or req.query['status']
  const directRegex = /(?:req|request|ctx)\.query\.([a-zA-Z0-9_$]+)/g;
  while ((m = directRegex.exec(handlerCode)) !== null) {
    const key = m[1];
    if (!seen.has(key)) {
      seen.add(key);
      const sugg = suggestParameterValue(key, 'query');
      results.push({
        name: key,
        location: 'query',
        required: false,
        type: sugg.type,
        placeholder: sugg.placeholder,
        value: sugg.value,
        defaultValue: sugg.value,
      });
    }
  }

  const bracketRegex = /(?:req|request|ctx)\.query\[['"]([^'"]+)['"]\]/g;
  while ((m = bracketRegex.exec(handlerCode)) !== null) {
    const key = m[1];
    if (!seen.has(key)) {
      seen.add(key);
      const sugg = suggestParameterValue(key, 'query');
      results.push({
        name: key,
        location: 'query',
        required: false,
        type: sugg.type,
        placeholder: sugg.placeholder,
        value: sugg.value,
        defaultValue: sugg.value,
      });
    }
  }

  // 3. Next.js / Web URL searchParams: searchParams.get('page')
  const searchParamsRegex = /searchParams\.get\(['"]([^'"]+)['"]\)/g;
  while ((m = searchParamsRegex.exec(handlerCode)) !== null) {
    const key = m[1];
    if (!seen.has(key)) {
      seen.add(key);
      const sugg = suggestParameterValue(key, 'query');
      results.push({
        name: key,
        location: 'query',
        required: false,
        type: sugg.type,
        placeholder: sugg.placeholder,
        value: sugg.value,
        defaultValue: sugg.value,
      });
    }
  }

  return results;
}

/**
 * Extracts request body parameters from handler code or validation schemas.
 */
export function extractBodyParametersFromHandler(handlerCode: string): ApiParameter[] {
  if (!handlerCode) {return [];}
  const results: ApiParameter[] = [];
  const seen = new Set<string>();

  // 1a. Nested body schema: body: z.object({ ... }) or body: Joi.object({ ... })
  const nestedBodyZodRegex = /body\s*:\s*(?:z|Joi|yup)\.object\s*\(\s*\{([\s\S]*?)\}\s*\)/g;
  let nbm: RegExpExecArray | null = nestedBodyZodRegex.exec(handlerCode);
  while (nbm !== null) {
    const block = nbm[1];
    extractFromSchemaBlock(block, 'zod', seen, results);
    nbm = nestedBodyZodRegex.exec(handlerCode);
  }

  // 1b. Validation Schemas: Zod z.object({ ... })
  const zodRegex = /z\.object\s*\(\s*\{([^}]+)\}\s*\)/g;
  let zm: RegExpExecArray | null = zodRegex.exec(handlerCode);
  while (zm !== null) {
    const block = zm[1];
    extractFromSchemaBlock(block, 'zod', seen, results);
    zm = zodRegex.exec(handlerCode);
  }

  // 2. Validation Schemas: Joi.object({ ... })
  const joiRegex = /Joi\.object\s*\(\s*\{([^}]+)\}\s*\)/g;
  let jm: RegExpExecArray | null = joiRegex.exec(handlerCode);
  while (jm !== null) {
    const block = jm[1];
    extractFromSchemaBlock(block, 'joi', seen, results);
    jm = joiRegex.exec(handlerCode);
  }

  // 3. Validation Schemas: yup.object({ ... })
  const yupRegex = /yup\.object\s*\(\s*\{([^}]+)\}\s*\)/g;
  let ym: RegExpExecArray | null = yupRegex.exec(handlerCode);
  while (ym !== null) {
    const block = ym[1];
    extractFromSchemaBlock(block, 'yup', seen, results);
    ym = yupRegex.exec(handlerCode);
  }

  // 4. Fastify schema body: schema: { body: { properties: { ... } } }
  const fastifyBodyRegex = /properties\s*:\s*\{([^}]+)\}/g;
  let fbm: RegExpExecArray | null = fastifyBodyRegex.exec(handlerCode);
  while (fbm !== null) {
    const block = fbm[1];
    for (const item of block.split(',')) {
      const parts = item.split(':');
      if (parts.length >= 2) {
        const key = parts[0].trim().replace(/['"]/g, '');
        if (key && !seen.has(key)) {
          seen.add(key);
          const sugg = suggestParameterValue(key, 'body');
          results.push({
            name: key,
            location: 'body',
            required: true,
            type: sugg.type,
            placeholder: sugg.placeholder,
            value: sugg.value,
            defaultValue: sugg.value,
            isSensitive: sugg.isSensitive,
          });
        }
      }
    }
    fbm = fastifyBodyRegex.exec(handlerCode);
  }

  // 5. Destructuring: const { email, password, rememberMe = false } = req.body;
  // Also supports Next.js App Router: const { email, password } = await req.json();
  const destRegex = /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*(?:(?:req|request|ctx)\.body|(?:await\s+)?(?:req|request)\.json\(\))/g;
  let dm: RegExpExecArray | null = destRegex.exec(handlerCode);
  while (dm !== null) {
    const block = dm[1];
    parseDestructuredBodyBlock(block, '', seen, results);
    dm = destRegex.exec(handlerCode);
  }

  // 6. Direct nested access: req.body.user.email
  const nestedRegex = /(?:req|request|ctx)\.body\.([a-zA-Z0-9_$]+(?:\.[a-zA-Z0-9_$]+)+)/g;
  let nm: RegExpExecArray | null = nestedRegex.exec(handlerCode);
  while (nm !== null) {
    const fullPath = nm[1];
    if (!seen.has(fullPath)) {
      seen.add(fullPath);
      const leafName = fullPath.split('.').pop() || fullPath;
      const sugg = suggestParameterValue(leafName, 'body');
      results.push({
        name: fullPath,
        location: 'body',
        required: true,
        type: sugg.type,
        placeholder: sugg.placeholder,
        value: sugg.value,
        defaultValue: sugg.value,
        isSensitive: sugg.isSensitive,
      });
    }
    nm = nestedRegex.exec(handlerCode);
  }

  // 7. Direct top-level access: req.body.email or req.body['email']
  const directRegex = /(?:req|request|ctx)\.body\.([a-zA-Z0-9_$]+)\b(?!\.)/g;
  let directM: RegExpExecArray | null = directRegex.exec(handlerCode);
  while (directM !== null) {
    const key = directM[1];
    if (!seen.has(key)) {
      seen.add(key);
      const sugg = suggestParameterValue(key, 'body');
      results.push({
        name: key,
        location: 'body',
        required: true,
        type: sugg.type,
        placeholder: sugg.placeholder,
        value: sugg.value,
        defaultValue: sugg.value,
        isSensitive: sugg.isSensitive,
      });
    }
    directM = directRegex.exec(handlerCode);
  }

  const bracketRegex = /(?:req|request|ctx)\.body\[['"]([^'"]+)['"]\]/g;
  let bm: RegExpExecArray | null = bracketRegex.exec(handlerCode);
  while (bm !== null) {
    const key = bm[1];
    if (!seen.has(key)) {
      seen.add(key);
      const sugg = suggestParameterValue(key, 'body');
      results.push({
        name: key,
        location: 'body',
        required: true,
        type: sugg.type,
        placeholder: sugg.placeholder,
        value: sugg.value,
        defaultValue: sugg.value,
        isSensitive: sugg.isSensitive,
      });
    }
    bm = bracketRegex.exec(handlerCode);
  }

  return results;
}

/**
 * Parses destructuring blocks, including nested destructuring (e.g. { user: { email, name } }).
 */
function parseDestructuredBodyBlock(
  block: string,
  prefix: string,
  seen: Set<string>,
  results: ApiParameter[]
): void {
  const parts = splitTopLevelArguments(block);
  for (const part of parts) {
    const item = part.trim();
    if (!item) {continue;}

    // Check nested destructuring: user: { email, name }
    const nestedMatch = item.match(/^([a-zA-Z0-9_$]+)\s*:\s*\{([^}]+)\}/);
    if (nestedMatch) {
      const nestedPrefix = prefix ? `${prefix}.${nestedMatch[1]}` : nestedMatch[1];
      parseDestructuredBodyBlock(nestedMatch[2], nestedPrefix, seen, results);
      continue;
    }

    const [keyPart, defaultVal] = item.split('=').map((s) => s.trim());
    const propName = keyPart.includes(':') ? keyPart.split(':')[0].trim() : keyPart;
    if (!propName || !/^[a-zA-Z0-9_$]+$/.test(propName)) {continue;}

    const fullPath = prefix ? `${prefix}.${propName}` : propName;
    if (!seen.has(fullPath)) {
      seen.add(fullPath);
      let parsedDef = defaultVal ? parseLiteralValue(defaultVal) : undefined;
      let inferredType: ParameterType | undefined;

      if (parsedDef !== undefined) {
        if (typeof parsedDef === 'boolean') {inferredType = 'boolean';}
        else if (typeof parsedDef === 'number') {inferredType = 'number';}
      }

      const sugg = suggestParameterValue(propName, 'body', inferredType);
      const isOptional = defaultVal !== undefined;

      results.push({
        name: fullPath,
        location: 'body',
        required: !isOptional,
        isOptional,
        type: inferredType || sugg.type,
        placeholder: sugg.placeholder,
        value: parsedDef !== undefined ? parsedDef : sugg.value,
        defaultValue: parsedDef !== undefined ? parsedDef : sugg.value,
        isSensitive: sugg.isSensitive,
      });
    }
  }
}

/**
 * Extracts parameter names and types from validation schema definition lines.
 */
function extractFromSchemaBlock(
  block: string,
  schemaType: 'zod' | 'joi' | 'yup',
  seen: Set<string>,
  results: ApiParameter[]
): void {
  const lines = block.split('\n');
  for (const line of lines) {
    const parts = line.split(':');
    if (parts.length < 2) {continue;}

    const rawKey = parts[0].trim().replace(/['"]/g, '');
    if (!rawKey || !/^[a-zA-Z0-9_$]+$/.test(rawKey)) {continue;}

    const rule = parts.slice(1).join(':').toLowerCase();
    if (rawKey === 'body' && (rule.includes('object') || rule.includes('z.object'))) {
      continue;
    }
    if (seen.has(rawKey)) {continue;}
    seen.add(rawKey);

    let type: ParameterType = 'string';
    if (rule.includes('number') || rule.includes('int') || rule.includes('integer')) {
      type = 'number';
    } else if (rule.includes('boolean') || rule.includes('bool')) {
      type = 'boolean';
    } else if (rule.includes('array')) {
      type = 'array';
    } else if (rule.includes('object')) {
      type = 'object';
    }

    const isOptional = rule.includes('optional') || rule.includes('default');
    const sugg = suggestParameterValue(rawKey, 'body', type);

    results.push({
      name: rawKey,
      location: 'body',
      required: !isOptional,
      isOptional,
      type,
      placeholder: sugg.placeholder,
      value: sugg.value,
      defaultValue: sugg.value,
      isSensitive: sugg.isSensitive,
    });
  }
}

/**
 * Safely parses simple JavaScript literal expressions (strings, numbers, booleans, null).
 * Never reads or evaluates process.env or dynamic code.
 */
function parseLiteralValue(expr: string): unknown {
  const trimmed = expr.trim();
  if (trimmed === 'true') {return true;}
  if (trimmed === 'false') {return false;}
  if (trimmed === 'null') {return null;}
  if (trimmed === 'undefined') {return undefined;}
  if (!isNaN(Number(trimmed)) && trimmed !== '') {return Number(trimmed);}

  const strMatch = trimmed.match(/^['"`](.*)['"`]$/);
  if (strMatch) {return strMatch[1];}

  // If expression references process.env, strictly reject env value
  if (trimmed.includes('process.env')) {
    return undefined;
  }

  return undefined;
}

/**
 * Primary static-analysis parameter extraction entry point.
 * Discovers and normalizes path, query, and request body parameters for any given API route.
 *
 * @param route The ApiRoute to inspect.
 * @param fileSources In-memory or workspace file cache.
 * @returns Array of normalized ApiParameter objects.
 */
export function extractRouteParameters(
  route: ApiRoute,
  fileSources?: Map<string, string> | Record<string, string>
): ApiParameter[] {
  if (!route) {return [];}

  // 1. Path Parameters (Priority 1)
  const pathParams = extractPathParameters(route.path);

  // 2. Query Parameters from Route Path
  const queryParams = extractQueryParametersFromPath(route.path);
  const seenQueryNames = new Set(queryParams.map((q) => q.name));

  // 3. Locate Handler Source Code
  const snippet = findHandlerCodeSnippet(route, fileSources);
  const handlerCode = snippet ? snippet.code : '';

  // 4. Query Parameters from Handler Code
  if (handlerCode) {
    const handlerQueryParams = extractQueryParametersFromHandler(handlerCode);
    for (const q of handlerQueryParams) {
      if (!seenQueryNames.has(q.name)) {
        seenQueryNames.add(q.name);
        queryParams.push(q);
      }
    }
  }

  // 5. Request Body Parameters (Methods that accept payload: POST, PUT, PATCH, DELETE, ANY)
  const bodyParams: ApiParameter[] = [];
  const methodUpper = (route.method || 'GET').toUpperCase() as HttpMethod;
  const supportsBody = methodUpper === 'POST' || methodUpper === 'PUT' || methodUpper === 'PATCH' || methodUpper === 'DELETE' || methodUpper === 'ANY';

  if (supportsBody && handlerCode) {
    const extracted = extractBodyParametersFromHandler(handlerCode);
    bodyParams.push(...extracted);
  }

  return [...pathParams, ...queryParams, ...bodyParams];
}
