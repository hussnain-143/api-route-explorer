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

## Current Status: Sprint 4 — Smart Route Analysis (v0.4.0)

The project is currently in **Sprint 4**. API Route Explorer introduces an intelligent static analysis layer that understands Express route relationships, mounts, duplicates, and health diagnostics without heavy AST overhead:

### Smart Route Analysis
```text
✓ Duplicate route detection
✓ Same-path/different-method awareness
✓ Express router prefix resolution
✓ Possible missing handler detection
✓ Route statistics
✓ Route diagnostics
```

#### 1. Express Router Prefix Composition
Resolves nested prefix mounts across files and within the same file (e.g. `app.use('/api/v1', router)` + `router.get('/users', ...)` resolves to `GET /api/v1/users`).
- Searches and matches work directly against the fully resolved route path while source navigation jumps straight to the original handler definition.
- Chained sub-routers (e.g. `app.use('/api', v1Router)` -> `v1Router.use('/users', userRouter)`) are statically traced.

#### 2. Duplicate Route Detection vs Shared Paths
A route is considered a duplicate only when **both** the HTTP method and normalized route path match:
```text
${method}:${normalizedPath}
```

- **Valid Shared Path (NOT a duplicate):**
  ```text
  GET    /api/users
  POST   /api/users
  PUT    /api/users
  DELETE /api/users
  ```
  These share the same endpoint path but represent distinct HTTP operations. They are grouped as a shared route path and **not** flagged as duplicate warnings.

- **Duplicate Route (DETECTED):**
  ```text
  GET /api/users
  GET /api/users
  ```
  Even if declared in different files (e.g., `userRoutes.ts` and `adminRoutes.ts`), this conflict is flagged with a diagnostic warning. Parameter names are also normalized (e.g., `GET /api/users/:id` and `GET /api/users/:userId` are detected as conflicting patterns).

#### 3. Possible Missing Handler Detection
Flags suspicious route declarations missing middleware or route handlers (e.g., `router.get('/users')`), using conservative detection to avoid false positives on valid middleware chains.

#### 4. Route Statistics Command
Run `API Route Explorer: Show Route Statistics` (`apiRouteExplorer.showStatistics`) via the Command Palette or the sidebar header icon to view comprehensive workspace route metrics:
- Total routes & unique files
- Breakdown by HTTP method (GET, POST, PUT, PATCH, DELETE)
- Duplicate route count
- Shared route path count
- Detected backend framework

#### 5. Native VS Code Diagnostics
Provides non-intrusive warnings directly in the Problems panel:
- `Duplicate route detected: GET /api/users`
- `Possible missing handler for GET /api/users`

Diagnostics are automatically synchronized on file changes, saves, deletions, or manual scans, and cleanly disposed.

---

## Supported Frameworks

| Framework | Status | Target Sprint |
| :--- | :--- | :--- |
| **Express (Node.js)** | ✅ Full Discovery, Navigation & Analysis | Sprint 1–4 |
| **Next.js (App & Pages Router)** | 📋 Planned | Sprint 5 |
| **Fastify** | 📋 Planned | Future |
| **NestJS** | 📋 Planned | Future |

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
- [ ] **Sprint 5: Multi-Framework Expansion**
  - Next.js App Router and Pages Router route detection

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
| **Open Route** | `apiRouteExplorer.openRoute` | Jumps to the exact route definition line in code |
| **Open File** | `apiRouteExplorer.openFile` | Opens the source file containing the route |
| **Copy Route** | `apiRouteExplorer.copyRoute` | Copies complete route signature (e.g. `GET /api/users`) |
| **Copy Route Path** | `apiRouteExplorer.copyRoutePath` | Copies route path only (e.g. `/api/users`) |

---

## Version

- **Current Version**: `0.3.0` (Sprint 3 — Developer Navigation & Route UX)
- **License**: MIT
