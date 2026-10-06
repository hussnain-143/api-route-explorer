/**
 * Domain model for API routes and supported framework definitions.
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

export interface ApiRoute {
  method: HttpMethod;
  path: string;
  filePath: string;
  line: number;
  column: number;
  framework: ApiFramework;
  handlerName?: string;
  module?: string;
}
