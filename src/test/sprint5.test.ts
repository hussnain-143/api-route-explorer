import * as assert from 'assert';
import { ApiRoute } from '../models/route';
import { detectFrameworks } from '../frameworks/frameworkDetector';
import { FrameworkRegistry, defaultFrameworkRegistry } from '../frameworks/frameworkRegistry';
import { ExpressAdapter } from '../frameworks/express/expressAdapter';
import { NextjsAdapter } from '../frameworks/nextjs/nextjsAdapter';
import {
  appRouterPathToPublicUrl,
  parseNextAppRouterRoutes,
} from '../frameworks/nextjs/nextjsAppRouterParser';
import {
  pagesRouterPathToPublicUrl,
  parseNextPagesRouterRoutes,
} from '../frameworks/nextjs/nextjsPagesRouterParser';
import { findDuplicateRoutes, findSharedPathGroups } from '../analysis/duplicateDetector';
import { calculateRouteStatistics, formatRouteStatistics } from '../analysis/routeStatistics';
import { createRouteQuickPickItem } from '../scanner/routeSearch';

suite('API Routes Explorer — Sprint 5 Multi-Framework & Next.js Suite', function () {
  this.timeout(10000);

  // =========================================================================
  // 1. FRAMEWORK DETECTION TESTS
  // =========================================================================
  test('detectFrameworks detects Express from package.json and route directory', () => {
    const pkg = JSON.stringify({ dependencies: { express: '^4.19.2' } });
    const files = ['src/routes/userRoutes.js', 'src/server.js'];
    const result = detectFrameworks(files, pkg);

    assert.strictEqual(result.hasExpress, true);
    assert.strictEqual(result.hasNextjs, false);
    assert.deepStrictEqual(result.detectedFrameworks, ['express']);
    assert.ok(result.evidence.express.length > 0);
  });

  test('detectFrameworks detects Next.js from config file and App Router directory', () => {
    const files = [
      'next.config.mjs',
      'src/app/api/users/route.ts',
      'src/app/page.tsx',
    ];
    const result = detectFrameworks(files);

    assert.strictEqual(result.hasExpress, false);
    assert.strictEqual(result.hasNextjs, true);
    assert.deepStrictEqual(result.detectedFrameworks, ['nextjs']);
    assert.ok(result.evidence.nextjs.length >= 2);
  });

  test('detectFrameworks detects mixed workspace with both Express and Next.js', () => {
    const pkg = JSON.stringify({
      dependencies: { express: '^4.18.0', next: '^14.2.0' },
    });
    const files = [
      'server/routes/api.js',
      'frontend/next.config.js',
      'frontend/app/api/auth/route.ts',
    ];
    const result = detectFrameworks(files, pkg);

    assert.strictEqual(result.hasExpress, true);
    assert.strictEqual(result.hasNextjs, true);
    assert.deepStrictEqual(result.detectedFrameworks, ['express', 'nextjs']);
  });

  test('detectFrameworks cleanly handles unknown workspace', () => {
    const pkg = JSON.stringify({ dependencies: { lodash: '^4.17.21' } });
    const files = ['src/index.js', 'src/utils.js'];
    const result = detectFrameworks(files, pkg);

    assert.strictEqual(result.hasExpress, false);
    assert.strictEqual(result.hasNextjs, false);
    assert.strictEqual(result.detectedFrameworks.length, 0);
  });

  // =========================================================================
  // 2. FRAMEWORK REGISTRY & ADAPTER TESTS
  // =========================================================================
  test('FrameworkRegistry registers and retrieves default adapters', () => {
    const registry = new FrameworkRegistry();
    const adapters = registry.getAdapters();

    assert.ok(adapters.length >= 2);
    assert.ok(registry.getAdapter('express') instanceof ExpressAdapter);
    assert.ok(registry.getAdapter('nextjs') instanceof NextjsAdapter);
  });

  test('Adapters correctly claim appropriate files', () => {
    const expressAdapter = new ExpressAdapter();
    const nextjsAdapter = new NextjsAdapter();

    const expressSource = "const router = require('express').Router(); router.get('/users', fn);";
    const nextAppSource = 'export async function GET(request) { return Response.json({}); }';
    const nextPagesSource = 'export default function handler(req, res) { res.status(200); }';

    // Express file
    assert.strictEqual(expressAdapter.canHandle('/workspace/routes/user.js', expressSource), true);
    assert.strictEqual(nextjsAdapter.canHandle('/workspace/routes/user.js', expressSource), false);

    // Next.js App Router file
    assert.strictEqual(nextjsAdapter.canHandle('/workspace/app/api/users/route.ts', nextAppSource), true);
    assert.strictEqual(expressAdapter.canHandle('/workspace/app/api/users/route.ts', nextAppSource), false);

    // Next.js Pages Router file
    assert.strictEqual(nextjsAdapter.canHandle('/workspace/pages/api/users.ts', nextPagesSource), true);
    assert.strictEqual(expressAdapter.canHandle('/workspace/pages/api/users.ts', nextPagesSource), false);

    // Next.js page.tsx must NOT be handled as an API route
    assert.strictEqual(nextjsAdapter.canHandle('/workspace/app/api/users/page.tsx', nextAppSource), false);
  });

  // =========================================================================
  // 3. NEXT.JS APP ROUTER URL RESOLUTION TESTS
  // =========================================================================
  test('appRouterPathToPublicUrl converts standard routes', () => {
    assert.strictEqual(
      appRouterPathToPublicUrl('/project/app/api/users/route.ts'),
      '/api/users'
    );
    assert.strictEqual(
      appRouterPathToPublicUrl('/project/src/app/api/v1/products/route.js'),
      '/api/v1/products'
    );
  });

  test('appRouterPathToPublicUrl strips route groups in parentheses', () => {
    assert.strictEqual(
      appRouterPathToPublicUrl('/project/app/(dashboard)/api/users/route.ts'),
      '/api/users'
    );
    assert.strictEqual(
      appRouterPathToPublicUrl('/project/src/app/(marketing)/(v2)/api/checkout/route.tsx'),
      '/api/checkout'
    );
    assert.strictEqual(
      appRouterPathToPublicUrl('/project/app/api/(auth)/login/route.js'),
      '/api/login'
    );
  });

  test('appRouterPathToPublicUrl handles dynamic and catch-all route segments', () => {
    // Dynamic :id
    assert.strictEqual(
      appRouterPathToPublicUrl('/project/app/api/users/[id]/route.ts'),
      '/api/users/:id'
    );
    assert.strictEqual(
      appRouterPathToPublicUrl('/project/app/api/users/[userId]/posts/[postId]/route.ts'),
      '/api/users/:userId/posts/:postId'
    );

    // Catch-all *slug
    assert.strictEqual(
      appRouterPathToPublicUrl('/project/app/api/files/[...slug]/route.ts'),
      '/api/files/*slug'
    );

    // Optional catch-all [[...slug]]
    assert.strictEqual(
      appRouterPathToPublicUrl('/project/app/api/docs/[[...slug]]/route.ts'),
      '/api/docs/*slug'
    );
  });

  test('appRouterPathToPublicUrl ignores parallel route slots', () => {
    assert.strictEqual(
      appRouterPathToPublicUrl('/project/app/@modal/api/items/route.ts'),
      '/api/items'
    );
  });

  test('appRouterPathToPublicUrl returns null for non-route files', () => {
    assert.strictEqual(appRouterPathToPublicUrl('/project/app/api/users/page.tsx'), null);
    assert.strictEqual(appRouterPathToPublicUrl('/project/app/layout.tsx'), null);
  });

  // =========================================================================
  // 4. NEXT.JS APP ROUTER PARSER & NAVIGATION LINE TESTS
  // =========================================================================
  test('parseNextAppRouterRoutes discovers multiple method exports with exact line positions', () => {
    const source = [
      '// User route handlers',
      'import { NextResponse } from "next/server";',
      '',
      'export async function GET(request: Request) {',
      '  return NextResponse.json({ ok: true });',
      '}',
      '',
      'export async function POST(request: Request) {',
      '  return NextResponse.json({ created: true });',
      '}',
      '',
      'export const DELETE = async () => {',
      '  return NextResponse.json({ deleted: true });',
      '};',
    ].join('\n');

    const filePath = '/workspace/app/api/users/route.ts';
    const routes = parseNextAppRouterRoutes(source, filePath);

    assert.strictEqual(routes.length, 3);

    // GET route
    const getRoute = routes.find((r) => r.method === 'GET');
    assert.ok(getRoute);
    assert.strictEqual(getRoute.path, '/api/users');
    assert.strictEqual(getRoute.line, 3); // Line 4 in 1-based editor
    assert.strictEqual(getRoute.framework, 'nextjs');

    // POST route
    const postRoute = routes.find((r) => r.method === 'POST');
    assert.ok(postRoute);
    assert.strictEqual(postRoute.path, '/api/users');
    assert.strictEqual(postRoute.line, 7); // Line 8 in 1-based editor

    // DELETE route
    const deleteRoute = routes.find((r) => r.method === 'DELETE');
    assert.ok(deleteRoute);
    assert.strictEqual(deleteRoute.path, '/api/users');
    assert.strictEqual(deleteRoute.line, 11); // Line 12 in 1-based editor
  });

  test('parseNextAppRouterRoutes handles named re-exports', () => {
    const source = [
      'async function handler() {}',
      'export { handler as GET, handler as PATCH, handler as HEAD };',
    ].join('\n');

    const routes = parseNextAppRouterRoutes(source, '/app/api/health/route.ts');
    assert.strictEqual(routes.length, 3);
    const methods = routes.map((r) => r.method);
    assert.ok(methods.includes('GET'));
    assert.ok(methods.includes('PATCH'));
    assert.ok(methods.includes('HEAD'));
  });

  // =========================================================================
  // 5. NEXT.JS PAGES ROUTER TESTS
  // =========================================================================
  test('pagesRouterPathToPublicUrl converts Pages API routes', () => {
    assert.strictEqual(
      pagesRouterPathToPublicUrl('/workspace/pages/api/users.ts'),
      '/api/users'
    );
    assert.strictEqual(
      pagesRouterPathToPublicUrl('/workspace/src/pages/api/users/index.js'),
      '/api/users'
    );
    assert.strictEqual(
      pagesRouterPathToPublicUrl('/workspace/pages/api/users/[id].ts'),
      '/api/users/:id'
    );
    assert.strictEqual(
      pagesRouterPathToPublicUrl('/workspace/pages/api/files/[...slug].ts'),
      '/api/files/*slug'
    );
  });

  test('pagesRouterPathToPublicUrl excludes internal and test files', () => {
    assert.strictEqual(
      pagesRouterPathToPublicUrl('/workspace/pages/api/_middleware.ts'),
      null
    );
    assert.strictEqual(
      pagesRouterPathToPublicUrl('/workspace/pages/api/users.test.ts'),
      null
    );
  });

  test('parseNextPagesRouterRoutes parses explicit req.method checks', () => {
    const source = [
      'export default async function handler(req, res) {',
      '  if (req.method === "GET") {',
      '    return res.status(200).json([]);',
      '  }',
      '  if (req.method === "POST") {',
      '    return res.status(201).json({});',
      '  }',
      '}',
    ].join('\n');

    const routes = parseNextPagesRouterRoutes(source, '/workspace/pages/api/users.ts');
    assert.strictEqual(routes.length, 2);
    assert.strictEqual(routes[0].method, 'GET');
    assert.strictEqual(routes[0].path, '/api/users');
    assert.strictEqual(routes[0].line, 1);
    assert.strictEqual(routes[1].method, 'POST');
    assert.strictEqual(routes[1].path, '/api/users');
    assert.strictEqual(routes[1].line, 4);
  });

  test('parseNextPagesRouterRoutes falls back to ANY method when unspecified', () => {
    const source = [
      'export default function handler(req, res) {',
      '  res.send("Hello world");',
      '}',
    ].join('\n');

    const routes = parseNextPagesRouterRoutes(source, '/workspace/pages/api/greeting.ts');
    assert.strictEqual(routes.length, 1);
    assert.strictEqual(routes[0].method, 'ANY');
    assert.strictEqual(routes[0].path, '/api/greeting');
    assert.strictEqual(routes[0].line, 0);
  });

  // =========================================================================
  // 6. MULTI-FRAMEWORK DUPLICATE & ANALYSIS INTEGRATION
  // =========================================================================
  test('Duplicate detection does not conflict between Express and Next.js in mixed workspace', () => {
    const routes: ApiRoute[] = [
      {
        method: 'GET',
        path: '/api/users',
        filePath: '/workspace/server/routes/users.js',
        line: 10,
        column: 0,
        framework: 'express',
      },
      {
        method: 'GET',
        path: '/api/users',
        filePath: '/workspace/client/app/api/users/route.ts',
        line: 5,
        column: 0,
        framework: 'nextjs',
      },
    ];

    // Routes in DIFFERENT frameworks must NOT be flagged as duplicate conflict
    const duplicates = findDuplicateRoutes(routes);
    assert.strictEqual(duplicates.length, 0);
  });

  test('Duplicate detection accurately flags collisions within the same framework', () => {
    const routes: ApiRoute[] = [
      {
        method: 'GET',
        path: '/api/users',
        filePath: '/workspace/client/app/api/users/route.ts',
        line: 5,
        column: 0,
        framework: 'nextjs',
      },
      {
        method: 'GET',
        path: '/api/users',
        filePath: '/workspace/client/app/(v1)/api/users/route.ts',
        line: 8,
        column: 0,
        framework: 'nextjs',
      },
    ];

    const duplicates = findDuplicateRoutes(routes);
    assert.strictEqual(duplicates.length, 1);
    assert.strictEqual(duplicates[0].routes.length, 2);
  });

  test('Shared path grouping detects multiple methods on same endpoint across frameworks', () => {
    const routes: ApiRoute[] = [
      {
        method: 'GET',
        path: '/api/products',
        filePath: '/app/api/products/route.ts',
        line: 4,
        column: 0,
        framework: 'nextjs',
      },
      {
        method: 'POST',
        path: '/api/products',
        filePath: '/app/api/products/route.ts',
        line: 10,
        column: 0,
        framework: 'nextjs',
      },
    ];

    const shared = findSharedPathGroups(routes);
    assert.strictEqual(shared.length, 1);
    assert.strictEqual(shared[0].methods.length, 2);
  });

  test('calculateRouteStatistics reports breakdown across frameworks', () => {
    const routes: ApiRoute[] = [
      {
        method: 'GET',
        path: '/api/express-route',
        filePath: '/server/app.js',
        line: 1,
        column: 0,
        framework: 'express',
      },
      {
        method: 'GET',
        path: '/api/next-route',
        filePath: '/client/app/api/next-route/route.ts',
        line: 1,
        column: 0,
        framework: 'nextjs',
      },
    ];

    const stats = calculateRouteStatistics(routes);
    assert.strictEqual(stats.totalRoutes, 2);
    assert.strictEqual(stats.totalFiles, 2);
    assert.ok(stats.framework.includes('Express'));
    assert.ok(stats.framework.includes('Next.js'));

    const summary = formatRouteStatistics(stats);
    assert.ok(summary.includes('Express'));
    assert.ok(summary.includes('Next.js'));
  });

  test('createRouteQuickPickItem displays framework name in detail', () => {
    const nextRoute: ApiRoute = {
      method: 'POST',
      path: '/api/checkout',
      filePath: '/workspace/app/api/checkout/route.ts',
      line: 15,
      column: 0,
      framework: 'nextjs',
    };

    const item = createRouteQuickPickItem(nextRoute);
    assert.strictEqual(item.label, 'POST /api/checkout');
    assert.ok(item.detail!.includes('Next.js'));
  });
});
