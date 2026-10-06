import { ApiFramework, FrameworkAdapter } from '../models/framework';
import { ExpressAdapter } from './express/expressAdapter';
import { NextjsAdapter } from './nextjs/nextjsAdapter';

/**
 * Central registry managing available framework adapters.
 * Enables modular expansion for future frameworks (Fastify, NestJS) without scanner rewrites.
 */
export class FrameworkRegistry {
  private readonly adapters = new Map<ApiFramework, FrameworkAdapter>();

  constructor() {
    this.registerAdapter(new ExpressAdapter());
    this.registerAdapter(new NextjsAdapter());
  }

  /**
   * Registers a framework adapter into the registry.
   */
  public registerAdapter(adapter: FrameworkAdapter): void {
    this.adapters.set(adapter.framework, adapter);
  }

  /**
   * Retrieves all registered framework adapters.
   */
  public getAdapters(): FrameworkAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Retrieves an adapter by framework identifier.
   */
  public getAdapter(framework: ApiFramework): FrameworkAdapter | undefined {
    return this.adapters.get(framework);
  }

  /**
   * Finds all adapters capable of processing the given file and source code.
   */
  public getAdaptersForFile(filePath: string, source: string): FrameworkAdapter[] {
    const matched: FrameworkAdapter[] = [];
    for (const adapter of this.adapters.values()) {
      if (adapter.canHandle(filePath, source)) {
        matched.push(adapter);
      }
    }
    return matched;
  }
}

/**
 * Singleton default registry instance.
 */
export const defaultFrameworkRegistry = new FrameworkRegistry();
