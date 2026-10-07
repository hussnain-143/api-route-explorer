import * as path from 'path';
import { ApiRoute, HttpMethod } from '../models/route';
import { RouteAnalysisResult } from '../analysis/routeAnalyzer';
import {
  OpenApiDocument,
  OpenApiGenerationOptions,
  OpenApiGenerationResult,
  OpenApiOperation,
  OpenApiPathItem,
  OpenApiRouteDeclarationMetadata,
  OpenApiSupportedMethod,
  OpenApiTag,
} from './openApiTypes';
import {
  buildPathParameters,
  convertRouteToOpenApiPath,
  extractResourceTag,
  generateOperationId,
} from './openApiPathBuilder';
import { getRouteKey } from '../analysis/routeRelationshipAnalyzer';

const SUPPORTED_HTTP_METHODS: OpenApiSupportedMethod[] = [
  'get',
  'post',
  'put',
  'delete',
  'patch',
  'head',
  'options',
];

/**
 * Normalizes a file path to workspace-relative path to prevent leaking
 * absolute machine paths (e.g. `/Users/username/...`) in public API specifications.
 */
export function getSafeRelativePath(
  filePath: string,
  workspaceRoot?: string
): string {
  if (!filePath) {
    return '';
  }
  const normalized = filePath.replace(/\\/g, '/');
  if (workspaceRoot) {
    const normRoot = workspaceRoot.replace(/\\/g, '/').replace(/\/+$/, '');
    if (normalized.startsWith(normRoot + '/')) {
      return normalized.slice(normRoot.length + 1);
    }
  }

  // Remove common prefix directories if outside explicit workspace root
  const parts = normalized.split('/').filter(Boolean);
  const srcIndex = parts.findIndex((p) =>
    ['src', 'app', 'pages', 'modules', 'routes', 'api', 'controllers'].includes(p.toLowerCase())
  );
  if (srcIndex >= 0) {
    return parts.slice(srcIndex).join('/');
  }

  return path.basename(filePath);
}

/**
 * Generates an OpenAPI 3.0.3 specification document from analyzed API routes.
 *
 * @param routes Discovered API routes.
 * @param analysis Optional RouteAnalysisResult for middleware, health, and relationship data.
 * @param options Generation configuration options.
 * @returns Complete OpenAPI 3.0.3 document and summary statistics.
 */
