import * as vscode from 'vscode';
import { ApiRoute } from '../models/route';
import { getMethodIcon, getRelativeFilePath } from '../providers/routeTreeProvider';
import { MESSAGES } from '../utils/constants';
import { openRoute } from '../utils/navigation';

/**
 * Extension of QuickPickItem holding the underlying ApiRoute reference.
 */
export interface RouteQuickPickItem extends vscode.QuickPickItem {
  route: ApiRoute;
}

/**
 * Converts an ApiRoute into a searchable QuickPickItem.
 * Uses label for method + path, description for relative file path, and detail for line info.
 */
export function createRouteQuickPickItem(route: ApiRoute): RouteQuickPickItem {
  const relativePath = getRelativeFilePath(route.filePath);
  return {
    label: `${route.method} ${route.path}`,
    description: relativePath,
    detail: `Line ${route.line + 1} • Express`,
    iconPath: getMethodIcon(route.method),
    route,
  };
}

/**
 * Opens a native VS Code QuickPick allowing developers to search routes
 * by HTTP method, route path, or filename.
 *
 * Safe handling: alerts user if search is invoked before scanning or if 0 routes were found.
 *
 * @param routes The currently discovered ApiRoute collection.
 * @param hasScanned Boolean indicating whether an initial workspace scan was performed.
 */
export async function showRouteQuickPick(
  routes: ApiRoute[],
  hasScanned: boolean
): Promise<void> {
  if (!hasScanned) {
    vscode.window.showWarningMessage(MESSAGES.SEARCH_NO_SCAN);
    return;
  }

  if (routes.length === 0) {
    vscode.window.showInformationMessage(MESSAGES.NO_ROUTES_FOUND);
    return;
  }

  const quickPick = vscode.window.createQuickPick<RouteQuickPickItem>();
  quickPick.title = 'API Route Explorer: Search Routes';
  quickPick.placeholder = 'Search by method, path, or file (e.g. GET, users, search.routes.js)...';
  quickPick.matchOnDescription = true;
  quickPick.matchOnDetail = true;
  quickPick.items = routes.map(createRouteQuickPickItem);

  quickPick.onDidAccept(async () => {
    const selected = quickPick.selectedItems[0];
    if (selected) {
      await openRoute(selected.route);
    }
    quickPick.dispose();
  });

  quickPick.onDidHide(() => {
    quickPick.dispose();
  });

  quickPick.show();
}
