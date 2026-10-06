import * as vscode from 'vscode';
import { SCAN_INCLUDE_PATTERN } from './routeScanner';

/**
 * Ignored path substrings to prevent watching build/dependency directories.
 */
const IGNORED_PATH_SEGMENTS = [
  '/node_modules/',
  '/.git/',
  '/.next/',
  '/dist/',
  '/build/',
  '/coverage/',
  '/out/',
];

/**
 * Checks whether a file URI belongs to an ignored directory.
 */
export function isIgnoredFile(uri: vscode.Uri): boolean {
  const normalizedPath = uri.fsPath.replace(/\\/g, '/');
  return IGNORED_PATH_SEGMENTS.some((segment) => normalizedPath.includes(segment));
}

/**
 * Creates a debounced FileSystemWatcher that triggers background route scans
 * when source files are modified, created, or deleted.
 *
 * Safe guarantees:
 * - Debounces rapid keystroke events (default 750ms).
 * - Filters out node_modules, .git, and build artifacts.
 * - Disposes watcher and timers cleanly.
 *
 * @param onTriggerScan Async callback to trigger workspace scan.
 * @param debounceMs Milliseconds to debounce file change events.
 * @returns Disposable to register in extension context subscriptions.
 */
export function createRouteFileWatcher(
  onTriggerScan: () => Promise<void>,
  debounceMs: number = 750
): vscode.Disposable {
  const watcher = vscode.workspace.createFileSystemWatcher(SCAN_INCLUDE_PATTERN);

  let timer: NodeJS.Timeout | undefined;

  const handleFileEvent = (uri: vscode.Uri) => {
    if (isIgnoredFile(uri)) {
      return;
    }

    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      onTriggerScan().catch((err) => {
        console.error('[API Route Explorer] Auto-refresh scan error:', err);
      });
    }, debounceMs);
  };

  const disposables: vscode.Disposable[] = [
    watcher,
    watcher.onDidChange(handleFileEvent),
    watcher.onDidCreate(handleFileEvent),
    watcher.onDidDelete(handleFileEvent),
    {
      dispose: () => {
        if (timer) {
          clearTimeout(timer);
          timer = undefined;
        }
      },
    },
  ];

  return vscode.Disposable.from(...disposables);
}
