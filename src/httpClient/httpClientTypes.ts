/**
 * Data contracts and models for the API Route Explorer HTTP Client.
 */

export type HttpClientMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS';

export const HTTP_CLIENT_METHODS: readonly HttpClientMethod[] = [
  'GET',
  'POST',
  'PUT' ,
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
] as const;

export interface HttpClientPathParam {
  name: string;
  value: string;
}

export interface HttpClientKeyValue {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface HttpRequestConfig {
  method: HttpClientMethod;
  url: string;
  pathParams: HttpClientPathParam[];
  queryParams: HttpClientKeyValue[];
  headers: HttpClientKeyValue[];
  body: string;
  timeoutMs?: number;
}

export interface ResolvedHttpRequest {
  method: HttpClientMethod;
  resolvedUrl: string;
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
}

export interface HttpResponseData {
  status: number;
  statusText: string;
  timeMs: number;
  sizeBytes: number;
  headers: Record<string, string>;
  body: string;
  isJson: boolean;
}

export interface HttpClientRouteContext {
  method: HttpClientMethod | 'ANY';
  path: string;
  sourceFile?: string;
  sourceLine?: number;
  sourceColumn?: number;
  framework?: string;
  handlerName?: string;
}

export interface HttpErrorData {
  message: string;
  code?: string;
  details?: string;
  url?: string;
  possibleCauses?: string[];
}

export interface HttpClientInitialState {
  routePath: string;
  openApiPath: string;
  method: HttpClientMethod;
  baseUrl: string;
  fullUrl: string;
  pathParams: HttpClientPathParam[];
  queryParams: HttpClientKeyValue[];
  headers: HttpClientKeyValue[];
  body: string;
  framework?: string;
  filePath?: string;
  line?: number;
  routeContext?: HttpClientRouteContext;
}
