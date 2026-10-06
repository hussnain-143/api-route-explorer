# Changelog

All notable changes to the "api-route-explorer" extension will be documented in this file.

## [1.1.0] - Sprint 10: Developer Experience & v1.1 UX Upgrade

### Added
- **Multi-Dimensional Route Grouping**: Switch between `Group by File`, `Group by Framework`, `Group by HTTP Method`, and `Group by Route Health` directly from the TreeView toolbar without rescanning.
- **Advanced In-Memory Filtering**: Filter routes across Framework, HTTP Method, Health status (`Healthy`, `Warning`, `Error`, `Info`), State (`Duplicates`, `Shared Paths`, `Conflicts`, `Shadowed`, `Missing Handler`), and file/folder paths.
- **Route Inventory Export**: Native VS Code export dialog supporting structured machine-readable **JSON** and human-readable **Markdown** route inventories with health, middleware, and issue details.
- **New Developer Productivity Actions**:
  - `Copy Route URL`: Generates fully-qualified local test URLs using configurable `apiRouteExplorer.baseUrl`.
  - `Copy Route Definition`: Copies concise developer-readable representations (e.g. `GET /users/:id -> routes/users.ts:42`).
  - `Search Similar Routes`: Pre-fills search QuickPick with the base resource segment to find related endpoints.
- **Enhanced Route Search**: Multi-token QuickPick search matching across HTTP method, route path, framework, file name, parent folder, and controller handler name.
- **Workspace Configuration Settings**:
  - `apiRouteExplorer.defaultGrouping`: Set preferred startup grouping mode (`file`, `framework`, `method`, or `health`).
  - `apiRouteExplorer.baseUrl`: Configurable base URL for Route URL generation (defaults to `http://localhost:3000`).
  - `apiRouteExplorer.scan.exclude`: User-defined scan exclusions extending built-in safe defaults.
  - `apiRouteExplorer.autoRefresh`: Toggle automatic incremental route updates on file changes.

## [1.0.0] - v1.0 Production Release

### Added
- **Multi-Framework Route Discovery**: Native static discovery across Express.js, Next.js (App Router & Pages Router), Fastify, and NestJS without executing runtime code.
- **Interactive Route Explorer UI**: Dual-tree Explorer sidebar grouping routes by module/resource folder and individual endpoints with semantic HTTP method glyphs.
- **1-Click Source Code Navigation**: Jump directly to exact controller handler definitions, HTTP method exports, or decorators across all supported frameworks.
- **Route Intelligence & Health Analysis**: Automatic classification of endpoint health (`Healthy`, `Info`, `Warning`, `Error`) with detection of parameter collisions, missing handlers, and route shadowing.
- **Middleware & Guard Extraction**: Framework-aware detection of chained middleware in Express, pre-handlers in Fastify, and `@UseGuards()` / `@UseInterceptors()` in NestJS.
- **In-Memory Route Index & Search**: High-throughput indexed search via QuickPick with multi-index lookups across method, path, filename, and framework.
- **Scalability & Incremental Scanning**: Instant incremental re-parsing on single file edits, native VS Code progress reporting, cancellation support, and sub-second analysis on workspaces with 5,000+ routes.
- **Developer Productivity Tools**: One-click clipboard actions for Route Path, Route Signature, and reproducible `cURL` commands.

## [0.8.0] - Sprint 8: Performance & Large Project Optimization

### Added
- **In-Memory RouteIndex**: High-performance multi-index supporting O(1) file additions, deletions, renames, and rapid lookups by filePath, method, framework, path, normalizedPath, and route signature.
- **Incremental Route Scanning**: Fast incremental file updates when editing, creating, or deleting files, avoiding full workspace scans for localized changes.
- **Scan Cancellation Support**: Integrated `vscode.CancellationToken` to cancel in-flight scans cleanly when workspace changes or a new scan is triggered.
- **Native Progress Reporting**: Detailed scan and analysis progress feedback using `vscode.window.withProgress`.
- **Precomputed Conflict Analysis**: Segments and normalized paths precomputed per route, dropping stress analysis time by over 60%.
- **Optimized TreeView Rendering**: Pre-computed folder occurrence mapping reducing TreeView update time to under 10ms for 5,000+ routes.
- **Batched File Watcher**: Event batching and deduplication with safe exclusion of build, dependency, and output directories.

## [0.7.0] - Sprint 7: Advanced Route Intelligence

### Added
- Advanced route intelligence
- Route health analysis
- Potential route conflict detection
- Potential route shadowing detection
- Route-level middleware analysis
- Framework-aware route relationships
- Enhanced diagnostics
- Enhanced route analysis statistics
- Route health indicators

## [0.6.0] - Sprint 6: Fastify + NestJS Support

### Added
- Fastify route detection
- Fastify route() support
- Fastify prefix resolution
- NestJS controller detection
- NestJS HTTP decorator detection
- NestJS controller prefix composition
- Fastify/NestJS framework detection
- Fastify/NestJS route search and analysis
- Framework-aware duplicate detection

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