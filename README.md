# API Route Explorer

> **“See every API route. Jump straight to the code.”**

A developer-focused Visual Studio Code extension that discovers, organizes, and navigates API routes directly from the sidebar into your backend source code.

---

## Overview

Modern backend projects often grow into complex route matrices spread across routers, controllers, and middleware files. **API Route Explorer** bridges the gap between API routes and the code defining them by scanning project files, assembling an interactive route hierarchy in the VS Code Explorer sidebar, and enabling instant 1-click navigation directly to route handlers.

### Key Capabilities (Planned)
- 🧭 **Sidebar Route Tree**: Discovers and groups API endpoints by module and resource.
- ⚡ **1-Click Code Jump**: Click any route to jump directly to its controller definition line.
- 🏷️ **HTTP Method Badges**: Visual recognition for GET, POST, PUT, PATCH, and DELETE endpoints.
- 🔍 **Route Filtering**: Fast filtering by route path, HTTP method, or controller name.
- ⚠️ **Diagnostics**: Detect duplicate route definitions and unhandled endpoints.

---

## Supported Frameworks

### 1. Express.js
- Full support for `app.get()`, `app.post()`, `router.put()`, `router.delete()`, etc.
- Router prefix composition via `app.use('/prefix', router)` and nested sub-router chaining.
- Dynamic route parameters (`:id`, `:userId`) and middleware chain inspection.

### 2. Next.js
> **Next.js support includes App Router and Pages Router API route discovery.**

- **Next.js App Router**:
  - Route handler files: `app/**/route.{ts,js,tsx,jsx}` and `src/app/**/route.{ts,js,tsx,jsx}`.
  - Named HTTP method exports: `export async function GET()`, `POST()`, `PUT()`, `PATCH()`, `DELETE()`, `HEAD()`, `OPTIONS()`.
  - Dynamic route parameters: `[id]` → `:id`.
  - Catch-all route parameters: `[...slug]` and `[[...slug]]` → `*slug`.
  - Route groups: `app/(dashboard)/api/users/route.ts` → `/api/users` (route groups in parentheses are omitted from public URLs).
  - Source navigation: Jumps directly to the specific HTTP method export declaration line.
- **Next.js Pages Router**:
  - API routes under `pages/api/**` and `src/pages/api/**`.
  - Dynamic routes: `pages/api/users/[id].ts` → `/api/users/:id`.
  - Runtime method checks (`req.method === 'GET'`) or fallback generic `ANY` endpoint.

### 3. Fastify
- Standard HTTP methods: `fastify.get()`, `post()`, `put()`, `patch()`, `delete()`, `head()`, `options()`.
- Instance variations: `fastify.*`, `app.*`, `server.*`, `api.*`.
- Multi-method route definitions: `fastify.route({ method: ['GET', 'POST'], url: '/users', handler })`.
- Dynamic parameters: `/users/:id` with parameter normalization.
- Static plugin prefix resolution: `fastify.register(plugin, { prefix: '/api/v1' })`.

### 4. NestJS
- Controller decorator detection: `@Controller('users')`, `@Controller()`, `@Controller('/api/users')`.
- HTTP method decorators: `@Get()`, `@Post()`, `@Put()`, `@Patch()`, `@Delete()`, `@Head()`, `@Options()`.
- Controller prefix composition: `@Controller('users')` + `@Get(':id')` → `GET /users/:id`.
- Exact decorator navigation: Clicking jumps directly to `@Get(':id')` line and column.
- False positive immunity: Non-HTTP decorators like `@Injectable()` and `@Module()` are cleanly ignored.

---

## Current Status: Sprint 8 — Performance & Large Project Optimization (v0.8.0)

The extension is optimized for high scalability across large real-world projects, comfortably handling workspaces with thousands of files and routes through in-memory indexing, incremental scanning, precomputed analysis, and scan cancellation.

### Capabilities Matrix
```text
✓ Multi-framework architecture (Express.js, Next.js, Fastify, NestJS)
✓ In-memory RouteIndex for rapid O(1) file additions, deletions, and multi-index lookups
✓ Incremental scanning for instant updates on single file edits without full rescan
✓ Native VS Code progress reporting and cancellation support
✓ Precomputed conflict and route relationship analysis
✓ Route health analysis (Healthy, Info, Warning, Error)
✓ Potential route conflict & shadowing detection
✓ Route-level middleware extraction & grouping
✓ Framework-scoped duplicate & shared path detection
✓ Express & Fastify prefix composition
✓ Rich VS Code diagnostics
✓ High-throughput TreeView rendering (< 10ms for 5,000 routes)
✓ 1-Click code navigation directly to route handlers
```

---

## Performance & Scalability

API Route Explorer is built to remain responsive as projects grow from hundreds to thousands of routes.

