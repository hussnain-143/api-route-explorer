import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { collapseRepeatingSegments } from '../analysis/prefixResolver';
import {
  HttpClientMethod,
  HttpRequestConfig,
  HttpResponseData,
  ResolvedHttpRequest,
} from './httpClientTypes';

export interface ValidationSuccess {
  ok: true;
  resolved: ResolvedHttpRequest;
}

export interface ValidationFailure {
  ok: false;
  error: string;
  code?: string;
  possibleCauses?: string[];
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

export interface ExecutionSuccess {
  ok: true;
  data: HttpResponseData;
}

export interface ExecutionFailure {
  ok: false;
  error: string;
  code?: string;
  url?: string;
  possibleCauses?: string[];
}

export type ExecutionResult = ExecutionSuccess | ExecutionFailure;

const DEFAULT_TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 5;

/**
 * Validates an HttpRequestConfig and produces a fully resolved request
 * with substituted path parameters, query string, normalized headers, and validated body.
 */
export function validateAndResolveRequest(config: HttpRequestConfig): ValidationResult {
  // 1. Basic URL validation
  if (!config.url || typeof config.url !== 'string' || !config.url.trim()) {
    return {
      ok: false,
      error: 'Invalid request URL.',
      code: 'ERR_INVALID_URL',
      possibleCauses: ['The URL field cannot be empty', 'Specify a valid HTTP or HTTPS endpoint'],
    };
  }

  let urlString = config.url.trim();
  if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
    return {
      ok: false,
      error: 'Invalid request URL. Scheme must be http:// or https://.',
      code: 'ERR_INVALID_URL',
      possibleCauses: ['Add http:// or https:// to the start of the URL'],
    };
  }

  // 2. Path parameter substitution and validation
  // 2. Path parameter substitution and validation ({param} and :param)
  const placeholderRegex = /\{([^}]+)\}/g;
  const colonParamRegex = /(?<![a-zA-Z0-9_]):([a-zA-Z_][a-zA-Z0-9_]*)/g;
  const pathParamMap = new Map<string, string>();
  for (const p of config.pathParams) {
    pathParamMap.set(p.name, p.value);
  }

  let missingParam: string | undefined;

  // Substitute {param}
  urlString = urlString.replace(placeholderRegex, (match, paramName) => {
    const val = pathParamMap.get(paramName);
    if (val === undefined || val.trim() === '') {
      const optParam = config.pathParams.find((p) => p.name === paramName);
      if (optParam?.isOptional) {
        return '';
      }
      if (!missingParam) {
        missingParam = paramName;
      }
      return match;
    }
    return encodeURIComponent(val.trim());
  });

  // Substitute :param
  urlString = urlString.replace(colonParamRegex, (match, paramName) => {
    const val = pathParamMap.get(paramName);
    if (val === undefined || val.trim() === '') {
      const optParam = config.pathParams.find((p) => p.name === paramName);
      if (optParam?.isOptional) {
        return '';
      }
      if (!missingParam) {
        missingParam = paramName;
      }
      return match;
    }
    return encodeURIComponent(val.trim());
  });

  if (missingParam) {
    return {
      ok: false,
      error: `Required path parameter "${missingParam}" is missing.`,
      code: 'MISSING_PATH_PARAM',
      possibleCauses: [
        `Specify a value for "${missingParam}" in the Path Parameters section`,
        'All path parameter placeholders must be replaced before sending',
      ],
    };
  }

  // Double check if any placeholder was missed
  const remainingPlaceholder = urlString.match(placeholderRegex);
  if (remainingPlaceholder && remainingPlaceholder.length > 0) {
    const name = remainingPlaceholder[0].slice(1, -1);
    return {
      ok: false,
      error: `Required path parameter "${name}" is missing.`,
      code: 'MISSING_PATH_PARAM',
      possibleCauses: [
        `Specify a value for "${name}" in the Path Parameters section`,
        'All path parameter placeholders must be replaced before sending',
      ],
    };
  }

  const remainingColon = urlString.match(colonParamRegex);
  if (remainingColon && remainingColon.length > 0) {
    const name = remainingColon[0].slice(1);
    return {
      ok: false,
      error: `Required path parameter "${name}" is missing.`,
      code: 'MISSING_PATH_PARAM',
      possibleCauses: [
        `Specify a value for "${name}" in the Path Parameters section`,
        'All path parameter placeholders must be replaced before sending',
      ],
    };
  }

  // 3. Parse URL object
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    return {
      ok: false,
      error: 'Invalid request URL.',
      code: 'ERR_INVALID_URL',
      possibleCauses: ['Ensure the URL is well-formed with valid hostname and path'],
    };
  }

  // Normalize path segments to collapse any repeating blocks (e.g. /api/v1/api/v1)
  const segments = parsedUrl.pathname.split('/').filter(Boolean);
  const collapsed = collapseRepeatingSegments(segments);
  const originalEndedWithSlash = config.url.split('?')[0].endsWith('/');
  const trailingSlash = originalEndedWithSlash && collapsed.length > 0 ? '/' : '';
  parsedUrl.pathname = (collapsed.length > 0 ? '/' + collapsed.join('/') : '/') + trailingSlash;

  // 4. Query parameter processing
  if (config.queryParams && Array.isArray(config.queryParams)) {
    for (const qp of config.queryParams) {
      if (qp.enabled && qp.key && qp.key.trim() !== '') {
        parsedUrl.searchParams.set(qp.key.trim(), qp.value);
      }
    }
  }

  // 5. Headers normalization
  const headers: Record<string, string> = {};
  if (config.headers && Array.isArray(config.headers)) {
    for (const h of config.headers) {
      if (h.enabled && h.key && h.key.trim() !== '') {
        headers[h.key.trim()] = h.value;
      }
    }
  }

  // 6. Request Body validation
  let bodyToSend: string | undefined = undefined;
  const method = config.method;
  const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';

  if (hasBody && config.body && config.body.trim() !== '') {
    const rawBody = config.body.trim();

    // Check if Content-Type is JSON or not set
    const headerKeys = Object.keys(headers);
    const contentTypeKey = headerKeys.find((k) => k.toLowerCase() === 'content-type');
    const isJsonHeader = contentTypeKey ? headers[contentTypeKey].toLowerCase().includes('application/json') : true;

    if (isJsonHeader) {
      try {
        JSON.parse(rawBody);
      } catch {
        return {
          ok: false,
          error: 'Request body contains invalid JSON.',
          code: 'MALFORMED_JSON',
          possibleCauses: [
            'Check for syntax errors, missing quotes, or trailing commas',
            'Use the "Format JSON" button to validate and beautify JSON',
          ],
        };
      }
      if (!contentTypeKey) {
        headers['Content-Type'] = 'application/json';
      }
    }

    bodyToSend = rawBody;
  }

  const timeoutMs = config.timeoutMs && config.timeoutMs > 0 ? config.timeoutMs : DEFAULT_TIMEOUT_MS;

  return {
    ok: true,
    resolved: {
      method,
      resolvedUrl: parsedUrl.toString(),
      headers,
      body: bodyToSend,
      timeoutMs,
    },
  };
}

