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
      --bg: var(--vscode-editor-background, #1e1e1e);
      --fg: var(--vscode-editor-foreground, #cccccc);
      --input-bg: var(--vscode-input-background, #252526);
      --input-fg: var(--vscode-input-foreground, #cccccc);
      --input-border: var(--vscode-input-border, rgba(128, 128, 128, 0.25));
      --btn-bg: var(--vscode-button-background, #0e639c);
      --btn-fg: var(--vscode-button-foreground, #ffffff);
      --btn-hover: var(--vscode-button-hoverBackground, #1177bb);
      --btn-sec-bg: var(--vscode-button-secondaryBackground, #3a3d41);
      --btn-sec-fg: var(--vscode-button-secondaryForeground, #ffffff);
      --btn-sec-hover: var(--vscode-button-secondaryHoverBackground, #45494e);
      --panel-border: var(--vscode-panel-border, rgba(128, 128, 128, 0.18));
      --badge-bg: var(--vscode-badge-background, #4d4d4d);
      --badge-fg: var(--vscode-badge-foreground, #ffffff);
      --font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
      --code-font: var(--vscode-editor-font-family, Menlo, Monaco, "Courier New", monospace);

      --color-emerald: #10B981;
      --color-emerald-bg: rgba(16, 185, 129, 0.15);
      --color-emerald-border: rgba(16, 185, 129, 0.35);
      --color-blue: #3B82F6;
      --color-amber: #F59E0B;
      --color-violet: #8B5CF6;
      --color-rose: #EF4444;
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
      line-height: 1.45;
      padding: 16px 20px;
      overflow-y: auto;
    }

    .container {
      max-width: 960px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* Top Brand Header */
    .header-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--panel-border);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .brand-icon {
      color: var(--color-emerald);
      font-size: 16px;
      line-height: 1;
      filter: drop-shadow(0 0 6px rgba(16, 185, 129, 0.4));
    }

    .header-title {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: -0.2px;
      color: var(--fg);
    }

    .header-badge {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: var(--color-emerald-bg);
      color: var(--color-emerald);
      border: 1px solid var(--color-emerald-border);
      border-radius: 9999px;
      padding: 2px 7px;
    }

    .header-meta {
      font-size: 11px;
      opacity: 0.65;
      font-family: var(--code-font);
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .shortcut-pill {
      font-size: 11px;
      opacity: 0.6;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    kbd {
      background: rgba(128, 128, 128, 0.18);
      border: 1px solid rgba(128, 128, 128, 0.3);
      border-radius: 4px;
      padding: 1px 5px;
      font-size: 10px;
      font-family: var(--code-font);
    }

    /* Route Context Banner (Hero Card) */
    .route-context-bar {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%);
      border: 1px solid var(--panel-border);
      border-left: 3px solid var(--color-emerald);
      border-radius: 8px;
      padding: 10px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .route-context-left {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .route-context-badge {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: 4px;
      background: var(--badge-bg);
      color: var(--badge-fg);
      letter-spacing: 0.6px;
      border: 1px solid rgba(255, 255, 255, 0.08);
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
      font-size: 11px;
      opacity: 0.85;
    }

    .source-link-btn {
      background: transparent;
      border: none;
      color: var(--vscode-textLink-foreground, #3794ff);
      cursor: pointer;
      font-family: var(--code-font);
      font-size: 11px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      text-decoration: underline;
      padding: 2px 4px;
      border-radius: 3px;
      transition: background 0.15s ease;
    }

    .source-link-btn:hover {
      background: rgba(55, 148, 255, 0.1);
      color: var(--vscode-textLink-activeForeground, #58a6ff);
    }

    /* Omni Request Bar */
    .request-bar {
      display: flex;
      align-items: stretch;
      gap: 8px;
    }

    .omni-input-group {
      flex: 1;
      display: flex;
      align-items: center;
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      border-radius: 6px;
      overflow: hidden;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .omni-input-group:focus-within {
      border-color: var(--color-emerald);
      box-shadow: 0 0 0 1px var(--color-emerald);
    }

    .method-select {
      background: transparent;
      color: var(--input-fg);
      border: none;
      padding: 8px 12px;
      font-family: var(--code-font);
      font-weight: 800;
      font-size: 12px;
      cursor: pointer;
      outline: none;
      letter-spacing: 0.5px;
    }

    .method-select[data-method="GET"] { color: var(--color-emerald); }
    .method-select[data-method="POST"] { color: var(--color-blue); }
    .method-select[data-method="PUT"] { color: var(--color-amber); }
    .method-select[data-method="PATCH"] { color: var(--color-violet); }
    .method-select[data-method="DELETE"] { color: var(--color-rose); }
    .method-select[data-method="HEAD"],
    .method-select[data-method="OPTIONS"] { color: #9CA3AF; }

    .omni-divider {
      width: 1px;
      height: 20px;
      background: var(--panel-border);
    }

    .url-input {
      flex: 1;
      background: transparent;
      color: var(--input-fg);
      border: none;
      padding: 8px 12px;
      font-family: var(--code-font);
      font-size: 12px;
      outline: none;
    }

    .url-input::placeholder {
      opacity: 0.45;
    }

    .btn-omni-copy {
      background: transparent;
      border: none;
      color: var(--fg);
      opacity: 0.7;
      padding: 6px 12px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: opacity 0.15s, background 0.15s;
    }

    .btn-omni-copy:hover {
      opacity: 1;
      background: rgba(128, 128, 128, 0.12);
    }

    /* Buttons */
    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: transform 0.08s ease, filter 0.15s ease, background 0.15s ease;
      white-space: nowrap;
      user-select: none;
    }

    .btn:active {
      transform: scale(0.98);
    }

    .btn-send {
      background: linear-gradient(135deg, #10B981 0%, #059669 100%);
      color: #ffffff;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3), 0 0 10px rgba(16, 185, 129, 0.25);
    }

    .btn-send:hover {
      filter: brightness(1.1);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35), 0 0 14px rgba(16, 185, 129, 0.4);
    }

    .btn-send .btn-badge {
      background: rgba(0, 0, 0, 0.2);
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 3px;
      font-family: var(--code-font);
      font-weight: 500;
    }

    .btn-secondary {
      background: var(--btn-sec-bg);
      color: var(--btn-sec-fg);
      border: 1px solid var(--panel-border);
    }

    .btn-secondary:hover {
      background: var(--btn-sec-hover);
    }

    .btn-cancel {
      background: var(--color-rose);
      color: #ffffff;
    }

    .btn-cancel:hover {
      background: #DC2626;
    }

    .btn-sm {
      padding: 4px 10px;
      font-size: 11px;
      border-radius: 4px;
    }

    /* Tab Bar */
    .tab-bar {
      display: flex;
      border-bottom: 1px solid var(--panel-border);
      gap: 6px;
      margin-top: 4px;
    }

    .tab-btn {
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--fg);
      opacity: 0.65;
      padding: 8px 14px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: opacity 0.15s, border-color 0.15s;
    }

    .tab-btn:hover {
      opacity: 1;
    }

    .tab-btn.active {
      opacity: 1;
      border-bottom-color: var(--color-emerald);
      color: var(--fg);
      font-weight: 600;
    }

    .tab-badge {
      background: var(--badge-bg);
      color: var(--badge-fg);
      font-size: 10px;
      font-weight: 600;
      border-radius: 9999px;
      padding: 1px 6px;
      line-height: 1.2;
    }

    .tab-content {
      display: none;
      padding-top: 10px;
    }

    .tab-content.active {
      display: block;
    }

    /* Cards */
    .card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--panel-border);
      border-radius: 8px;
      padding: 14px;
    }

    .section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      opacity: 0.75;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* Parameter rows */
    .param-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }

    .param-row:last-child {
      margin-bottom: 0;
    }

    .param-label {
      width: 150px;
      font-family: var(--code-font);
      font-size: 12px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .param-label .opt-tag {
      font-size: 10px;
      opacity: 0.6;
      font-weight: normal;
    }

    .param-input {
      flex: 1;
      background: var(--input-bg);
      color: var(--input-fg);
      border: 1px solid var(--input-border);
      padding: 6px 10px;
      border-radius: 5px;
      font-family: var(--code-font);
      font-size: 12px;
      outline: none;
      transition: border-color 0.15s;
    }

    .param-input:focus {
      border-color: var(--color-emerald);
    }

    .param-input.invalid {
      border-color: var(--color-rose);
      box-shadow: 0 0 0 1px var(--color-rose);
    }

    /* Tables */
    .kv-table {
      width: 100%;
      border-collapse: collapse;
    }

    .kv-table th {
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      opacity: 0.6;
      padding: 6px 8px;
      border-bottom: 1px solid var(--panel-border);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .kv-table td {
      padding: 5px 4px;
    }

    .kv-checkbox {
      cursor: pointer;
      accent-color: var(--color-emerald);
      width: 14px;
      height: 14px;
    }

    .kv-input {
      width: 100%;
      background: var(--input-bg);
      color: var(--input-fg);
      border: 1px solid var(--input-border);
      padding: 6px 10px;
      border-radius: 4px;
      font-family: var(--code-font);
      font-size: 12px;
      outline: none;
      transition: border-color 0.15s;
    }

    .kv-input:focus {
      border-color: var(--color-emerald);
    }

    .btn-icon {
      background: transparent;
      border: none;
      color: var(--fg);
      opacity: 0.5;
      cursor: pointer;
      padding: 4px 6px;
      border-radius: 4px;
      font-size: 13px;
      line-height: 1;
      transition: opacity 0.15s, color 0.15s;
    }

    .btn-icon:hover {
      opacity: 1;
      color: var(--color-rose);
    }

    /* Body Editor */
    .body-editor {
      width: 100%;
      min-height: 200px;
      background: var(--input-bg);
      color: var(--input-fg);
      border: 1px solid var(--input-border);
      border-radius: 6px;
      padding: 10px 12px;
      font-family: var(--code-font);
      font-size: 12px;
      resize: vertical;
      line-height: 1.5;
      outline: none;
      transition: border-color 0.15s;
    }

    .body-editor:focus {
      border-color: var(--color-emerald);
    }

    .body-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 8px;
      font-size: 11px;
    }

    .body-toolbar-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .json-valid-indicator {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-weight: 500;
      font-size: 11px;
    }

    .json-valid-indicator.valid { color: var(--color-emerald); }
    .json-valid-indicator.invalid { color: var(--color-rose); }
    .json-valid-indicator.empty { opacity: 0.6; }

    .quick-snippet-btn {
      background: transparent;
      border: 1px dashed var(--panel-border);
      color: var(--fg);
      opacity: 0.7;
      padding: 2px 7px;
      border-radius: 3px;
      font-size: 11px;
      font-family: var(--code-font);
      cursor: pointer;
    }

    .quick-snippet-btn:hover {
      opacity: 1;
      border-color: var(--color-emerald);
      color: var(--color-emerald);
    }

    /* cURL Preview */
    .curl-preview {
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid var(--panel-border);
      border-radius: 6px;
      padding: 12px;
      font-family: var(--code-font);
      font-size: 12px;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-all;
      color: var(--fg);
      max-height: 320px;
      overflow-y: auto;
    }

    /* Response Section */
    .response-section {
      margin-top: 12px;
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

    .response-title {
      font-weight: 700;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .response-meta {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-weight: 700;
      font-size: 12px;
      padding: 3px 8px;
      border-radius: 4px;
      font-family: var(--code-font);
    }

    .status-dot {
      font-size: 9px;
      line-height: 1;
    }

    .status-2xx {
      background: rgba(16, 185, 129, 0.15);
      color: var(--color-emerald);
      border: 1px solid rgba(16, 185, 129, 0.4);
    }

    .status-3xx {
      background: rgba(59, 130, 246, 0.15);
      color: var(--color-blue);
      border: 1px solid rgba(59, 130, 246, 0.4);
    }

    .status-4xx {
      background: rgba(245, 158, 11, 0.15);
      color: var(--color-amber);
      border: 1px solid rgba(245, 158, 11, 0.4);
    }

    .status-5xx {
      background: rgba(239, 68, 68, 0.15);
      color: var(--color-rose);
      border: 1px solid rgba(239, 68, 68, 0.4);
    }

    .metric-chip {
      font-size: 11px;
      font-family: var(--code-font);
      background: rgba(128, 128, 128, 0.12);
      border: 1px solid var(--panel-border);
      padding: 3px 7px;
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      opacity: 0.9;
    }

    .response-body-pre {
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid var(--panel-border);
      border-radius: 6px;
      padding: 14px;
      max-height: 440px;
      overflow: auto;
      font-family: var(--code-font);
      font-size: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .empty-state {
      text-align: center;
      padding: 36px 20px;
      opacity: 0.7;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .empty-state-icon {
      font-size: 28px;
      line-height: 1;
      opacity: 0.8;
    }

    .empty-state-title {
      font-weight: 600;
      font-size: 13px;
      color: var(--fg);
    }

    .empty-state-sub {
      font-size: 11px;
      opacity: 0.7;
      max-width: 320px;
    }

    /* Error Card */
    .error-card {
      border: 1px solid rgba(239, 68, 68, 0.35);
      background: rgba(239, 68, 68, 0.08);
      border-radius: 8px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .error-card-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--color-rose);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .error-card-url-title {
      font-size: 11px;
      opacity: 0.8;
    }

    .error-card-url {
      font-family: var(--code-font);
      font-size: 12px;
      background: rgba(0, 0, 0, 0.25);
      padding: 6px 10px;
      border-radius: 4px;
      word-break: break-all;
    }

    .error-card-causes-title {
      font-size: 11px;
      font-weight: 700;
      opacity: 0.9;
    }

    .error-card-causes {
      list-style-type: none;
      padding-left: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .error-card-causes li {
      font-size: 12px;
      opacity: 0.85;
    }

    .error-card-code-wrap {
      font-size: 11px;
      opacity: 0.8;
    }

    .error-card-code {
      font-family: var(--code-font);
      font-weight: 600;
      color: var(--color-rose);
      background: rgba(239, 68, 68, 0.15);
      padding: 1px 6px;
      border-radius: 3px;
    }

    .alert {
      padding: 10px 14px;
      border-radius: 6px;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .alert-error {
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.35);
      color: var(--color-rose);
    }

    .spinner {
      display: inline-block;
      width: 12px;
      height: 12px;
      border: 2px solid rgba(255, 255, 255, 0.35);
      border-radius: 50%;
      border-top-color: #ffffff;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Top Brand Header -->
    <div class="header-bar">
      <div class="header-left">
        <span class="brand-icon">⚡</span>
        <span class="header-title">API Routes Explorer</span>
        <span class="header-badge">HTTP Client</span>
        <span class="header-meta" id="header-meta"></span>
      </div>
      <div class="header-right">
        <span class="shortcut-pill"><kbd>⌘↵</kbd> / <kbd>Ctrl+↵</kbd> to Send</span>
      </div>
    </div>

    <!-- Route Context Banner (Hero Card) -->
    <div class="route-context-bar" id="route-context-bar" style="display: none;">
      <div class="route-context-left">
        <span class="route-context-badge" id="route-context-badge">API</span>
        <span class="route-context-signature" id="route-context-signature"></span>
      </div>
      <div class="route-context-source" id="route-context-source">
        <span>Source:</span>
        <button type="button" class="source-link-btn" id="btn-jump-code" title="Jump to route definition in code">
          <span id="jump-code-text">Open file</span> ↗
        </button>
      </div>
    </div>

    <!-- Omni Request Bar -->
    <div class="request-bar">
      <div class="omni-input-group">
        <select id="method-select" class="method-select" data-method="GET">
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="PATCH">PATCH</option>
          <option value="DELETE">DELETE</option>
          <option value="HEAD">HEAD</option>
          <option value="OPTIONS">OPTIONS</option>
        </select>
        <div class="omni-divider"></div>
        <input type="text" id="url-input" class="url-input" spellcheck="false" placeholder="http://localhost:3000/api/v1/..." />
        <button id="btn-copy-url" class="btn-omni-copy" title="Copy Request URL">
          <span>📋</span>
          <span id="copy-url-label">Copy URL</span>
        </button>
      </div>

      <button id="btn-send" class="btn btn-send" title="Send Request (⌘↵ / Ctrl+↵)">
        <span id="send-spinner" style="display:none;" class="spinner"></span>
        <span id="send-icon">➤</span>
        <span id="send-label">Send</span>
        <span class="btn-badge">⌘↵</span>
      </button>

      <button id="btn-cancel" class="btn btn-cancel" style="display:none;" title="Cancel running request">
        ✕ Cancel
      </button>

      <button id="btn-reset" class="btn btn-secondary" title="Reset to route default">
        ↺ Reset
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
          <div class="empty-state">
            <span class="empty-state-icon">✨</span>
            <div class="empty-state-title">No dynamic path parameters</div>
            <div class="empty-state-sub">This route does not require dynamic URL parameters.</div>
          </div>
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
        <div style="margin-top: 10px;">
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
        <div style="margin-top: 10px;">
          <button id="btn-add-header" class="btn btn-secondary btn-sm">+ Add Header</button>
        </div>
      </div>
    </div>

    <!-- Tab 3: Body -->
    <div id="tab-body" class="tab-content">
      <div class="card">
        <textarea id="body-input" class="body-editor" spellcheck="false" placeholder='{\n  "key": "value"\n}'></textarea>
        <div class="body-toolbar">
          <div class="body-toolbar-left">
            <span id="json-valid-indicator" class="json-valid-indicator empty">JSON Body (optional)</span>
            <button type="button" class="quick-snippet-btn" id="btn-snippet-obj">{ } Object</button>
            <button type="button" class="quick-snippet-btn" id="btn-snippet-arr">[ ] Array</button>
          </div>
          <button id="btn-format-json" class="btn btn-secondary btn-sm">{ } Format JSON</button>
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
        <div class="response-title">
          <span>Response</span>
        </div>
        <div id="response-meta" class="response-meta" style="display: none;">
          <span id="response-status" class="status-badge"></span>
          <span id="response-time" class="metric-chip"></span>
          <span id="response-size" class="metric-chip"></span>
          <button id="btn-copy-response" class="btn btn-secondary btn-sm">Copy Body</button>
          <button id="btn-copy-res-headers" class="btn btn-secondary btn-sm">Copy Headers</button>
        </div>
      </div>

      <div id="response-empty" class="card empty-state">
        <span class="empty-state-icon">🚀</span>
        <div class="empty-state-title">Ready to test endpoint</div>
        <div class="empty-state-sub">Press Send or <strong>⌘↵ / Ctrl+↵</strong> to execute and inspect status, headers, and body.</div>
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
    let sendStartTime = 0;
    let sendTimerInterval = null;
    let lastResponseHeaders = {};

    // Elements
    const methodSelect = document.getElementById('method-select');
    const urlInput = document.getElementById('url-input');
    const btnCopyUrl = document.getElementById('btn-copy-url');
    const copyUrlLabel = document.getElementById('copy-url-label');
    const btnSend = document.getElementById('btn-send');
    const sendIcon = document.getElementById('send-icon');
    const btnCancel = document.getElementById('btn-cancel');
    const sendSpinner = document.getElementById('send-spinner');
    const sendLabel = document.getElementById('send-label');
    const btnReset = document.getElementById('btn-reset');
    const bodyInput = document.getElementById('body-input');
    const btnFormatJson = document.getElementById('btn-format-json');
    const jsonValidIndicator = document.getElementById('json-valid-indicator');
    const btnSnippetObj = document.getElementById('btn-snippet-obj');
    const btnSnippetArr = document.getElementById('btn-snippet-arr');
    const validationError = document.getElementById('validation-error');
    const headerMeta = document.getElementById('header-meta');

    const routeContextBar = document.getElementById('route-context-bar');
    const routeContextBadge = document.getElementById('route-context-badge');
    const routeContextSignature = document.getElementById('route-context-signature');
    const routeContextSource = document.getElementById('route-context-source');
    const btnJumpCode = document.getElementById('btn-jump-code');
    const jumpCodeText = document.getElementById('jump-code-text');

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

    // Global keyboard shortcut: Cmd+Enter or Ctrl+Enter to trigger Send
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isSending) {
          sendRequest();
        }
      }
    });

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
      validateBodyJsonRealtime();
      updateCurlPreview();
    });

    function validateBodyJsonRealtime() {
      const val = bodyInput.value.trim();
      if (!val) {
        jsonValidIndicator.className = 'json-valid-indicator empty';
        jsonValidIndicator.textContent = 'JSON Body (optional)';
        return;
      }
      try {
        JSON.parse(val);
        jsonValidIndicator.className = 'json-valid-indicator valid';
        jsonValidIndicator.textContent = '✓ Valid JSON';
      } catch {
        jsonValidIndicator.className = 'json-valid-indicator invalid';
        jsonValidIndicator.textContent = '⚠ Invalid JSON';
      }
    }

    if (btnSnippetObj) {
      btnSnippetObj.addEventListener('click', () => {
        bodyInput.value = '{\\n  "key": "value"\\n}';
        validateBodyJsonRealtime();
        updateCurlPreview();
      });
    }

    if (btnSnippetArr) {
      btnSnippetArr.addEventListener('click', () => {
        bodyInput.value = '[\\n  {\\n    "id": 1\\n  }\\n]';
        validateBodyJsonRealtime();
        updateCurlPreview();
      });
    }

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
        validateBodyJsonRealtime();
        updateCurlPreview();
      } catch (e) {
        showValidationError('Request body contains invalid JSON.');
        validateBodyJsonRealtime();
      }
    });

    function setTemporaryLabel(btn, tempText, originalText, duration = 1500) {
      btn.textContent = tempText;
      setTimeout(() => {
        btn.textContent = originalText;
      }, duration);
    }

    btnCopyUrl.addEventListener('click', () => {
      const url = urlInput.value.trim();
      vscode.postMessage({ type: 'copyText', payload: { text: url, label: 'Request URL' } });
      if (copyUrlLabel) {
        copyUrlLabel.textContent = 'Copied!';
        setTimeout(() => { copyUrlLabel.textContent = 'Copy URL'; }, 1500);
      }
    });

    btnCopyResponse.addEventListener('click', () => {
      const text = responseBody.textContent || '';
      vscode.postMessage({ type: 'copyText', payload: { text, label: 'Response body' } });
      setTemporaryLabel(btnCopyResponse, '✓ Copied!', 'Copy Body');
    });

    btnCopyResHeaders.addEventListener('click', () => {
      const lines = Object.entries(lastResponseHeaders).map(([k, v]) => k + ': ' + v).join('\\n');
      vscode.postMessage({ type: 'copyText', payload: { text: lines, label: 'Response headers' } });
      setTemporaryLabel(btnCopyResHeaders, '✓ Copied!', 'Copy Headers');
    });

    btnCopyCurl.addEventListener('click', () => {
      const text = curlPreview.textContent || '';
      vscode.postMessage({ type: 'copyText', payload: { text, label: 'cURL command' } });
      setTemporaryLabel(btnCopyCurl, '✓ Copied!', 'Copy cURL');
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
      validationError.style.display = 'flex';
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

    function updateLiveUrlFromInputs() {
      if (!currentInitialState || !currentInitialState.urlTemplate) {
        return;
      }
      let newUrl = currentInitialState.urlTemplate;
      pathParams.forEach((p) => {
        const input = document.getElementById('param-input-' + p.name);
        const val = input ? input.value : p.value;
        if (val && val.trim() !== '') {
          newUrl = newUrl.replace(new RegExp('\\\\{' + p.name + '\\\\}', 'g'), encodeURIComponent(val.trim()));
          newUrl = newUrl.replace(new RegExp(':' + p.name + '(\\\\?|\\\\*|\\\\+)?', 'g'), encodeURIComponent(val.trim()));
        } else if (p.isOptional) {
          newUrl = newUrl.replace(new RegExp('/\\\\{' + p.name + '\\\\}', 'g'), '');
          newUrl = newUrl.replace(new RegExp('\\\\{' + p.name + '\\\\}', 'g'), '');
          newUrl = newUrl.replace(new RegExp('/:' + p.name + '\\\\?', 'g'), '');
          newUrl = newUrl.replace(new RegExp(':' + p.name + '\\\\?', 'g'), '');
        }
      });
      const activeQueries = queryParams
        .filter((q) => q.enabled && q.key && q.key.trim() !== '')
        .map((q) => encodeURIComponent(q.key.trim()) + '=' + encodeURIComponent(q.value))
        .join('&');
      if (activeQueries) {
        newUrl += (newUrl.includes('?') ? '&' : '?') + activeQueries;
      }
      urlInput.value = newUrl;
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
      const placeholderRegex = /\{([^}]+)\}/g;
      const paramMap = new Map();
      for (const p of config.pathParams) {
        paramMap.set(p.name, p.value);
      }

      let match;
      while ((match = placeholderRegex.exec(config.url)) !== null) {
        const paramName = match[1];
        const val = paramMap.get(paramName);
        const optParam = pathParams.find((p) => p.name === paramName);
        if ((!val || val.trim() === '') && !optParam?.isOptional) {
          const input = document.getElementById('param-input-' + paramName);
          if (input) {
            input.classList.add('invalid');
            input.focus();
          }
          const paramsTabBtn = document.querySelector('.tab-btn[data-tab="tab-params"]');
          if (paramsTabBtn) {
            paramsTabBtn.click();
          }
          showValidationError('Required path parameter "' + paramName + '" is missing.');
          return;
        }
      }

      // Dynamic path parameter validation: detect unresolved :param tokens in URL
      const colonRegex = /(?<![a-zA-Z0-9_]):([a-zA-Z_][a-zA-Z0-9_]*)/g;
      let colonMatch;
      while ((colonMatch = colonRegex.exec(config.url)) !== null) {
        const colonParamName = colonMatch[1];
        const val = paramMap.get(colonParamName);
        const optParam = pathParams.find((p) => p.name === colonParamName);
        if ((!val || val.trim() === '') && !optParam?.isOptional) {
          const input = document.getElementById('param-input-' + colonParamName);
          if (input) {
            input.classList.add('invalid');
            input.focus();
          }
          showValidationError('Required path parameter "' + colonParamName + '" is missing.');
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
        pathParamsList.innerHTML =
          '<div class="empty-state">' +
          '<span class="empty-state-icon">✨</span>' +
          '<div class="empty-state-title">No dynamic path parameters</div>' +
          '<div class="empty-state-sub">This route does not require dynamic URL parameters.</div>' +
          '</div>';
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
        label.innerHTML = escapeHtml(param.name) + (param.isOptional ? ' <span class="opt-tag">(optional)</span>' : '');
        label.title = param.name;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'param-input';
        input.id = 'param-input-' + param.name;
        input.value = param.value || '';
        input.placeholder = param.placeholder || ('Value for ' + param.name + '...');

        input.addEventListener('input', () => {
          param.value = input.value;
          input.classList.remove('invalid');
          hideValidationError();
          updateLiveUrlFromInputs();
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
          validateBodyJsonRealtime();
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
              if (jumpCodeText) {
                jumpCodeText.textContent = locText;
              } else {
                btnJumpCode.textContent = locText;
              }
              routeContextSource.style.display = 'flex';
            } else {
              routeContextSource.style.display = 'none';
            }
            routeContextBar.style.display = 'flex';
          } else {
            routeContextBar.style.display = 'none';
          }

          // Reset response area
          responseEmpty.style.display = 'flex';
          responseTabs.style.display = 'none';
          responseMeta.style.display = 'none';
          responseErrorCard.style.display = 'none';
          break;
        }

        case 'requestStart': {
          isSending = true;
          sendStartTime = Date.now();
          sendSpinner.style.display = 'inline-block';
          if (sendIcon) sendIcon.style.display = 'none';
          sendLabel.textContent = 'Sending...';
          btnSend.disabled = true;
          btnCancel.style.display = 'inline-flex';
          responseEmpty.style.display = 'none';
          responseErrorCard.style.display = 'none';
          responseTabs.style.display = 'none';
          responseMeta.style.display = 'none';

          if (sendTimerInterval) clearInterval(sendTimerInterval);
          sendTimerInterval = setInterval(() => {
            const elapsed = Date.now() - sendStartTime;
            sendLabel.textContent = 'Sending (' + elapsed + 'ms)...';
          }, 100);
          break;
        }

        case 'response': {
          isSending = false;
          if (sendTimerInterval) {
            clearInterval(sendTimerInterval);
            sendTimerInterval = null;
          }
          sendSpinner.style.display = 'none';
          if (sendIcon) sendIcon.style.display = 'inline';
          sendLabel.textContent = 'Send';
          btnSend.disabled = false;
          btnCancel.style.display = 'none';

          const data = msg.payload;
          lastResponseHeaders = data.headers || {};
          responseEmpty.style.display = 'none';
          responseErrorCard.style.display = 'none';
          responseTabs.style.display = 'block';
          responseMeta.style.display = 'flex';

          // Status badge
          responseStatus.innerHTML = '<span class="status-dot">●</span> ' + escapeHtml(data.status + ' ' + (data.statusText || ''));
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

          // Timing and size chips
          responseTime.innerHTML = '⚡ ' + data.timeMs + ' ms';
          const sizeKb = (data.sizeBytes / 1024).toFixed(1);
          responseSize.innerHTML = '📦 ' + (data.sizeBytes > 1024 ? sizeKb + ' KB' : data.sizeBytes + ' B');

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
          if (sendTimerInterval) {
            clearInterval(sendTimerInterval);
            sendTimerInterval = null;
          }
          sendSpinner.style.display = 'none';
          if (sendIcon) sendIcon.style.display = 'inline';
          sendLabel.textContent = 'Send';
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
            '<div class="error-card-title">⚠️ Request Failed</div>' +
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
