/**
 * Domain models for API routes and supported framework definitions.
 * Formulates the data contract for future AST parsers and scanners.
 */

export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'OPTIONS'
  | 'HEAD';

export type ApiFramework =
  | 'express'
  | 'next'
  | 'fastify'
  | 'nestjs';

export interface RouteLocation {
  filePath: string;
  line: number;
  column: number;
}

export interface ApiRoute {
  /** HTTP verb (e.g. GET, POST) */
  method: HttpMethod;
  /** Normalized URL route path (e.g. /api/v1/users/:id) */
  path: string;
  /** Absolute or workspace-relative path to source file */
  filePath: string;
  /** 1-based line number of the route definition */
  line: number;
  /** 1-based column number */
  column: number;
  /** Framework defining the route (e.g. express, next) */
  framework: ApiFramework;
  /** Optional handler function or controller name */
  handlerName?: string;
  /** Optional group or module categorization */
  module?: string;
}
