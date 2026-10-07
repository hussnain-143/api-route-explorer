import * as crypto from 'crypto';
import * as vscode from 'vscode';
import {
  isWebviewToHostMessage,
  WebviewToHostMessage,
} from './httpClientMessages';
import {
  buildCurlFromConfig,
  HttpRequestService,
} from './httpRequestService';
import {
  HttpClientInitialState,
  HttpRequestConfig,
} from './httpClientTypes';

/**
 * Manages the HTTP Client Webview panel lifecycle, HTML generation,
 * strict Content Security Policy, and message coordination.
 */
export class HttpClientPanel {
  public static currentPanel: HttpClientPanel | undefined;
  public static readonly viewType = 'apiRouteExplorer.httpClientPanel';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private readonly _requestService: HttpRequestService;
  private _initialState: HttpClientInitialState;

  /**
   * Creates or reveals the HTTP Client panel.
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    initialState: HttpClientInitialState
  ): HttpClientPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.ViewColumn.Beside
      : vscode.ViewColumn.One;

    // If an existing panel is active, reveal it and update state
    if (HttpClientPanel.currentPanel) {
      HttpClientPanel.currentPanel._panel.reveal(column);
      HttpClientPanel.currentPanel.updateRoute(initialState);
      return HttpClientPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      HttpClientPanel.viewType,
      `HTTP: ${initialState.method} ${initialState.openApiPath}`,
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri],
      }
    );

    HttpClientPanel.currentPanel = new HttpClientPanel(
      panel,
      extensionUri,
      initialState
    );
    return HttpClientPanel.currentPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    initialState: HttpClientInitialState
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._initialState = initialState;
    this._requestService = new HttpRequestService();

    // Set webview HTML with CSP and nonce
    this._panel.webview.html = this.getHtmlForWebview(this._panel.webview);

    // Handle messages received from the Webview
    this._panel.webview.onDidReceiveMessage(
      async (message: unknown) => {
        await this.handleWebviewMessage(message);
      },
      null,
      this._disposables
    );

    // Clean up when panel is closed
    this._panel.onDidDispose(
      () => this.dispose(),
      null,
      this._disposables
    );
  }

  /**
   * Updates the panel with a newly selected route.
   */
  public updateRoute(state: HttpClientInitialState): void {
    this._initialState = state;
    this._panel.title = `HTTP: ${state.method} ${state.openApiPath}`;
    this._panel.webview.postMessage({
      type: 'init',
      payload: this._initialState,
    });
  }

  /**
   * Handles messages sent from the untrusted Webview UI.
   */
  private async handleWebviewMessage(rawMessage: unknown): Promise<void> {
    if (!isWebviewToHostMessage(rawMessage)) {
      return;
    }

    const message: WebviewToHostMessage = rawMessage;

    switch (message.type) {
      case 'ready': {
        this._panel.webview.postMessage({
          type: 'init',
          payload: this._initialState,
        });
        break;
      }

      case 'sendRequest': {
        await this.executeRequest(message.payload);
        break;
      }

      case 'copyCurl': {
        const curlCmd = buildCurlFromConfig(message.payload);
        await vscode.env.clipboard.writeText(curlCmd);
        vscode.window.showInformationMessage('cURL command copied to clipboard.');
        break;
      }

      case 'resetRequest': {
        this._panel.webview.postMessage({
          type: 'init',
          payload: this._initialState,
        });
        break;
      }
    }
  }

  /**
   * Executes HTTP request through HttpRequestService in Extension Host.
   */
  private async executeRequest(config: HttpRequestConfig): Promise<void> {
    this._panel.webview.postMessage({ type: 'requestStart' });

    const result = await this._requestService.execute(config);

    if (result.ok) {
      this._panel.webview.postMessage({
        type: 'response',
        payload: result.data,
      });
    } else {
      this._panel.webview.postMessage({
        type: 'error',
        payload: {
          message: result.error,
          code: result.code,
        },
      });
    }
  }

