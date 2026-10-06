# API Route Explorer — Brand Identity & Design System

> **“See every API route. Jump straight to the code.”**

---

## 1. Executive Summary & Brand Positioning

**API Route Explorer** is a high-performance Visual Studio Code extension built for backend and full-stack developers. It statically analyzes Node.js/Express (and modern backend framework) ASTs, maps endpoints into a real-time sidebar route tree, and enables instantaneous 1-click code navigation directly to the underlying handler implementation.

### The Distinctive Visual Direction: Emerald Green + Teal + Cyan
Rather than adopting the ubiquitous purple/indigo palette found across generic developer products, **API Route Explorer** establishes an authoritative, high-contrast, technical visual identity powered by:
- **Primary Emerald Green (`#10B981`)**
- **Secondary Teal (`#14B8A6`)**
- **Accent Cyan (`#06B6D4`)**
- **Deep Navy Canvas (`#0B1220`)** & **Dark Surface (`#111827`)**

This palette evokes high-performance network telemetry, real-time terminals, active server routes, and compiler precision.

### Brand Personality
- **Technical & Modern**: Tailored for JavaScript, TypeScript, Node.js, Express, and full-stack backend developers.
- **Fast & Precise**: Zero-latency mental model — from route discovery to line-of-code execution.
- **Intelligent & Minimal**: Clean geometric architecture devoid of AI sparkles, 3D skeuomorphism, cartoon mascots, or cloud clipart.
- **Trustworthy & Open-Source Friendly**: Engineered for clean marketplace presence, GitHub repositories, and developer documentation.

---

## 2. Logo Symbol: The Route Pathfinder & Code Gateway

The **API Route Explorer** mark is a minimal geometric symbol representing:

```
API endpoint  +  route/path  +  navigation  +  source code
```

Communicating the core developer loop: **“Discover → Follow → Navigate”**.

### Geometric Construction

```
       [Segment 1: Emerald #10B981]       [Segment 2: Teal #14B8A6]
(28,46) ●───────────────────────────────●──────────────────────────────► (102,46)
    Node 1 (Root API)               Node 2 (Junction)             Directional Arrow
                                        │
                                        │ [Branch Stem: Cyan #06B6D4]
                                        │
                                     <  /  > (y=86)
                          [Subtle Integrated Code Motif: </>]
```

### Visual Components:
1. **The Route Highway**: A clean horizontal path traveling through two endpoint nodes:
   - **Node 1 (Origin Endpoint)**: Positioned at `(28, 46)`, rendered in **Emerald Green (`#10B981`)**, representing the root router (`/api/v1`).
   - **Node 2 (Route Junction)**: Positioned at `(64, 46)`, rendered in **Accent Cyan (`#06B6D4`)**, representing an active endpoint coordinate.
2. **The Directional Navigation Arrow**: A sharp, streamlined chevron terminating at `(102, 46)` in **Secondary Teal (`#14B8A6`)**, communicating forward momentum and direct jump to the source code.
3. **The Branch & Code Motif (`</>`)**: A subtle vertical connector drops down from Node 2 into a balanced code glyph:
   - `<` bracket in Emerald Green
   - `/` path slash in Accent Cyan
   - `>` bracket in Secondary Teal
   This grounds the symbol firmly in source-code navigation without looking like generic coding clipart.

---

## 3. Complete Brand Lockups

All vector assets are provided in pixel-perfect SVG format inside [`assets/logos/`](./assets/logos/):

| Asset File | Canvas Dimensions | Description & Usage |
| :--- | :--- | :--- |
| [`logo-symbol.svg`](./assets/logos/logo-symbol.svg) | 128 × 128 | Pure geometric symbol for icons, favicons, and status bars |
| [`logo-horizontal.svg`](./assets/logos/logo-horizontal.svg) | 480 × 96 | Primary horizontal lockup for website headers and marketplace top bar |
| [`logo-primary.svg`](./assets/logos/logo-primary.svg) | 320 × 360 | Official vertical badge presentation with wordmark and HTTP pills |
| [`logo-vertical.svg`](./assets/logos/logo-vertical.svg) | 320 × 360 | Vertical brand lockup |
| [`logo-dark.svg`](./assets/logos/logo-dark.svg) | 540 × 140 | Dark surface container presentation (`#0B1220` Deep Background) |
| [`logo-light.svg`](./assets/logos/logo-light.svg) | 540 × 140 | Light surface container presentation (`#F8FAFC` Light Background) |
| [`logo-monochrome-white.svg`](./assets/logos/logo-monochrome-white.svg) | 480 × 96 | Single-color white for terminal output and dark monochrome print |
| [`logo-monochrome-black.svg`](./assets/logos/logo-monochrome-black.svg) | 480 × 96 | Single-color black for white paper and documentation printing |
| [`vscode-extension-icon.svg`](./assets/logos/vscode-extension-icon.svg) | 256 × 256 | Official VS Code Marketplace and Activity Bar square icon |
| [`github-avatar.svg`](./assets/logos/github-avatar.svg) | 500 × 500 | GitHub Organization & repo avatar (circle-crop safe with blueprint grid) |
| [`npm-avatar.svg`](./assets/logos/npm-avatar.svg) | 500 × 500 | npm registry profile badge with extension label |
| [`favicon.svg`](./assets/logos/favicon.svg) | 32 × 32 | High-contrast browser favicon |

---

## 4. Color Architecture

