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

## Route Explorer & Grouping

The **API Routes** sidebar provides flexible, multi-dimensional organization:
- **Group by File (Default)**: Groups routes by source file, showing developer-friendly module folder names (e.g. `booking` or `admin/booking`) rather than long, repetitive file paths.
- **Group by Framework**: Organizes routes cleanly into **Express**, **Next.js**, **Fastify**, and **NestJS** top-level categories.
- **Group by HTTP Method**: Groups endpoints by HTTP verb (`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, etc.).
- **Group by Route Health**: Groups routes by diagnostic health status (`Errors`, `Warnings`, `Info`, `Healthy`).
- **Instant Grouping Switching**: Switch grouping dynamically from the view title menu (`apiRouteExplorer.groupBy`) without rescanning.

---

## Advanced Route Filtering

Filter your route inventory entirely in-memory:
- **By Framework**: Express, Next.js, Fastify, NestJS, or All.
- **By HTTP Method**: GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD.
- **By Health**: Healthy, Warnings, Errors, Info.
- **By Route State**: Duplicates, Shared Paths, Conflicts, Shadowed routes, or Missing Handlers.
- **By File / Folder**: Narrow down to specific submodules or filenames.
- **Multi-Token Free Text**: Query routes using multi-token search patterns (e.g. `GET users`, `nestjs auth`).

---

## Route Inventory Export

Export your entire API route catalog using native VS Code save workflows:
- **Structured JSON (`api-routes.json`)**: Machine-readable array containing HTTP method, public path, framework, file path, line, column, health classification, detected issues, and middleware bindings.
- **Markdown Documentation (`api-routes.md`)**: Beautifully formatted documentation grouped by framework with health badges, source links, parameter warnings, and middleware guards.

Run `API Route Explorer: Export Routes...` from the title bar or Command Palette.

---

## Route Search

Press `Cmd+Shift+P` / `Ctrl+Shift+P` and run **API Route Explorer: Search Routes**:
- **Multi-Token Matching**: Matches against HTTP method, URL path, framework, filename, folder path, and controller handler name.
- **Instant Response**: Operates entirely in memory on the pre-indexed route cache without filesystem latency.
- **Direct Jump**: Selecting any result opens the file and places your cursor directly at the route handler.

---

## Configuration Settings

Configure extension behavior via VS Code Settings (`settings.json`):

| Setting | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `apiRouteExplorer.defaultGrouping` | `string` | `"file"` | Default grouping mode for the TreeView (`"file"`, `"framework"`, `"method"`, `"health"`). |
| `apiRouteExplorer.baseUrl` | `string` | `"http://localhost:3000"` | Base URL used when copying complete route URLs. |
| `apiRouteExplorer.scan.exclude` | `array` | `[]` | Additional folder/file patterns to exclude during scanning (extends built-in safe defaults). |
| `apiRouteExplorer.autoRefresh` | `boolean` | `true` | Automatically refresh and incrementally update routes when files change. |

---

## Extension Commands

| Command | Command ID | Description |
| :--- | :--- | :--- |
| **Scan Routes** | `apiRouteExplorer.scan` | Scans workspace and discovers API routes |
| **Refresh Routes** | `apiRouteExplorer.refresh` | Re-scans and updates the sidebar |
| **Search Routes** | `apiRouteExplorer.searchRoutes` | QuickPick search matching method, path, framework, or file |
| **Search Similar Routes** | `apiRouteExplorer.searchSimilarRoutes` | QuickPick pre-filled with the route's resource segment |
| **Group Routes By...** | `apiRouteExplorer.groupBy` | Switch grouping between File, Framework, Method, and Health |
| **Filter Routes...** | `apiRouteExplorer.filterRoutes` | Multi-criteria filter hub (framework, method, health, state) |
| **Filter by HTTP Method** | `apiRouteExplorer.filterByMethod` | Filter sidebar routes by method or duplicate/shared condition |
| **Export Routes...** | `apiRouteExplorer.exportRoutes` | Export routes to JSON or Markdown documentation |
| **Quick Hub Menu** | `apiRouteExplorer.statusBarMenu` | Status bar quick actions for search, filters, export, and stats |
| **Show Route Statistics** | `apiRouteExplorer.showStatistics` | Interactive metrics modal with duplicate & shared path breakdown |
| **Open Route** | `apiRouteExplorer.openRoute` | Jumps to the exact route definition line in code |
| **Open File** | `apiRouteExplorer.openFile` | Opens the source file containing the route |
| **Copy Route** | `apiRouteExplorer.copyRoute` | Copies route signature (e.g. `GET /api/users`) |
| **Copy Route Path** | `apiRouteExplorer.copyRoutePath` | Copies route path only (e.g. `/api/users`) |
| **Copy Route URL** | `apiRouteExplorer.copyRouteUrl` | Copies full local URL (e.g. `http://localhost:3000/api/users`) |
| **Copy Route Definition** | `apiRouteExplorer.copyRouteDefinition` | Copies developer-readable format (e.g. `GET /users -> users.ts:42`) |
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

## OpenAPI / Swagger Specification Generation

API Route Explorer can transform discovered and analyzed API routes into valid **OpenAPI 3.0.3** specifications directly inside VS Code — without requiring your backend server to be running.

### Key Capabilities
- 📄 **Dual Format Export**: Export as formatted OpenAPI **YAML** (`.yaml`) or machine-readable **JSON** (`.json`).
- 🔄 **Multi-Framework Path Conversion**:
  - Express / Fastify / NestJS `:id` → `{id}`
  - Next.js dynamic parameters `[id]` → `{id}`
  - Next.js catch-all routes `[...slug]` → `{slug}`
- 🏷️ **Automatic Path Parameters**: Extracts path parameters into formal OpenAPI parameter objects with `in: 'path'`, `required: true`, and `schema: { type: 'string' }`.
- 🗂️ **Smart Resource Tagging**: Groups operations under semantic tags derived from route resource segments (e.g. `users`, `orders`, `auth`).
- 🆔 **Deterministic Operation IDs**: Generates predictable camelCase operation identifiers (e.g. `getUsers`, `getUsersById`, `postOrders`).
- ⚡ **Shared & Duplicate Route Safety**: Groups multi-method endpoints under single path items and collapses duplicate route declarations without emitting duplicate JSON/YAML keys.
- 🔒 **Privacy & Zero Leaks**: Strict safeguards ensure local absolute machine paths (`/Users/...`) and environment variables are never included.

### What is Inferred vs. What is NOT Inferred
To ensure contracts are reliable and truthful:
- **Inferred from code**: Paths, HTTP methods, path parameter names, resource tags, source file locations (workspace-relative), and standard HTTP response statuses (`200`, `201`, `204`, etc.).
- **Intentionally NOT inferred**: API Route Explorer does **not** fabricate fictitious response models, data schemas, or validation rules that do not exist in static route declarations. Generated contracts serve as clean, accurate architectural skeletons ready for further documentation or Swagger UI viewing.

### Exporting OpenAPI Specifications
1. Open the **API Route Explorer** sidebar or Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`).
2. Run `API Route Explorer: Export OpenAPI Specification...` (or export directly to YAML / JSON).
3. Select your desired route scope (Filtered Routes or All Routes) and file destination.

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
