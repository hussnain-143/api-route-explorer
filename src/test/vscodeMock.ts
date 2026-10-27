import Module from 'module';
import * as path from 'path';
import { COMMANDS } from '../utils/constants';

class MockUri {
  public readonly scheme: string;
  public readonly fsPath: string;
  public readonly path: string;

  constructor(fsPath: string, scheme: string = 'file') {
    this.scheme = scheme;
    this.fsPath = fsPath;
    this.path = fsPath.replace(/\\/g, '/');
  }

  public static file(p: string): MockUri {
    return new MockUri(p, 'file');
  }

  public static joinPath(base: MockUri, ...segments: string[]): MockUri {
    return new MockUri(path.join(base.fsPath, ...segments), base.scheme);
  }

  public toString(): string {
    return `${this.scheme}://${this.path}`;
  }
}

class MockPosition {
  constructor(
    public readonly line: number,
    public readonly character: number
  ) {}
}

class MockRange {
  public readonly start: MockPosition;
  public readonly end: MockPosition;

  constructor(
    startLineOrPos: number | MockPosition,
    startCharOrEndPos: number | MockPosition,
    endLine?: number,
    endChar?: number
  ) {
    if (typeof startLineOrPos === 'number' && typeof startCharOrEndPos === 'number') {
      this.start = new MockPosition(startLineOrPos, startCharOrEndPos);
      this.end = new MockPosition(endLine ?? startLineOrPos, endChar ?? startCharOrEndPos);
    } else {
      this.start = startLineOrPos as MockPosition;
      this.end = startCharOrEndPos as MockPosition;
    }
  }
}

class MockSelection extends MockRange {
  public readonly anchor: MockPosition;
  public readonly active: MockPosition;

  constructor(anchor: MockPosition, active: MockPosition) {
    super(anchor, active);
    this.anchor = anchor;
    this.active = active;
  }
}

class MockLocation {
  constructor(
    public readonly uri: MockUri,
    public readonly range: MockRange | MockPosition
  ) {}
}

class MockThemeColor {
  constructor(public readonly id: string) {}
}

class MockThemeIcon {
  public static readonly Folder = new MockThemeIcon('folder');
  public static readonly File = new MockThemeIcon('file');

  constructor(
    public readonly id: string,
    public readonly color?: MockThemeColor
  ) {}
}

enum MockTreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

class MockTreeItem {
  public label?: string;
  public id?: string;
  public iconPath?: unknown;
  public description?: string | boolean;
  public tooltip?: string | MockMarkdownString;
  public command?: { command: string; title: string; arguments?: unknown[] };
  public collapsibleState?: MockTreeItemCollapsibleState;
  public contextValue?: string;
  public resourceUri?: MockUri;

  constructor(
    labelOrUri: string | MockUri,
    collapsibleState: MockTreeItemCollapsibleState = MockTreeItemCollapsibleState.None
  ) {
    if (typeof labelOrUri === 'string') {
      this.label = labelOrUri;
    } else {
      this.resourceUri = labelOrUri;
    }
    this.collapsibleState = collapsibleState;
  }
}

class MockMarkdownString {
  public value: string;
  public isTrusted?: boolean;
  public supportThemeIcons?: boolean;

  constructor(value: string = '', supportThemeIcons: boolean = false) {
    this.value = value;
    this.supportThemeIcons = supportThemeIcons;
  }

  public appendMarkdown(str: string): this {
    this.value += str;
    return this;
  }

  public appendText(str: string): this {
    this.value += str;
    return this;
  }
}

class MockEventEmitter<T> {
  private listeners: Array<(e: T) => unknown> = [];

  public readonly event = (listener: (e: T) => unknown) => {
    this.listeners.push(listener);
    return {
      dispose: () => {
        this.listeners = this.listeners.filter((l) => l !== listener);
      },
    };
  };

  public fire(data: T): void {
    for (const listener of this.listeners) {
      listener(data);
    }
  }

  public dispose(): void {
    this.listeners = [];
  }
}

class MockCancellationTokenSource {
  public token = {
    isCancellationRequested: false,
    onCancellationRequested: () => ({ dispose: () => {} }),
  };

