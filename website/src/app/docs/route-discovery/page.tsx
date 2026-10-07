import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/site-config";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CodeBlock } from "@/components/CodeBlock";

export const metadata: Metadata = {
  title: "Route Discovery — Offline AST Analysis Engine",
  description:
    "Learn how API Route Explorer uses static Abstract Syntax Tree (AST) inspection to discover backend routes without executing untrusted code.",
  alternates: {
    canonical: `${siteConfig.url}/docs/route-discovery`,
  },
  openGraph: {
    title: "Route Discovery — API Route Explorer Docs",
    description: "Offline AST parsing mechanics, route normalization, and exclusion rules.",
    url: `${siteConfig.url}/docs/route-discovery`,
  },
};

export default function RouteDiscoveryPage() {
  return (
    <div className="space-y-10">
      <Breadcrumbs
        items={[
          { name: "Docs", href: "/docs" },
          { name: "Route Discovery", href: "/docs/route-discovery" },
        ]}
      />

      <div className="space-y-4">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)]">
          Route Discovery Engine
        </h1>
        <p className="text-base text-[var(--muted)] leading-relaxed">
          API Route Explorer inspects your backend source files using static Abstract Syntax Tree (AST) analysis. This enables fast, accurate discovery without executing server code or connecting to databases.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-[var(--foreground)]">How AST Parsing Works</h2>
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
          Traditional API explorers often require starting the backend server and importing routing modules at runtime. This poses security and stability risks if database drivers fail to connect or required environment variables are absent.
        </p>
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
          API Route Explorer parses JavaScript and TypeScript source tokens statically:
        </p>
        <ul className="space-y-2 text-xs sm:text-sm text-[var(--foreground)]">
          <li>• <strong>Comment Masking:</strong> Automatically ignores commented-out route declarations.</li>
          <li>• <strong>String &amp; Template Literal Resolution:</strong> Normalizes path prefixes and resolves variable parameters.</li>
          <li>• <strong>Hierarchy Tracking:</strong> Assembles parent router mounts (<code>app.use(&apos;/api/v1&apos;, router)</code>) with child endpoints.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-[var(--foreground)]">Safe Exclusion Patterns</h2>
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
          To maintain sub-second scanning performance across large repositories, API Route Explorer excludes build artifacts and non-route directories by default:
        </p>
        <CodeBlock
          code={`node_modules/
.git/
dist/
build/
out/
.next/
coverage/`}
          language="text"
          title="Default Exclude Segments"
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-[var(--foreground)]">File System Watcher &amp; Auto-Refresh</h2>
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
          The extension registers an active file watcher on JavaScript and TypeScript files in your workspace. When you save a new route or edit an existing path, the internal cache updates incrementally, keeping the route tree synchronized with your code.
        </p>
      </section>

      {/* Navigation Footer */}
      <div className="pt-6 border-t border-[var(--surface-border)] flex items-center justify-between text-xs">
        <Link href="/docs/getting-started" className="text-[var(--muted)] hover:text-[var(--foreground)]">
          ← Getting Started
        </Link>
        <Link href="/docs/route-analysis" className="text-emerald-400 font-semibold hover:underline">
          Route Analysis &amp; Health →
        </Link>
      </div>
    </div>
  );
}
