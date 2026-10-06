import type * as vscodeTypes from 'vscode';
import { ApiRoute, HttpMethod } from '../models/route';
import {
  findDuplicateRoutes,
  findSharedPathGroups,
  DuplicateRouteGroup,
  RoutePathGroup,
} from './duplicateDetector';
import type { RouteAnalysisResult } from './routeAnalyzer';

import type { RouteConflict, RouteRelationship } from './analysisTypes';

/**
 * Metric breakdown across discovered routes.
 */
export interface RouteStatistics {
  totalRoutes: number;
  totalFiles: number;
  methodCounts: Record<HttpMethod, number>;
  duplicateCount: number;
  sharedPathCount: number;
  framework: string;
  frameworkCounts?: Record<string, number>;
  healthyCount: number;
  warningCount: number;
  errorCount: number;
  potentialConflictCount: number;
  middlewareReferenceCount: number;
}

/**
 * Computes comprehensive route analytics and statistics.
 *
 * @param routes All discovered and analyzed API routes.
 * @param precomputedDuplicates Optional precomputed duplicate groups.
 * @param precomputedSharedPaths Optional precomputed shared path groups.
 * @param precomputedConflicts Optional precomputed route conflicts.
 * @param precomputedRelationships Optional precomputed route relationships.
 * @returns Complete RouteStatistics object.
 */
export function calculateRouteStatistics(
  routes: ApiRoute[],
  precomputedDuplicates?: DuplicateRouteGroup[],
  precomputedSharedPaths?: RoutePathGroup[],
  precomputedConflicts?: RouteConflict[],
  precomputedRelationships?: Map<string, RouteRelationship>
): RouteStatistics {
  const duplicates = precomputedDuplicates ?? findDuplicateRoutes(routes);
  const sharedPaths = precomputedSharedPaths ?? findSharedPathGroups(routes);

  const uniqueFiles = new Set(routes.map((r) => r.filePath));

  const methodCounts: Record<HttpMethod, number> = {
    GET: 0,
    POST: 0,
    PUT: 0,
    PATCH: 0,
    DELETE: 0,
    OPTIONS: 0,
    HEAD: 0,
    ANY: 0,
  };

  const frameworkCounts: Record<string, number> = {};

  for (const route of routes) {
    if (route.method in methodCounts) {
      methodCounts[route.method]++;
    }
    let fw = 'Express';
    if (route.framework === 'nextjs' || route.framework === 'next') {
      fw = 'Next.js';
    } else if (route.framework === 'fastify') {
      fw = 'Fastify';
    } else if (route.framework === 'nestjs') {
      fw = 'NestJS';
    }
    frameworkCounts[fw] = (frameworkCounts[fw] || 0) + 1;
  }

  const fwKeys = Object.keys(frameworkCounts);
  let frameworkLabel = 'Express';
  if (fwKeys.length > 1) {
    frameworkLabel = fwKeys.map((k) => `${k} (${frameworkCounts[k]})`).join(', ');
  } else if (fwKeys.length === 1) {
    frameworkLabel = fwKeys[0];
  }

  // Count duplicate routes: sum of (routes in duplicate group - 1) or total duplicate entries
  const duplicateRouteInstances = duplicates.reduce(
    (sum, group) => sum + (group.routes.length > 1 ? group.routes.length - 1 : 0),
    0
  );

  let healthyCount = 0;
  let warningCount = 0;
  let errorCount = 0;
  let middlewareReferenceCount = 0;

  if (precomputedRelationships) {
    for (const rel of precomputedRelationships.values()) {
      if (rel.health === 'error') {
        errorCount++;
      } else if (rel.health === 'warning') {
        warningCount++;
      } else {
        healthyCount++;
      }
      middlewareReferenceCount += rel.middleware.length;
    }
  } else {
    errorCount = duplicateRouteInstances;
    warningCount = precomputedConflicts ? precomputedConflicts.length : 0;
    healthyCount = Math.max(0, routes.length - errorCount - warningCount);
  }

  const potentialConflictCount = precomputedConflicts ? precomputedConflicts.length : 0;

  return {
    totalRoutes: routes.length,
    totalFiles: uniqueFiles.size,
    methodCounts,
    duplicateCount: duplicateRouteInstances,
    sharedPathCount: sharedPaths.length,
    framework: frameworkLabel,
    frameworkCounts,
    healthyCount,
    warningCount,
    errorCount,
    potentialConflictCount,
    middlewareReferenceCount,
  };
}