/**
 * Builds a reproducible cURL command string based on current request configuration.
 */
export function buildCurlFromConfig(config: HttpRequestConfig): string {
  const validation = validateAndResolveRequest(config);
  if (!validation.ok) {
    // If validation fails (e.g. missing param), build best-effort cURL
    let fallbackUrl = config.url;
    if (config.pathParams) {
      for (const p of config.pathParams) {
        if (p.value) {
          fallbackUrl = fallbackUrl.replace(new RegExp(`\\{${p.name}\\}`, 'g'), encodeURIComponent(p.value));
        }
      }
    }
    if (config.queryParams && config.queryParams.length > 0) {
      const activeQueries = config.queryParams
        .filter((q) => q.enabled && q.key)
        .map((q) => `${encodeURIComponent(q.key)}=${encodeURIComponent(q.value)}`)
        .join('&');
      if (activeQueries) {
        fallbackUrl += (fallbackUrl.includes('?') ? '&' : '?') + activeQueries;
      }
    }
    let cmd = `curl -X ${config.method} "${fallbackUrl}"`;
    if (config.headers) {
      for (const h of config.headers) {
        if (h.enabled && h.key) {
          cmd += ` \\\n  -H "${h.key}: ${h.value}"`;
        }
      }
    }
    if (config.body && config.body.trim()) {
      cmd += ` \\\n  -d '${config.body.replace(/'/g, "'\\''")}'`;
    }
    return cmd;
  }

  const { resolved } = validation;
  const method = resolved.method;
  const url = resolved.resolvedUrl;

  if (method === 'HEAD') {
    let headCmd = `curl -I "${url}"`;
    for (const [k, v] of Object.entries(resolved.headers)) {
      headCmd += ` \\\n  -H "${k}: ${v}"`;
    }
    return headCmd;
  }

  let cmd = `curl -X ${method} "${url}"`;
  for (const [k, v] of Object.entries(resolved.headers)) {
    cmd += ` \\\n  -H "${k}: ${v}"`;
  }

  if (resolved.body) {
    cmd += ` \\\n  -d '${resolved.body.replace(/'/g, "'\\''")}'`;
  }

  return cmd;
}

