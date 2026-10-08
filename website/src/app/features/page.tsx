import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/site-config";
import { CodeBlock } from "@/components/CodeBlock";

export const metadata: Metadata = {
  title: "Features — Route Intelligence, HTTP Client & OpenAPI",
  description:
    "Explore the complete feature set of API Route Explorer: route discovery, multi-dimensional grouping, conflict analysis, native HTTP client, and OpenAPI 3.0.3 generation.",
  alternates: {
    canonical: `${siteConfig.url}/features`,
  },
  openGraph: {
    title: "API Route Explorer Features — Discover, Analyze & Test APIs",
    description:
      "Deep dive into Route Discovery, Native HTTP Client Webview, and OpenAPI 3.0.3 export directly in VS Code.",
    url: `${siteConfig.url}/features`,
  },
};

export default function FeaturesPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-20">
      {/* Header */}
      <div className="max-w-3xl space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-xs font-medium text-emerald-400 font-mono">
          Features &amp; Architecture
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[var(--foreground)]">
          Everything you need to navigate and test backend APIs.
        </h1>
        <p className="text-base sm:text-lg text-[var(--muted)] leading-relaxed">
          API Route Explorer replaces fragmented toolchains with an integrated, local-first workflow built directly into Visual Studio Code.
        </p>
      </div>

      {/* Feature 1: Route Intelligence */}
      <section className="p-8 sm:p-12 rounded-3xl border border-[var(--surface-border)] bg-[var(--surface)] space-y-8">
        <div className="max-w-2xl space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 font-mono">
            01 / Route Intelligence
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)]">
            Instant Route Discovery &amp; Navigation
          </h2>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            Never search through hundreds of controller files manually. The offline AST scanner parses your workspace in milliseconds, presenting a structured tree with fuzzy searching and quick navigation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          <div className="p-5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] space-y-2">
            <h3 className="font-semibold text-sm text-[var(--foreground)]">Multi-Dimensional Grouping</h3>
            <p className="text-[var(--muted)] leading-relaxed">
              Toggle between grouping by file path, framework type, or HTTP verb (GET, POST, PUT, DELETE) without re-scanning your workspace.
            </p>
          </div>
          <div className="p-5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] space-y-2">
            <h3 className="font-semibold text-sm text-[var(--foreground)]">Fuzzy QuickPick Search</h3>
            <p className="text-[var(--muted)] leading-relaxed">
              Press <code>Cmd+Shift+P</code> and search by path token, method, or controller handler name. Matches are scored and highlighted instantly.
            </p>
          </div>
          <div className="p-5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] space-y-2">
            <h3 className="font-semibold text-sm text-[var(--foreground)]">Direct Source Jumping</h3>
            <p className="text-[var(--muted)] leading-relaxed">
              Clicking any route in the Activity Bar opens the exact source file and highlights the line where the endpoint handler is defined.
            </p>
          </div>
        </div>
      </section>

      {/* Feature 2: Route Analysis & Health */}
      <section className="p-8 sm:p-12 rounded-3xl border border-[var(--surface-border)] bg-[var(--surface)] space-y-8">
        <div className="max-w-2xl space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 font-mono">
            02 / Diagnostics
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)]">
            Static Analysis &amp; Conflict Detection
          </h2>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            Detect routing bugs before starting your server. API Route Explorer identifies shadowing conflicts, ambiguous parameter patterns, and duplicate routes directly in the VS Code Problems panel.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-4 text-xs text-[var(--muted)] leading-relaxed">
            <p>
              When parameterized routes like <code>/users/:id</code> precede static routes like <code>/users/me</code>, incoming requests may be hijacked. API Route Explorer alerts you to these ordering issues statically.
            </p>
            <ul className="space-y-2 text-[var(--foreground)]">
              <li>• <strong>Shadowing Warnings:</strong> Detects static endpoints hidden behind dynamic tokens.</li>
              <li>• <strong>Duplicate Collisions:</strong> Flags identical method + normalized path pairs across files.</li>
              <li>• <strong>VS Code Problems Panel:</strong> Warnings integrate cleanly into standard IDE error reporting.</li>
            </ul>
          </div>
          <CodeBlock
            language="typescript"
            title="Express Shadowing Conflict"
            badge="Diagnostic Warning"
            code={`// 1. Dynamic route registered first
router.get('/users/:id', getUserById);

// 2. Static route shadowed by /:id pattern!
// ⚠️ API Route Explorer Diagnostic: Route '/users/me' is shadowed by '/users/:id'
router.get('/users/me', getCurrentUser);`}
          />
        </div>
      </section>

      {/* Feature 3: Native HTTP Client */}
      <section className="p-8 sm:p-12 rounded-3xl border border-[var(--surface-border)] bg-[var(--surface)] space-y-8">
        <div className="max-w-2xl space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 font-mono">
            03 / Testing
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)]">
            Native HTTP Client Webview
          </h2>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            Execute local requests without switching to Postman or terminal curl commands. The embedded HTTP Client pre-populates your route, extracts dynamic parameters, and renders formatted responses.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-xs">
          <div className="p-5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] space-y-2">
            <h3 className="font-semibold text-sm text-[var(--foreground)]">Path Parameters</h3>
            <p className="text-[var(--muted)]">
              Detects tokens (<code>:id</code>, <code>[slug]</code>) and replaces them dynamically as you type values into the parameters table.
            </p>
          </div>
          <div className="p-5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] space-y-2">
            <h3 className="font-semibold text-sm text-[var(--foreground)]">Headers &amp; JSON Body</h3>
            <p className="text-[var(--muted)]">
              Full key-value headers editor and embedded JSON body validator for POST, PUT, and PATCH operations.
            </p>
          </div>
          <div className="p-5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] space-y-2">
            <h3 className="font-semibold text-sm text-[var(--foreground)]">cURL Generation</h3>
            <p className="text-[var(--muted)]">
              One-click copy formats your request into a valid POSIX cURL snippet ready for terminal scripts or CI pipelines.
            </p>
          </div>
          <div className="p-5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] space-y-2">
            <h3 className="font-semibold text-sm text-[var(--foreground)]">Abort Cancellation</h3>
            <p className="text-[var(--muted)]">
              Cancel hanging requests or infinite loops instantly using native Node AbortController socket termination.
            </p>
          </div>
        </div>
      </section>

      {/* Feature 4: OpenAPI 3.0.3 */}
      <section className="p-8 sm:p-12 rounded-3xl border border-[var(--surface-border)] bg-[var(--surface)] space-y-8">
        <div className="max-w-2xl space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 font-mono">
            04 / Documentation
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)]">
            OpenAPI 3.0.3 Generation
          </h2>
          <p className="text-sm text-[var(--muted)] leading-relaxed">
            Turn your code into Swagger and OpenAPI specs with zero runtime dependencies. Generates valid JSON and YAML documents from static routes.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="space-y-4 text-xs text-[var(--muted)] leading-relaxed">
            <p>
              Export specs for your entire workspace or copy a single operation snippet to share with frontend developers and API gateways.
            </p>
            <ul className="space-y-2 text-[var(--foreground)]">
              <li>• Generates standardized paths, HTTP operations, and parameter objects</li>
              <li>• Exports directly to <code>openapi.json</code> or <code>openapi.yaml</code></li>
              <li>• Works offline without running database connections or runtime servers</li>
            </ul>
          </div>
          <CodeBlock
            language="yaml"
            title="Generated openapi.yaml"
            badge="OpenAPI 3.0.3"
            code={`openapi: 3.0.3
info:
  title: Workspace API
  version: 1.0.0
paths:
  /api/v1/users/{id}:
    get:
      summary: Get user by ID
      tags: [Users]
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string }
      responses:
        '200': { description: OK }`}
          />
        </div>
      </section>

      {/* Bottom CTA */}
      <div className="text-center space-y-4 pt-8">
        <h2 className="text-2xl font-bold text-[var(--foreground)]">
          Ready to supercharge your API workflow?
        </h2>
        <div className="flex justify-center gap-4">
          <Link
            href="/install"
            className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-sm transition-all"
          >
            Install for VS Code
          </Link>
          <Link
            href="/docs"
            className="px-6 py-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] text-[var(--foreground)] text-sm font-semibold hover:bg-[var(--surface-hover)] transition-colors"
          >
            Read the Documentation
          </Link>
        </div>
      </div>
    </div>
  );
}
