import {
  HttpClientInitialState,
  HttpClientMethod,
  HttpErrorData,
  HttpRequestConfig,
  HttpResponseData,
  HTTP_CLIENT_METHODS,
} from './httpClientTypes';

/**
 * Message protocol between Webview and Extension Host.
 */

export type WebviewToHostMessage =
  | { type: 'ready' }
  | { type: 'sendRequest'; payload: HttpRequestConfig }
  | { type: 'cancelRequest' }
  | { type: 'copyCurl'; payload: HttpRequestConfig }
  | { type: 'copyText'; payload: { text: string; label: string } }
  | { type: 'resetRequest' };

export type HostToWebviewMessage =
  | { type: 'init'; payload: HttpClientInitialState }
  | { type: 'requestStart' }
  | { type: 'response'; payload: HttpResponseData }
  | { type: 'error'; payload: HttpErrorData }
  | { type: 'info'; payload: { message: string } };

/**
 * Strict validator for messages received from the untrusted Webview UI.
 */
export function isWebviewToHostMessage(data: unknown): data is WebviewToHostMessage {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const obj = data as Record<string, unknown>;
  const type = obj.type;

  if (type === 'ready' || type === 'resetRequest' || type === 'cancelRequest') {
    return true;
  }

  if (type === 'sendRequest' || type === 'copyCurl') {
    return isValidHttpRequestConfig(obj.payload);
  }

  if (type === 'copyText') {
    if (!obj.payload || typeof obj.payload !== 'object') {
      return false;
    }
    const p = obj.payload as Record<string, unknown>;
    return typeof p.text === 'string' && typeof p.label === 'string';
  }

  return false;
}

/**
 * Validates the structure of HttpRequestConfig received from Webview.
 */
export function isValidHttpRequestConfig(payload: unknown): payload is HttpRequestConfig {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const p = payload as Record<string, unknown>;

  if (
    typeof p.method !== 'string' ||
    !HTTP_CLIENT_METHODS.includes(p.method as HttpClientMethod)
  ) {
    return false;
  }

  if (typeof p.url !== 'string') {
    return false;
  }

  if (!Array.isArray(p.pathParams)) {
    return false;
  }

  for (const item of p.pathParams) {
    if (!item || typeof item !== 'object') {
      return false;
    }
    const param = item as Record<string, unknown>;
    if (typeof param.name !== 'string' || typeof param.value !== 'string') {
      return false;
    }
  }

  if (!Array.isArray(p.queryParams)) {
    return false;
  }

  for (const item of p.queryParams) {
    if (!item || typeof item !== 'object') {
      return false;
    }
    const qp = item as Record<string, unknown>;
    if (
      typeof qp.id !== 'string' ||
      typeof qp.key !== 'string' ||
      typeof qp.value !== 'string' ||
      typeof qp.enabled !== 'boolean'
    ) {
      return false;
    }
  }

  if (!Array.isArray(p.headers)) {
    return false;
  }

  for (const item of p.headers) {
    if (!item || typeof item !== 'object') {
      return false;
    }
    const h = item as Record<string, unknown>;
    if (
      typeof h.id !== 'string' ||
      typeof h.key !== 'string' ||
      typeof h.value !== 'string' ||
      typeof h.enabled !== 'boolean'
    ) {
      return false;
    }
  }

  if (typeof p.body !== 'string') {
    return false;
  }

  if (p.timeoutMs !== undefined && typeof p.timeoutMs !== 'number') {
    return false;
  }

  return true;
}
