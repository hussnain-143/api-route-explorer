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

## Current Status: Sprint 0 — Project Foundation

The project is currently in **Sprint 0**. The core extension architecture, native VS Code TreeView provider, domain models, and command registrations have been established.

> [!NOTE]
> Route scanning and framework AST parsing are currently in active development and scheduled for Sprint 1.

---

## Supported Frameworks

| Framework | Status | Target Sprint |
| :--- | :--- | :--- |
| **Express (Node.js)** | 🚧 In Planning | Sprint 1 |
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
- [ ] **Sprint 1: Express Route Detection**
  - AST parser for Express `app.use`, `router.get`, `router.post`, etc.
  - Workspace route scanner and file watcher
  - 1-Click jump to controller source location
- [ ] **Sprint 2: Next.js Route Support & Method Badges**
  - Support for `app/api/**/route.ts` and `pages/api/**/*.ts`
  - Colored HTTP method badges in TreeView
- [ ] **Sprint 3: Route Diagnostics & Search**
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
| **API Route Explorer: Scan Routes** | `apiRouteExplorer.scan` | Triggers a workspace scan (Sprint 0 placeholder) |
| **API Route Explorer: Refresh Routes** | `apiRouteExplorer.refresh` | Refreshes the API Routes sidebar view |

---

## Version

- **Current Version**: `0.0.1` (Sprint 0 — Project Foundation)
- **License**: MIT
