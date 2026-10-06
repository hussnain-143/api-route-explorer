import { ApiRoute, HttpMethod, ApiFramework } from '../models/route';
import { normalizeRoutePath, getDuplicateSignature } from '../analysis/duplicateDetector';

/**
 * High-performance in-memory index for discovered API routes.
 * Enables O(1) file additions, deletions, renames, and rapid lookups
 * by filePath, HTTP method, framework, path, normalized path, and route signature.
 */
export class RouteIndex {
  /**
   * Primary storage: Maps canonical filePath -> ApiRoute[]
   */
  private readonly fileRouteMap = new Map<string, ApiRoute[]>();

  /**
   * Secondary index: Framework -> ApiRoute[]
   */
  private readonly frameworkIndex = new Map<ApiFramework, Set<ApiRoute>>();

  /**
   * Secondary index: HTTP Method -> ApiRoute[]
   */
  private readonly methodIndex = new Map<HttpMethod, Set<ApiRoute>>();

  /**
   * Secondary index: Exact Route Path -> ApiRoute[]
   */
  private readonly pathIndex = new Map<string, Set<ApiRoute>>();

  /**
   * Secondary index: Normalized Route Path -> ApiRoute[]
   */
  private readonly normalizedPathIndex = new Map<string, Set<ApiRoute>>();

  /**
   * Secondary index: Duplicate Signature (${METHOD}:${NORMALIZED_PATH}) -> ApiRoute[]
   */
  private readonly signatureIndex = new Map<string, Set<ApiRoute>>();

  /**
   * Cached flat array of all indexed routes. Invalidated on mutation.
   */
  private cachedAllRoutes: ApiRoute[] | null = null;

  /**
   * Sets or replaces all routes discovered for a specific source file.
   * If existing routes were indexed for this file, they are cleanly removed first.
   *
   * @param filePath File path of the source file.
   * @param routes Array of ApiRoute instances found in the file.
   */
  public setFileRoutes(filePath: string, routes: ApiRoute[]): void {
    if (this.fileRouteMap.has(filePath)) {
      this.removeFileRoutes(filePath);
    }

    if (routes.length === 0) {
      this.fileRouteMap.set(filePath, []);
      this.cachedAllRoutes = null;
      return;
    }

    const routeCopies = [...routes];
    this.fileRouteMap.set(filePath, routeCopies);

    for (const route of routeCopies) {
      this.indexRoute(route);
    }

    this.cachedAllRoutes = null;
  }

  /**
   * Removes all routes associated with a source file (e.g. file deleted or being re-parsed).
   *
   * @param filePath File path to purge from the index.
   * @returns The removed routes if any were present.
   */
  public removeFileRoutes(filePath: string): ApiRoute[] {
    const existing = this.fileRouteMap.get(filePath);
    if (!existing || existing.length === 0) {
      this.fileRouteMap.delete(filePath);
      this.cachedAllRoutes = null;
      return [];
    }

    for (const route of existing) {
      this.unindexRoute(route);
    }

    this.fileRouteMap.delete(filePath);
    this.cachedAllRoutes = null;
    return existing;
  }

  /**
   * Handles a file rename or move, migrating route paths and updating indices.
   *
   * @param oldFilePath Previous file path.
   * @param newFilePath New file path.
   * @param newRoutes Optional replacement routes for the new file.
   */
  public renameFile(oldFilePath: string, newFilePath: string, newRoutes?: ApiRoute[]): void {
    const existing = this.removeFileRoutes(oldFilePath);
    if (newRoutes) {
      this.setFileRoutes(newFilePath, newRoutes);
    } else if (existing.length > 0) {
      const updatedRoutes = existing.map((r) => ({
        ...r,
        filePath: newFilePath,
      }));
      this.setFileRoutes(newFilePath, updatedRoutes);
    }
  }

  /**
   * Returns all routes across all indexed files.
   * Results are cached until the next mutation.
   */
  public getAllRoutes(): ApiRoute[] {
    if (this.cachedAllRoutes !== null) {
      return this.cachedAllRoutes;
    }

    const all: ApiRoute[] = [];
    for (const routes of this.fileRouteMap.values()) {
      for (const r of routes) {
        all.push(r);
      }
    }

    this.cachedAllRoutes = all;
    return all;
  }

