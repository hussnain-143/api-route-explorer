import * as vscode from 'vscode';
import { ApiRoute, HttpMethod } from '../models/route';
import { convertRouteToOpenApiPath } from '../openapi/openApiPathBuilder';
import { getRelativeFilePath } from '../providers/routeTreeProvider';
import { getResolvedBaseUrl, resolveFullUrl } from '../utils/routeFormatters';
import { HttpClientPanel } from './httpClientPanel';
import {
  HttpClientBodyParam,
  HttpClientInitialState,
  HttpClientKeyValue,
  HttpClientMethod,
  HTTP_CLIENT_METHODS,
} from './httpClientTypes';
import { extractRouteParameters } from '../analysis/parameterExtractor';
import { buildJsonObjectFromParams } from '../analysis/parameterSuggester';

/**
 * Normalizes an ApiRoute HttpMethod to a supported HttpClientMethod.
 * 'ANY' is defaulted to 'GET'.
 */
export function normalizeHttpClientMethod(method: HttpMethod): HttpClientMethod {
  if (method === 'ANY') {
    return 'GET';
  }
  if (HTTP_CLIENT_METHODS.includes(method as HttpClientMethod)) {
    return method as HttpClientMethod;
  }
  return 'GET';
}

let sharedVariables: Record<string, string> = {
  baseUrl: 'http://localhost:3000',
  token: '',
};

let workspaceStateStore: vscode.Memento | undefined;
const VARIABLES_STORAGE_KEY = 'apiRouteExplorer.httpClient.variables';

/**
 * Initializes persistent storage for HTTP Client variables using workspaceState.
 */
export function initHttpClientState(workspaceState: vscode.Memento): void {
  workspaceStateStore = workspaceState;
  const saved = workspaceState.get<Record<string, string>>(VARIABLES_STORAGE_KEY);
  if (saved && typeof saved === 'object') {
    sharedVariables = { ...sharedVariables, ...saved };
  }
}

export function getSharedVariables(): Record<string, string> {
  return { ...sharedVariables };
}

export function setSharedVariables(vars: Record<string, string>): void {
  sharedVariables = { ...sharedVariables, ...vars };
  if (workspaceStateStore) {
    // Persist non-empty variables safely in workspace state
    void workspaceStateStore.update(VARIABLES_STORAGE_KEY, sharedVariables);
  }
}

/**
 * Builds the initial state for the HTTP Client based on an ApiRoute and workspace configuration.
 */
export function buildInitialStateForRoute(
  route: ApiRoute,
  customBaseUrl?: string,
  fileSources?: Map<string, string> | Record<string, string>
): HttpClientInitialState {
  const baseUrl = getResolvedBaseUrl(customBaseUrl);

  // 1. Separate path and OpenAPI conversion
  const rawPath = route.path || '';
  let rawPathOnly = rawPath;
  let rawQueryString = '';

  const queryIdx = rawPath.search(/\?[^/:]*=/);
  if (queryIdx !== -1) {
    rawPathOnly = rawPath.slice(0, queryIdx);
    rawQueryString = rawPath.slice(queryIdx + 1);
  }

  const conversion = convertRouteToOpenApiPath(rawPathOnly);
  const openApiPath = conversion.openApiPath;
  const method = normalizeHttpClientMethod(route.method);

  // 2. Extract normalized parameters using static analysis engine
  const allParams = extractRouteParameters(route, fileSources);

  // 3. Populate Query Parameters
  const queryParams: HttpClientKeyValue[] = [];
  let qCounter = 0;

  // Include query params detected from route path or handler
  const detectedQueryParams = allParams.filter((p) => p.location === 'query');
  if (detectedQueryParams.length > 0) {
    for (const q of detectedQueryParams) {
      queryParams.push({
        id: `q_init_${qCounter++}`,
        key: q.name,
        value: q.value !== undefined ? String(q.value) : (q.defaultValue !== undefined ? String(q.defaultValue) : ''),
        enabled: true,
      });
    }
  } else if (rawQueryString) {
    const pairs = rawQueryString.split('&');
    pairs.forEach((pair) => {
      const [k, v] = pair.split('=');
      if (k && k.trim()) {
        queryParams.push({
          id: `q_init_${qCounter++}`,
          key: decodeURIComponent(k.trim()),
          value: v ? decodeURIComponent(v.trim()) : '',
          enabled: true,
        });
      }
    });
  }

  // 4. Populate Path Parameters
  const detectedPathParams = allParams.filter((p) => p.location === 'path');
  const pathParams = conversion.pathParameters.map((name) => {
    const detected = detectedPathParams.find((p) => p.name.toLowerCase() === name.toLowerCase());
    const placeholder = detected?.placeholder || '123';
    const isOptional = detected?.isOptional || rawPathOnly.includes(`:${name}?`);

    return {
      name,
      value: '',
      placeholder,
      isOptional,
    };
  });

  const urlTemplate = resolveFullUrl(baseUrl, openApiPath);

  // 5. Compose initial fullUrl (template + query params)
  let fullUrl = urlTemplate;
  const queryStr = queryParams
    .filter((q) => q.enabled && q.key)
    .map((q) => `${encodeURIComponent(q.key)}=${encodeURIComponent(q.value)}`)
    .join('&');
  if (queryStr) {
    fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryStr;
  }

  // 6. Headers
  const headers: HttpClientKeyValue[] = [];
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    headers.push({
      id: 'h_content_type',
      key: 'Content-Type',
      value: 'application/json',
      enabled: true,
    });
  }
  headers.push({
    id: 'h_accept',
    key: 'Accept',
    value: 'application/json',
    enabled: true,
  });

  // 7. Request Body & Body Parameters
  const detectedBodyParams = allParams.filter((p) => p.location === 'body');
  let body = '';
  const bodyParams: HttpClientBodyParam[] = [];

  if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
    if (detectedBodyParams.length > 0) {
      const jsonObject = buildJsonObjectFromParams(detectedBodyParams);
      body = JSON.stringify(jsonObject, null, 2);
      for (const p of detectedBodyParams) {
        bodyParams.push({
          name: p.name,
          value: p.value !== undefined ? p.value : p.defaultValue,
          type: typeof p.type === 'string' ? p.type : undefined,
          required: p.required,
          placeholder: p.placeholder,
          isSensitive: p.isSensitive,
        });
      }
    } else {
      body = method === 'DELETE' ? '' : '{\n  \n}';
    }
  }

  const relFilePath = getRelativeFilePath(route.filePath);

  return {
    routePath: route.path,
    openApiPath,
    method,
    baseUrl,
    fullUrl,
    urlTemplate,
    pathParams,
    queryParams,
    headers,
    body,
    bodyParams,
    detectedParameters: allParams,
    framework: route.framework,
    filePath: relFilePath,
    line: route.line,
    routeContext: {
      method: route.method,
      path: route.path,
      sourceFile: relFilePath,
      sourceLine: route.line + 1,
      sourceColumn: route.column + 1,
      framework: route.framework,
      handlerName: route.handlerName,
    },
    variables: { ...sharedVariables, baseUrl },
  };
}

/**
 * Opens or reveals the HTTP Client Webview for the given ApiRoute.
 */
export function openHttpClientForRoute(
  extensionUri: vscode.Uri,
  route: ApiRoute,
  customBaseUrl?: string,
  fileSources?: Map<string, string> | Record<string, string>
): HttpClientPanel {
  const initialState = buildInitialStateForRoute(route, customBaseUrl, fileSources);
  return HttpClientPanel.createOrShow(extensionUri, initialState);
}