  public cancel(): void {
    this.token.isCancellationRequested = true;
  }

  public dispose(): void {}
}

class MockDisposable {
  constructor(private readonly callOnDispose?: () => void) {}

  public static from(...disposables: Array<{ dispose: () => unknown }>): MockDisposable {
    return new MockDisposable(() => {
      for (const d of disposables) {
        d?.dispose?.();
      }
    });
  }

  public dispose(): void {
    this.callOnDispose?.();
  }
}

enum MockDiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3,
}

class MockDiagnostic {
  public source?: string;
  public code?: string | number;
  public relatedInformation?: MockDiagnosticRelatedInformation[];

  constructor(
    public readonly range: MockRange,
    public readonly message: string,
    public readonly severity: MockDiagnosticSeverity = MockDiagnosticSeverity.Error
  ) {}
}

class MockDiagnosticRelatedInformation {
  constructor(
    public readonly location: MockLocation,
    public readonly message: string
  ) {}
}

class MockCodeLens {
  public range: MockRange;
  public command?: { title: string; command: string; tooltip?: string; arguments?: unknown[] };

  constructor(
    range: MockRange,
    command?: { title: string; command: string; tooltip?: string; arguments?: unknown[] }
  ) {
    this.range = range;
    this.command = command;
  }

  public get isResolved(): boolean {
    return Boolean(this.command);
  }
}

const registeredCommands = new Map<string, (...args: unknown[]) => unknown>();
for (const cmdId of Object.values(COMMANDS)) {
  registeredCommands.set(cmdId, async () => undefined);
}

let clipboardText = '';

