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
  | 'HEAD'
  | 'ANY';

import type { ApiFramework } from './framework';
export type { ApiFramework };

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
