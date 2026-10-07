import { OpenApiParameter } from './openApiTypes';

/**
 * Result of converting a framework route path into an OpenAPI 3.0 path.
 */
export interface OpenApiPathConversionResult {
  openApiPath: string;
  pathParameters: string[];
}

/**
 * Converts framework-specific route paths (Express, Next.js, Fastify, NestJS)
 * into standard OpenAPI 3.0 path syntax with `{param}` placeholders.
 *
 * Examples:
 * - Express: `/users/:id` -> `/users/{id}`
 * - Next.js: `/users/[id]` -> `/users/{id}`
 * - Catch-all: `/docs/[...slug]` -> `/docs/{slug}`
 * - Optional catch-all: `/shop/[[...category]]` -> `/shop/{category}`
 * - Wildcard: `/files/*` -> `/files/{wildcard}`
 *
 * @param rawPath Raw path from ApiRoute.
 * @returns Cleaned OpenAPI path and extracted parameter names.
 */
export function convertRouteToOpenApiPath(rawPath: string): OpenApiPathConversionResult {
  if (!rawPath || rawPath.trim() === '') {
    return { openApiPath: '/', pathParameters: [] };
  }

  let path = rawPath.trim();

  // Normalize backslashes and ensure leading slash
  path = path.replace(/\\/g, '/');
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }

  // Deduplicate consecutive slashes
  path = path.replace(/\/+/g, '/');

  // Strip Next.js route groups (e.g. `/(dashboard)/api` -> `/api`)
  path = path.replace(/\/\([^)]+\)/g, '');
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }

  const pathParameters: string[] = [];
  const usedParamNames = new Set<string>();

  const segments = path.split('/').filter(Boolean);
  const convertedSegments: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    let seg = segments[i];

    // 1. Next.js optional catch-all: `[[...slug]]`
    if (seg.startsWith('[[...') && seg.endsWith(']]')) {
      const paramName = sanitizeParameterName(seg.slice(5, -2)) || `param${i + 1}`;
      const uniqueName = disambiguateParamName(paramName, usedParamNames);
      pathParameters.push(uniqueName);
      convertedSegments.push(`{${uniqueName}}`);
      continue;
    }

    // 2. Next.js catch-all: `[...slug]`
    if (seg.startsWith('[...') && seg.endsWith(']')) {
      const paramName = sanitizeParameterName(seg.slice(4, -1)) || `param${i + 1}`;
      const uniqueName = disambiguateParamName(paramName, usedParamNames);
      pathParameters.push(uniqueName);
      convertedSegments.push(`{${uniqueName}}`);
      continue;
    }

    // 3. Next.js standard dynamic segment: `[id]`
    if (seg.startsWith('[') && seg.endsWith(']')) {
      const paramName = sanitizeParameterName(seg.slice(1, -1)) || `param${i + 1}`;
      const uniqueName = disambiguateParamName(paramName, usedParamNames);
      pathParameters.push(uniqueName);
      convertedSegments.push(`{${uniqueName}}`);
      continue;
    }

    // 4. Express / Fastify / NestJS colon parameter: `:id` or `:id*` or `:id+`
    if (seg.includes(':')) {
      // Handle potential prefix or suffix around colon parameter (e.g., `item-:id` or `:id.json`)
      seg = seg.replace(/:([a-zA-Z0-9_]+)[\*\+]?/g, (_match, name) => {
        const clean = sanitizeParameterName(name) || `param${i + 1}`;
        const uniqueName = disambiguateParamName(clean, usedParamNames);
        pathParameters.push(uniqueName);
        return `{${uniqueName}}`;
      });
      convertedSegments.push(seg);
      continue;
    }

    // 5. Raw wildcard `*` or `*slug`
    if (seg === '*' || seg.startsWith('*')) {
      const rawName = seg === '*' ? 'wildcard' : seg.slice(1);
      const paramName = sanitizeParameterName(rawName) || 'wildcard';
      const uniqueName = disambiguateParamName(paramName, usedParamNames);
      pathParameters.push(uniqueName);
      convertedSegments.push(`{${uniqueName}}`);
      continue;
    }

    convertedSegments.push(seg);
  }

  let openApiPath = `/${convertedSegments.join('/')}`;
  if (openApiPath.length > 1 && openApiPath.endsWith('/')) {
    openApiPath = openApiPath.slice(0, -1);
  }

  return { openApiPath, pathParameters };
}

