# Changelog

All notable changes to the "api-route-explorer" extension will be documented in this file.

## [0.0.1] - Sprint 0: Project Foundation

### Added
- Project initialized with TypeScript, strict mode, and ESLint configuration.
- Native VS Code Explorer sidebar view: `API Routes` (`apiRouteExplorer.routesView`).
- `RouteTreeProvider` implementing `vscode.TreeDataProvider`.
- Intentional initial empty state: "No routes discovered yet" with guidance tooltip.
- Domain models: `ApiRoute`, `HttpMethod`, and `ApiFramework`.
- Command registration: `API Route Explorer: Scan Routes` (`apiRouteExplorer.scan`).
- Command registration: `API Route Explorer: Refresh Routes` (`apiRouteExplorer.refresh`).
- Interface contract: `IRouteScanner` for future AST parsing engine.
- Brand design tokens and constants (Emerald Green, Teal, Cyan).
- 256x256 extension icon asset at `resources/icons/icon.png`.