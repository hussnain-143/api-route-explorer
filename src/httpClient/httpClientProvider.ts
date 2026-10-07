import * as vscode from 'vscode';
import { ApiRoute, HttpMethod } from '../models/route';
import { convertRouteToOpenApiPath } from '../openapi/openApiPathBuilder';
import { getRelativeFilePath } from '../providers/routeTreeProvider';
import { getResolvedBaseUrl, resolveFullUrl } from '../utils/routeFormatters';
import { HttpClientPanel } from './httpClientPanel';
import {
  HttpClientInitialState,
  HttpClientKeyValue,
  HttpClientMethod,
  HTTP_CLIENT_METHODS,
} from './httpClientTypes';

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

/**
 * Builds the initial state for the HTTP Client based on an ApiRoute and workspace configuration.
 */
export function buildInitialStateForRoute(
  route: ApiRoute,
  customBaseUrl?: string
): HttpClientInitialState {
  const baseUrl = getResolvedBaseUrl(customBaseUrl);
  const conversion = convertRouteToOpenApiPath(route.path);
  const openApiPath = conversion.openApiPath;
  const method = normalizeHttpClientMethod(route.method);

  const fullUrl = resolveFullUrl(baseUrl, openApiPath);

  const pathParams = conversion.pathParameters.map((name) => ({
    name,
    value: '',
  }));

  const queryParams: HttpClientKeyValue[] = [];

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

  const body = method === 'POST' || method === 'PUT' || method === 'PATCH'
    ? '{\n  \n}'
    : '';

  return {
    routePath: route.path,
    openApiPath,
    method,
    baseUrl,
    fullUrl,
    pathParams,
    queryParams,
    headers,
    body,
    framework: route.framework,
    filePath: getRelativeFilePath(route.filePath),
    line: route.line,
  };
}

/**
 * Opens or reveals the HTTP Client Webview for the given ApiRoute.
 */
export function openHttpClientForRoute(
  extensionUri: vscode.Uri,
  route: ApiRoute,
  customBaseUrl?: string
): HttpClientPanel {
  const initialState = buildInitialStateForRoute(route, customBaseUrl);
  return HttpClientPanel.createOrShow(extensionUri, initialState);
}
