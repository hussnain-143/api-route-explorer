/**
 * Extension constants and brand identity configuration.
 * Strictly adheres to Emerald Green + Teal + Cyan palette.
 */

export const COMMANDS = {
  SCAN_ROUTES: 'apiRouteExplorer.scan',
  REFRESH_ROUTES: 'apiRouteExplorer.refresh',
} as const;

export const VIEWS = {
  ROUTES: 'apiRouteExplorer.routesView',
  EXPLORER_ROUTES: 'apiRouteExplorer.explorerRoutesView',
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
  SPRINT_0_SCAN_PLACEHOLDER: 'Route scanning will be available in Sprint 1.',
  NO_ROUTES_TITLE: 'No routes discovered yet',
  NO_ROUTES_DESCRIPTION: 'Scan your workspace to discover API routes.',
} as const;
