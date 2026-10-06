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
 * Safely merges built-in exclusions with user-configured exclusions.
 */
export function isIgnoredFile(uri: vscode.Uri): boolean {
  const normalizedPath = uri.fsPath.replace(/\\/g, '/');
  if (IGNORED_PATH_SEGMENTS.some((segment) => normalizedPath.includes(segment))) {
    return true;
  }

  try {
    const config = vscode.workspace.getConfiguration('apiRouteExplorer');
    const userExcludes: string[] = config.get('scan.exclude') || [];
    for (const item of userExcludes) {
      const clean = item.trim().replace(/^[\/\*]+|[\/\*]+$/g, '');
      if (clean && normalizedPath.includes(`/${clean}/`)) {
        return true;
      }
    }
  } catch {
    // Graceful fallback
  }

  return false;
}

/**
 * File mutation event types emitted by the watcher.
 */
export type FileChangeType = 'change' | 'create' | 'delete';

/**
 * File change descriptor containing the event type and file URI.
 */
export interface RouteFileChangeEvent {
  type: FileChangeType;
  uri: vscode.Uri;
}

/**
 * Callback signature for file change notifications.
 * Can be called with or without the list of batched events.
 */
export type RouteWatcherCallback = (events?: RouteFileChangeEvent[]) => Promise<void> | void;

/**
 * Creates a debounced FileSystemWatcher that triggers background route updates
 * when source files are modified, created, or deleted.
 *
 * Safe guarantees:
 * - Debounces rapid keystroke events (default 750ms).
 * - Batches multiple rapid changes into a deduplicated event set.
 * - Filters out node_modules, .git, and build artifacts.
 * - Disposes watcher and timers cleanly.
 *
 * @param onTriggerScan Async callback to trigger workspace scan or incremental update.
 * @param debounceMs Milliseconds to debounce file change events.
 * @returns Disposable to register in extension context subscriptions.
 */
export function createRouteFileWatcher(
  onTriggerScan: RouteWatcherCallback,
  debounceMs: number = 750
): vscode.Disposable {
  const watcher = vscode.workspace.createFileSystemWatcher(SCAN_INCLUDE_PATTERN);

  let timer: NodeJS.Timeout | undefined;
  const pendingEvents = new Map<string, RouteFileChangeEvent>();

  const queueEvent = (type: FileChangeType, uri: vscode.Uri) => {
    if (isIgnoredFile(uri)) {
      return;
    }

    pendingEvents.set(uri.fsPath, { type, uri });

    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      const batchedEvents = Array.from(pendingEvents.values());
      pendingEvents.clear();

      try {
        const result = onTriggerScan(batchedEvents);
        if (result instanceof Promise) {
          result.catch((err) => {
            console.error('[API Route Explorer] Auto-refresh scan error:', err);
          });
        }
      } catch (err) {
        console.error('[API Route Explorer] Auto-refresh scan error:', err);
      }
    }, debounceMs);
  };

  const disposables: vscode.Disposable[] = [
    watcher,
    watcher.onDidChange((uri) => queueEvent('change', uri)),
    watcher.onDidCreate((uri) => queueEvent('create', uri)),
    watcher.onDidDelete((uri) => queueEvent('delete', uri)),
    {
      dispose: () => {
        if (timer) {
          clearTimeout(timer);
          timer = undefined;
        }
        pendingEvents.clear();
      },
    },
  ];

  return vscode.Disposable.from(...disposables);
}
