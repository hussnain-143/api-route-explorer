import type { Metadata } from "next";
import { siteConfig } from "@/lib/site-config";
import { CodeBlock } from "@/components/CodeBlock";

export const metadata: Metadata = {
  title: "Framework Support — Express, Next.js, Fastify & NestJS",
  description:
    "Discover how API Route Explorer automatically detects routes across Express, Next.js App & Pages Router, Fastify, and NestJS.",
  alternates: {
    canonical: `${siteConfig.url}/frameworks`,
  },
  openGraph: {
    title: "Supported Backend Frameworks — API Route Explorer",
    description:
      "Native AST parsing for Express, Next.js App/Pages Router, Fastify, and NestJS directly inside VS Code.",
    url: `${siteConfig.url}/frameworks`,
  },
};

export default function FrameworksPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-20">
      {/* Header */}
      <div className="max-w-3xl space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-xs font-medium text-emerald-400 font-mono">
          Supported Stacks
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[var(--foreground)]">
          Built for modern backend frameworks.
        </h1>
        <p className="text-base sm:text-lg text-[var(--muted)] leading-relaxed">
          API Route Explorer includes dedicated AST parsers that understand each framework&apos;s idiosyncratic routing semantics, from file-based conventions to TypeScript decorators.
        </p>
      </div>

      {/* 1. Express */}
      <section className="p-8 sm:p-12 rounded-3xl border border-[var(--surface-border)] bg-[var(--surface)] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 font-mono">
              Framework 01
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)]">Express.js</h2>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono w-fit">
            Full AST Support
          </span>
        </div>
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed max-w-3xl">
          Express routes are detected via call expression analysis on <code>app</code> and <code>router</code> instances. Sub-router prefix mounts (<code>app.use(&apos;/api/v1&apos;, router)</code>) are automatically resolved into hierarchical path templates.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3 text-xs">
            <h3 className="font-semibold text-[var(--foreground)]">Supported Patterns:</h3>
            <ul className="space-y-1.5 text-[var(--muted)]">
              <li>• Direct HTTP verbs: <code>app.get()</code>, <code>router.post()</code>, <code>router.delete()</code></li>
              <li>• Chainable route handlers: <code>router.route(&apos;/resource&apos;).get().post()</code></li>
              <li>• Nested router mounting: <code>app.use(&apos;/users&apos;, userRouter)</code></li>
              <li>• Colon parameter syntax: <code>:id</code>, <code>:userId</code>, <code>:slug</code></li>
            </ul>
          </div>
          <CodeBlock
            language="javascript"
            title="Express Router Example"
            code={`const express = require('express');
const router = express.Router();

// Discovered as: GET /api/v1/users/:id
router.get('/:id', authMiddleware, async (req, res) => {
  const user = await db.findUser(req.params.id);
  res.json(user);
});`}
          />
        </div>
      </section>

      {/* 2. Next.js App Router */}
      <section className="p-8 sm:p-12 rounded-3xl border border-[var(--surface-border)] bg-[var(--surface)] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 font-mono">
              Framework 02
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)]">Next.js App Router</h2>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono w-fit">
            File-System Routing
          </span>
        </div>
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed max-w-3xl">
          Scans <code>app/**/route.ts</code> and <code>app/**/route.js</code> files. HTTP verbs are derived directly from named export declarations (<code>export async function GET()</code>), mapping folders to endpoint paths.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3 text-xs">
            <h3 className="font-semibold text-[var(--foreground)]">Supported Patterns:</h3>
            <ul className="space-y-1.5 text-[var(--muted)]">
              <li>• Standard Route Handlers: <code>app/api/auth/route.ts</code></li>
              <li>• Dynamic path segments: <code>app/api/users/[id]/route.ts</code></li>
              <li>• Catch-all dynamic segments: <code>app/api/docs/[...slug]/route.ts</code></li>
              <li>• Route Groups handling: <code>app/(marketing)/api/route.ts</code> (groups omitted from path)</li>
            </ul>
          </div>
          <CodeBlock
            language="typescript"
            title="app/api/users/[id]/route.ts"
            code={`import { NextResponse } from 'next/server';

// Discovered as: GET /api/users/{id}
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  return NextResponse.json({ id: params.id });
}`}
          />
        </div>
      </section>

      {/* 3. Next.js Pages Router */}
      <section className="p-8 sm:p-12 rounded-3xl border border-[var(--surface-border)] bg-[var(--surface)] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 font-mono">
              Framework 03
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)]">Next.js Pages Router</h2>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono w-fit">
            Legacy &amp; Hybrid Support
          </span>
        </div>
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed max-w-3xl">
          Inspects API routes declared in <code>pages/api/**/*.ts</code> or <code>.js</code> files. Parses default exported request handlers and analyzes internal method dispatch switches (e.g. <code>switch (req.method)</code>).
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3 text-xs">
            <h3 className="font-semibold text-[var(--foreground)]">Supported Patterns:</h3>
            <ul className="space-y-1.5 text-[var(--muted)]">
              <li>• Standard endpoints: <code>pages/api/webhook.ts</code></li>
              <li>• Parameterized files: <code>pages/api/posts/[id].ts</code></li>
              <li>• Method switch evaluation: <code>case &apos;POST&apos;</code>, <code>case &apos;GET&apos;</code></li>
            </ul>
          </div>
          <CodeBlock
            language="typescript"
            title="pages/api/users/[id].ts"
            code={`import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    res.status(200).json({ id: req.query.id });
  }
}`}
          />
        </div>
      </section>

      {/* 4. Fastify */}
      <section className="p-8 sm:p-12 rounded-3xl border border-[var(--surface-border)] bg-[var(--surface)] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 font-mono">
              Framework 04
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)]">Fastify</h2>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono w-fit">
            Plugin Architecture
          </span>
        </div>
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed max-w-3xl">
          Discovers routes registered on <code>fastify</code> instance objects and tracks modular plugin registrations with route prefixes (<code>fastify.register(userRoutes, &#123; prefix: &apos;/users&apos; &#125;)</code>).
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3 text-xs">
            <h3 className="font-semibold text-[var(--foreground)]">Supported Patterns:</h3>
            <ul className="space-y-1.5 text-[var(--muted)]">
              <li>• Instance shorthand methods: <code>fastify.get()</code>, <code>fastify.post()</code></li>
              <li>• Generic route declaration: <code>fastify.route(&#123; method, url, handler &#125;)</code></li>
              <li>• Prefix-scoped plugins: <code>fastify.register(plugin, &#123; prefix &#125;)</code></li>
            </ul>
          </div>
          <CodeBlock
            language="typescript"
            title="Fastify Route Plugin"
            code={`export async function userRoutes(fastify, opts) {
  // Discovered as: GET /items/:id
  fastify.get('/:id', async (request, reply) => {
    return { item: request.params.id };
  });
}`}
          />
        </div>
      </section>

      {/* 5. NestJS */}
      <section className="p-8 sm:p-12 rounded-3xl border border-[var(--surface-border)] bg-[var(--surface)] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 font-mono">
              Framework 05
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)]">NestJS</h2>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono w-fit">
            TypeScript Decorators
          </span>
        </div>
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed max-w-3xl">
          Analyzes TypeScript class declarations and decorator AST nodes. Combines class-level <code>@Controller(&apos;prefix&apos;)</code> with method-level decorators like <code>@Get(&apos;:id&apos;)</code>, <code>@Post()</code>, and <code>@Delete()</code>.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3 text-xs">
            <h3 className="font-semibold text-[var(--foreground)]">Supported Patterns:</h3>
            <ul className="space-y-1.5 text-[var(--muted)]">
              <li>• Controller decorators: <code>@Controller(&apos;api/v1/users&apos;)</code></li>
              <li>• Method action decorators: <code>@Get()</code>, <code>@Post()</code>, <code>@Put()</code>, <code>@Delete()</code>, <code>@Patch()</code></li>
              <li>• Parameter decorators: <code>@Param(&apos;id&apos;)</code>, <code>@Body()</code>, <code>@Query()</code></li>
            </ul>
          </div>
          <CodeBlock
            language="typescript"
            title="NestJS Controller Example"
            code={`@Controller('users')
export class UsersController {
  // Discovered as: GET /users/:id
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);
  }
}`}
          />
        </div>
      </section>

      {/* Community Demand Notice */}
      <div className="p-8 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] text-center space-y-3">
        <h3 className="text-lg font-bold text-[var(--foreground)]">Looking for another framework?</h3>
        <p className="text-xs text-[var(--muted)] max-w-xl mx-auto">
          API Route Explorer is designed with an extensible scanner engine. Support for Koa, Hono, Elysia, and Spring Boot can be added based on community feedback.
        </p>
        <div className="pt-2">
          <a
            href={siteConfig.links.issues}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:underline"
          >
            Request a framework on GitHub ↗
          </a>
        </div>
      </div>
    </div>
  );
}
