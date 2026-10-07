# Changelog

All notable changes to the "api-route-explorer" extension will be documented in this file.

## [1.5.0] - Sprint 15: MVP Integration & UX (Feature Freeze)

### Connected & Polished
- **Unified Developer Workflow (Discover → Analyze → Test → Document)**:
  - Formed one continuous product experience connecting Discovery, Health Analysis, HTTP Client testing, and OpenAPI generation.
  - Declared formal **Feature Freeze** for the MVP.
- **Route → HTTP Client Integration & Action Triad**:
  - Implemented the streamlined route action triad across the TreeView and context menus:
    `[ Analyze ] [ Test API ] [ OpenAPI ]`.
  - Clicking **Test API** instantly opens the HTTP Client pre-populated with method, base URL, converted route path, dynamic parameters, and default headers.
- **Route Context Preservation**:
  - Added `HttpClientRouteContext` model preserving route metadata (`method`, `path`, `sourceFile`, `sourceLine`, `sourceColumn`, `framework`, `handlerName`).
  - Added Route Context top banner in HTTP Client Webview displaying framework badge, route signature, and clickable source file location.
  - Added `openSource` message protocol: clicking the source file link in HTTP Client navigates directly to the route definition line in the active VS Code editor.
- **Route Analysis Hub (`apiRouteExplorer.analyzeRoute`)**:
  - Registered interactive analysis quick pick command providing immediate route health status, diagnostic issues, active middleware/guards count, and action options to jump to code, test API, or view OpenAPI.
- **Direct Route OpenAPI Operation Preview (`apiRouteExplorer.viewRouteOpenApi`)**:
  - Generates a dedicated OpenAPI 3.0.3 YAML operation definition for the selected route and opens an instant virtual editor preview with zero disk clutter.
- **Loading & Empty State Discipline**:
  - Polished empty and error states across the TreeView and HTTP Client with clear, actionable guidance explaining causes and resolution steps.
  - All asynchronous scanning and test operations resolve strictly to Success, Error, Empty, or Cancelled states.
- **Lightweight First-Run Experience**:
  - Introduced clean, non-intrusive first-run welcome notification prompting users to explore routes on initial extension activation.
  - Zero account requirements, zero telemetry, zero network dependency, and fully dismissible.
- **Theme & Accessibility Conformance**:
  - Verified UI rendering and high contrast ratios across VS Code Dark, Light, and High Contrast themes.
  - Full keyboard accessibility: Tab navigation, Enter to activate actions, Escape to cancel.
- **Automated Test Suite Expansion**:
  - Expanded test suite from 243 to **250 passing tests** (100% pass rate) with 0 regressions.
- **Solo Backend Real-World Validation**:
  - Validated against `/Users/husnain/Desktop/solo/solo-backend`: route discovery, route selection, dynamic parameter resolution, query parameters, headers, error responses, 404 responses, request cancellation, and OpenAPI generation.
  - Zero modifications to Solo Backend codebase (`Solo Backend source modifications: 0`).

## [1.4.0] - Sprint 14: HTTP Client Hardening & UX

### Fixed & Hardened
- **URL & Base-Path Resolution Architecture**:
  - Resolved base URL + route duplication bugs (e.g. `/api/v1/api/v1/health` or `/api/v1/admin/auth/api/v1/admin/auth/signin`).
  - Added segment-level suffix-prefix overlap deduplication in `resolveFullUrl` and `joinRoutePaths`.
  - Added repeating consecutive segment block collapsing (`collapseRepeatingSegments`) across URL construction and request validation.
  - Safe leading and trailing slash normalization for arbitrary API prefixes.
- **Dynamic Path Parameter UX (`{parameter}`)**:
  - Real-time parameter extraction for all dynamic parameters in route URLs.
  - Interactive parameter input cards with inline `{param}` labels.
  - Validation before dispatch: detects empty or missing required dynamic parameters and displays developer-friendly warning `Required path parameter "id" is missing.`.
  - Visual validation state highlighting missing inputs in red with automatic focus.
  - Safe URI encoding for parameter values containing special characters or spaces.
  - Query parameters and search strings are safely preserved during dynamic replacement.
