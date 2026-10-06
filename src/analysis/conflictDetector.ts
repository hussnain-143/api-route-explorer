import { ApiRoute } from '../models/route';
import { normalizeRoutePath } from './duplicateDetector';
import { RouteConflict } from './analysisTypes';

/**
 * Segment classification for path overlap evaluation.
 */
interface RouteSegment {
  raw: string;
  type: 'static' | 'param' | 'catchall';
  value: string;
}

/**
 * Parses a route path into structured segments.
 */
function parseRouteSegments(routePath: string): RouteSegment[] {
  const clean = routePath.split('?')[0].trim();
  const parts = clean.split('/').filter(Boolean);

  return parts.map((part) => {
    // Catch-all patterns: *slug, *path, [...slug], [[...slug]]
    if (part.startsWith('*') || /^\[{1,2}\.\.\.[^\]]+\]{1,2}$/.test(part)) {
      return { raw: part, type: 'catchall', value: part };
    }
    // Parameter patterns: :id, [id]
    if (part.startsWith(':') || /^\[[^\]]+\]$/.test(part)) {
      return { raw: part, type: 'param', value: ':param' };
    }
    // Static segment
    return { raw: part, type: 'static', value: part.toLowerCase() };
  });
}

/**
 * Detects whether two routes overlap in URL matching space and flags potential shadowing.
 */
function evaluateRouteOverlap(
  r1: ApiRoute,
  r2: ApiRoute
): { overlaps: boolean; moreGeneric: ApiRoute | null } | null {
  // Same normalized path is an exact duplicate (handled by duplicate detector)
  const norm1 = normalizeRoutePath(r1.path);
  const norm2 = normalizeRoutePath(r2.path);
  if (norm1 === norm2) {
    return null;
  }

  const segs1 = parseRouteSegments(r1.path);
  const segs2 = parseRouteSegments(r2.path);

  const hasCatchall1 = segs1.some((s) => s.type === 'catchall');
  const hasCatchall2 = segs2.some((s) => s.type === 'catchall');

  if (!hasCatchall1 && !hasCatchall2 && segs1.length !== segs2.length) {
    return null;
  }

  const minLen = Math.min(segs1.length, segs2.length);
  let hasDynamicDivergence = false;
  let genericScore1 = 0;
  let genericScore2 = 0;

  for (let i = 0; i < minLen; i++) {
    const s1 = segs1[i];
    const s2 = segs2[i];

    if (s1.type === 'catchall' || s2.type === 'catchall') {
      hasDynamicDivergence = true;
      if (s1.type === 'catchall') {
        genericScore1 += 2;
      }
      if (s2.type === 'catchall') {
        genericScore2 += 2;
      }
      break;
    }

    if (s1.type === 'static' && s2.type === 'static') {
      if (s1.value !== s2.value) {
        // Differing static paths do not match the same URL
        return null;
      }
    } else if (s1.type !== s2.type) {
      hasDynamicDivergence = true;
      if (s1.type === 'param') {
        genericScore1 += 1;
      }
      if (s2.type === 'param') {
        genericScore2 += 1;
      }
    }
  }

  if (hasCatchall1 && segs1.length <= segs2.length) {
    hasDynamicDivergence = true;
    genericScore1 += 2;
  }
  if (hasCatchall2 && segs2.length <= segs1.length) {
    hasDynamicDivergence = true;
    genericScore2 += 2;
  }

  if (!hasDynamicDivergence) {
    return null;
  }

  let moreGeneric: ApiRoute | null = null;
  if (genericScore1 > genericScore2) {
    moreGeneric = r1;
  } else if (genericScore2 > genericScore1) {
    moreGeneric = r2;
  }

  return { overlaps: true, moreGeneric };
}

/**
 * Finds all potentially conflicting and shadowing routes across workspace routes.
 * Employs bucketed grouping by framework, method, and root segment to achieve O(N) performance on large projects.
 */
export function findRouteConflicts(routes: ApiRoute[]): RouteConflict[] {
  const conflicts: RouteConflict[] = [];
  const visitedPairs = new Set<string>();

  // 1. Group routes by framework + HTTP method + root segment
  const buckets = new Map<string, ApiRoute[]>();

  for (const route of routes) {
    const segs = parseRouteSegments(route.path);
    const rootSeg = segs.length > 0 && segs[0].type === 'static' ? segs[0].value : '*';
    const key = `${route.framework}:${route.method}:${rootSeg}`;

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
    }
    bucket.push(route);

    // Also include in wildcard bucket if root is dynamic or catchall
    if (rootSeg === '*') {
      const globalKey = `${route.framework}:${route.method}:*`;
      let gBucket = buckets.get(globalKey);
      if (!gBucket) {
        gBucket = [];
        buckets.set(globalKey, gBucket);
      }
      if (!gBucket.includes(route)) {
        gBucket.push(route);
      }
    }
  }

  // 2. Compare within buckets
  for (const bucket of buckets.values()) {
    if (bucket.length < 2) {
      continue;
    }

    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const r1 = bucket[i];
        const r2 = bucket[j];

        const pairId = `${r1.filePath}:${r1.line}:${r1.column}<->${r2.filePath}:${r2.line}:${r2.column}`;
        if (visitedPairs.has(pairId)) {
          continue;
        }
        visitedPairs.add(pairId);

        const overlapResult = evaluateRouteOverlap(r1, r2);
        if (!overlapResult || !overlapResult.overlaps) {
          continue;
        }

        const { moreGeneric } = overlapResult;

        // Determine ordering / shadowing:
        // If in same file, earlier line is registered earlier.
        const sameFile = r1.filePath === r2.filePath;
        const firstDeclared = sameFile ? (r1.line <= r2.line ? r1 : r2) : r1;
        const secondDeclared = firstDeclared === r1 ? r2 : r1;

        if (moreGeneric && firstDeclared === moreGeneric && sameFile) {
          // Dynamic route declared first in the same file -> strong shadowing warning!
          conflicts.push({
            route: firstDeclared,
            conflictingRoute: secondDeclared,
            reason: `Possible route shadowing: ${firstDeclared.method} ${firstDeclared.path} may capture ${secondDeclared.method} ${secondDeclared.path}`,
            isShadowing: true,
            severity: 'warning',
          });
          conflicts.push({
            route: secondDeclared,
            conflictingRoute: firstDeclared,
            reason: `Potentially shadowed by ${firstDeclared.method} ${firstDeclared.path} declared earlier`,
            isShadowing: true,
            severity: 'warning',
          });
        } else {
          // Overlap warning without definite shadowing
          conflicts.push({
            route: r1,
            conflictingRoute: r2,
            reason: `Potential route conflict: ${r1.method} ${r1.path} overlaps with ${r2.method} ${r2.path}`,
            isShadowing: false,
            severity: 'warning',
          });
          conflicts.push({
            route: r2,
            conflictingRoute: r1,
            reason: `Potential route conflict: ${r2.method} ${r2.path} overlaps with ${r1.method} ${r1.path}`,
            isShadowing: false,
            severity: 'warning',
          });
        }
      }
    }
  }

  return conflicts;
}