/**
 * Formats statistics into a clean, human-readable summary string.
 */
export function formatRouteStatistics(stats: RouteStatistics): string {
  return [
    'API Route Statistics',
    '',
    `Routes: ${stats.totalRoutes}`,
    `Files: ${stats.totalFiles}`,
    '',
    'Health:',
    `Healthy: ${stats.healthyCount}`,
    `Warnings: ${stats.warningCount}`,
    `Errors: ${stats.errorCount}`,
    '',
    `GET: ${stats.methodCounts.GET}`,
    `POST: ${stats.methodCounts.POST}`,
    `PUT: ${stats.methodCounts.PUT}`,
    `PATCH: ${stats.methodCounts.PATCH}`,
    `DELETE: ${stats.methodCounts.DELETE}`,
    '',
    `Duplicate routes: ${stats.duplicateCount}`,
    `Shared paths: ${stats.sharedPathCount}`,
    `Potential conflicts: ${stats.potentialConflictCount}`,
    `Middleware references: ${stats.middlewareReferenceCount}`,
    `Framework: ${stats.framework}`,
  ].join('\n');
}

/**
 * Displays statistics in an interactive native VS Code QuickPick modal.
 * Clicking items enables interactive drill-downs and code jumps.
 *
 * @param stats Calculated RouteStatistics.
 * @param fullAnalysis Optional full analysis result for interactive drill-downs.
 */