```
Brand Primary & Secondary:
┌────────────────────────┐  #10B981  Primary Emerald Green (Route path, main brand accent)
│        #10B981         │
└────────────────────────┘
┌────────────────────────┐  #14B8A6  Secondary Teal (Navigation arrow, secondary route)
│        #14B8A6         │
└────────────────────────┘
┌────────────────────────┐  #06B6D4  Accent Cyan (Secondary accent: nodes, branch slash)
│        #06B6D4         │
└────────────────────────┘

Interface & Surface Palette:
┌────────────────────────┐  #0B1220  Deep Background (Main VS Code dark environment)
│        #0B1220         │
└────────────────────────┘
┌────────────────────────┐  #111827  Dark Surface (Sidebar panels, card backgrounds)
│        #111827         │
└────────────────────────┘
┌────────────────────────┐  #1F2937  Slate (Borders, separators, inputs)
│        #1F2937         │
└────────────────────────┘
┌────────────────────────┐  #F8FAFC  Light Background (Light mode canvas)
│        #F8FAFC         │
└────────────────────────┘
┌────────────────────────┐  #FFFFFF  Pure White (Primary headings on dark surfaces)
│        #FFFFFF         │
└────────────────────────┘

Status & Method Palette:
┌───────────┐  #22C55E  Success / GET method
│  #22C55E  │
└───────────┘
┌───────────┐  #F59E0B  Warning / PUT method
│  #F59E0B  │
└───────────┘
┌───────────┐  #EF4444  Error / DELETE method
│  #EF4444  │
└───────────┘
```

---

## 5. Unified 16-Icon Geometric System

All icons are built on a consistent 24×24 grid (`viewBox="0 0 24 24"`) sharing a unified 2px stroke width, rounded caps and joins, and matching corner radiuses.

Located in [`assets/icons/`](./assets/icons/):

1. **`route.svg` (API Route)**: Continuous route path connecting origin and destination nodes.
2. **`get.svg` (GET)**: Simple directional route arrow pointing right with origin node.
3. **`post.svg` (POST)**: Route line combined with a distinct `+` creation symbol.
4. **`put.svg` (PUT)**: Horizontal movement/swap arrows indicating update mutation.
5. **`patch.svg` (PATCH)**: Route line accented with an edit/spark element.
6. **`delete.svg` (DELETE)**: Route line terminating in a clear, high-contrast `✕`.
7. **`controller.svg` (Controller)**: File glyph embedding a function `fx` routing emblem.
8. **`endpoint.svg` (Endpoint)**: Concentric target crosshair with active route coordinate.
9. **`navigation.svg` (Navigation)**: Directional jump needle pointing straight to source code.
10. **`search.svg` (Search)**: Magnifying glass featuring an internal route slash `/`.
11. **`refresh.svg` (Refresh)**: Circular AST synchronization arrows with center node.
12. **`folder.svg` (Folder)**: File directory folder with internal route branch.
13. **`duplicate-route.svg` (Duplicate Route)**: Overlapping route paths with collision warning dot.
14. **`missing-handler.svg` (Missing Handler)**: Unresolved route terminating in a broken/alert indicator.
15. **`warning.svg` (Warning)**: Geometric warning triangle with center alert pillar.
16. **`settings.svg` (Settings)**: Developer configuration gear with routing pins.

---

## 6. Marketing & Technical Banners

Located in [`assets/banners/`](./assets/banners/):

1. **[`readme-hero.svg`](./assets/banners/readme-hero.svg)** (1000 × 420):
   - Hero banner for GitHub `README.md` and documentation root.
   - Features the official product hierarchy:
     ```
     API ROUTES
     ├── AUTH
     │   ├── POST /login
     │   └── POST /register
     ├── USERS
     │   ├── GET /users
     │   ├── POST /users
     │   └── GET /users/:id  ───► [1-CLICK JUMP TO CODE: LINE 24]
     └── PRODUCTS
         ├── GET /products
         └── POST /products
     ```
   - Connected with subtle Green/Teal route branch lines, AST sync status pill, and high-contrast code landing pane.
2. **[`docs-header.svg`](./assets/banners/docs-header.svg)** (1200 × 260):
   - Documentation top banner with technical blueprint grid and feature badges.
3. **[`social-preview.svg`](./assets/banners/social-preview.svg)** (1200 × 630):
   - Standard OpenGraph social card for GitHub repository previews, Twitter/X cards, and developer link sharing.

---

## 7. Typography System

- **UI & Wordmark**: `Inter` (sans-serif)
  - Alternatives: `Geist Sans`, `Manrope`
- **Code & Route Paths**: `Fira Code` (monospace)
  - Alternatives: `JetBrains Mono`, `ui-monospace`

### Wordmark Construction:
- **“API Route”**: Bold / ExtraBold (Weight `800`), tracking `-0.6px`, rendered in Pure White (`#FFFFFF`) on dark surfaces and Deep Background (`#0B1220`) on light surfaces.
- **“Explorer”**: SemiBold (Weight `500`–`600`), tracking `-0.6px`, rendered in Primary Emerald Green (`#10B981`).
- **Tagline**: `“See every API route. Jump straight to the code.”` (Weight `500`, `#94A3B8`).

---

## 8. Brand Rules & Best Practices

### Do:
- Maintain **Emerald Green (`#10B981`)** and **Teal (`#14B8A6`)** as the primary brand drivers.
- Use **Cyan (`#06B6D4`)** only as an intentional secondary accent (junction nodes, slash connectors).
- Maintain generous clear space around the logo symbol (minimum 25% of icon height).
- Keep the route highway line and the arrow perfectly horizontal and balanced.

### Don't:
- Do NOT revert to purple or indigo gradients.
- Do NOT add 3D bevels, glass reflections, or metallic textures.
- Do NOT substitute the symbol with generic server, cloud, or database clipart.
- Do NOT introduce cartoon characters, animal mascots, or AI sparkle stars.
