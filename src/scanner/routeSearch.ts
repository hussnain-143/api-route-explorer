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
 * Uses label for method + path, description for relative file path & handler,
 * and detail for line info and framework.
 */
export function createRouteQuickPickItem(route: ApiRoute): RouteQuickPickItem {
  const relativePath = getRelativeFilePath(route.filePath);
  let fwName = 'Express';
  if (route.framework === 'nextjs' || route.framework === 'next') {
    fwName = 'Next.js';
  } else if (route.framework === 'fastify') {
    fwName = 'Fastify';
  } else if (route.framework === 'nestjs') {
    fwName = 'NestJS';
  }

  const handlerSuffix = route.handlerName ? ` • ${route.handlerName}` : '';
  const description = `${relativePath}${handlerSuffix}`;
  const detail = `Line ${route.line + 1} • ${fwName}`;

  return {
    label: `${route.method} ${route.path}`,
    description,
    detail,
    iconPath: getMethodIcon(route.method),
    route,
  };
}

/**
 * Finds routes that share the same base path segment or similar resource pattern.
 */
export function findSimilarRoutes(route: ApiRoute, allRoutes: ApiRoute[]): ApiRoute[] {
  const segments = route.path.split('/').filter(Boolean);
  if (segments.length === 0) {
    return allRoutes.filter((r) => !(r.method === route.method && r.filePath === route.filePath && r.line === route.line));
  }
  const rootSegment = segments[0].toLowerCase();
  return allRoutes.filter((r) => {
    if (r.method === route.method && r.filePath === route.filePath && r.line === route.line) {
      return false;
    }
    const rSegs = r.path.split('/').filter(Boolean);
    return rSegs.length > 0 && rSegs[0].toLowerCase() === rootSegment;
  });
}

/**
 * Opens a native VS Code QuickPick allowing developers to search routes
 * by HTTP method, route path, filename, folder, framework, or handler.
 *
 * @param routes The currently discovered ApiRoute collection.
 * @param hasScanned Boolean indicating whether an initial workspace scan was performed.
 * @param initialQuery Optional initial search query to populate.
 */
export async function showRouteQuickPick(
  routes: ApiRoute[],
  hasScanned: boolean,
  initialQuery?: string
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
  quickPick.placeholder = 'Search by method, path, framework, file, or handler (e.g. GET users, nestjs auth)...';
  quickPick.matchOnDescription = true;
  quickPick.matchOnDetail = true;
  quickPick.items = routes.map(createRouteQuickPickItem);

  if (initialQuery) {
    quickPick.value = initialQuery;
  }

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