### Architectural Optimizations
1. **In-Memory RouteIndex**: Maintains indexes across files, frameworks, HTTP methods, paths, normalized paths, and signatures. Mutations execute in O(1) time.
2. **Incremental Route Processing**: When a route file is saved, only the affected file is re-parsed and updated in the index, avoiding full workspace scans for localized changes.
3. **Scan Cancellation & Concurrency Protection**: Long scans support VS Code's `CancellationToken`. Rapid rescans automatically cancel obsolete in-flight scans.
4. **Native Progress Reporting**: Real-time progress feedback via `vscode.window.withProgress`.
5. **Precomputed Analysis**: Route segments and normalized paths are precomputed once per route, reducing conflict detection overhead by over 60%.
6. **Optimized TreeView Rendering**: Folder disambiguation is precomputed in O(F) time, rendering thousands of routes in under 10ms.

### Performance Benchmarks

| Project Size | Routes | Files | Scan Time | Analysis Time | TreeView Render | Total Time |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Small** | 96 | 12 | 29 ms | 26 ms | 1 ms | 58 ms |
| **Medium** | 476 | 62 | 78 ms | 16 ms | 1 ms | 99 ms |
| **Large** | 950 | 125 | 124 ms | 32 ms | 1 ms | 165 ms |
| **Stress** | 4,750 | 625 | 478 ms | 468 ms | 9 ms | 975 ms |

- **Incremental File Change**: ~30 ms (re-parses single file and re-evaluates analysis without scanning filesystem).
- **In-Memory Index Lookups**: ~827 ns per lookup across 40,000 lookups.

---

## Route Intelligence

### 1. Route Health Evaluation
Every endpoint receives a deterministic health status:
- **Healthy**: No route conflicts, missing handlers, or duplicate declarations.
- **Info**: Informational status (e.g., protected by middleware).
- **Warning**: Potential route overlap or possible route shadowing that may intercept traffic depending on registration order.
- **Error**: High-confidence issues requiring attention (duplicate route definitions or missing handlers).

### 2. Route Conflict & Shadowing Detection
Identifies routes that collide in URL matching space:
- **Static vs Parameter Overlaps**: e.g. `GET /users/:id` and `GET /users/me`.
- **Order-Sensitive Shadowing**: If `GET /users/:id` is declared before `GET /users/me` in the same file, the dynamic route captures requests meant for the specific endpoint. Flagged as `Possible route shadowing`.
- **Catch-All Overlaps**: e.g. `/files/*path` and `/files/:id`.

### 3. Middleware & Guard Analysis
Extracts route-level middleware without runtime overhead:
- **Express**: Extracts chained middleware identifiers (e.g. `router.get('/users', authenticate, authorize, handler)`).
- **Fastify**: Detects route `preHandler` and `preValidation` configurations.
- **NestJS**: Identifies `@UseGuards(AuthGuard)` and `@UseInterceptors(LoggingInterceptor)`.
- **Middleware Grouping**: Visualizes all routes protected by each middleware in the Route Analysis view.

### 4. Interactive Diagnostics
Publishes concise, actionable warnings directly to VS Code's Problems panel:
- `Duplicate route: GET /api/users` (Error)
- `Possible route shadowing: GET /users/:id may capture GET /users/me` (Warning)
- `Potential route conflict: GET /users/:id overlaps with GET /users/me` (Warning)
- `Possible missing handler for GET /users` (Warning)

---

## Supported Frameworks

| Framework | Status | Target Sprint |
| :--- | :--- | :--- |
| **Express (Node.js)** | ✅ Full Discovery, Navigation & Intelligence | Sprint 1–4, 7 |
| **Next.js (App & Pages Router)** | ✅ Full Discovery, Navigation & Intelligence | Sprint 5, 7 |
| **Fastify** | ✅ Full Discovery, Navigation & Intelligence | Sprint 6, 7 |
| **NestJS** | ✅ Full Discovery, Navigation & Intelligence | Sprint 6, 7 |

---

## Development Roadmap

- [x] **Sprint 0: Project Foundation**
  - TypeScript project initialization and strict type checking
  - Native VS Code Explorer TreeView integration (`API Routes`)
  - Domain models (`ApiRoute`, `HttpMethod`, `ApiFramework`)
  - Placeholder empty state and command architecture
  - Clean brand tokens (Emerald Green, Teal, Cyan)
- [x] **Sprint 1: Express Route Detection**
  - Workspace scanner inspecting `.js`, `.jsx`, `.ts`, `.tsx` files
  - Detection for `app.(get|post|put|patch|delete)` and `router.(get|post|put|patch|delete)`
  - Exact 0-based line and column location calculation
  - Comment masking to prevent false positives in inactive code
  - Integration with `apiRouteExplorer.scan` command