const vscodeMock = {
  Uri: MockUri,
  Position: MockPosition,
  Range: MockRange,
  Selection: MockSelection,
  Location: MockLocation,
  ThemeColor: MockThemeColor,
  ThemeIcon: MockThemeIcon,
  TreeItemCollapsibleState: MockTreeItemCollapsibleState,
  TreeItem: MockTreeItem,
  MarkdownString: MockMarkdownString,
  EventEmitter: MockEventEmitter,
  CancellationTokenSource: MockCancellationTokenSource,
  Disposable: MockDisposable,
  DiagnosticSeverity: MockDiagnosticSeverity,
  Diagnostic: MockDiagnostic,
  DiagnosticRelatedInformation: MockDiagnosticRelatedInformation,
  CodeLens: MockCodeLens,
  StatusBarAlignment: { Left: 1, Right: 2 },
  ViewColumn: { Active: -1, Beside: -2, One: 1, Two: 2, Three: 3 },
  ProgressLocation: { SourceControl: 1, Window: 10, Notification: 15 },
  TextEditorRevealType: { Default: 0, InCenter: 1, InCenterIfOutsideViewport: 2, AtTop: 3 },

  commands: {
    registerCommand: (id: string, handler: (...args: unknown[]) => unknown) => {
      registeredCommands.set(id, handler);
      return new MockDisposable(() => registeredCommands.delete(id));
    },
    executeCommand: async (id: string, ...args: unknown[]) => {
      const handler = registeredCommands.get(id);
      if (handler) {
        return await handler(...args);
      }
      return undefined;
    },
    getCommands: async () => Array.from(registeredCommands.keys()),
  },

  env: {
    clipboard: {
      writeText: async (text: string) => {
        clipboardText = text;
      },
      readText: async () => clipboardText,
    },
  },

  languages: {
    createDiagnosticCollection: (_name?: string) => {
      const store = new Map<string, MockDiagnostic[]>();
      return {
        set: (uri: MockUri, diags: MockDiagnostic[]) => {
          store.set(uri.toString(), diags || []);
        },
        get: (uri: MockUri) => store.get(uri.toString()) || [],
        delete: (uri: MockUri) => store.delete(uri.toString()),
        clear: () => store.clear(),
        dispose: () => store.clear(),
      };
    },
    registerCodeLensProvider: () => new MockDisposable(),
  },

  window: {
    activeTextEditor: undefined,
    showInformationMessage: async () => undefined,
    showWarningMessage: async () => undefined,
    showErrorMessage: async () => undefined,
    showQuickPick: async () => undefined,
    showSaveDialog: async () => undefined,
    showTextDocument: async () => ({
      selection: new MockSelection(new MockPosition(0, 0), new MockPosition(0, 0)),
      revealRange: () => {},
    }),
    withProgress: async (
      _options: unknown,
      task: (
        progress: { report: () => void },
        token: { isCancellationRequested: boolean; onCancellationRequested: () => { dispose: () => void } }
      ) => Promise<unknown>
    ) => {
      return await task(
        { report: () => {} },
        { isCancellationRequested: false, onCancellationRequested: () => ({ dispose: () => {} }) }
      );
    },
    createTreeView: () => ({
      visible: true,
      description: undefined,
      badge: undefined,
      reveal: async () => {},
      dispose: () => {},
    }),
    registerTreeDataProvider: () => new MockDisposable(),
    createStatusBarItem: () => ({
      text: '',
      tooltip: '',
      command: undefined,
      show: () => {},
      hide: () => {},
      dispose: () => {},
    }),
    createQuickPick: () => ({
      items: [],
      title: '',
      placeholder: '',
      matchOnDescription: true,
      matchOnDetail: true,
      onDidChangeValue: () => new MockDisposable(),
      onDidAccept: () => new MockDisposable(),
      onDidTriggerItemButton: () => new MockDisposable(),
      onDidHide: () => new MockDisposable(),
      show: () => {},
      hide: () => {},
      dispose: () => {},
    }),
    createWebviewPanel: (_viewType: string, title: string) => ({
      title,
      webview: {
        html: '',
        onDidReceiveMessage: () => new MockDisposable(),
        postMessage: async () => true,
        asWebviewUri: (u: MockUri) => u,
        cspSource: 'vscode-webview://mock',
      },
      reveal: () => {},
      onDidDispose: () => new MockDisposable(),
      dispose: () => {},
    }),
    onDidChangeActiveTextEditor: () => new MockDisposable(),
    onDidChangeTextEditorSelection: () => new MockDisposable(),
  },

  workspace: {
    workspaceFolders: undefined,
    getConfiguration: () => ({
      get: <T>(_key: string, defaultValue?: T): T | undefined => defaultValue,
    }),
    onDidChangeConfiguration: () => new MockDisposable(),
    createFileSystemWatcher: () => ({
      onDidChange: () => new MockDisposable(),
      onDidCreate: () => new MockDisposable(),
      onDidDelete: () => new MockDisposable(),
      dispose: () => {},
    }),
    findFiles: async () => [],
    openTextDocument: async (arg: unknown) => ({
      uri: arg instanceof MockUri ? arg : MockUri.file('/mock/doc'),
      getText: () => (typeof arg === 'object' && arg !== null && 'content' in arg ? String((arg as { content: unknown }).content) : ''),
      lineCount: 100,
    }),
    fs: {
      readFile: async () => new Uint8Array(),
      writeFile: async () => {},
    },
  },
};

const originalLoad = (Module as unknown as { _load: (request: string, parent: unknown, isMain: boolean) => unknown })._load;
(Module as unknown as { _load: (request: string, parent: unknown, isMain: boolean) => unknown })._load = function (
  request: string,
  parent: unknown,
  isMain: boolean
): unknown {
  if (request === 'vscode') {
    return vscodeMock;
  }
  return originalLoad.call(this, request, parent, isMain);
};

// Activate extension in mock environment so all real command handlers are registered
try {
  const ext = require('../extension');
  if (ext && typeof ext.activate === 'function') {
    const createMockMemento = () => {
      const map = new Map<string, unknown>();
      return {
        keys: () => Array.from(map.keys()),
        get: <T>(k: string, def?: T): T | undefined => (map.has(k) ? (map.get(k) as T) : def),
        update: async (k: string, v: unknown) => {
          map.set(k, v);
        },
      };
    };
    ext.activate({
      subscriptions: [],
      extensionUri: MockUri.file(path.resolve(__dirname, '../..')),
      workspaceState: createMockMemento(),
      globalState: createMockMemento(),
    });
  }
} catch {
  // Ignore if extension cannot be activated in isolated test run
}

