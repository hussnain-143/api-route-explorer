# API Route Explorer

> **“See every API route. Jump straight to the code.”**

A developer-focused Visual Studio Code extension that discovers, analyzes, searches, and navigates API routes directly inside VS Code.

---

## Overview

Modern backend projects often grow into complex route matrices spread across routers, controllers, and middleware files. **API Route Explorer** bridges the gap between API routes and the code defining them by scanning project files, assembling an interactive route hierarchy in the VS Code Activity Bar, and enabling instant 1-click navigation directly to route handlers.

### Key Capabilities
- 🧭 **Interactive Route Explorer**: Discovers and groups API endpoints by module, folder, and resource.
- ⚡ **1-Click Code Navigation**: Click any route to jump directly to its controller definition line.
- 🏷️ **HTTP Method Icons**: Visual recognition for GET, POST, PUT, PATCH, DELETE, and ANY endpoints.
- 🔍 **Instant In-Memory Search**: Fuzzy search by route path, HTTP method, or filename.
- 🩺 **Route Intelligence & Health**: Automatic detection of duplicate endpoints, route shadowing, and parameter collisions.
- 🛡️ **Middleware & Guard Analysis**: Framework-aware extraction of middleware chains, Fastify pre-handlers, and NestJS guards.
- 📊 **Route Statistics & Diagnostics**: Integrated Problems panel diagnostics and metrics modal.
- ⚡ **High Scalability & Incremental Scanning**: Sub-second performance on workspaces with 5,000+ routes with instant incremental file updates.

---

## Supported Frameworks

API Route Explorer provides first-class support for the following frameworks:

### 1. Express.js
- Standard HTTP methods: `app.get()`, `app.post()`, `router.put()`, `router.delete()`, etc.
- Router prefix composition via `app.use('/prefix', router)` and multi-level nested router chaining.
- Dynamic route parameters (`:id`, `:userId`) with parameter normalization.
- Chained route-level middleware extraction.

### 2. Next.js
- **App Router**:
  - Route handler files: `app/**/route.{ts,js,tsx,jsx}` and `src/app/**/route.{ts,js,tsx,jsx}`.
  - Named HTTP method exports: `export async function GET()`, `POST()`, `PUT()`, `PATCH()`, `DELETE()`, `HEAD()`, `OPTIONS()`.
  - Dynamic route parameters: `[id]` → `:id`.
  - Catch-all route parameters: `[...slug]` and `[[...slug]]` → `*slug`.
  - Route groups: `app/(dashboard)/api/users/route.ts` → `/api/users` (parentheses groups omitted from public URLs).
  - Source navigation: Jumps directly to the specific HTTP method export declaration line.
- **Pages Router**:
  - API routes under `pages/api/**` and `src/pages/api/**`.
  - Dynamic routes: `pages/api/users/[id].ts` → `/api/users/:id`.
  - Explicit method checks (`req.method === 'GET'`) or fallback generic `ANY` endpoint.

### 3. Fastify
- Standard HTTP methods: `fastify.get()`, `post()`, `put()`, `patch()`, `delete()`, `head()`, `options()`.
- Instance variations: `fastify.*`, `app.*`, `server.*`, `api.*`.
- Multi-method route definitions: `fastify.route({ method: ['GET', 'POST'], url: '/users', handler })`.
- Dynamic parameters: `/users/:id` with parameter normalization.
- Static plugin prefix resolution: `fastify.register(plugin, { prefix: '/api/v1' })`.
- Route-level pre-handlers: `preHandler` and `preValidation` inspection.

### 4. NestJS
- Controller decorator detection: `@Controller('users')`, `@Controller()`, `@Controller('/api/users')`.
- HTTP method decorators: `@Get()`, `@Post()`, `@Put()`, `@Patch()`, `@Delete()`, `@Head()`, `@Options()`.
- Controller prefix composition: `@Controller('users')` + `@Get(':id')` → `GET /users/:id`.
- Exact decorator navigation: Clicking jumps directly to `@Get(':id')` line and column.
- Route guards and interceptors: Extracts `@UseGuards(AuthGuard)` and `@UseInterceptors(LoggingInterceptor)`.
- False positive immunity: Non-HTTP decorators like `@Injectable()` and `@Module()` are cleanly ignored.

---

## Quick Start