- **Request Configuration UI Restructuring**:
  - Streamlined 4-tab request configuration: `Params`, `Headers`, `Body`, and `cURL`.
  - Live syntax-highlighted cURL preview updating in real-time as method, URL, parameters, headers, or payload change.
- **Response Presentation & Performance**:
  - Response metrics display: Status badge (`200 OK`, `401 Unauthorized`, `404 Not Found`, etc.), duration (`ms`), and payload size (`KB`/`B`).
  - Sub-tabs for formatted Response Body and structured Response Headers table.
  - Large payload safety safeguards: truncated view (>250 KB) preventing webview freezing.
- **Developer-Centric Error UX**:
  - Replaced raw Node.js error codes (`ECONNREFUSED`, `ETIMEDOUT`, `ENOTFOUND`) with formatted cards detailing target URL, possible causes, and technical error code.
- **Request Cancellation**:
  - Added `[ Cancel Request ]` button in request bar while requests are in flight.
  - Clean socket teardown, listener cleanup, and memory leak prevention via `HttpRequestService.cancel()`.
  - Cancellation yields `CANCELLED` status and resets UI state safely without rendering stale responses.
- **Native Clipboard Copy Actions**:
  - One-click copy actions for Request URL, Response Body, Response Headers, and generated cURL command using native VS Code clipboard APIs.
- **Regression Suite Expansion**:
  - Test suite expanded from 213 to **243 passing tests** (100% pass rate).

## [1.3.0] - Sprint 13: Interactive HTTP Client Webview

