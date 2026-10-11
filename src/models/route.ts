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
import type { ApiParameter } from './parameter';

export type { ApiFramework };
export type { ApiParameter };

export interface ApiRoute {
  method: HttpMethod;
  path: string;
  filePath: string;
  line: number;
  column: number;
  framework: ApiFramework;
  handlerName?: string;
  module?: string;
  routerVar?: string;
  parameters?: ApiParameter[];
}
