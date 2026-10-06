import { ApiRoute, HttpMethod } from './route';

export type ApiFramework =
  | 'express'
  | 'nextjs'
  | 'next'
  | 'fastify'
  | 'nestjs';

export interface FrameworkInfo {
  id: ApiFramework;
  name: string;
  description: string;
}

/**
 * Interface contract for framework-specific route adapters.
 */
export interface FrameworkAdapter {
  readonly framework: ApiFramework;
  readonly name: string;

  /**
   * Fast check to determine if this adapter can process the given file.
   * Can evaluate file path, directory conventions, or source content signatures.
   */
  canHandle(filePath: string, source: string): boolean;

  /**
   * Parses all API routes from the given file source.
   */
  parseRoutes(filePath: string, source: string): ApiRoute[];

  /**
   * Optional post-processing step across all workspace routes
   * (e.g. Express router mount prefix resolution).
   */
  postProcessRoutes?(
    routes: ApiRoute[],
    fileSources: Map<string, string> | Record<string, string>
  ): ApiRoute[];
}