/**
 * Sanitizes a parameter identifier to safe alphanumeric OpenAPI parameter name.
 */
function sanitizeParameterName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '');
}

/**
 * Ensures parameter names in the same path are unique to satisfy OpenAPI validation.
 */
function disambiguateParamName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  let index = 2;
  while (used.has(`${name}_${index}`)) {
    index++;
  }
  const disambiguated = `${name}_${index}`;
  used.add(disambiguated);
  return disambiguated;
}

/**
 * Builds OpenAPI parameter definitions for path parameters.
 */
export function buildPathParameters(paramNames: string[]): OpenApiParameter[] {
  return paramNames.map((name) => ({
    name,
    in: 'path',
    required: true,
    description: `Path parameter: ${name}`,
    schema: {
      type: 'string',
    },
  }));
}

/**
 * Extracts a meaningful tag from a route path for API grouping.
 * Skips generic prefix segments like `api`, `v1`, `v2`, etc.
 *
 * Example: `/api/v1/users/{id}` -> `users`
 * Example: `/auth/login` -> `auth`
 * Example: `/health` -> `health`
 */
export function extractResourceTag(openApiPath: string): string {
  const segments = openApiPath.split('/').filter(Boolean);
  if (segments.length === 0) {
    return 'default';
  }

  const ignorePrefixes = new Set([
    'api',
    'v1',
    'v2',
    'v3',
    'v4',
    'v5',
    'rest',
    'app',
  ]);

  for (const seg of segments) {
    const clean = seg.replace(/[{}]/g, '').toLowerCase();
    if (!ignorePrefixes.has(clean) && clean.length > 0) {
      return clean;
    }
  }

  const fallback = segments[0].replace(/[{}]/g, '').toLowerCase();
  return fallback || 'default';
}

/**
 * Generates a deterministic, unique camelCase operation ID from HTTP method and path.
 *
 * Examples:
 * - `get` + `/users` -> `getUsers`
 * - `get` + `/users/{id}` -> `getUsersById`
 * - `post` + `/api/v1/auth/login` -> `postApiV1AuthLogin`
 * - `delete` + `/items/{itemId}` -> `deleteItemsByItemId`
 *
 * @param method Lowercase HTTP method (`get`, `post`, etc.).
 * @param openApiPath Standardized OpenAPI path.
 * @param usedOperationIds Set of already used IDs in the document for collision avoidance.
 */
export function generateOperationId(
  method: string,
  openApiPath: string,
  usedOperationIds: Set<string>
): string {
  const segments = openApiPath.split('/').filter(Boolean);
  const parts: string[] = [method.toLowerCase()];

  for (const seg of segments) {
    if (seg.startsWith('{') && seg.endsWith('}')) {
      const paramName = seg.slice(1, -1);
      const capitalized = capitalize(paramName);
      parts.push(`By${capitalized}`);
    } else {
      const sanitized = seg.replace(/[^a-zA-Z0-9_]/g, '');
      if (sanitized) {
        parts.push(capitalize(sanitized));
      }
    }
  }

  let baseId = parts.join('');
  if (baseId === method.toLowerCase()) {
    baseId = `${method.toLowerCase()}Root`;
  }

  // Ensure deterministic uniqueness
  if (!usedOperationIds.has(baseId)) {
    usedOperationIds.add(baseId);
    return baseId;
  }

  let counter = 2;
  while (usedOperationIds.has(`${baseId}_${counter}`)) {
    counter++;
  }
  const uniqueId = `${baseId}_${counter}`;
  usedOperationIds.add(uniqueId);
  return uniqueId;
}

function capitalize(s: string): string {
  if (!s) {
    return '';
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}
