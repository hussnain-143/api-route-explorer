import { ApiRoute } from '../../models/route';
import { FrameworkAdapter } from '../../models/framework';
import { parseNestjsRoutes } from './nestjsRouteParser';

/**
 * Adapter for discovering and parsing NestJS controller routes.
 */
export class NestjsAdapter implements FrameworkAdapter {
  public readonly framework = 'nestjs' as const;
  public readonly name = 'NestJS';

  /**
   * Fast check to determine if this file is a NestJS controller or route file.
   */
  public canHandle(filePath: string, source: string): boolean {
    if (!/\.[jt]sx?$/i.test(filePath)) {
      return false;
    }

    // Exclude Next.js route files
    const normalized = filePath.replace(/\\/g, '/');
    if (
      /(?:^|\/)(?:app|src\/app)\/.*\/route\.[jt]sx?$/i.test(normalized) ||
      /(?:^|\/)(?:pages\/api|src\/pages\/api)\/.*\.[jt]sx?$/i.test(normalized)
    ) {
      return false;
    }

    // NestJS detection signatures:
    // 1. from '@nestjs/common' or require('@nestjs/common')
    // 2. @Controller decorator
    // 3. HTTP method decorators: @Get, @Post, etc.
    const hasNestImport = /\b(?:@nestjs\/common|@nestjs\/core)\b/.test(source);
    const hasController = /@Controller\b/.test(source);
    const hasRouteDecorators = /@(Get|Post|Put|Patch|Delete|Head|Options|All)\b/.test(source);

    return hasNestImport || hasController || hasRouteDecorators;
  }

  /**
   * Parses NestJS routes from file source.
   */
  public parseRoutes(filePath: string, source: string): ApiRoute[] {
    return parseNestjsRoutes(source, filePath);
  }
}