- [x] **Sprint 2: Sidebar TreeView Route Display & Navigation**
  - Two-level TreeView with source file groups and route items
  - 1-Click jump to route definition line in code editor
  - Distinct HTTP method icons (GET, POST, PUT, PATCH, DELETE)
  - Rich Markdown tooltips with route metadata
  - Resilient missing file handling
  - Synchronized Scan and Refresh command flow
- [x] **Sprint 3: Developer Navigation & Route UX**
  - Fast QuickPick route search matching method, path, and file
  - Route path and route signature clipboard actions
  - Open containing source file action
  - Intelligent auto-refresh with debouncing
  - Active editor route awareness and TreeView synchronization
  - Concurrency-safe scanner queueing
- [x] **Sprint 4: Smart Route Analysis**
  - Static Express router prefix resolution (`app.use(prefix, router)`)
  - Duplicate route detection with path parameter normalization
  - Same-path / different-method shared path aggregation
  - Conservative possible missing handler analysis
  - Route statistics calculation and modal reporting
  - Integrated VS Code Diagnostics collection lifecycle
- [x] **Sprint 5: Multi-Framework Expansion**
  - Next.js App Router and Pages Router route detection
  - Framework adapter architecture and registry
- [x] **Sprint 6: Fastify + NestJS Support**
  - Fastify route detection (standard methods, `route()`, plugin prefixes)
  - NestJS controller detection, HTTP decorators (`@Get`, `@Post`, etc.)
  - NestJS controller prefix composition and exact source navigation
- [x] **Sprint 7: Advanced Route Intelligence**
  - Route health assessment (Healthy, Info, Warning, Error)
  - Static route conflict and order-dependent shadowing detection
  - Route-level middleware extraction and usage grouping
  - Expanded diagnostics and Route Analysis tree

---

## Getting Started (Development)

### Prerequisites
- [Visual Studio Code](https://code.visualstudio.com/) v1.90.0 or higher
- [Node.js](https://nodejs.org/) v18+ (tested on Node v24)
- npm

### Installation & Build
```bash
# Clone and navigate to extension folder
cd api-route-explorer

# Install dependencies
npm install

# Compile TypeScript
npm run compile
```

### Running the Extension
1. Open the project in VS Code.
2. Press `F5` to start a new **Extension Development Host** window.
3. Open the **Explorer** sidebar and look for the **API Routes** section.
4. Run the command `API Route Explorer: Scan Routes` or `API Route Explorer: Search Routes` from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).

---

## Extension Commands

| Command | Command ID | Description |
| :--- | :--- | :--- |
| **API Route Explorer: Scan Routes** | `apiRouteExplorer.scan` | Scans workspace files and discovers Express routes |
| **API Route Explorer: Refresh Routes** | `apiRouteExplorer.refresh` | Re-scans and refreshes the API Routes sidebar |
| **API Route Explorer: Search Routes** | `apiRouteExplorer.searchRoutes` | QuickPick search matching method, path, or filename |
| **API Route Explorer: Show Route Statistics** | `apiRouteExplorer.showStatistics` | Interactive metrics modal with duplicate & shared path drilldowns |
| **Open Route** | `apiRouteExplorer.openRoute` | Jumps to the exact route definition line in code |
| **Open File** | `apiRouteExplorer.openFile` | Opens the source file containing the route |
| **Copy Route** | `apiRouteExplorer.copyRoute` | Copies complete route signature (e.g. `GET /api/users`) |
| **Copy Route Path** | `apiRouteExplorer.copyRoutePath` | Copies route path only (e.g. `/api/users`) |

---

## Installation

### For Development
```bash
git clone <repository-url>
cd api-route-explorer
npm install
npm run compile
```

### From VSIX Package
In VS Code:
1. Open the **Extensions** view (`Cmd+Shift+X` / `Ctrl+Shift+X`).
2. Click the `...` (More Actions) menu in the top-right of the Extensions view.
3. Select **Install from VSIX...**.
4. Choose `api-route-explorer-0.7.0.vsix`.

---

## Usage Workflow

1. Open any Node.js backend workspace using Express, Next.js, Fastify, or NestJS in VS Code.
2. Click the **API Route Explorer** icon in the Activity Bar.
3. Click **Scan Routes** (or press `Cmd+Shift+P` and execute `API Route Explorer: Scan Routes`).
4. Browse endpoints organized by file in **API Routes** and inspect health in **Route Analysis**.
5. Press `Cmd+Shift+P` and run `API Route Explorer: Search Routes` to instantly find any endpoint.
6. Click any route item to jump straight to its source code definition.

---

## Version

- **Current Version**: `0.7.0` (Sprint 7 — Advanced Route Intelligence)
- **Frameworks Supported**: Express.js, Next.js, Fastify, NestJS (JavaScript & TypeScript)
- **License**: MIT
