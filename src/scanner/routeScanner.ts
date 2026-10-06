import { ApiRoute } from '../models/route';

/**
 * Interface contract for workspace route scanners.
 */
export interface IRouteScanner {
  scan(workspacePath: string): Promise<ApiRoute[]>;
}

/**
 * Sprint 0 placeholder scanner.
 * Express AST scanning will be implemented in Sprint 1.
 */
export class RouteScanner implements IRouteScanner {
  public async scan(_workspacePath: string): Promise<ApiRoute[]> {
    return [];
  }
}
