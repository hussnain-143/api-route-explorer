/**
 * Extension constants and brand identity configuration.
 * Strictly adheres to Emerald Green + Teal + Cyan palette.
 */

export const COMMANDS = {
  SCAN_ROUTES: 'apiRouteExplorer.scan',
  REFRESH_ROUTES: 'apiRouteExplorer.refresh',
  SEARCH_ROUTES: 'apiRouteExplorer.searchRoutes',
  OPEN_ROUTE: 'apiRouteExplorer.openRoute',
  OPEN_FILE: 'apiRouteExplorer.openFile',
  COPY_ROUTE: 'apiRouteExplorer.copyRoute',
  COPY_ROUTE_PATH: 'apiRouteExplorer.copyRoutePath',
} as const;

export const VIEWS = {
  ROUTES: 'apiRouteExplorer.routesView',
  EXPLORER_ROUTES: 'apiRouteExplorer.explorerRoutesView',
} as const;

export const CONTEXT_VALUES = {
  ROUTE: 'apiRouteExplorer.route',
  FILE_GROUP: 'apiRouteExplorer.fileGroup',
  PLACEHOLDER: 'apiRouteExplorer.placeholder',
} as const;

export const BRAND_COLORS = {
  PRIMARY_EMERALD: '#10B981',
  SECONDARY_TEAL: '#14B8A6',
  ACCENT_CYAN: '#06B6D4',
  DEEP_BACKGROUND: '#0B1220',
  DARK_SURFACE: '#111827',
  SLATE: '#1F2937',
  LIGHT_BACKGROUND: '#F8FAFC',
  WHITE: '#FFFFFF',
  SUCCESS: '#22C55E',
  WARNING: '#F59E0B',
  ERROR: '#EF4444',
} as const;

export const MESSAGES = {
  NO_WORKSPACE: 'No workspace is open.',
  NO_ROUTES_FOUND: 'No API routes found.',
  NO_ROUTES_TITLE: 'No routes discovered yet',
  NO_ROUTES_DESCRIPTION: 'Scan your workspace to discover API routes.',
  NO_ROUTES_EMPTY_DESCRIPTION: 'No Express routes discovered in workspace.',
  SEARCH_NO_SCAN: 'No routes discovered yet. Run Scan Routes first.',
  ROUTE_PATH_COPIED: 'Route path copied.',
  ROUTE_COPIED: 'Route copied.',
  FILE_NOT_FOUND: 'Route source file no longer exists or could not be opened.',
} as const;
