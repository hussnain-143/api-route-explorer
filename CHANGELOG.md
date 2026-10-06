# Changelog

All notable changes to the "api-route-explorer" extension will be documented in this file.

## [0.5.0] - Sprint 5: Multi-Framework Architecture + Next.js Support

### Added
- **Multi-Framework Route Architecture**: Pluggable framework abstraction layer (`FrameworkAdapter`, `FrameworkRegistry`, `FrameworkDetector`) isolating discovery logic from agnostic analysis and UI.
- **Next.js App Router Support**: Full discovery for route handler files (`app/**/route.{ts,js,tsx,jsx}` and `src/app/**/route.{ts,js,tsx,jsx}`).
- **Next.js Pages Router Support**: Discovery for API routes (`pages/api/**.{ts,js,tsx,jsx}` and `src/pages/api/**.{ts,js,tsx,jsx}`).
- **Next.js HTTP Method Export Detection**: Discovers `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, and `OPTIONS` exports with exact source line/column coordinates.
- **Dynamic & Catch-All Route Segments**: Converts `[id]` to `:id` and catch-all `[...slug]` / `[[...slug]]` to `*slug`.
- **Route Group Handling**: Strips parenthetical route groups like `(dashboard)` and `(auth)` from public URLs while preserving source file paths.
- **Framework-Aware Route Statistics**: Comprehensive breakdown of discovered routes across Express and Next.js.
- **Framework-Scoped Duplicate Detection**: Prevents false positive duplicate warnings between coexisting frameworks in mixed workspaces or monorepos.
- **Enhanced Route Search**: Instant filtering by method, path, filename, and framework (e.g. `next`, `express`).

## [0.4.0] - 2026-10-06 - Sprint 4 & 4.5: Smart Route Analysis & Release Hardening

### Added
- **Express Router Prefix Composition**: Static resolution of `app.use(prefix, router)` and `router.use(prefix, subRouter)` mounts across files and within the same file.
- **Hierarchical Router Chaining**: Traces multi-level sub-router mounts (e.g. `app.js` → `v1/index.js` → `search.routes.js`).
- **Duplicate Route Detection**: Identifies true route collisions matching `${method}:${normalizedPath}`, normalizing trailing slashes, redundant slashes, and path parameters (`:id`, `:userId`).
- **Same-Path / Different-Method Awareness**: Accurately classifies shared endpoints with different HTTP verbs (GET, POST, PUT, DELETE) as valid shared paths rather than duplicate collisions.
- **Possible Missing Handler Detection**: Flags suspicious route calls lacking handlers or middleware arguments while avoiding false positives on valid middleware chains.
- **Route Diagnostics Lifecycle**: Native VS Code Diagnostic warnings for duplicates and missing handlers, automatically synchronized with file changes and clean disposal.
- **Interactive Route Statistics**: `API Route Explorer: Show Route Statistics` (`apiRouteExplorer.showStatistics`) with drill-downs for shared paths, duplicates, and method search.
- **Dedicated Route Analysis Sidebar View**: Persistent `Route Analysis` view in the Activity Bar showing overview metrics, shared path drilldowns, collision status, and method distribution.
- **Analysis Badges in Route Listing**: Visual indicators in the route tree for shared paths (`Line X • Shared`), duplicates (`⚠️ Duplicate`), and missing handlers (`⚠️ Missing handler`).

### Hardening & Polish
- Full test suite passing with 50 automated tests covering unit, integration, parser, diagnostics, and UI providers.
- Real-world backend validation verified against 115 Express route declarations (118 mounted instances).
- Shorter temporary user data directory configuration to comply with macOS UNIX domain socket length limit during tests.
- Clean packaging configuration with `.vscodeignore` exclusions.

## [0.3.0] - Sprint 3: Developer Navigation & Route UX

### Added
- **Instant Route Search**: `API Route Explorer: Search Routes` (`apiRouteExplorer.searchRoutes`) QuickPick modal matching methods, paths, and filenames.
- **Context Menu Clipboard Actions**: Right-click route items to **Copy Route Path** or **Copy Route Signature**.
- **Source File Navigation**: **Open File** action to open containing route source files.
- **Intelligent Auto-Refresh**: Background workspace watcher with 750ms debouncing and concurrency protection.
- **Active Editor Route Awareness**: Synchronizes TreeView selection with the active editor cursor position.

## [0.2.0] - Sprint 2: Route Explorer UI & Navigation

### Added
- **Two-Level Route TreeView**: Files grouped by relative workspace path with alphabetical sorting and route count badges.
- **HTTP Method Badges**: Visual glyphs with semantic colors for GET, POST, PUT, PATCH, and DELETE.
- **1-Click Source Jump**: Clicking any route navigates directly to the exact definition line and column.
- **Rich Markdown Tooltips**: Hover tooltips displaying method, path, relative file location, line/col, and framework.

## [0.1.0] - Sprint 1: Express Route Detection

### Added
- **Express Route Discovery Engine**: Scans `.js`, `.jsx`, `.ts`, and `.tsx` files in the workspace.
- Detection for `app.(get|post|put|patch|delete)` and `router.(get|post|put|patch|delete)`.
- Accurate 0-based line and column calculation using offset indexer.
- Comment masking to prevent false positives in single-line and multi-line comments.

## [0.0.1] - Sprint 0: Project Foundation

### Added
- Project initialized with TypeScript, strict mode, and ESLint configuration.
- Native VS Code Explorer sidebar view: `API Routes` (`apiRouteExplorer.routesView`).
- `RouteTreeProvider` implementing `vscode.TreeDataProvider`.
- Intentional initial empty state: "No routes discovered yet" with guidance tooltip.
- Domain models: `ApiRoute`, `HttpMethod`, and `ApiFramework`.
- Command registration: `API Route Explorer: Scan Routes` and `Refresh Routes`.
- Brand design tokens and constants (Emerald Green, Teal, Cyan).
- Extension icon assets.