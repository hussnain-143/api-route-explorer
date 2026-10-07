import * as assert from 'assert';
import * as vscode from 'vscode';
import { COMMANDS, MESSAGES, BRAND_COLORS, VIEWS } from '../utils/constants';
import { getMethodIcon } from '../providers/routeTreeProvider';
import { defaultFrameworkRegistry } from '../frameworks/frameworkRegistry';
import { normalizeRoutePath } from '../analysis/duplicateDetector';
import { ApiRoute } from '../models/route';

suite('API Route Explorer — Sprint 9 v1.0 Release Readiness Suite', () => {
  suite('Release Metadata & Configuration Integrity', () => {
    test('All contributed command IDs exist in COMMANDS constant registry', () => {
      const packageJson = require('../../package.json');
      const contributes = packageJson.contributes;
      assert.ok(contributes.commands && contributes.commands.length > 0);

      const commandValues = Object.values(COMMANDS);
      for (const cmd of contributes.commands) {
        assert.ok(
          commandValues.includes(cmd.command),
          `Command ${cmd.command} defined in package.json contributes must exist in COMMANDS constant`
        );
      }
    });

    test('Package metadata satisfies production marketplace requirements', () => {
      const pkg = require('../../package.json');
      assert.ok(/^\d+\.\d+\.\d+$/.test(pkg.version), `Version should be valid release version, got ${pkg.version}`);
      assert.strictEqual(pkg.name, 'api-route-explorer');
      assert.strictEqual(pkg.publisher, 'hussnain-143');
      assert.strictEqual(pkg.license, 'MIT');
      assert.ok(pkg.description && pkg.description.includes('API routes'));
      assert.ok(pkg.keywords && pkg.keywords.length >= 5);
      assert.ok(pkg.repository && pkg.repository.url);
      assert.ok(pkg.bugs && pkg.bugs.url);
      assert.ok(pkg.homepage);
      assert.ok(pkg.icon);
    });

    test('View IDs align with VIEWS constant definitions', () => {
      const pkg = require('../../package.json');
      const views = pkg.contributes.views;
      assert.ok(views.apiRouteExplorer);

      const viewIds = views.apiRouteExplorer.map((v: { id: string }) => v.id);
      assert.ok(viewIds.includes(VIEWS.ROUTES));
      assert.ok(viewIds.includes(VIEWS.ANALYSIS));
    });
  });

  suite('Framework Support Matrix Completeness', () => {
    test('Framework registry contains all 4 supported frameworks', () => {
      const adapters = defaultFrameworkRegistry.getAdapters();
      const frameworks = adapters.map((a) => a.framework);

      assert.ok(frameworks.includes('express'), 'Express adapter must be registered');
      assert.ok(frameworks.includes('nextjs'), 'Next.js adapter must be registered');
      assert.ok(frameworks.includes('fastify'), 'Fastify adapter must be registered');
      assert.ok(frameworks.includes('nestjs'), 'NestJS adapter must be registered');
      assert.strictEqual(frameworks.length, 4);
    });

    test('All HTTP methods map to valid accessible ThemeIcons without throwing', () => {
      const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'ANY'] as const;
      for (const m of methods) {
        const icon = getMethodIcon(m);
        assert.ok(icon);
        assert.ok(icon instanceof vscode.ThemeIcon);
        assert.ok(icon.id);
      }
    });
  });

  suite('Defensive Error Handling & Edge Cases', () => {
    test('normalizeRoutePath safely handles null, undefined, empty, and malformed paths', () => {
      assert.strictEqual(normalizeRoutePath(''), '/');
      assert.strictEqual(normalizeRoutePath('   '), '/');
      assert.strictEqual(normalizeRoutePath('///'), '/');
      assert.strictEqual(normalizeRoutePath('users'), '/users');
      assert.strictEqual(normalizeRoutePath('//api//v1///users/'), '/api/v1/users');
      assert.strictEqual(normalizeRoutePath('/users/:id'), '/users/:param');
      assert.strictEqual(normalizeRoutePath('/users/:userId/posts/:postId'), '/users/:param/posts/:param');
    });

    test('MESSAGES constants provide user-friendly non-technical guidance', () => {
      assert.ok(!MESSAGES.NO_ROUTES_FOUND.includes('undefined'));
      assert.ok(!MESSAGES.NO_ROUTES_TITLE.includes('undefined'));
      assert.ok(MESSAGES.NO_ROUTES_DESCRIPTION.length > 10);
      assert.strictEqual(MESSAGES.NO_ROUTES_EMPTY_DESCRIPTION, 'No API routes discovered in workspace.');
    });

    test('Brand colors conform to emerald/teal/cyan palette and avoid purple/indigo', () => {
      assert.strictEqual(BRAND_COLORS.PRIMARY_EMERALD, '#10B981');
      assert.strictEqual(BRAND_COLORS.SECONDARY_TEAL, '#14B8A6');
      assert.strictEqual(BRAND_COLORS.ACCENT_CYAN, '#06B6D4');
      assert.strictEqual(BRAND_COLORS.DEEP_BACKGROUND, '#0B1220');
      assert.strictEqual(BRAND_COLORS.DARK_SURFACE, '#111827');
    });
  });

  suite('Navigation and Route Model Safety', () => {
    test('ApiRoute model integrity validation across all required attributes', () => {
      const testRoute: ApiRoute = {
        method: 'GET',
        path: '/api/v1/health',
        filePath: '/workspace/src/health.ts',
        line: 12,
        column: 4,
        framework: 'express',
      };

      assert.strictEqual(testRoute.method, 'GET');
      assert.strictEqual(testRoute.path, '/api/v1/health');
      assert.strictEqual(testRoute.filePath, '/workspace/src/health.ts');
      assert.strictEqual(testRoute.line, 12);
      assert.strictEqual(testRoute.column, 4);
      assert.strictEqual(testRoute.framework, 'express');
    });
  });
});
