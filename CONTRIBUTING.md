# Contributing to API Route Explorer

Thank you for your interest in contributing to **API Route Explorer**! We welcome contributions to improve route detection accuracy, framework compatibility, and developer productivity inside VS Code.

---

## Code of Conduct

Please maintain a welcoming, respectful, and professional environment for all contributors and maintainers. Be constructive in issues, code reviews, and discussions.

---

## Architecture & Project Structure

API Route Explorer is a pure TypeScript VS Code extension built with **zero runtime dependencies**:

```text
src/
├── analysis/           # Route health, duplicate detection, prefix resolution, conflict analysis
├── frameworks/         # Framework-specific route parsers and adapters
│   ├── express/        # Express.js AST-based route parsing and router mounting
│   ├── nextjs/         # Next.js App Router and Pages Router route detection
│   ├── fastify/        # Fastify plugin prefixes, HTTP methods, and pre-handlers
│   └── nestjs/         # NestJS controller and method decorator analysis
├── httpClient/         # Native HTTP Client Webview, request service, and cURL generation
├── models/             # Core route and framework data structures
├── openapi/            # OpenAPI 3.0.3 specification builder and YAML/JSON serializers
├── providers/          # TreeDataProvider implementations for Routes & Analysis
├── scanner/            # Workspace file scanner, route indexing, search, and file watchers
└── utils/              # Navigation, formatters, and extension constants
```

---

## Development Setup

### Prerequisites
- Node.js (v18.x, v20.x, or v22+)
- npm
- Visual Studio Code (v1.90.0+)

### Initial Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/hussnain-143/api-route-explorer.git
   cd api-route-explorer
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the extension:**
   ```bash
   npm run build
   ```

4. **Launch Extension in Development Mode:**
   - Press `F5` in VS Code to launch the Extension Development Host.
   - Open a backend project (e.g. Express, Next.js, Fastify, or NestJS) in the new window.
   - Open the **API Route Explorer** tab from the Activity Bar.

---

## Quality Standards & Engineering Rules

All contributions must adhere to the following standards:

1. **Strict TypeScript**: Pure TypeScript with `noImplicitAny: true`. Zero `any`.
2. **Zero Runtime Dependencies**: The extension runtime must stay completely standalone (`@vscode/vsce package --no-dependencies`).
3. **Automated Tests**: Every new feature or parser fix must include automated test coverage in `src/test/`.
4. **Security Guarantees**:
   - Webview scripts must use cryptographic nonces with strict Content Security Policy (`default-src 'none'`).
   - Never scan `.env` files or harvest credentials.
   - All messages received from Webview must be validated by type guards.
   - Absolute machine paths must never leak into exported OpenAPI specifications.
5. **No Regressions**: Run the full test suite and linter before submitting PRs:
   ```bash
   npm run build
   npx tsc --noEmit
   npm run lint
   npm test
   ```

---

## Submitting Pull Requests

1. Fork the repository and create your branch from `main`:
   ```bash
   git checkout -b fix/express-nested-router
   ```
2. Make your changes and commit with concise, descriptive commit messages:
   ```bash
   git commit -m "fix(express): resolve nested router prefix with trailing slash"
   ```
3. Ensure all tests pass:
   ```bash
   npm test
   ```
4. Push to your fork and submit a Pull Request.
5. In the PR description, explain the motivation, framework behavior, and link any relevant issues.

---

## License

By contributing to API Route Explorer, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