1. Install **API Route Explorer** from the VS Code Marketplace or VSIX package.
2. Open any workspace containing an Express, Next.js, Fastify, or NestJS backend.
3. Click the **API Route Explorer** icon in the Activity Bar.
4. Click **Scan Routes** (or press `Cmd+Shift+P` / `Ctrl+Shift+P` and execute `API Route Explorer: Scan Routes`).
5. Browse your endpoints organized by file in **API Routes** and inspect health in **Route Analysis**.
6. Click any route item to jump straight to its code definition.

---

## How It Works

API Route Explorer uses offline, AST-aware static analysis without executing runtime code:

```text
Workspace Files
       ↓
Framework Detection & Registry
       ↓
Framework Adapters (Express / Next.js / Fastify / NestJS)
       ↓
In-Memory Route Index
       ↓
Route Intelligence Pipeline (Prefixes, Duplicates, Conflicts, Middleware, Health)
       ↓
VS Code UI (Sidebar TreeView / QuickPick Search / Diagnostics / Status Bar)
```

---

## Route Explorer (Sidebar UI)

The **API Routes** sidebar provides a clean two-level hierarchy:
- **Level 1 (Module/File)**: Groups routes by source file, showing developer-friendly module folder names (e.g. `booking` or `admin/booking`) rather than long, repetitive file paths.
- **Level 2 (Route Item)**: Displays each route with its HTTP method icon, public URL, declaration line number, and health indicator badge.
- **Method Filtering**: Filter the TreeView dynamically to show only `GET`, `POST`, `PUT`, `DELETE`, `Shared`, or `Duplicate` endpoints.

---

## Route Search

Press `Cmd+Shift+P` / `Ctrl+Shift+P` and run **API Route Explorer: Search Routes**:
- **Fuzzy Matching**: Matches against HTTP method, URL path, and filename.
- **Instant Response**: Operates entirely in memory on the pre-indexed route cache without filesystem latency.
- **Direct Jump**: Selecting any result opens the file and places your cursor directly at the route handler.

---

## Route Intelligence & Diagnostics

API Route Explorer evaluates every endpoint to ensure consistency and highlight potential issues:

### 1. Duplicate vs. Shared Path Distinction
- **Shared Paths (Valid API Design)**:
  ```text
  GET    /api/users
  POST   /api/users
  DELETE /api/users
  ```
  Recognized as a single endpoint supporting multiple HTTP methods (`Shared Paths: 1`, `Duplicates: 0`).
- **Duplicate Conflicts (Real Collision)**:
  ```text
  GET /api/users
  GET /api/users
  ```
  Flagged as a duplicate error in the Problems panel.
- **Parameter Normalization**:
  `/users/:id` and `/users/:userId` are recognized as the same endpoint pattern.

### 2. Route Overlap & Shadowing Detection
- **Static vs Parameter Overlaps**: e.g. `GET /users/me` and `GET /users/:id`.
- **Order-Sensitive Shadowing**: If `GET /users/:id` is registered *before* `GET /users/me` in the same file, the dynamic route captures requests intended for `/users/me`. API Route Explorer detects this registration order and issues a `Possible route shadowing` warning.

### 3. Middleware & Guard Analysis
- Extracts protecting middleware and groups endpoints by middleware usage in the **Route Analysis** view.

### 4. Route Health Classification
- 🟢 **Healthy**: Well-configured endpoint with no conflicts or warnings.
- 🔵 **Info**: Endpoint protected by middleware or shared path.
- 🟡 **Warning**: Potential route conflict or possible route shadowing.
- 🔴 **Error**: Exact duplicate route declaration or missing handler.

---

## Performance & Scalability

Built for large real-world codebases with thousands of routes:

### Architectural Optimizations
1. **In-Memory RouteIndex**: O(1) mutations and lookups across files, methods, frameworks, and path signatures.
2. **Incremental Route Scanning**: Editing a file re-parses only the affected file, updating the index in ~30 ms without scanning the filesystem.
3. **Scan Cancellation**: Background scans observe `vscode.CancellationToken`; rapid rescans cancel superseded scans instantly.
4. **Precomputed Analysis**: Route segments and normalized paths are cached, reducing conflict detection overhead by over 60%.
5. **Fast TreeView Updates**: Folder occurrence mapping precomputed in O(F) time, rendering thousands of routes in under 10ms.

### Benchmarks

