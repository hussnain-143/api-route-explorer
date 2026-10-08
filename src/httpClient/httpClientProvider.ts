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

  // 1. Separate query parameters if already present in route path (safely distinguishing from optional :param?)
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

  const queryParams: HttpClientKeyValue[] = [];
  if (rawQueryString) {
    const pairs = rawQueryString.split('&');
    pairs.forEach((pair, idx) => {
      const [k, v] = pair.split('=');
      if (k && k.trim()) {
        queryParams.push({
          id: `q_init_${idx}`,
          key: decodeURIComponent(k.trim()),
          value: v ? decodeURIComponent(v.trim()) : '',
          enabled: true,
        });
      }
    });
  }

  // 2. Extract path parameters and assign safe initial placeholders and values
  let idCounter = 0;
  const sampleIds = ['123', '456', '789', '101', '202'];

  const pathParams = conversion.pathParameters.map((name) => {
    const lower = name.toLowerCase();
    let placeholder = '123';
    let initialValue = '123';

    if (lower === 'id' || lower.endsWith('id') || lower.endsWith('_id')) {
      initialValue = sampleIds[idCounter % sampleIds.length];
      placeholder = initialValue;
      idCounter++;
    } else if (lower.includes('slug')) {
      initialValue = 'sample-slug';
      placeholder = 'sample-slug';
    } else if (lower.includes('name')) {
      initialValue = 'sample-name';
      placeholder = 'sample-name';
    } else if (lower.includes('email')) {
      initialValue = 'user@example.com';
      placeholder = 'user@example.com';
    } else if (lower.includes('date')) {
      initialValue = '2026-01-01';
      placeholder = '2026-01-01';
    } else if (lower.includes('status')) {
      initialValue = 'active';
      placeholder = 'active';
    } else if (lower.includes('type')) {
      initialValue = 'default';
      placeholder = 'default';
    } else if (lower.includes('provider')) {
      initialValue = 'google';
      placeholder = 'google';
    } else if (lower.includes('category')) {
      initialValue = 'sample-category';
      placeholder = 'sample-category';
    } else if (lower.includes('token') || lower.includes('code')) {
      initialValue = 'ABC123';
      placeholder = 'ABC123';
    } else {
      initialValue = '123';
      placeholder = '123';
    }

    const isOptional = rawPathOnly.includes(`:${name}?`);

    return {
      name,
      value: '',
      placeholder,
      isOptional,
    };
  });

  const urlTemplate = resolveFullUrl(baseUrl, openApiPath);

  // 3. Compose initial fullUrl (template + query params)
  let fullUrl = urlTemplate;

  const queryStr = queryParams
    .filter((q) => q.enabled && q.key)
    .map((q) => `${encodeURIComponent(q.key)}=${encodeURIComponent(q.value)}`)
    .join('&');
  if (queryStr) {
    fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryStr;
  }

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
