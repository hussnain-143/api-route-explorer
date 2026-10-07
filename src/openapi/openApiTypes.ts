import { ApiFramework, HttpMethod } from '../models/route';
import { RouteHealth } from '../analysis/analysisTypes';

/**
 * OpenAPI 3.0.3 Document Specification Types
 */

export interface OpenApiParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  description?: string;
  required: boolean;
  schema: OpenApiSchema;
  example?: unknown;
}

export interface OpenApiSchema {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  format?: string;
  description?: string;
  items?: OpenApiSchema;
  properties?: Record<string, OpenApiSchema>;
  required?: string[];
  default?: unknown;
  example?: unknown;
}

export interface OpenApiMediaType {
  schema?: OpenApiSchema;
  example?: unknown;
}

export interface OpenApiRequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, OpenApiMediaType>;
}

export interface OpenApiResponse {
  description: string;
  content?: Record<string, OpenApiMediaType>;
}

export interface OpenApiRouteDeclarationMetadata {
  framework: ApiFramework;
  filePath: string;
  line: number;
  column: number;
  handlerName?: string;
  health?: RouteHealth;
  middleware?: string[];
}

export interface OpenApiOperationExtensionMetadata {
  framework: ApiFramework;
  sourceFile: string;
  sourceLine: number;
  sourceColumn: number;
  handlerName?: string;
  health?: RouteHealth;
  middleware?: string[];
  isDuplicate?: boolean;
  duplicateCount?: number;
  declarations?: OpenApiRouteDeclarationMetadata[];
}

export interface OpenApiOperation {
  operationId: string;
  summary: string;
  description?: string;
  tags?: string[];
  parameters?: OpenApiParameter[];
  requestBody?: OpenApiRequestBody;
  responses: Record<string, OpenApiResponse>;
  deprecated?: boolean;
  'x-api-route-explorer'?: OpenApiOperationExtensionMetadata;
}

export type OpenApiSupportedMethod =
  | 'get'
  | 'post'
  | 'put'
  | 'delete'
  | 'patch'
  | 'head'
  | 'options';

export interface OpenApiPathItem {
  summary?: string;
  description?: string;
  get?: OpenApiOperation;
  post?: OpenApiOperation;
  put?: OpenApiOperation;
  delete?: OpenApiOperation;
  patch?: OpenApiOperation;
  head?: OpenApiOperation;
  options?: OpenApiOperation;
  parameters?: OpenApiParameter[];
}

export interface OpenApiTag {
  name: string;
  description?: string;
}

export interface OpenApiServer {
  url: string;
  description?: string;
}

export interface OpenApiInfo {
  title: string;
  version: string;
  description?: string;
  contact?: {
    name?: string;
    url?: string;
    email?: string;
  };
  license?: {
    name: string;
    url?: string;
  };
}

export interface OpenApiDocument {
  openapi: '3.0.3';
  info: OpenApiInfo;
  servers?: OpenApiServer[];
  tags?: OpenApiTag[];
  paths: Record<string, OpenApiPathItem>;
  components?: {
    schemas?: Record<string, OpenApiSchema>;
    securitySchemes?: Record<string, unknown>;
  };
  'x-api-route-explorer'?: {
    generatedAt?: string;
    generatorVersion: string;
    totalRoutes: number;
    totalPaths: number;
  };
}

/**
 * Generation options for OpenAPI 3.0.3 specification builder.
 */
export interface OpenApiGenerationOptions {
  title?: string;
  version?: string;
  description?: string;
  baseUrl?: string;
  includeSourceMetadata?: boolean;
  expandWildcardMethods?: boolean;
  workspaceRoot?: string;
}

/**
 * Statistics and results from OpenAPI document generation.
 */
export interface OpenApiGenerationResult {
  document: OpenApiDocument;
  stats: {
    totalPaths: number;
    totalOperations: number;
    duplicateCollisions: number;
    pathParametersExtracted: number;
  };
}