export function generateOpenApiDocument(
  routes: ApiRoute[],
  analysis?: RouteAnalysisResult,
  options: OpenApiGenerationOptions = {}
): OpenApiGenerationResult {
  const title = options.title || 'API Route Explorer API';
  const version = options.version || '1.0.0';
  const description =
    options.description ||
    'OpenAPI 3.0.3 specification generated from static API route discovery.';
  const includeSourceMetadata = options.includeSourceMetadata !== false;
  const expandWildcards = options.expandWildcardMethods !== false;

  const usedOperationIds = new Set<string>();
  const collectedTags = new Map<string, OpenApiTag>();

  let totalOperations = 0;
  let duplicateCollisions = 0;
  let pathParametersExtracted = 0;

  // Intermediate grouping: openApiPath -> map of method -> ApiRoute[]
  interface PathGroupEntry {
    openApiPath: string;
    pathParameters: string[];
    methodMap: Map<HttpMethod, ApiRoute[]>;
  }

  const pathGroups = new Map<string, PathGroupEntry>();

  for (const route of routes) {
    const { openApiPath, pathParameters } = convertRouteToOpenApiPath(route.path);
    let entry = pathGroups.get(openApiPath);
    if (!entry) {
      entry = {
        openApiPath,
        pathParameters,
        methodMap: new Map(),
      };
      pathGroups.set(openApiPath, entry);
    }

    const currentList = entry.methodMap.get(route.method) || [];
    currentList.push(route);
    entry.methodMap.set(route.method, currentList);
  }

  // Sort paths deterministically (alphabetically)
  const sortedPathKeys = Array.from(pathGroups.keys()).sort((a, b) => a.localeCompare(b));
  const openApiPaths: Record<string, OpenApiPathItem> = {};

  for (const pathKey of sortedPathKeys) {
    const group = pathGroups.get(pathKey)!;
    const pathItem: OpenApiPathItem = {};
    const pathParams = buildPathParameters(group.pathParameters);
    pathParametersExtracted += pathParams.length;

    // Collect tags for this path
    const tag = extractResourceTag(pathKey);
    if (!collectedTags.has(tag)) {
      collectedTags.set(tag, {
        name: tag,
        description: `Operations related to ${tag}`,
      });
    }

    // Process explicit HTTP methods first
    const processedMethods = new Set<string>();

    for (const openApiMethod of SUPPORTED_HTTP_METHODS) {
      const uppercaseMethod = openApiMethod.toUpperCase() as HttpMethod;
      const matchingRoutes = group.methodMap.get(uppercaseMethod);

      if (matchingRoutes && matchingRoutes.length > 0) {
        processedMethods.add(openApiMethod);
        const primaryRoute = matchingRoutes[0];
        const isDuplicate = matchingRoutes.length > 1;
        if (isDuplicate) {
          duplicateCollisions += matchingRoutes.length - 1;
        }

        const opId = generateOperationId(openApiMethod, pathKey, usedOperationIds);
        const operation = buildOperation(
          openApiMethod,
          pathKey,
          primaryRoute,
          matchingRoutes,
          opId,
          tag,
          pathParams,
          analysis,
          options,
          includeSourceMetadata
        );

        pathItem[openApiMethod] = operation;
        totalOperations++;
      }
    }

    // Handle `ANY` method (wildcard routes from Next.js Pages router or Fastify `all`)
    const anyRoutes = group.methodMap.get('ANY');
    if (anyRoutes && anyRoutes.length > 0) {
      const primaryAnyRoute = anyRoutes[0];
      const wildcardTargets: OpenApiSupportedMethod[] = expandWildcards
        ? ['get', 'post', 'put', 'delete', 'patch']
        : ['get'];

      for (const targetMethod of wildcardTargets) {
        // Do not overwrite explicitly defined HTTP methods with the wildcard handler
        if (!processedMethods.has(targetMethod)) {
          const opId = generateOperationId(targetMethod, pathKey, usedOperationIds);
          const operation = buildOperation(
            targetMethod,
            pathKey,
            primaryAnyRoute,
            anyRoutes,
            opId,
            tag,
            pathParams,
            analysis,
            options,
            includeSourceMetadata,
            true // isWildcardHandler
          );

          pathItem[targetMethod] = operation;
          totalOperations++;
          processedMethods.add(targetMethod);
        }
      }
    }

    openApiPaths[pathKey] = pathItem;
  }

  // Sorted tags list
  const sortedTags = Array.from(collectedTags.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const document: OpenApiDocument = {
    openapi: '3.0.3',
    info: {
      title,
      version,
      description,
    },
    paths: openApiPaths,
    tags: sortedTags,
  };

  if (options.baseUrl) {
    document.servers = [
      {
        url: options.baseUrl,
        description: 'Server URL',
      },
    ];
  }

  if (includeSourceMetadata) {
    document['x-api-route-explorer'] = {
      generatorVersion: '1.2.0',
      totalRoutes: routes.length,
      totalPaths: sortedPathKeys.length,
    };
  }

  return {
    document,
    stats: {
      totalPaths: sortedPathKeys.length,
      totalOperations,
      duplicateCollisions,
      pathParametersExtracted,
    },
  };
}

/**
 * Builds a single OpenAPI operation object.
 */
function buildOperation(
  method: OpenApiSupportedMethod,
  openApiPath: string,
  primaryRoute: ApiRoute,
  allMatchingRoutes: ApiRoute[],
  operationId: string,
  tag: string,
  pathParameters: ReturnType<typeof buildPathParameters>,
  analysis: RouteAnalysisResult | undefined,
  options: OpenApiGenerationOptions,
  includeSourceMetadata: boolean,
  isWildcardHandler: boolean = false
): OpenApiOperation {
  const summaryPrefix = isWildcardHandler
    ? `${method.toUpperCase()} (ANY wildcard handler)`
    : `${method.toUpperCase()} ${openApiPath}`;

  const operation: OpenApiOperation = {
    operationId,
    summary: summaryPrefix,
    tags: [tag],
    parameters: pathParameters.length > 0 ? pathParameters : undefined,
    responses: buildDefaultResponses(method),
  };

  if (isWildcardHandler) {
    operation.description = `Handled by wildcard route: ${primaryRoute.path}`;
  }

  // Build minimal safe RequestBody for POST, PUT, PATCH
  if (method === 'post' || method === 'put' || method === 'patch') {
    operation.requestBody = {
      description: 'Request payload',
      required: false,
      content: {
        'application/json': {
          schema: {
            type: 'object',
          },
        },
      },
    };
  }

  if (includeSourceMetadata) {
    const relSource = getSafeRelativePath(primaryRoute.filePath, options.workspaceRoot);
    const relKey = getRouteKey(primaryRoute);
    const relationship = analysis?.relationships.get(relKey);

    const declarations: OpenApiRouteDeclarationMetadata[] = allMatchingRoutes.map((r) => ({
      framework: r.framework,
      filePath: getSafeRelativePath(r.filePath, options.workspaceRoot),
      line: r.line + 1,
      column: r.column,
      handlerName: r.handlerName,
      health: analysis?.relationships.get(getRouteKey(r))?.health,
      middleware: analysis?.relationships.get(getRouteKey(r))?.middleware?.map((m) => m.name),
    }));

    operation['x-api-route-explorer'] = {
      framework: primaryRoute.framework,
      sourceFile: relSource,
      sourceLine: primaryRoute.line + 1,
      sourceColumn: primaryRoute.column,
      handlerName: primaryRoute.handlerName,
      health: relationship?.health,
      middleware: relationship?.middleware?.map((m) => m.name),
      isDuplicate: allMatchingRoutes.length > 1,
      duplicateCount: allMatchingRoutes.length > 1 ? allMatchingRoutes.length : undefined,
      declarations: allMatchingRoutes.length > 1 ? declarations : undefined,
    };
  }

  return operation;
}

/**
 * Constructs standard default OpenAPI responses depending on HTTP method.
 */
function buildDefaultResponses(
  method: OpenApiSupportedMethod
): Record<string, { description: string }> {
  switch (method) {
    case 'post':
      return {
        '201': { description: 'Resource created successfully' },
        '400': { description: 'Bad request' },
      };
    case 'delete':
      return {
        '204': { description: 'Resource deleted successfully' },
        '404': { description: 'Resource not found' },
      };
    case 'get':
      return {
        '200': { description: 'Successful response' },
        '404': { description: 'Resource not found' },
      };
    case 'put':
    case 'patch':
      return {
        '200': { description: 'Resource updated successfully' },
        '400': { description: 'Bad request' },
        '404': { description: 'Resource not found' },
      };
    default:
      return {
        '200': { description: 'Successful response' },
      };
  }
}