/**
 * Service that executes HTTP requests via Node core modules.
 */
export class HttpRequestService {
  private readonly _activeRequests: Map<string, { req: http.ClientRequest; res?: http.IncomingMessage }> = new Map();

  /**
   * Cancels any active in-flight request for the given identifier.
   */
  public cancel(requestId: string = 'default'): boolean {
    const active = this._activeRequests.get(requestId);
    if (!active) {
      return false;
    }
    this._activeRequests.delete(requestId);
    try {
      active.req.destroy(new Error('Request was cancelled by user.'));
      if (active.res) {
        active.res.destroy();
      }
    } catch {
      // Ignore cleanup errors on cancelled request
    }
    return true;
  }

  /**
   * Executes an HTTP request based on the provided configuration.
   */
  public async execute(config: HttpRequestConfig, requestId: string = 'default'): Promise<ExecutionResult> {
    // Cancel any previous request running under the same id
    this.cancel(requestId);

    const validation = validateAndResolveRequest(config);
    if (!validation.ok) {
      return {
        ok: false,
        error: validation.error,
        code: validation.code,
        url: config.url,
        possibleCauses: validation.possibleCauses,
      };
    }

    return this.executeResolved(validation.resolved, 0, requestId);
  }

  /**
   * Internal execution with redirect handling and execution timing.
   */
  private async executeResolved(
    req: ResolvedHttpRequest,
    redirectCount: number,
    requestId: string = 'default'
  ): Promise<ExecutionResult> {
    if (redirectCount > MAX_REDIRECTS) {
      return {
        ok: false,
        error: 'Too many redirects.',
        code: 'MAX_REDIRECTS',
        url: req.resolvedUrl,
        possibleCauses: [
          'Endpoint is stuck in a circular redirect loop',
          `Exceeded maximum limit of ${MAX_REDIRECTS} redirects`,
        ],
      };
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(req.resolvedUrl);
    } catch {
      return {
        ok: false,
        error: 'Invalid request URL.',
        code: 'ERR_INVALID_URL',
        url: req.resolvedUrl,
        possibleCauses: ['Ensure the URL is well-formed with valid protocol and host'],
      };
    }

    const isHttps = parsedUrl.protocol === 'https:';
    const requester = isHttps ? https : http;

    const headersToSend = { ...req.headers };
    if (req.body && !Object.keys(headersToSend).some((k) => k.toLowerCase() === 'content-length')) {
      headersToSend['Content-Length'] = Buffer.byteLength(req.body, 'utf8').toString();
    }

    const startTime = Date.now();

    return new Promise<ExecutionResult>((resolve) => {
      let isSettled = false;

      const cleanup = (): void => {
        this._activeRequests.delete(requestId);
      };

      const safeResolve = (result: ExecutionResult): void => {
        if (!isSettled) {
          isSettled = true;
          cleanup();
          resolve(result);
        }
      };

      const requestOptions: http.RequestOptions = {
        method: req.method,
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        headers: headersToSend,
        timeout: req.timeoutMs,
      };

      const clientReq = requester.request(requestOptions, (res) => {
        const active = this._activeRequests.get(requestId);
        if (active) {
          active.res = res;
        }

        const statusCode = res.statusCode ?? 0;
        const statusMessage = res.statusMessage ?? (http.STATUS_CODES[statusCode] || '');

        // Redirect handling (301, 302, 303, 307, 308)
        if (
          [301, 302, 303, 307, 308].includes(statusCode) &&
          res.headers.location
        ) {
          res.resume(); // consume response data to free up memory
          const redirectUrl = new URL(res.headers.location, parsedUrl).toString();

          let redirectMethod = req.method;
          let redirectBody = req.body;
          if (statusCode === 303 || ((statusCode === 301 || statusCode === 302) && req.method === 'POST')) {
            redirectMethod = 'GET';
            redirectBody = undefined;
          }

          const redirectReq: ResolvedHttpRequest = {
            method: redirectMethod,
            resolvedUrl: redirectUrl,
            headers: req.headers,
            body: redirectBody,
            timeoutMs: req.timeoutMs,
          };

          cleanup();
          this.executeResolved(redirectReq, redirectCount + 1, requestId).then(safeResolve);
          return;
        }

        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        res.on('end', () => {
          const duration = Math.round(Date.now() - startTime);
          const rawBuffer = Buffer.concat(chunks);
          const rawBody = rawBuffer.toString('utf8');
          const sizeBytes = rawBuffer.length;

          const responseHeaders: Record<string, string> = {};
          for (const [key, value] of Object.entries(res.headers)) {
            if (value !== undefined) {
              responseHeaders[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
            }
          }

          // Check if response is JSON
          const contentType = responseHeaders['content-type'] || '';
          let isJson = contentType.includes('application/json');
          let formattedBody = rawBody;

          if (rawBody.trim().startsWith('{') || rawBody.trim().startsWith('[')) {
            try {
              const parsed = JSON.parse(rawBody);
              formattedBody = JSON.stringify(parsed, null, 2);
              isJson = true;
            } catch {
              // Not valid JSON, keep rawBody
            }
          }

          safeResolve({
            ok: true,
            data: {
              status: statusCode,
              statusText: statusMessage,
              timeMs: duration,
              sizeBytes,
              headers: responseHeaders,
              body: formattedBody,
              isJson,
            },
          });
        });

        res.on('error', (err) => {
          safeResolve(this.mapError(err, req.resolvedUrl));
        });
      });

      this._activeRequests.set(requestId, { req: clientReq });

      clientReq.on('timeout', () => {
        clientReq.destroy();
        safeResolve({
          ok: false,
          error: 'Request timed out.',
          code: 'ETIMEDOUT',
          url: req.resolvedUrl,
          possibleCauses: [
            'Server took too long to respond',
            `Timeout limit of ${req.timeoutMs} ms was reached`,
            'Network delay or dropped connection',
          ],
        });
      });

      clientReq.on('error', (err: NodeJS.ErrnoException) => {
        safeResolve(this.mapError(err, req.resolvedUrl));
      });

      if (req.body) {
        clientReq.write(req.body, 'utf8');
      }

      clientReq.end();
    });
  }

  /**
   * Maps system/network errors to clear developer messages.
   */
  private mapError(err: NodeJS.ErrnoException, targetUrl?: string): ExecutionFailure {
    const code = err.code || '';
    if (code === 'ECONNREFUSED') {
      return {
        ok: false,
        error: 'Unable to connect to the API server.',
        code: 'ECONNREFUSED',
        url: targetUrl,
        possibleCauses: [
          'Backend is not running',
          'Incorrect host or port',
          'Server refused the connection',
        ],
      };
    }
    if (code === 'ETIMEDOUT' || err.message.includes('timed out')) {
      return {
        ok: false,
        error: `Request timed out connecting to: ${targetUrl || 'the server'}`,
        code: 'ETIMEDOUT',
        url: targetUrl,
        possibleCauses: [
          'Server took too long to respond',
          'Timeout limit was reached',
          'Network delay or dropped connection',
        ],
      };
    }
    if (code === 'ENOTFOUND') {
      let host = 'host';
      if (targetUrl) {
        try {
          host = new URL(targetUrl).hostname;
        } catch {
          host = targetUrl;
        }
      }
      return {
        ok: false,
        error: `Unable to resolve host: ${host}`,
        code: 'ENOTFOUND',
        url: targetUrl,
        possibleCauses: [
          'Backend hostname does not exist',
          'DNS lookup failed',
          'Typo in the hostname or domain',
        ],
      };
    }
    if (
      code === 'ABORT_ERR' ||
      code === 'ECONNABORTED' ||
      err.message.includes('cancelled') ||
      err.message.includes('aborted')
    ) {
      return {
        ok: false,
        error: 'Request was cancelled by user.',
        code: 'CANCELLED',
        url: targetUrl,
        possibleCauses: [
          'User cancelled the active request',
          'Underlying connection and socket were closed cleanly',
        ],
      };
    }
    if (code === 'ERR_INVALID_URL') {
      return {
        ok: false,
        error: 'Invalid request URL.',
        code: 'ERR_INVALID_URL',
        url: targetUrl,
        possibleCauses: [
          'Malformed URL structure',
          'Missing protocol (http:// or https://)',
          'Invalid characters in URL',
        ],
      };
    }

    return {
      ok: false,
      error: err.message || 'An error occurred during request execution.',
      code: code || 'REQUEST_FAILED',
      url: targetUrl,
      possibleCauses: ['Unexpected network or connection issue'],
    };
  }
}