  public dispose(): void {
    HttpClientPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const item = this._disposables.pop();
      if (item) {
        item.dispose();
      }
    }
  }

  /**
   * Generates HTML content with strict Content Security Policy, VS Code theme integration,
   * and responsive UI components.
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = crypto.randomBytes(16).toString('base64');
    const cspSource = webview.cspSource;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${cspSource};">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HTTP Client</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --input-bg: var(--vscode-input-background);
      --input-fg: var(--vscode-input-foreground);
      --input-border: var(--vscode-input-border, rgba(128, 128, 128, 0.3));
      --btn-bg: var(--vscode-button-background);
      --btn-fg: var(--vscode-button-foreground);
      --btn-hover: var(--vscode-button-hoverBackground);
      --btn-sec-bg: var(--vscode-button-secondaryBackground, #3a3d41);
      --btn-sec-fg: var(--vscode-button-secondaryForeground, #ffffff);
      --btn-sec-hover: var(--vscode-button-secondaryHoverBackground, #45494e);
      --panel-border: var(--vscode-panel-border, rgba(128, 128, 128, 0.2));
      --badge-bg: var(--vscode-badge-background, #4d4d4d);
      --badge-fg: var(--vscode-badge-foreground, #ffffff);
      --font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
      --code-font: var(--vscode-editor-font-family, Menlo, Monaco, "Courier New", monospace);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: var(--bg);
      color: var(--fg);
      font-family: var(--font-family);
      font-size: 13px;
      line-height: 1.4;
      padding: 16px;
      overflow-y: auto;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .header-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--panel-border);
      padding-bottom: 12px;
    }

    .header-title {
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .header-meta {
      font-size: 11px;
      opacity: 0.7;
    }

    .request-bar {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .method-select {
      background: var(--input-bg);
      color: var(--input-fg);
      border: 1px solid var(--input-border);
      padding: 7px 10px;
      border-radius: 4px;
      font-family: var(--code-font);
      font-weight: 700;
      font-size: 12px;
      cursor: pointer;
    }

    .method-select[data-method="GET"] { color: #10B981; }
    .method-select[data-method="POST"] { color: #3B82F6; }
    .method-select[data-method="PUT"] { color: #F59E0B; }
    .method-select[data-method="PATCH"] { color: #8B5CF6; }
    .method-select[data-method="DELETE"] { color: #EF4444; }
    .method-select[data-method="HEAD"],
    .method-select[data-method="OPTIONS"] { color: #9CA3AF; }

    .url-input {
      flex: 1;
      background: var(--input-bg);
      color: var(--input-fg);
      border: 1px solid var(--input-border);
      padding: 7px 10px;
      border-radius: 4px;
      font-family: var(--code-font);
      font-size: 12px;
    }

    .url-input:focus, .method-select:focus, textarea:focus, input[type="text"]:focus {
      outline: 1px solid var(--vscode-focusBorder, #007fd4);
    }

    .btn {
      padding: 7px 14px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.1s ease;
      white-space: nowrap;
    }

    .btn-primary {
      background: var(--btn-bg);
      color: var(--btn-fg);
    }
    .btn-primary:hover {
      background: var(--btn-hover);
    }

    .btn-secondary {
      background: var(--btn-sec-bg);
      color: var(--btn-sec-fg);
    }
    .btn-secondary:hover {
      background: var(--btn-sec-hover);
    }

    .btn-sm {
      padding: 4px 8px;
      font-size: 11px;
    }

    .tab-bar {
      display: flex;
      border-bottom: 1px solid var(--panel-border);
      gap: 4px;
    }

    .tab-btn {
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--fg);
      opacity: 0.7;
      padding: 6px 12px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .tab-btn:hover {
      opacity: 1;
    }

    .tab-btn.active {
      opacity: 1;
      border-bottom-color: var(--vscode-focusBorder, #007fd4);
      font-weight: 600;
    }

    .tab-badge {
      background: var(--badge-bg);
      color: var(--badge-fg);
      font-size: 10px;
      border-radius: 10px;
      padding: 1px 6px;
    }

    .tab-content {
      display: none;
      padding-top: 8px;
    }

    .tab-content.active {
      display: block;
    }

    .card {
      border: 1px solid var(--panel-border);
      border-radius: 6px;
      padding: 12px;
    }

    .param-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .param-label {
      width: 140px;
      font-family: var(--code-font);
      font-size: 12px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .param-input {
      flex: 1;
      background: var(--input-bg);
      color: var(--input-fg);
      border: 1px solid var(--input-border);
      padding: 5px 8px;
      border-radius: 4px;
      font-family: var(--code-font);
      font-size: 12px;
    }

    .table-container {
      width: 100%;
    }

    .kv-table {
      width: 100%;
      border-collapse: collapse;
    }

    .kv-table th {
      text-align: left;
      font-size: 11px;
      opacity: 0.7;
      padding: 6px 4px;
      border-bottom: 1px solid var(--panel-border);
    }

    .kv-table td {
      padding: 4px;
    }

    .kv-checkbox {
      cursor: pointer;
    }

    .kv-input {
      width: 100%;
      background: var(--input-bg);
      color: var(--input-fg);
      border: 1px solid var(--input-border);
      padding: 5px 8px;
      border-radius: 4px;
      font-family: var(--code-font);
      font-size: 12px;
    }

    .btn-icon {
      background: transparent;
      border: none;
      color: var(--fg);
      opacity: 0.6;
      cursor: pointer;
      padding: 4px 6px;
      border-radius: 4px;
    }

    .btn-icon:hover {
      opacity: 1;
      background: rgba(128, 128, 128, 0.15);
    }

    .body-editor {
      width: 100%;
      min-height: 180px;
      background: var(--input-bg);
      color: var(--input-fg);
      border: 1px solid var(--input-border);
      border-radius: 4px;
      padding: 8px;
      font-family: var(--code-font);
      font-size: 12px;
      resize: vertical;
      line-height: 1.4;
    }

    .body-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 6px;
      font-size: 11px;
      opacity: 0.7;
    }

    /* Response section */
    .response-section {
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .response-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--panel-border);
      padding-bottom: 8px;
    }

    .response-meta {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      font-weight: 700;
      font-size: 12px;
      padding: 3px 8px;
      border-radius: 4px;
      font-family: var(--code-font);
    }

    .status-2xx { background: rgba(16, 185, 129, 0.2); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.4); }
    .status-3xx { background: rgba(59, 130, 246, 0.2); color: #3B82F6; border: 1px solid rgba(59, 130, 246, 0.4); }
    .status-4xx { background: rgba(245, 158, 11, 0.2); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.4); }
    .status-5xx { background: rgba(239, 68, 68, 0.2); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.4); }

    .metric-item {
      font-size: 11px;
      opacity: 0.8;
      font-family: var(--code-font);
    }

    .response-body-pre {
      background: var(--input-bg);
      border: 1px solid var(--panel-border);
      border-radius: 4px;
      padding: 12px;
      max-height: 420px;
      overflow: auto;
      font-family: var(--code-font);
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .alert {
      padding: 12px;
      border-radius: 6px;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .alert-error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #EF4444;
    }

    .alert-info {
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.3);
      color: var(--fg);
      opacity: 0.85;
    }

    .spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: currentColor;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .empty-state {
      text-align: center;
      padding: 32px 16px;
      opacity: 0.6;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-bar">
      <div class="header-title">
        <span>⚡ API Route Explorer — HTTP Client</span>
      </div>
      <div class="header-meta" id="header-meta"></div>
    </div>

    <!-- Request Row -->
    <div class="request-bar">
      <select id="method-select" class="method-select" data-method="GET">
        <option value="GET">GET</option>
        <option value="POST">POST</option>
        <option value="PUT">PUT</option>
        <option value="PATCH">PATCH</option>
        <option value="DELETE">DELETE</option>
        <option value="HEAD">HEAD</option>
        <option value="OPTIONS">OPTIONS</option>
      </select>

      <input type="text" id="url-input" class="url-input" placeholder="http://localhost:3000/api/v1/..." />

      <button id="btn-send" class="btn btn-primary">
        <span id="send-spinner" style="display:none;" class="spinner"></span>
        <span id="send-label">Send</span>
      </button>

      <button id="btn-curl" class="btn btn-secondary" title="Copy request as cURL command">
        Copy cURL
      </button>

      <button id="btn-reset" class="btn btn-secondary" title="Reset to route default">
        Reset
      </button>
    </div>

    <!-- Client Error Display -->
    <div id="validation-error" class="alert alert-error" style="display: none;"></div>

    <!-- Request Sub-Tabs -->
    <div class="tab-bar">
      <button class="tab-btn active" data-tab="tab-params">
        Path Parameters <span id="badge-params" class="tab-badge" style="display:none;">0</span>
      </button>
      <button class="tab-btn" data-tab="tab-query">
        Query Params <span id="badge-query" class="tab-badge" style="display:none;">0</span>
      </button>
      <button class="tab-btn" data-tab="tab-headers">
        Headers <span id="badge-headers" class="tab-badge" style="display:none;">0</span>
      </button>
      <button class="tab-btn" data-tab="tab-body">
        Body
      </button>
    </div>

    <!-- Tab 1: Path Params -->
    <div id="tab-params" class="tab-content active">
      <div id="path-params-list" class="card">
        <div class="empty-state">No path parameters detected for this route.</div>
      </div>
    </div>

    <!-- Tab 2: Query Params -->
    <div id="tab-query" class="tab-content">
      <div class="card">
        <table class="kv-table">
          <thead>
            <tr>
              <th style="width: 28px;"></th>
              <th style="width: 40%;">Key</th>
              <th>Value</th>
              <th style="width: 32px;"></th>
            </tr>
          </thead>
          <tbody id="query-table-body"></tbody>
        </table>
        <div style="margin-top: 8px;">
          <button id="btn-add-query" class="btn btn-secondary btn-sm">+ Add Query Param</button>
        </div>
      </div>
    </div>

    <!-- Tab 3: Headers -->
    <div id="tab-headers" class="tab-content">
      <div class="card">
        <table class="kv-table">
          <thead>
            <tr>
              <th style="width: 28px;"></th>
              <th style="width: 40%;">Key</th>
              <th>Value</th>
              <th style="width: 32px;"></th>
            </tr>
          </thead>
          <tbody id="headers-table-body"></tbody>
        </table>
        <div style="margin-top: 8px;">
          <button id="btn-add-header" class="btn btn-secondary btn-sm">+ Add Header</button>
        </div>
      </div>
    </div>

    <!-- Tab 4: Body -->
    <div id="tab-body" class="tab-content">
      <div class="card">
        <textarea id="body-input" class="body-editor" placeholder='{\n  "key": "value"\n}'></textarea>
        <div class="body-toolbar">
          <span>JSON syntax is validated before sending.</span>
          <button id="btn-format-json" class="btn btn-secondary btn-sm">Format JSON</button>
        </div>
      </div>
    </div>

    <!-- Response Section -->
    <div class="response-section">
      <div class="response-header">
        <div style="font-weight: 600; font-size: 13px;">Response</div>
        <div id="response-meta" class="response-meta" style="display: none;">
          <span id="response-status" class="status-badge"></span>
          <span id="response-time" class="metric-item"></span>
          <span id="response-size" class="metric-item"></span>
          <button id="btn-copy-response" class="btn btn-secondary btn-sm">Copy Body</button>
        </div>
      </div>

      <div id="response-empty" class="card empty-state">
        Send a request to inspect response status, headers, and body.
      </div>

      <div id="response-error-card" class="alert alert-error" style="display: none;"></div>

      <div id="response-tabs" style="display: none;">
        <div class="tab-bar">
          <button class="tab-btn active" data-res-tab="res-tab-body">Body</button>
          <button class="tab-btn" data-res-tab="res-tab-headers">
            Headers <span id="res-badge-headers" class="tab-badge">0</span>
          </button>
        </div>

        <div id="res-tab-body" class="tab-content active" style="margin-top: 8px;">
          <pre id="response-body" class="response-body-pre"></pre>
        </div>

        <div id="res-tab-headers" class="tab-content" style="margin-top: 8px;">
          <div class="card">
            <table class="kv-table">
              <thead>
                <tr>
                  <th style="width: 35%;">Header</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody id="res-headers-table-body"></tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    // In-memory state
    let currentInitialState = null;
    let pathParams = [];
    let queryParams = [];
    let headers = [];
    let isSending = false;

    // Elements
    const methodSelect = document.getElementById('method-select');
    const urlInput = document.getElementById('url-input');
    const btnSend = document.getElementById('btn-send');
    const sendSpinner = document.getElementById('send-spinner');
    const sendLabel = document.getElementById('send-label');
    const btnCurl = document.getElementById('btn-curl');
    const btnReset = document.getElementById('btn-reset');
    const bodyInput = document.getElementById('body-input');
    const btnFormatJson = document.getElementById('btn-format-json');
    const validationError = document.getElementById('validation-error');
    const headerMeta = document.getElementById('header-meta');

    const pathParamsList = document.getElementById('path-params-list');
    const queryTableBody = document.getElementById('query-table-body');
    const headersTableBody = document.getElementById('headers-table-body');
    const btnAddQuery = document.getElementById('btn-add-query');
    const btnAddHeader = document.getElementById('btn-add-header');

    const badgeParams = document.getElementById('badge-params');
    const badgeQuery = document.getElementById('badge-query');
    const badgeHeaders = document.getElementById('badge-headers');

    const responseMeta = document.getElementById('response-meta');
    const responseStatus = document.getElementById('response-status');
    const responseTime = document.getElementById('response-time');
    const responseSize = document.getElementById('response-size');
    const responseEmpty = document.getElementById('response-empty');
    const responseErrorCard = document.getElementById('response-error-card');
    const responseTabs = document.getElementById('response-tabs');
    const responseBody = document.getElementById('response-body');
    const resHeadersTableBody = document.getElementById('res-headers-table-body');
    const resBadgeHeaders = document.getElementById('res-badge-headers');
    const btnCopyResponse = document.getElementById('btn-copy-response');

    // Method change style
    methodSelect.addEventListener('change', () => {
      methodSelect.setAttribute('data-method', methodSelect.value);
    });

    // Sub-tab switching (Request)
    document.querySelectorAll('.tab-btn[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn[data-tab]').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.tab-content:not([id^="res-tab"])').forEach((c) => c.classList.remove('active'));
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-tab');
        const target = document.getElementById(targetId);
        if (target) {
          target.classList.add('active');
        }
      });
    });

    // Sub-tab switching (Response)
    document.querySelectorAll('.tab-btn[data-res-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn[data-res-tab]').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('[id^="res-tab"]').forEach((c) => c.classList.remove('active'));
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-res-tab');
        const target = document.getElementById(targetId);
        if (target) {
          target.classList.add('active');
        }
      });
    });

    // Setup listeners
    btnAddQuery.addEventListener('click', () => {
      queryParams.push({ id: 'q_' + Date.now(), key: '', value: '', enabled: true });
      renderQueryParams();
    });

    btnAddHeader.addEventListener('click', () => {
      headers.push({ id: 'h_' + Date.now(), key: '', value: '', enabled: true });
      renderHeaders();
    });

    btnFormatJson.addEventListener('click', () => {
      const raw = bodyInput.value.trim();
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        bodyInput.value = JSON.stringify(parsed, null, 2);
        hideValidationError();
      } catch (e) {
        showValidationError('Request body contains invalid JSON.');
      }
    });

    btnCopyResponse.addEventListener('click', () => {
      const text = responseBody.textContent || '';
      navigator.clipboard.writeText(text);
    });

    btnSend.addEventListener('click', () => {
      if (isSending) return;
      sendRequest();
    });

    btnCurl.addEventListener('click', () => {
      const config = collectRequestConfig();
      vscode.postMessage({ type: 'copyCurl', payload: config });
    });

    btnReset.addEventListener('click', () => {
      vscode.postMessage({ type: 'resetRequest' });
    });

    function showValidationError(msg) {
      validationError.textContent = msg;
      validationError.style.display = 'block';
    }

    function hideValidationError() {
      validationError.style.display = 'none';
      validationError.textContent = '';
    }

    function collectRequestConfig() {
      // Gather path parameter values from DOM
      const currentPathParams = pathParams.map((p) => {
        const input = document.getElementById('param-input-' + p.name);
        return {
          name: p.name,
          value: input ? input.value : p.value,
        };
      });

      return {
        method: methodSelect.value,
        url: urlInput.value.trim(),
        pathParams: currentPathParams,
        queryParams: queryParams,
        headers: headers,
        body: bodyInput.value,
      };
    }

    function sendRequest() {
      hideValidationError();
      const config = collectRequestConfig();

      // Client-side quick check on JSON body
      const method = config.method;
      if (['POST', 'PUT', 'PATCH'].includes(method) && config.body.trim()) {
        try {
          JSON.parse(config.body.trim());
        } catch {
          showValidationError('Request body contains invalid JSON.');
          return;
        }
      }

      vscode.postMessage({ type: 'sendRequest', payload: config });
    }

    // Render path parameters
    function renderPathParams() {
      pathParamsList.innerHTML = '';
      if (!pathParams || pathParams.length === 0) {
        pathParamsList.innerHTML = '<div class="empty-state">No path parameters detected for this route.</div>';
        badgeParams.style.display = 'none';
        return;
      }

      badgeParams.textContent = pathParams.length;
      badgeParams.style.display = 'inline-block';

      pathParams.forEach((param) => {
        const row = document.createElement('div');
        row.className = 'param-row';

        const label = document.createElement('span');
        label.className = 'param-label';
        label.textContent = '{' + param.name + '}';
        label.title = param.name;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'param-input';
        input.id = 'param-input-' + param.name;
        input.value = param.value || '';
        input.placeholder = 'Value for ' + param.name + '...';

        input.addEventListener('input', () => {
          param.value = input.value;
          hideValidationError();
        });

        row.appendChild(label);
        row.appendChild(input);
        pathParamsList.appendChild(row);
      });
    }

    // Render Query parameters
    function renderQueryParams() {
      queryTableBody.innerHTML = '';
      const enabledCount = queryParams.filter((q) => q.enabled && q.key).length;
      if (enabledCount > 0) {
        badgeQuery.textContent = enabledCount;
        badgeQuery.style.display = 'inline-block';
      } else {
        badgeQuery.style.display = 'none';
      }

      queryParams.forEach((param, index) => {
        const tr = document.createElement('tr');

        // Checkbox
        const tdCheck = document.createElement('td');
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.className = 'kv-checkbox';
        check.checked = param.enabled;
        check.addEventListener('change', () => {
          param.enabled = check.checked;
          renderQueryParams();
        });
        tdCheck.appendChild(check);

        // Key
        const tdKey = document.createElement('td');
        const inputKey = document.createElement('input');
        inputKey.type = 'text';
        inputKey.className = 'kv-input';
        inputKey.value = param.key;
        inputKey.placeholder = 'Parameter name';
        inputKey.addEventListener('input', () => { param.key = inputKey.value; });
        tdKey.appendChild(inputKey);

        // Value
        const tdVal = document.createElement('td');
        const inputVal = document.createElement('input');
        inputVal.type = 'text';
        inputVal.className = 'kv-input';
        inputVal.value = param.value;
        inputVal.placeholder = 'Value';
        inputVal.addEventListener('input', () => { param.value = inputVal.value; });
        tdVal.appendChild(inputVal);

        // Delete
        const tdDel = document.createElement('td');
        const btnDel = document.createElement('button');
        btnDel.className = 'btn-icon';
        btnDel.textContent = '✕';
        btnDel.title = 'Remove';
        btnDel.addEventListener('click', () => {
          queryParams.splice(index, 1);
          renderQueryParams();
        });
        tdDel.appendChild(btnDel);

        tr.appendChild(tdCheck);
        tr.appendChild(tdKey);
        tr.appendChild(tdVal);
        tr.appendChild(tdDel);
        queryTableBody.appendChild(tr);
      });
    }

    // Render Headers
    function renderHeaders() {
      headersTableBody.innerHTML = '';
      const enabledCount = headers.filter((h) => h.enabled && h.key).length;
      if (enabledCount > 0) {
        badgeHeaders.textContent = enabledCount;
        badgeHeaders.style.display = 'inline-block';
      } else {
        badgeHeaders.style.display = 'none';
      }

      headers.forEach((h, index) => {
        const tr = document.createElement('tr');

        // Checkbox
        const tdCheck = document.createElement('td');
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.className = 'kv-checkbox';
        check.checked = h.enabled;
        check.addEventListener('change', () => {
          h.enabled = check.checked;
          renderHeaders();
        });
        tdCheck.appendChild(check);

        // Key
        const tdKey = document.createElement('td');
        const inputKey = document.createElement('input');
        inputKey.type = 'text';
        inputKey.className = 'kv-input';
        inputKey.value = h.key;
        inputKey.placeholder = 'Header name';
        inputKey.addEventListener('input', () => { h.key = inputKey.value; });
        tdKey.appendChild(inputKey);

        // Value
        const tdVal = document.createElement('td');
        const inputVal = document.createElement('input');
        inputVal.type = 'text';
        inputVal.className = 'kv-input';
        inputVal.value = h.value;
        inputVal.placeholder = 'Value';
        inputVal.addEventListener('input', () => { h.value = inputVal.value; });
        tdVal.appendChild(inputVal);

        // Delete
        const tdDel = document.createElement('td');
        const btnDel = document.createElement('button');
        btnDel.className = 'btn-icon';
        btnDel.textContent = '✕';
        btnDel.title = 'Remove';
        btnDel.addEventListener('click', () => {
          headers.splice(index, 1);
          renderHeaders();
        });
        tdDel.appendChild(btnDel);

        tr.appendChild(tdCheck);
        tr.appendChild(tdKey);
        tr.appendChild(tdVal);
        tr.appendChild(tdDel);
        headersTableBody.appendChild(tr);
      });
    }

    // Handle messages from host
    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (!msg || !msg.type) return;

      switch (msg.type) {
        case 'init': {
          currentInitialState = msg.payload;
          methodSelect.value = currentInitialState.method;
          methodSelect.setAttribute('data-method', currentInitialState.method);
          urlInput.value = currentInitialState.fullUrl;
          bodyInput.value = currentInitialState.body || '';

          pathParams = (currentInitialState.pathParams || []).map((p) => ({ ...p }));
          queryParams = (currentInitialState.queryParams || []).map((q) => ({ ...q }));
          headers = (currentInitialState.headers || []).map((h) => ({ ...h }));

          renderPathParams();
          renderQueryParams();
          renderHeaders();
          hideValidationError();

          headerMeta.textContent = currentInitialState.framework
            ? currentInitialState.framework.toUpperCase() + (currentInitialState.filePath ? ' • ' + currentInitialState.filePath : '')
            : '';

          // Reset response area
          responseEmpty.style.display = 'block';
          responseTabs.style.display = 'none';
          responseMeta.style.display = 'none';
          responseErrorCard.style.display = 'none';
          break;
        }

        case 'requestStart': {
          isSending = true;
          sendSpinner.style.display = 'inline-block';
          sendLabel.textContent = 'Sending...';
          btnSend.disabled = true;
          responseEmpty.style.display = 'none';
          responseErrorCard.style.display = 'none';
          responseTabs.style.display = 'none';
          responseMeta.style.display = 'none';
          break;
        }

        case 'response': {
          isSending = false;
          sendSpinner.style.display = 'none';
          sendLabel.textContent = 'Send';
          btnSend.disabled = false;

          const data = msg.payload;
          responseEmpty.style.display = 'none';
          responseErrorCard.style.display = 'none';
          responseTabs.style.display = 'block';
          responseMeta.style.display = 'flex';

          // Status badge
          responseStatus.textContent = data.status + ' ' + (data.statusText || '');
          responseStatus.className = 'status-badge';
          if (data.status >= 200 && data.status < 300) {
            responseStatus.classList.add('status-2xx');
          } else if (data.status >= 300 && data.status < 400) {
            responseStatus.classList.add('status-3xx');
          } else if (data.status >= 400 && data.status < 500) {
            responseStatus.classList.add('status-4xx');
          } else {
            responseStatus.classList.add('status-5xx');
          }

          // Timing and size
          responseTime.textContent = data.timeMs + ' ms';
          const sizeKb = (data.sizeBytes / 1024).toFixed(1);
          responseSize.textContent = data.sizeBytes > 1024 ? sizeKb + ' KB' : data.sizeBytes + ' B';

          // Body
          responseBody.textContent = data.body || '(empty response body)';

          // Headers
          resHeadersTableBody.innerHTML = '';
          const headerEntries = Object.entries(data.headers || {});
          resBadgeHeaders.textContent = headerEntries.length;
          headerEntries.forEach(([key, val]) => {
            const tr = document.createElement('tr');
            const tdKey = document.createElement('td');
            tdKey.textContent = key;
            tdKey.style.fontFamily = 'var(--code-font)';
            tdKey.style.fontWeight = '600';
            const tdVal = document.createElement('td');
            tdVal.textContent = val;
            tdVal.style.fontFamily = 'var(--code-font)';
            tr.appendChild(tdKey);
            tr.appendChild(tdVal);
            resHeadersTableBody.appendChild(tr);
          });
          break;
        }

        case 'error': {
          isSending = false;
          sendSpinner.style.display = 'none';
          sendLabel.textContent = 'Send';
          btnSend.disabled = false;

          responseEmpty.style.display = 'none';
          responseTabs.style.display = 'none';
          responseMeta.style.display = 'none';

          responseErrorCard.style.display = 'block';
          responseErrorCard.innerHTML = '<strong>Request Failed</strong><div>' + (msg.payload.message || 'Unknown network error') + '</div>';
          break;
        }
      }
    });

    // Notify extension host that UI is ready
    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  }
}