| Project Size | Routes | Files | Scan Time | Analysis Time | TreeView Render | Total Time |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Small** | 96 | 12 | 18 ms | 24 ms | 1 ms | 45 ms |
| **Medium** | 476 | 62 | 30 ms | 13 ms | 1 ms | 50 ms |
| **Large** | 950 | 125 | 49 ms | 27 ms | 2 ms | 87 ms |
| **Stress** | 4,750 | 625 | 258 ms | 554 ms | 37 ms | 887 ms |

- **Incremental File Update**: ~30 ms (instant re-analysis without workspace scan).
- **In-Memory Index Lookups**: ~845 ns per lookup.

---

## Extension Commands

| Command | Command ID | Description |
| :--- | :--- | :--- |
| **Scan Routes** | `apiRouteExplorer.scan` | Scans workspace and discovers API routes |
| **Refresh Routes** | `apiRouteExplorer.refresh` | Re-scans and updates the sidebar |
| **Search Routes** | `apiRouteExplorer.searchRoutes` | QuickPick search matching method, path, or file |
| **Filter by HTTP Method** | `apiRouteExplorer.filterByMethod` | Filter sidebar routes by method or duplicate/shared condition |
| **Quick Hub Menu** | `apiRouteExplorer.statusBarMenu` | Status bar quick actions for search, filters, and stats |
| **Show Route Statistics** | `apiRouteExplorer.showStatistics` | Interactive metrics modal with duplicate & shared path breakdown |
| **Open Route** | `apiRouteExplorer.openRoute` | Jumps to the exact route definition line in code |
| **Open File** | `apiRouteExplorer.openFile` | Opens the source file containing the route |
| **Copy Route** | `apiRouteExplorer.copyRoute` | Copies route signature (e.g. `GET /api/users`) |
| **Copy Route Path** | `apiRouteExplorer.copyRoutePath` | Copies route path only (e.g. `/api/users`) |
| **Copy as cURL** | `apiRouteExplorer.copyCurl` | Copies reproducible curl command to clipboard |

---

## Examples

### 1. Express Router with Mount Prefixes
```javascript
// src/app.js
const express = require('express');
const app = express();
const userRouter = require('./routes/userRoutes');
app.use('/api/v1', userRouter);

// src/routes/userRoutes.js
const router = express.Router();
router.get('/users', authMiddleware, getUsers);
router.post('/users', authMiddleware, createUser);
router.get('/users/:id', authMiddleware, getUserById);
module.exports = router;
```
Discovered routes:
- `GET /api/v1/users` (Line 2, `userRoutes.js`)
- `POST /api/v1/users` (Line 3, `userRoutes.js`)
- `GET /api/v1/users/:id` (Line 4, `userRoutes.js`)

### 2. Next.js App Router
```typescript
// app/api/orders/[id]/route.ts
export async function GET(request: Request, { params }: { params: { id: string } }) { ... }
export async function DELETE(request: Request, { params }: { params: { id: string } }) { ... }
```
Discovered routes:
- `GET /api/orders/:id`
- `DELETE /api/orders/:id`

### 3. NestJS Controller
```typescript
// src/billing/billing.controller.ts
@Controller('billing')
export class BillingController {
  @Get('invoices')
  @UseGuards(JwtAuthGuard)
  getInvoices() { ... }
}
```
Discovered routes:
- `GET /billing/invoices` (Protected by `JwtAuthGuard`)

---

## Troubleshooting

- **No routes discovered**: Ensure your project files are within the opened VS Code workspace and use supported file extensions (`.js`, `.jsx`, `.ts`, `.tsx`). Run `API Route Explorer: Scan Routes` from the Command Palette.
- **Large workspace scanning**: Build directories (`node_modules`, `.git`, `.next`, `dist`, `build`, `coverage`, `out`) are automatically excluded to preserve performance.
- **Router prefix not resolving**: Ensure your router mounting file (`app.js` or `server.ts`) is part of the workspace. Prefix resolution traces direct `require` and `import` references.

---

## Requirements

- VS Code version `1.90.0` or higher.
- Zero runtime dependencies.

---

## Development & Testing

```bash
# Clone repository
git clone https://github.com/api-route-explorer/api-route-explorer.git
cd api-route-explorer

# Install dev dependencies
npm install

# Compile TypeScript
npm run compile

# Run tests
npm test

# Run ESLint
npm run lint

# Build VSIX package
npm run package
```

---

## License

MIT © [API Route Explorer Contributors](LICENSE)
