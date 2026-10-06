import { ApiRoute } from '../models/route';

/**
 * Interface contract for workspace route scanners.
 * Will be implemented in Sprint 1 (Express AST scanner).
 */
export interface IRouteScanner {
  /**
   * Scans the given workspace root path for route declarations.
   * @param workspacePath Root directory to scan
   * @returns List of detected API routes
   */
  scan(workspacePath: string): Promise<ApiRoute[]>;
}

/**
 * Placeholder scanner service for Sprint 0 foundation.
 * Full AST scanning pipeline will be implemented in Sprint 1.
 */
export class RouteScanner implements IRouteScanner {
  public async scan(_workspacePath: string): Promise<ApiRoute[]> {
    // Sprint 0 intentionally returns empty array; scanner logic scheduled for Sprint 1
    return [];
  }
}
