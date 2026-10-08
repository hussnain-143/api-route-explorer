import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/site-config";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CodeBlock } from "@/components/CodeBlock";

export const metadata: Metadata = {
  title: "Native HTTP Client Guide — Test APIs in VS Code",
  description:
    "Complete reference for the embedded HTTP Client in API Routes Explorer. Dynamic parameters, headers, JSON body, cancellation, and response inspection.",
  alternates: {
    canonical: `${siteConfig.url}/docs/http-client`,
  },
  openGraph: {
    title: "Native HTTP Client — API Routes Explorer Docs",
    description: "Execute local HTTP requests directly inside your VS Code editor.",
    url: `${siteConfig.url}/docs/http-client`,
  },
};

export default function HttpClientDocsPage() {
  return (
    <div className="space-y-10">
      <Breadcrumbs
        items={[
          { name: "Docs", href: "/docs" },
          { name: "Native HTTP Client", href: "/docs/http-client" },
        ]}
      />

      <div className="space-y-4">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)]">
          Native HTTP Client Guide
        </h1>
        <p className="text-base text-[var(--muted)] leading-relaxed">
          Execute HTTP requests against your local or development servers directly from your editor. Pre-populate endpoints, interpolate dynamic path parameters, attach headers, and view structured responses without opening third-party tools.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-[var(--foreground)]">Opening the Client</h2>
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
          You can launch the HTTP Client Webview panel through multiple workflows:
        </p>
        <ul className="space-y-2 text-xs sm:text-sm text-[var(--foreground)]">
          <li>• <strong>Activity Bar Route Click:</strong> Click the <strong>Test</strong> (⚡) icon next to any route item in the sidebar tree.</li>
          <li>• <strong>Right-Click Context Menu:</strong> Right-click a route in the tree and choose <strong>Test in HTTP Client</strong>.</li>
          <li>• <strong>Command Palette:</strong> Press <kbd className="px-1.5 py-0.5 rounded bg-[var(--surface-elevated)] border border-[var(--surface-border)] text-xs">Cmd+Shift+P</kbd> and run <code>API Routes Explorer: Open HTTP Client</code>.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-[var(--foreground)]">Dynamic Path Parameters</h2>
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
          When opening parameterized routes like <code>/api/v1/users/:id</code> or <code>/api/v1/posts/[slug]</code>, API Routes Explorer detects every parameter token and populates the <strong>Params</strong> tab:
        </p>
        <ul className="space-y-1.5 text-xs sm:text-sm text-[var(--muted)]">
          <li>• Parameter keys are pre-filled and marked as required based on the route definition.</li>
          <li>• Entering a value dynamically replaces the parameter in the resolved URL preview in real time.</li>
          <li>• Supports Express style (<code>:id</code>), Next.js style (<code>[id]</code>, <code>[...slug]</code>), and OpenAPI style (<code>&#123;id&#125;</code>).</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-[var(--foreground)]">Headers &amp; JSON Body</h2>
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
          Add arbitrary request headers and structured request payloads:
        </p>
        <ul className="space-y-1.5 text-xs sm:text-sm text-[var(--muted)]">
          <li>• <strong>Headers:</strong> Standard presets like <code>Content-Type: application/json</code> and <code>Authorization: Bearer &lt;token&gt;</code> are easily inserted.</li>
          <li>• <strong>JSON Body:</strong> Embedded editor validates JSON syntax before sending to prevent malformed payloads.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-[var(--foreground)]">cURL Generation &amp; Export</h2>
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
          Clicking the <strong>cURL</strong> button formats the entire request into a standard POSIX-compliant cURL command copied directly to your clipboard:
        </p>
        <CodeBlock
          code={`curl -X POST http://localhost:5000/api/v1/users \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer dev_token" \\
  -d '{"name":"Alex","email":"alex@example.com"}'`}
          language="bash"
          title="Generated cURL Command"
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-[var(--foreground)]">In-Flight Request Cancellation</h2>
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
          If a long-running query or backend hang is taking too long, click <strong>Cancel</strong>. API Routes Explorer immediately triggers an internal <code>AbortController</code> signal on the active Node HTTP request, releasing sockets cleanly.
        </p>
      </section>

      {/* Navigation Footer */}
      <div className="pt-6 border-t border-[var(--surface-border)] flex items-center justify-between text-xs">
        <Link href="/docs/route-analysis" className="text-[var(--muted)] hover:text-[var(--foreground)]">
          ← Route Analysis
        </Link>
        <Link href="/docs/openapi" className="text-emerald-400 font-semibold hover:underline">
          OpenAPI Generation →
        </Link>
      </div>
    </div>
  );
}
