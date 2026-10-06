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
 * Pre-computed representation of a route for high-throughput conflict evaluation.
 */
interface PreparedRoute {
  route: ApiRoute;
  normalizedPath: string;
  segments: RouteSegment[];
  hasCatchall: boolean;
}

/**
 * Detects whether two pre-computed routes overlap in URL matching space and flags potential shadowing.
 */
function evaluateRouteOverlap(
  p1: PreparedRoute,
  p2: PreparedRoute
): { overlaps: boolean; moreGeneric: ApiRoute | null } | null {
  // Same normalized path is an exact duplicate (handled by duplicate detector)
  if (p1.normalizedPath === p2.normalizedPath) {
    return null;
  }

  const segs1 = p1.segments;
  const segs2 = p2.segments;

  if (!p1.hasCatchall && !p2.hasCatchall && segs1.length !== segs2.length) {
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

  if (p1.hasCatchall && segs1.length <= segs2.length) {
    hasDynamicDivergence = true;
    genericScore1 += 2;
  }
  if (p2.hasCatchall && segs2.length <= segs1.length) {
    hasDynamicDivergence = true;
    genericScore2 += 2;
  }

  if (!hasDynamicDivergence) {
    return null;
  }

  let moreGeneric: ApiRoute | null = null;
  if (genericScore1 > genericScore2) {
    moreGeneric = p1.route;
  } else if (genericScore2 > genericScore1) {
    moreGeneric = p2.route;
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

  // 1. Precompute parsed segments and normalized path for each route ONCE
  const prepared: PreparedRoute[] = routes.map((r) => {
    const segments = parseRouteSegments(r.path);
    return {
      route: r,
      normalizedPath: normalizeRoutePath(r.path),
      segments,
      hasCatchall: segments.some((s) => s.type === 'catchall'),
    };
  });

  // 2. Group routes by framework + HTTP method + root segment
  const buckets = new Map<string, PreparedRoute[]>();
  const globalWildcardBuckets = new Map<string, PreparedRoute[]>();

  for (const p of prepared) {
    const route = p.route;
    const segs = p.segments;
    const rootSeg = segs.length > 0 && segs[0].type === 'static' ? segs[0].value : '*';
    const key = `${route.framework}:${route.method}:${rootSeg}`;

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
    }
    bucket.push(p);

    // Also track in global wildcard bucket if root is dynamic or catchall
    if (rootSeg === '*') {
      const globalKey = `${route.framework}:${route.method}`;
      let gBucket = globalWildcardBuckets.get(globalKey);
      if (!gBucket) {
        gBucket = [];
        globalWildcardBuckets.set(globalKey, gBucket);
      }
      gBucket.push(p);
    }
  }

  // Helper to test pairs
  const testPair = (p1: PreparedRoute, p2: PreparedRoute) => {
    const r1 = p1.route;
    const r2 = p2.route;
    const pairId = `${r1.filePath}:${r1.line}:${r1.column}<->${r2.filePath}:${r2.line}:${r2.column}`;
    if (visitedPairs.has(pairId)) {
      return;
    }
    visitedPairs.add(pairId);

    const overlapResult = evaluateRouteOverlap(p1, p2);
    if (!overlapResult || !overlapResult.overlaps) {
      return;
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
  };

  // 3. Compare within buckets
  for (const bucket of buckets.values()) {
    if (bucket.length < 2) {
      continue;
    }

    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        testPair(bucket[i], bucket[j]);
      }
    }
  }

  // 4. Compare wildcard routes against other buckets of same framework and method
  for (const [globalKey, wildcards] of globalWildcardBuckets.entries()) {
    for (const [key, bucket] of buckets.entries()) {
      if (key.startsWith(globalKey) && !key.endsWith(':*')) {
        for (const w of wildcards) {
          for (const b of bucket) {
            testPair(w, b);
          }
        }
      }
    }
  }

  return conflicts;
}
