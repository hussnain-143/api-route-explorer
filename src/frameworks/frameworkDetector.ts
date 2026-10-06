import { ApiFramework } from '../models/framework';

export interface FrameworkDetectionResult {
  hasExpress: boolean;
  hasNextjs: boolean;
  hasFastify: boolean;
  hasNestjs: boolean;
  detectedFrameworks: ApiFramework[];
  evidence: Record<string, string[]>;
}

/**
 * Detects which backend frameworks are present in the workspace
 * using dependencies, configuration files, directory structures, and file patterns.
 */
export function detectFrameworks(
  filePaths: string[],
  packageJsonSource?: string
): FrameworkDetectionResult {
  const evidence: Record<string, string[]> = {
    express: [],
    nextjs: [],
    fastify: [],
    nestjs: [],
  };

  // 1. Analyze package.json dependencies
  if (packageJsonSource) {
    try {
      const parsed = JSON.parse(packageJsonSource);
      const allDeps = {
        ...(parsed.dependencies || {}),
        ...(parsed.devDependencies || {}),
      };

      if (allDeps.express) {
        evidence.express.push(`package.json dependency (express@${allDeps.express})`);
      }
      if (allDeps.next) {
        evidence.nextjs.push(`package.json dependency (next@${allDeps.next})`);
      }
      if (allDeps.fastify) {
        evidence.fastify.push(`package.json dependency (fastify@${allDeps.fastify})`);
      }
      if (allDeps['@nestjs/common'] || allDeps['@nestjs/core']) {
        const nestVer = allDeps['@nestjs/common'] || allDeps['@nestjs/core'];
        evidence.nestjs.push(`package.json dependency (@nestjs/core@${nestVer})`);
      }
    } catch {
      // Ignore malformed package.json
    }
  }

  // 2. Analyze workspace file paths and config signatures
  for (const rawPath of filePaths) {
    const normalized = rawPath.replace(/\\/g, '/');

    // Next.js configuration files
    if (/(?:^|\/)next\.config\.(?:js|mjs|ts)$/i.test(normalized)) {
      evidence.nextjs.push(`Configuration file found (${normalized})`);
    }

    // Next.js App Router route files
    if (/(?:^|\/)(?:src\/app|app)\/.*route\.[jt]sx?$/i.test(normalized)) {
      evidence.nextjs.push(`App Router route file found (${normalized})`);
    }

    // Next.js Pages Router API files
    if (/(?:^|\/)(?:src\/pages\/api|pages\/api)\/.*\.[jt]sx?$/i.test(normalized)) {
      evidence.nextjs.push(`Pages Router API file found (${normalized})`);
    }

    // Express typical conventions
    if (/(?:routes?|controllers?|endpoints?)\/.*\.[jt]sx?$/i.test(normalized)) {
      evidence.express.push(`Routes directory convention (${normalized})`);
    }

    // NestJS typical conventions: *.controller.ts, *.module.ts
    if (/\.controller\.[jt]s$/i.test(normalized)) {
      evidence.nestjs.push(`NestJS controller convention (${normalized})`);
    }
  }

  const hasExpress = evidence.express.length > 0;
  const hasNextjs = evidence.nextjs.length > 0;
  const hasFastify = evidence.fastify.length > 0;
  const hasNestjs = evidence.nestjs.length > 0;
  const detectedFrameworks: ApiFramework[] = [];

  if (hasExpress) {
    detectedFrameworks.push('express');
  }
  if (hasNextjs) {
    detectedFrameworks.push('nextjs');
  }
  if (hasFastify) {
    detectedFrameworks.push('fastify');
  }
  if (hasNestjs) {
    detectedFrameworks.push('nestjs');
  }

  return {
    hasExpress,
    hasNextjs,
    hasFastify,
    hasNestjs,
    detectedFrameworks,
    evidence,
  };
}
