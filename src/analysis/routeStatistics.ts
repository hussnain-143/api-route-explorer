import type * as vscodeTypes from 'vscode';
import { ApiRoute, HttpMethod } from '../models/route';
import {
  findDuplicateRoutes,
  findSharedPathGroups,
  DuplicateRouteGroup,
  RoutePathGroup,
} from './duplicateDetector';

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
}

/**
 * Computes comprehensive route analytics and statistics.
 *
 * @param routes All discovered and analyzed API routes.
 * @param precomputedDuplicates Optional precomputed duplicate groups.
 * @param precomputedSharedPaths Optional precomputed shared path groups.
 * @returns Complete RouteStatistics object.
 */
export function calculateRouteStatistics(
  routes: ApiRoute[],
  precomputedDuplicates?: DuplicateRouteGroup[],
  precomputedSharedPaths?: RoutePathGroup[]
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
  };

  for (const route of routes) {
    if (route.method in methodCounts) {
      methodCounts[route.method]++;
    }
  }

  // Count duplicate routes: sum of (routes in duplicate group - 1) or total duplicate entries
  const duplicateRouteInstances = duplicates.reduce(
    (sum, group) => sum + (group.routes.length > 1 ? group.routes.length - 1 : 0),
    0
  );

  return {
    totalRoutes: routes.length,
    totalFiles: uniqueFiles.size,
    methodCounts,
    duplicateCount: duplicateRouteInstances,
    sharedPathCount: sharedPaths.length,
    framework: 'Express',
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
    `GET: ${stats.methodCounts.GET}`,
    `POST: ${stats.methodCounts.POST}`,
    `PUT: ${stats.methodCounts.PUT}`,
    `PATCH: ${stats.methodCounts.PATCH}`,
    `DELETE: ${stats.methodCounts.DELETE}`,
    '',
    `Duplicate routes: ${stats.duplicateCount}`,
    `Shared paths: ${stats.sharedPathCount}`,
    `Framework: ${stats.framework}`,
  ].join('\n');
}

/**
 * Displays statistics in a native VS Code QuickPick modal with individual item breakdown.
 *
 * @param stats Calculated RouteStatistics.
 */
export async function showRouteStatisticsModal(stats: RouteStatistics): Promise<void> {
  let vscode: typeof vscodeTypes;
  try {
    vscode = require('vscode');
  } catch {
    return;
  }
  const quickPick = vscode.window.createQuickPick();
  quickPick.title = 'API Route Explorer: Statistics';
  quickPick.placeholder = `Total Routes: ${stats.totalRoutes} | Files: ${stats.totalFiles} | Duplicates: ${stats.duplicateCount}`;

  quickPick.items = [
    {
      label: `$(symbol-event) Total Routes: ${stats.totalRoutes}`,
      description: `Across ${stats.totalFiles} source files`,
      detail: `Framework: ${stats.framework}`,
    },
    {
      label: `$(arrow-down) GET: ${stats.methodCounts.GET}`,
      description: 'Read / Fetch endpoints',
    },
    {
      label: `$(add) POST: ${stats.methodCounts.POST}`,
      description: 'Create / Submission endpoints',
    },
    {
      label: `$(edit) PUT: ${stats.methodCounts.PUT}`,
      description: 'Full update endpoints',
    },
    {
      label: `$(diff-modified) PATCH: ${stats.methodCounts.PATCH}`,
      description: 'Partial update endpoints',
    },
    {
      label: `$(trash) DELETE: ${stats.methodCounts.DELETE}`,
      description: 'Removal endpoints',
    },
    {
      label: `$(warning) Duplicate Conflicts: ${stats.duplicateCount}`,
      description:
        stats.duplicateCount === 0
          ? 'No method & path collisions detected'
          : `${stats.duplicateCount} duplicate signature(s) detected`,
    },
    {
      label: `$(split-horizontal) Shared Route Paths: ${stats.sharedPathCount}`,
      description: `${stats.sharedPathCount} path(s) supporting multiple HTTP methods`,
    },
  ];

  quickPick.onDidAccept(() => {
    quickPick.dispose();
  });

  quickPick.onDidHide(() => {
    quickPick.dispose();
  });

  quickPick.show();
}
