import * as crypto from 'crypto';
import * as path from 'path';
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

      case 'cancelRequest': {
        this._requestService.cancel();
        break;
      }

      case 'copyCurl': {
        const curlCmd = buildCurlFromConfig(message.payload);
        await vscode.env.clipboard.writeText(curlCmd);
        vscode.window.showInformationMessage('cURL command copied to clipboard.');
        break;
      }

      case 'copyText': {
        await vscode.env.clipboard.writeText(message.payload.text);
        vscode.window.showInformationMessage(`${message.payload.label} copied to clipboard.`);
        break;
      }

      case 'resetRequest': {
        this._panel.webview.postMessage({
          type: 'init',
          payload: this._initialState,
        });
        break;
      }

      case 'openSource': {
        const { filePath, line } = message.payload;
        if (filePath) {
          try {
            let targetPath = filePath;
            if (!path.isAbsolute(targetPath)) {
              const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
              if (workspaceFolder) {
                targetPath = path.join(workspaceFolder.uri.fsPath, targetPath);
              }
            }
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(targetPath));
            const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
            if (line && line > 0) {
              const pos = new vscode.Position(line - 1, 0);
              editor.selection = new vscode.Selection(pos, pos);
              editor.revealRange(
                new vscode.Range(pos, pos),
                vscode.TextEditorRevealType.InCenter
              );
            }
          } catch {
            vscode.window.showErrorMessage(`Unable to open source file: ${filePath}`);
          }
        }
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
          url: result.url,
          possibleCauses: result.possibleCauses,
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
      max-width: 920px;
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

    .route-context-bar {
      background: var(--input-bg);
      border: 1px solid var(--panel-border);
      border-left: 3px solid var(--btn-bg);
      border-radius: 6px;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .route-context-top {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .route-context-badge {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 2px 6px;
      border-radius: 3px;
      background: var(--badge-bg);
      color: var(--badge-fg);
      letter-spacing: 0.5px;
    }

    .route-context-signature {
      font-family: var(--code-font);
      font-size: 13px;
      font-weight: 600;
      color: var(--fg);
    }

    .route-context-source {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--fg);
      opacity: 0.85;
    }

    .source-link-btn {
      background: transparent;
      border: none;
      color: var(--vscode-textLink-foreground, #3794ff);
      cursor: pointer;
      font-family: var(--code-font);
      font-size: 11px;
      text-decoration: underline;
      padding: 0;
    }

    .source-link-btn:hover {
      color: var(--vscode-textLink-activeForeground, #3794ff);
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

    .btn-cancel {
      background: #EF4444;
      color: #ffffff;
    }
    .btn-cancel:hover {
      background: #DC2626;
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

    .section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.8;
      margin-bottom: 8px;
    }

    .param-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .param-row:last-child {
      margin-bottom: 0;
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

    .param-input.invalid {
      border-color: #EF4444;
      outline: 1px solid #EF4444;
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

    .curl-preview {
      background: var(--input-bg);
      border: 1px solid var(--panel-border);
      border-radius: 4px;
      padding: 12px;
      font-family: var(--code-font);
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-all;
      color: var(--fg);
      max-height: 300px;
      overflow-y: auto;
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
      gap: 10px;
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

    .error-card {
      border: 1px solid rgba(239, 68, 68, 0.4);
      background: rgba(239, 68, 68, 0.08);
      border-radius: 6px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .error-card-title {
      font-size: 13px;
      font-weight: 700;
      color: #EF4444;
    }

    .error-card-url-title {
      font-size: 11px;
      opacity: 0.8;
      margin-top: 2px;
    }

    .error-card-url {
      font-family: var(--code-font);
      font-size: 12px;
      background: rgba(0, 0, 0, 0.2);
      padding: 5px 8px;
      border-radius: 4px;
      word-break: break-all;
    }

    .error-card-causes-title {
      font-size: 11px;
      font-weight: 600;
      opacity: 0.9;
      margin-top: 4px;
    }

    .error-card-causes {
      list-style-type: none;
      padding-left: 0;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .error-card-causes li {
      font-size: 12px;
      opacity: 0.85;
    }

    .error-card-code-wrap {
      margin-top: 4px;
      font-size: 11px;
      opacity: 0.8;
    }

    .error-card-code {
      font-family: var(--code-font);
      font-weight: 600;
      color: #EF4444;
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
      padding: 24px 16px;
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

    <!-- Route Context Banner -->
    <div class="route-context-bar" id="route-context-bar" style="display: none;">
      <div class="route-context-top">
        <span class="route-context-badge" id="route-context-badge">API</span>
        <span class="route-context-signature" id="route-context-signature"></span>
      </div>
      <div class="route-context-source" id="route-context-source">
        <span>Source:</span>
        <button type="button" class="source-link-btn" id="btn-jump-code" title="Jump to route definition in code"></button>
      </div>
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

      <input type="text" id="url-input" class="url-input" placeholder="http://localhost:5000/api/v1/..." />

      <button id="btn-copy-url" class="btn btn-secondary btn-sm" title="Copy Request URL">
        Copy URL
      </button>

      <button id="btn-send" class="btn btn-primary">
        <span id="send-spinner" style="display:none;" class="spinner"></span>
        <span id="send-label">Send</span>
      </button>

      <button id="btn-cancel" class="btn btn-cancel" style="display:none;" title="Cancel running request">
        Cancel Request
      </button>

      <button id="btn-reset" class="btn btn-secondary" title="Reset to route default">
        Reset
      </button>
    </div>

    <!-- Client Error Display -->
    <div id="validation-error" class="alert alert-error" style="display: none;"></div>

    <!-- Request Sub-Tabs: Params, Headers, Body, cURL -->
    <div class="tab-bar">
      <button class="tab-btn active" data-tab="tab-params">
        Params <span id="badge-params" class="tab-badge" style="display:none;">0</span>
      </button>
      <button class="tab-btn" data-tab="tab-headers">
        Headers <span id="badge-headers" class="tab-badge" style="display:none;">0</span>
      </button>
      <button class="tab-btn" data-tab="tab-body">
        Body
      </button>
      <button class="tab-btn" data-tab="tab-curl">
        cURL
      </button>
    </div>

    <!-- Tab 1: Params (Path Parameters + Query Parameters) -->
    <div id="tab-params" class="tab-content active">
      <div id="path-params-wrapper" style="margin-bottom: 14px;">
        <div class="section-title">Path Parameters</div>
        <div id="path-params-list" class="card">
          <div class="empty-state">No path parameters detected for this route.</div>
        </div>
      </div>

      <div class="section-title">Query Parameters</div>
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
          <button id="btn-add-query" class="btn btn-secondary btn-sm">+ Add Parameter</button>
        </div>
      </div>
    </div>

    <!-- Tab 2: Headers -->
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

    <!-- Tab 3: Body -->
    <div id="tab-body" class="tab-content">
      <div class="card">
        <textarea id="body-input" class="body-editor" placeholder='{\n  "key": "value"\n}'></textarea>
        <div class="body-toolbar">
          <span>JSON syntax is validated before sending.</span>
          <button id="btn-format-json" class="btn btn-secondary btn-sm">Format JSON</button>
        </div>
      </div>
    </div>

    <!-- Tab 4: cURL -->
    <div id="tab-curl" class="tab-content">
      <div class="card" style="display: flex; flex-direction: column; gap: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 11px; opacity: 0.7;">Reproducible command generated from current request settings</span>
          <button id="btn-copy-curl" class="btn btn-secondary btn-sm">Copy cURL</button>
        </div>
        <pre id="curl-preview" class="curl-preview"></pre>
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
          <button id="btn-copy-res-headers" class="btn btn-secondary btn-sm">Copy Headers</button>
        </div>
      </div>

      <div id="response-empty" class="card empty-state">
        Send a request to inspect response status, headers, and body.
      </div>

      <!-- Developer-facing Error Card -->
      <div id="response-error-card" class="error-card" style="display: none;"></div>

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
    let lastResponseHeaders = {};

    // Elements
    const methodSelect = document.getElementById('method-select');
    const urlInput = document.getElementById('url-input');
    const btnCopyUrl = document.getElementById('btn-copy-url');
    const btnSend = document.getElementById('btn-send');
    const btnCancel = document.getElementById('btn-cancel');
    const sendSpinner = document.getElementById('send-spinner');
    const sendLabel = document.getElementById('send-label');
    const btnReset = document.getElementById('btn-reset');
    const bodyInput = document.getElementById('body-input');
    const btnFormatJson = document.getElementById('btn-format-json');
    const validationError = document.getElementById('validation-error');
    const headerMeta = document.getElementById('header-meta');

    const routeContextBar = document.getElementById('route-context-bar');
    const routeContextBadge = document.getElementById('route-context-badge');
    const routeContextSignature = document.getElementById('route-context-signature');
    const routeContextSource = document.getElementById('route-context-source');
    const btnJumpCode = document.getElementById('btn-jump-code');

    const pathParamsWrapper = document.getElementById('path-params-wrapper');
    const pathParamsList = document.getElementById('path-params-list');
    const queryTableBody = document.getElementById('query-table-body');
    const headersTableBody = document.getElementById('headers-table-body');
    const btnAddQuery = document.getElementById('btn-add-query');
    const btnAddHeader = document.getElementById('btn-add-header');
    const curlPreview = document.getElementById('curl-preview');
    const btnCopyCurl = document.getElementById('btn-copy-curl');

    const badgeParams = document.getElementById('badge-params');
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
    const btnCopyResHeaders = document.getElementById('btn-copy-res-headers');

    // Method change style
    methodSelect.addEventListener('change', () => {
      methodSelect.setAttribute('data-method', methodSelect.value);
      updateCurlPreview();
    });

    urlInput.addEventListener('input', () => {
      hideValidationError();
      updateCurlPreview();
    });

    bodyInput.addEventListener('input', () => {
      updateCurlPreview();
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
        if (targetId === 'tab-curl') {
          updateCurlPreview();
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
      updateCurlPreview();
    });

    btnAddHeader.addEventListener('click', () => {
      headers.push({ id: 'h_' + Date.now(), key: '', value: '', enabled: true });
      renderHeaders();
      updateCurlPreview();
    });

    btnFormatJson.addEventListener('click', () => {
      const raw = bodyInput.value.trim();
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        bodyInput.value = JSON.stringify(parsed, null, 2);
        hideValidationError();
        updateCurlPreview();
      } catch (e) {
        showValidationError('Request body contains invalid JSON.');
      }
    });

    btnCopyUrl.addEventListener('click', () => {
      const url = urlInput.value.trim();
      vscode.postMessage({ type: 'copyText', payload: { text: url, label: 'Request URL' } });
    });

    btnCopyResponse.addEventListener('click', () => {
      const text = responseBody.textContent || '';
      vscode.postMessage({ type: 'copyText', payload: { text, label: 'Response body' } });
    });

    btnCopyResHeaders.addEventListener('click', () => {
      const lines = Object.entries(lastResponseHeaders).map(([k, v]) => k + ': ' + v).join('\\n');
      vscode.postMessage({ type: 'copyText', payload: { text: lines, label: 'Response headers' } });
    });

    btnCopyCurl.addEventListener('click', () => {
      const text = curlPreview.textContent || '';
      vscode.postMessage({ type: 'copyText', payload: { text, label: 'cURL command' } });
    });

    btnJumpCode.addEventListener('click', () => {
      if (currentInitialState) {
        const rc = currentInitialState.routeContext;
        const targetFile = (rc && rc.sourceFile) || currentInitialState.filePath;
        const targetLine = (rc && rc.sourceLine) || currentInitialState.line;
        if (targetFile) {
          vscode.postMessage({
            type: 'openSource',
            payload: { filePath: targetFile, line: targetLine },
          });
        }
      }
    });

    btnSend.addEventListener('click', () => {
      if (isSending) return;
      sendRequest();
    });

    btnCancel.addEventListener('click', () => {
      if (!isSending) return;
      vscode.postMessage({ type: 'cancelRequest' });
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
      document.querySelectorAll('.param-input.invalid').forEach((el) => el.classList.remove('invalid'));
    }

    function collectRequestConfig() {
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

    function updateCurlPreview() {
      const config = collectRequestConfig();
      let resolvedUrl = config.url;

      // Replace path params
      for (const p of config.pathParams) {
        if (p.value) {
          resolvedUrl = resolvedUrl.replace(new RegExp('\\\\{' + p.name + '\\\\}', 'g'), encodeURIComponent(p.value.trim()));
        }
      }

      // Append query params
      const activeQueries = config.queryParams
        .filter((q) => q.enabled && q.key && q.key.trim() !== '')
        .map((q) => encodeURIComponent(q.key.trim()) + '=' + encodeURIComponent(q.value))
        .join('&');

      if (activeQueries) {
        resolvedUrl += (resolvedUrl.includes('?') ? '&' : '?') + activeQueries;
      }

      let cmd = 'curl -X ' + config.method + ' "' + resolvedUrl + '"';

      for (const h of config.headers) {
        if (h.enabled && h.key && h.key.trim() !== '') {
          cmd += ' \\\\\\n  -H "' + h.key.trim() + ': ' + h.value + '"';
        }
      }

      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method) && config.body && config.body.trim()) {
        cmd += ' \\\\\\n  -d \\'' + config.body.replace(/'/g, "'\\\\''") + '\\'';
      }

      curlPreview.textContent = cmd;
    }

    function sendRequest() {
      hideValidationError();
      const config = collectRequestConfig();

      // Validate URL
      if (!config.url || (!config.url.startsWith('http://') && !config.url.startsWith('https://'))) {
        showValidationError('Invalid request URL. Scheme must be http:// or https://.');
        return;
      }

      // Dynamic path parameter validation: detect all {param} in URL
      const placeholderRegex = /\\{([^}]+)\\}/g;
      const paramMap = new Map();
      for (const p of config.pathParams) {
        paramMap.set(p.name, p.value);
      }

      let match;
      while ((match = placeholderRegex.exec(config.url)) !== null) {
        const paramName = match[1];
        const val = paramMap.get(paramName);
        if (!val || val.trim() === '') {
          const input = document.getElementById('param-input-' + paramName);
          if (input) {
            input.classList.add('invalid');
            input.focus();
          }
          // Switch to Params tab if not active
          const paramsTabBtn = document.querySelector('.tab-btn[data-tab="tab-params"]');
          if (paramsTabBtn) {
            paramsTabBtn.click();
          }
          showValidationError('Required path parameter "' + paramName + '" is missing.');
          return;
        }
      }

      // Quick JSON syntax check
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
          input.classList.remove('invalid');
          hideValidationError();
          updateCurlPreview();
        });

        row.appendChild(label);
        row.appendChild(input);
        pathParamsList.appendChild(row);
      });
    }

    // Render Query parameters
    function renderQueryParams() {
      queryTableBody.innerHTML = '';
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
          updateCurlPreview();
        });
        tdCheck.appendChild(check);

        // Key
        const tdKey = document.createElement('td');
        const inputKey = document.createElement('input');
        inputKey.type = 'text';
        inputKey.className = 'kv-input';
        inputKey.value = param.key;
        inputKey.placeholder = 'Parameter name';
        inputKey.addEventListener('input', () => {
          param.key = inputKey.value;
          updateCurlPreview();
        });
        tdKey.appendChild(inputKey);

        // Value
        const tdVal = document.createElement('td');
        const inputVal = document.createElement('input');
        inputVal.type = 'text';
        inputVal.className = 'kv-input';
        inputVal.value = param.value;
        inputVal.placeholder = 'Value';
        inputVal.addEventListener('input', () => {
          param.value = inputVal.value;
          updateCurlPreview();
        });
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
          updateCurlPreview();
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
          updateCurlPreview();
        });
        tdCheck.appendChild(check);

        // Key
        const tdKey = document.createElement('td');
        const inputKey = document.createElement('input');
        inputKey.type = 'text';
        inputKey.className = 'kv-input';
        inputKey.value = h.key;
        inputKey.placeholder = 'Header name';
        inputKey.addEventListener('input', () => {
          h.key = inputKey.value;
          updateCurlPreview();
        });
        tdKey.appendChild(inputKey);

        // Value
        const tdVal = document.createElement('td');
        const inputVal = document.createElement('input');
        inputVal.type = 'text';
        inputVal.className = 'kv-input';
        inputVal.value = h.value;
        inputVal.placeholder = 'Value';
        inputVal.addEventListener('input', () => {
          h.value = inputVal.value;
          updateCurlPreview();
        });
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
          updateCurlPreview();
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
          updateCurlPreview();
          hideValidationError();

          headerMeta.textContent = currentInitialState.framework
            ? currentInitialState.framework.toUpperCase() + (currentInitialState.filePath ? ' • ' + currentInitialState.filePath : '')
            : '';

          if (currentInitialState.routeContext || currentInitialState.filePath) {
            const rc = currentInitialState.routeContext;
            const fw = (rc && rc.framework) || currentInitialState.framework || 'API';
            const meth = (rc && rc.method) || currentInitialState.method || 'GET';
            const rPath = (rc && rc.path) || currentInitialState.openApiPath || currentInitialState.path || '';
            const sFile = (rc && rc.sourceFile) || currentInitialState.filePath;
            const sLine = (rc && rc.sourceLine) || currentInitialState.line;

            routeContextBadge.textContent = fw.toUpperCase();
            routeContextSignature.textContent = meth + ' ' + rPath;

            if (sFile) {
              const locText = sLine ? sFile + ':' + sLine : sFile;
              btnJumpCode.textContent = locText;
              routeContextSource.style.display = 'flex';
            } else {
              routeContextSource.style.display = 'none';
            }
            routeContextBar.style.display = 'flex';
          } else {
            routeContextBar.style.display = 'none';
          }

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
          btnSend.style.display = 'none';
          btnCancel.style.display = 'inline-flex';
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
          btnSend.style.display = 'inline-flex';
          btnSend.disabled = false;
          btnCancel.style.display = 'none';

          const data = msg.payload;
          lastResponseHeaders = data.headers || {};
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

          // Body (large response protection: limit pre render if > 250,000 chars)
          const rawBody = data.body || '';
          if (rawBody.length > 250000) {
            responseBody.textContent = rawBody.slice(0, 250000) + '\\n\\n... [Response body truncated for rendering performance. Total size: ' + responseSize.textContent + ']';
          } else {
            responseBody.textContent = rawBody || '(empty response body)';
          }

          // Headers
          resHeadersTableBody.innerHTML = '';
          const headerEntries = Object.entries(lastResponseHeaders);
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
          btnSend.style.display = 'inline-flex';
          btnSend.disabled = false;
          btnCancel.style.display = 'none';

          responseEmpty.style.display = 'none';
          responseTabs.style.display = 'none';
          responseMeta.style.display = 'none';

          const err = msg.payload;
          responseErrorCard.style.display = 'flex';

          let causesHtml = '';
          if (err.possibleCauses && err.possibleCauses.length > 0) {
            causesHtml = '<div class="error-card-causes-title">Possible causes:</div><ul class="error-card-causes">' +
              err.possibleCauses.map((c) => '<li>• ' + escapeHtml(c) + '</li>').join('') +
              '</ul>';
          }

          let urlHtml = '';
          if (err.url) {
            urlHtml = '<div class="error-card-url-title">Unable to connect to:</div><div class="error-card-url">' + escapeHtml(err.url) + '</div>';
          }

          let codeHtml = '';
          if (err.code) {
            codeHtml = '<div class="error-card-code-wrap">Error: <span class="error-card-code">' + escapeHtml(err.code) + '</span></div>';
          }

          responseErrorCard.innerHTML =
            '<div class="error-card-title">Request Failed</div>' +
            urlHtml +
            '<div style="font-size: 12px; margin-top: 4px;">' + escapeHtml(err.message || 'An error occurred during request execution.') + '</div>' +
            causesHtml +
            codeHtml;
          break;
        }
      }
    });

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // Notify extension host that UI is ready
    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
  }
}
