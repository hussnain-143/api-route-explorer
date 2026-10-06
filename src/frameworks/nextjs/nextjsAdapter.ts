import { ApiRoute } from '../../models/route';
import { FrameworkAdapter } from '../../models/framework';
import { parseNextAppRouterRoutes } from './nextjsAppRouterParser';
import { parseNextPagesRouterRoutes } from './nextjsPagesRouterParser';

/**
 * Adapter for discovering and parsing Next.js App Router and Pages Router API routes.
 */
export class NextjsAdapter implements FrameworkAdapter {
  public readonly framework = 'nextjs' as const;
  public readonly name = 'Next.js';

  /**
   * Fast check to determine if the file is a Next.js route handler.
   */
  public canHandle(filePath: string, _source: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');

    // 1. App Router route handlers: app/**/route.(ts|js|tsx|jsx)
    if (/(?:^|\/)(?:src\/app|app)\/.*route\.[jt]sx?$/i.test(normalized)) {
      return true;
    }

    // 2. Pages Router API routes: pages/api/**.(ts|js|tsx|jsx)
    if (/(?:^|\/)(?:src\/pages\/api|pages\/api)\/.*\.[jt]sx?$/i.test(normalized)) {
      // Exclude special Next.js files and test files
      const parts = normalized.split('/');
      const fileName = parts[parts.length - 1];
      if (fileName.startsWith('_') || fileName.includes('.test') || fileName.includes('.spec')) {
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Parses routes according to Next.js App Router or Pages Router conventions.
   */
  public parseRoutes(filePath: string, source: string): ApiRoute[] {
    const normalized = filePath.replace(/\\/g, '/');

    // App Router
    if (/(?:^|\/)(?:src\/app|app)\/.*route\.[jt]sx?$/i.test(normalized)) {
      return parseNextAppRouterRoutes(source, filePath);
    }

    // Pages Router
    if (/(?:^|\/)(?:src\/pages\/api|pages\/api)\/.*\.[jt]sx?$/i.test(normalized)) {
      return parseNextPagesRouterRoutes(source, filePath);
    }

    return [];
  }
}