export async function showRouteStatisticsModal(
  stats: RouteStatistics,
  fullAnalysis?: RouteAnalysisResult
): Promise<void> {
  let vscode: typeof vscodeTypes;
  try {
    vscode = require('vscode');
  } catch {
    return;
  }
  const quickPick = vscode.window.createQuickPick();
  quickPick.title = 'API Route Explorer: Statistics';
  quickPick.placeholder = `Total Routes: ${stats.totalRoutes} | Healthy: ${stats.healthyCount} | Warnings: ${stats.warningCount} | Errors: ${stats.errorCount}`;

  interface ActionItem extends vscodeTypes.QuickPickItem {
    actionType?: 'total' | 'method' | 'duplicates' | 'sharedPaths';
    targetMethod?: string;
  }

  const items: ActionItem[] = [
    {
      label: `$(symbol-event) Total Routes: ${stats.totalRoutes}`,
      description: `Across ${stats.totalFiles} source files • Click to search all`,
      detail: `Framework: ${stats.framework} • Healthy: ${stats.healthyCount}, Warnings: ${stats.warningCount}, Errors: ${stats.errorCount}`,
      actionType: 'total',
    },
    {
      label: `$(heart) Route Health: ${stats.healthyCount} Healthy`,
      description: `Warnings: ${stats.warningCount} • Errors: ${stats.errorCount}`,
      detail: `${stats.potentialConflictCount} potential conflict(s) • ${stats.middlewareReferenceCount} middleware reference(s)`,
    },
    {
      label: `$(arrow-down) GET: ${stats.methodCounts.GET}`,
      description: 'Read / Fetch endpoints • Click to search GET',
      actionType: 'method',
      targetMethod: 'GET',
    },
    {
      label: `$(add) POST: ${stats.methodCounts.POST}`,
      description: 'Create / Submission endpoints • Click to search POST',
      actionType: 'method',
      targetMethod: 'POST',
    },
    {
      label: `$(edit) PUT: ${stats.methodCounts.PUT}`,
      description: 'Full update endpoints • Click to search PUT',
      actionType: 'method',
      targetMethod: 'PUT',
    },
    {
      label: `$(diff-modified) PATCH: ${stats.methodCounts.PATCH}`,
      description: 'Partial update endpoints • Click to search PATCH',
      actionType: 'method',
      targetMethod: 'PATCH',
    },
    {
      label: `$(trash) DELETE: ${stats.methodCounts.DELETE}`,
      description: 'Removal endpoints • Click to search DELETE',
      actionType: 'method',
      targetMethod: 'DELETE',
    },
    {
      label: `$(warning) Duplicate Conflicts: ${stats.duplicateCount}`,
      description:
        stats.duplicateCount === 0
          ? '✓ No collisions detected'
          : `${stats.duplicateCount} duplicate signature(s) • Click to inspect`,
      actionType: 'duplicates',
    },
    {
      label: `$(split-horizontal) Shared Route Paths: ${stats.sharedPathCount}`,
      description: `${stats.sharedPathCount} path(s) supporting multiple HTTP methods • Click to inspect`,
      actionType: 'sharedPaths',
    },
  ];

  quickPick.items = items;

  quickPick.onDidAccept(async () => {
    const selected = quickPick.selectedItems[0] as ActionItem | undefined;
    quickPick.dispose();

    if (!selected || !selected.actionType) {
      return;
    }

    if (selected.actionType === 'total') {
      await vscode.commands.executeCommand('apiRouteExplorer.searchRoutes');
      return;
    }

    if (selected.actionType === 'method' && selected.targetMethod) {
      await vscode.commands.executeCommand('apiRouteExplorer.searchRoutes', selected.targetMethod);
      return;
    }

    if (selected.actionType === 'duplicates') {
      if (!fullAnalysis || fullAnalysis.duplicates.length === 0) {
        vscode.window.showInformationMessage('No duplicate route conflicts detected in this workspace.');
        return;
      }

      const dupItems = fullAnalysis.duplicates.flatMap((group) =>
        group.routes.map((route) => ({
          label: `${route.method} ${route.path}`,
          description: `Line ${route.line + 1}`,
          detail: route.filePath,
          route,
        }))
      );

      const picked = await vscode.window.showQuickPick(dupItems, {
        title: 'Duplicate Route Conflicts (Select to Jump)',
        placeHolder: 'Select a duplicate route to jump to its source code',
      });

      if (picked) {
        await vscode.commands.executeCommand('apiRouteExplorer.openRoute', picked.route);
      }
      return;
    }

    if (selected.actionType === 'sharedPaths') {
      if (!fullAnalysis || fullAnalysis.sharedPaths.length === 0) {
        vscode.window.showInformationMessage('No shared route paths discovered.');
        return;
      }

      const sharedPickItems = fullAnalysis.sharedPaths.map((group) => ({
        label: `$(split-horizontal) ${group.normalizedPath}`,
        description: `Methods: ${group.methods.join(', ')} (${group.routes.length} routes)`,
        group,
      }));

      const pickedShared = await vscode.window.showQuickPick(sharedPickItems, {
        title: 'Shared Route Paths (Multiple HTTP Methods)',
        placeHolder: 'Select a shared path to inspect its endpoint routes',
      });

      if (pickedShared) {
        const routeItems = pickedShared.group.routes.map((route) => ({
          label: `${route.method} ${route.path}`,
          description: `Line ${route.line + 1}`,
          detail: route.filePath,
          route,
        }));

        const pickedRoute = await vscode.window.showQuickPick(routeItems, {
          title: `Routes for ${pickedShared.group.normalizedPath}`,
          placeHolder: 'Select a route to jump to code',
        });

        if (pickedRoute) {
          await vscode.commands.executeCommand('apiRouteExplorer.openRoute', pickedRoute.route);
        }
      }
    }
  });

  quickPick.onDidHide(() => {
    quickPick.dispose();
  });

  quickPick.show();
}