### Added
- **Interactive HTTP Client Webview (`apiRouteExplorer.openHttpClient`)**:
  - Direct endpoint testing from the TreeView sidebar without external clients or context switching.
  - Automatic pre-fill of HTTP method, converted path parameter syntax (`{id}`), and configured base URL.
  - Editable URL bar with real-time method selector (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`).
  - Path parameter detection and dedicated editable parameter inputs with validation against missing required parameters.
  - Query parameter table with active checkboxes, key/value editing, safe URL encoding, and row management.
  - Request headers table with add/remove controls, default JSON content-type insertion, and active toggles.
  - JSON request body editor for mutating methods with automatic syntax verification and one-click JSON formatting.
  - Reproducible **Copy as cURL** command generator reflecting active parameters, headers, and body payloads.
  - **Reset** button to restore request parameters back to the pristine discovered route state.
- **Response Inspector & Developer Metrics**:
  - Status pill with HTTP status code and text color-coded by response severity (2xx, 3xx, 4xx, 5xx).
  - High-precision request duration timing (`timeMs`) and payload size measurement (`sizeBytes`).
  - Automatic pretty-printing for JSON responses with safe fallback rendering for plain text and HTML.
  - Tabular response header viewer and one-click copy response body button.
  - Clear user-facing error reporting for connection refused (`ECONNREFUSED`), host not found (`ENOTFOUND`), timeouts, and invalid URLs.
- **Enterprise Security & VS Code Native Theming**:
  - Untrusted UI model with strict schema validation for all webview messages.
  - Strict Content Security Policy (CSP) with cryptographic nonces and zero unsafe scripts.
  - Extension Host network execution: zero `.env` scanning, zero secret exposure, and zero logging or persistence of sensitive credentials.
  - Seamless adaptation to VS Code Light, Dark, and High Contrast themes using native CSS variables.
  - Configurable request timeout setting: `apiRouteExplorer.httpClient.timeout` (default 10,000 ms).

## [1.2.0] - Sprint 12: Advanced API Intelligence — OpenAPI / Swagger Specification Generation

### Added
- **OpenAPI 3.0.3 Specification Generation**:
  - Automatically transforms discovered routes into standardized OpenAPI 3.0.3 API contracts without running the backend server.
  - Multi-framework route path conversion supporting Express colon parameters (`:id`), Next.js dynamic routes (`[id]`), catch-all routes (`[...slug]`), optional catch-all (`[[...slug]]`), Fastify, and NestJS parameters into standard `{param}` placeholders.
  - Automatic parameter definitions with `in: 'path'`, `required: true`, and `schema: { type: 'string' }`.
  - Automatic resource tag extraction based on top-level resource segments for clean Swagger UI organization.
  - Deterministic camelCase `operationId` generation with collision avoidance (e.g. `getUsers`, `getUsersById`).
  - Shared paths support: multiple HTTP methods on the same route are grouped under the same path item.
  - Graceful duplicate route handling: collapses multiple identical route declarations into a single OpenAPI operation without emitting duplicate JSON/YAML keys, tracking multiple declaration locations in extension metadata.
  - Safe Next.js Pages router wildcard (`ANY`) expansion into standard HTTP methods without overriding explicit routes.
  - Sensible default responses (`200`, `201`, `204`, `400`, `404`) and safe request body skeletons for `POST`, `PUT`, and `PATCH`.
- **Zero-Dependency YAML & JSON Export**:
  - Native VS Code export dialogs with file format selection: OpenAPI 3.0 YAML (`.yaml`) and OpenAPI 3.0 JSON (`.json`).
  - Supports filtered route export scope when sidebar filters are active.
  - Guaranteed deterministic output ordering for paths, methods, tags, and parameters.
  - Privacy safeguards: strictly prevents leaking local absolute machine paths (`/Users/...`) or environment variables into exported documents.
- **Commands & Configuration**:
  - `apiRouteExplorer.exportOpenApi`: Interactive dialog to choose format and save location.
  - `apiRouteExplorer.exportOpenApiYaml`: Direct export to OpenAPI YAML.
  - `apiRouteExplorer.exportOpenApiJson`: Direct export to OpenAPI JSON.
  - Configurable settings: `apiRouteExplorer.openapi.title`, `apiRouteExplorer.openapi.version`, and `apiRouteExplorer.openapi.includeSourceMetadata`.

## [1.1.1] - Sprint 11: User Feedback, Product Refinement & v1.1.1 Stability

### Refinements & Stability
- **Interactive TreeView UX & States**:
  - Placeholder tree items now include actionable 1-click commands: triggers Scan on unscanned/empty workspaces, and opens Filter dialog when active filters yield zero matches.
  - Added dedicated visual scanning progress state in the TreeView while workspace indexing is active.
  - Synchronized method and advanced filter option states to eliminate inconsistent filtering conditions.
- **Centralized & Defensive Route Formatters**:
  - Centralized URL and command formatters (`buildRouteUrl`, `buildRouteDefinition`, `buildCurlCommand`).
  - Added URL normalization handling missing protocols (defaults to `http://`), redundant slashes, and whitespace base URLs.
  - Enhanced cURL generation to support `HEAD` requests (`curl -I`) and safe fallback for Next.js wildcard `ANY` methods (`GET`).
  - Preserved dynamic parameter syntax (`:id`, `[slug]`) without inventing fictitious runtime values.
- **Navigation Boundary Resilience**:
  - Added automatic line and column clamping in `openRoute` against current editor line counts and text lengths, preventing crashes when navigating to routes in edited or truncated files.
- **Interactive Diagnostics Navigation**:
  - Attached `DiagnosticRelatedInformation` to duplicate route errors and potential conflict warnings in the Problems panel, enabling 1-click navigation to conflicting declarations.
- **Context-Aware Route Inventory Export**:
  - When filters are active, the Export command now prompts developers to select between exporting the filtered route subset or all discovered routes, generating appropriately named export files (`api-routes-filtered.json/.md`).
- **Watcher & Concurrency Hardening**:
  - Eliminated race conditions between full workspace scans and incremental file events, safely queuing pending scans.
  - Extended file watcher ignore filter to incorporate user-configured exclusions from `apiRouteExplorer.scan.exclude`.
- **Strict Code Quality & Type Safety**:
  - Removed remaining `any` type casts across extension core.
  - Expanded test suite to 166 passing tests with zero warnings or errors.

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