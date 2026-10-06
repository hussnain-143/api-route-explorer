import { ApiFramework } from '../models/framework';

export interface FrameworkDetectionResult {
  hasExpress: boolean;
  hasNextjs: boolean;
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
  }

  const hasExpress = evidence.express.length > 0;
  const hasNextjs = evidence.nextjs.length > 0;
  const detectedFrameworks: ApiFramework[] = [];

  if (hasExpress) {
    detectedFrameworks.push('express');
  }
  if (hasNextjs) {
    detectedFrameworks.push('nextjs');
  }

  return {
    hasExpress,
    hasNextjs,
    detectedFrameworks,
    evidence,
  };
}
