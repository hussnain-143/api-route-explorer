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

## Current Status: Sprint 2 — Route Explorer UI & Code Navigation

The project is currently in **Sprint 2**. Discovered API routes are connected directly to the VS Code sidebar with interactive code navigation:
- **Two-Level Tree Hierarchy**: Level 1 groups routes by source file (`routes/userRoutes.js`, `app.js`); Level 2 presents individual routes (`GET /users`, `POST /users`).
- **1-Click Code Navigation**: Clicking any route opens the file in the editor, positions the cursor, and reveals the exact route definition line in the center.
- **Accessible HTTP Method Icons**: Distinct `ThemeIcon` glyphs and semantic colors for GET, POST, PUT, PATCH, and DELETE endpoints with text labels for complete accessibility.
- **Rich Markdown Tooltips**: Hovering over any endpoint displays formatted route details, relative file path, and exact 1-based line/column numbers.
- **Safe File Handling**: Resilient handling with friendly alerts if a source file was moved or deleted outside VS Code.
- **Instant Scan & Refresh**: Running `Scan Routes` or clicking `Refresh` triggers workspace re-discovery and immediately updates the TreeView.

---

## Supported Frameworks

| Framework | Status | Target Sprint |
| :--- | :--- | :--- |
| **Express (Node.js)** | ✅ Detected & Interactive (Sprint 2) | Sprint 1 & 2 |
| **Next.js (App & Pages Router)** | 📋 Planned | Sprint 3 |
| **Fastify** | 📋 Planned | Sprint 4 |
| **NestJS** | 📋 Planned | Sprint 5 |

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

- **Current Version**: `0.2.0` (Sprint 2 — Route Explorer UI & Code Navigation)
- **License**: MIT
