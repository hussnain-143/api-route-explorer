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

## Current Status: Sprint 1 — Express Route Detection

The project is currently in **Sprint 1**. The core route discovery engine has been built:
- **Workspace Scanner**: Scans workspace `.js`, `.jsx`, `.ts`, and `.tsx` source files while ignoring build and dependency directories (`node_modules`, `.git`, `.next`, `dist`, `build`, `coverage`, `out`).
- **Express Route Detection**: Detects Express application routes (`app.get()`, `app.post()`, `app.put()`, `app.patch()`, `app.delete()`) and router routes (`router.get()`, `router.post()`, `router.put()`, `router.patch()`, `router.delete()`).
- **Route Information**: Extracts HTTP method, route path, file path, zero-based line/column position, and framework (`express`).
- **Developer Feedback**: The `Scan Routes` command triggers discovery, logs results to the developer console, and provides notification feedback.

> [!NOTE]
> Sprint 2 will consume the discovered `ApiRoute[]` list to populate the interactive route TreeView in the sidebar.

---

## Supported Frameworks

| Framework | Status | Target Sprint |
| :--- | :--- | :--- |
| **Express (Node.js)** | ✅ Detected (Sprint 1) | Sprint 1 |
| **Next.js (App & Pages Router)** | 📋 Planned | Sprint 2 |
| **Fastify** | 📋 Planned | Sprint 3 |
| **NestJS** | 📋 Planned | Sprint 4 |

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
- [ ] **Sprint 2: Sidebar TreeView Route Display & Navigation**
  - Populate sidebar TreeView with discovered `ApiRoute[]`
  - 1-Click jump to route definition in code editor
  - Method badges (GET, POST, PUT, PATCH, DELETE)
- [ ] **Sprint 3: Next.js & Additional Frameworks**
  - Next.js App Router and Pages Router route detection
- [ ] **Sprint 4: Route Diagnostics & Search**
  - Quick-pick route filter (⌘P / Ctrl+P integration)
  - Collision detection for duplicate routes

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
4. Run the command `API Route Explorer: Scan Routes` from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).

---

## Extension Commands

| Command | Command ID | Description |
| :--- | :--- | :--- |
| **API Route Explorer: Scan Routes** | `apiRouteExplorer.scan` | Scans workspace files and discovers Express routes |
| **API Route Explorer: Refresh Routes** | `apiRouteExplorer.refresh` | Refreshes the API Routes sidebar view |

---

## Version

- **Current Version**: `0.1.0` (Sprint 1 — Express Route Detection)
- **License**: MIT