  /**
   * Returns all routes for a specific file path.
   */
  public getRoutesForFile(filePath: string): ApiRoute[] {
    return this.fileRouteMap.get(filePath) || [];
  }

  /**
   * Returns whether a specific file path is tracked in the index.
   */
  public hasFile(filePath: string): boolean {
    return this.fileRouteMap.has(filePath);
  }

  /**
   * Returns all file paths currently tracked in the index.
   */
  public getAllFilePaths(): string[] {
    return Array.from(this.fileRouteMap.keys());
  }

  /**
   * Returns all routes belonging to a specific framework.
   */
  public getRoutesByFramework(framework: ApiFramework): ApiRoute[] {
    const set = this.frameworkIndex.get(framework);
    return set ? Array.from(set) : [];
  }

  /**
   * Returns all routes using a specific HTTP method.
   */
  public getRoutesByMethod(method: HttpMethod): ApiRoute[] {
    const set = this.methodIndex.get(method);
    return set ? Array.from(set) : [];
  }

  /**
   * Returns all routes with an exact path string.
   */
  public getRoutesByPath(path: string): ApiRoute[] {
    const set = this.pathIndex.get(path);
    return set ? Array.from(set) : [];
  }

  /**
   * Returns all routes matching a normalized route path (parameter-normalized).
   */
  public getRoutesByNormalizedPath(normPath: string): ApiRoute[] {
    const set = this.normalizedPathIndex.get(normPath);
    return set ? Array.from(set) : [];
  }

  /**
   * Returns all routes matching a duplicate signature (${METHOD}:${NORMALIZED_PATH}).
   */
  public getRoutesBySignature(signature: string): ApiRoute[] {
    const set = this.signatureIndex.get(signature);
    return set ? Array.from(set) : [];
  }

  /**
   * Returns the total count of indexed routes.
   */
  public size(): number {
    return this.getAllRoutes().length;
  }

  /**
   * Returns the total number of files indexed.
   */
  public fileCount(): number {
    return this.fileRouteMap.size;
  }

  /**
   * Clears the entire route index.
   */
  public clear(): void {
    this.fileRouteMap.clear();
    this.frameworkIndex.clear();
    this.methodIndex.clear();
    this.pathIndex.clear();
    this.normalizedPathIndex.clear();
    this.signatureIndex.clear();
    this.cachedAllRoutes = null;
  }

  private indexRoute(route: ApiRoute): void {
    // Framework index
    const fw = route.framework || 'express';
    let fwSet = this.frameworkIndex.get(fw);
    if (!fwSet) {
      fwSet = new Set<ApiRoute>();
      this.frameworkIndex.set(fw, fwSet);
    }
    fwSet.add(route);

    // Method index
    let mSet = this.methodIndex.get(route.method);
    if (!mSet) {
      mSet = new Set<ApiRoute>();
      this.methodIndex.set(route.method, mSet);
    }
    mSet.add(route);

    // Exact Path index
    let pSet = this.pathIndex.get(route.path);
    if (!pSet) {
      pSet = new Set<ApiRoute>();
      this.pathIndex.set(route.path, pSet);
    }
    pSet.add(route);

    // Normalized Path index
    const normPath = normalizeRoutePath(route.path);
    let npSet = this.normalizedPathIndex.get(normPath);
    if (!npSet) {
      npSet = new Set<ApiRoute>();
      this.normalizedPathIndex.set(normPath, npSet);
    }
    npSet.add(route);

    // Signature index
    const sig = getDuplicateSignature(route);
    let sSet = this.signatureIndex.get(sig);
    if (!sSet) {
      sSet = new Set<ApiRoute>();
      this.signatureIndex.set(sig, sSet);
    }
    sSet.add(route);
  }

  private unindexRoute(route: ApiRoute): void {
    const fw = route.framework || 'express';
    this.frameworkIndex.get(fw)?.delete(route);
    this.methodIndex.get(route.method)?.delete(route);
    this.pathIndex.get(route.path)?.delete(route);

    const normPath = normalizeRoutePath(route.path);
    this.normalizedPathIndex.get(normPath)?.delete(route);

    const sig = getDuplicateSignature(route);
    this.signatureIndex.get(sig)?.delete(route);
  }
}
