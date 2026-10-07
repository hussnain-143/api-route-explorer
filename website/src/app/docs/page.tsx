import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/site-config";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const metadata: Metadata = {
  title: "Documentation Overview — Architecture & Concepts",
  description:
    "Official documentation for API Route Explorer. Learn how AST scanning, route tree providers, HTTP testing, and OpenAPI generation work in VS Code.",
  alternates: {
    canonical: `${siteConfig.url}/docs`,
  },
  openGraph: {
    title: "API Route Explorer Documentation — Introduction",
    description: "Architectural overview and core concepts for API Route Explorer.",
    url: `${siteConfig.url}/docs`,
  },
};

export default function DocsIndexPage() {
  return (
    <div className="space-y-10">
      <Breadcrumbs items={[{ name: "Documentation", href: "/docs" }]} />

      <div className="space-y-4">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)]">
          API Route Explorer Documentation
        </h1>
        <p className="text-base text-[var(--muted)] leading-relaxed">
          Welcome to the official developer documentation for API Route Explorer. Discover how to inspect, analyze, test, and document backend routes directly inside Visual Studio Code.
        </p>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          href="/docs/getting-started"
          className="p-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] hover:border-emerald-500/40 transition-colors space-y-2"
        >
          <span className="text-emerald-400 text-xs font-mono font-semibold">01 / Quick Start</span>
          <h3 className="text-base font-bold text-[var(--foreground)]">Getting Started →</h3>
          <p className="text-xs text-[var(--muted)]">
            Step-by-step walkthrough to scan your first backend project in 60 seconds.
          </p>
        </Link>

        <Link
          href="/docs/route-discovery"
          className="p-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] hover:border-teal-500/40 transition-colors space-y-2"
        >
          <span className="text-teal-400 text-xs font-mono font-semibold">02 / Engine</span>
          <h3 className="text-base font-bold text-[var(--foreground)]">Route Discovery →</h3>
          <p className="text-xs text-[var(--muted)]">
            Learn how the offline AST scanner identifies routes without runtime code execution.
          </p>
        </Link>

        <Link
          href="/docs/http-client"
          className="p-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] hover:border-cyan-500/40 transition-colors space-y-2"
        >
          <span className="text-cyan-400 text-xs font-mono font-semibold">03 / Testing</span>
          <h3 className="text-base font-bold text-[var(--foreground)]">Native HTTP Client →</h3>
          <p className="text-xs text-[var(--muted)]">
            Configure dynamic path parameters, request headers, JSON payloads, and cancellation.
          </p>
        </Link>

        <Link
          href="/docs/openapi"
          className="p-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] hover:border-emerald-500/40 transition-colors space-y-2"
        >
          <span className="text-emerald-400 text-xs font-mono font-semibold">04 / Specifications</span>
          <h3 className="text-base font-bold text-[var(--foreground)]">OpenAPI 3.0.3 →</h3>
          <p className="text-xs text-[var(--muted)]">
            Generate and export valid Swagger / OpenAPI documents to JSON or YAML.
          </p>
        </Link>
      </div>

      {/* Core Architecture */}
      <section className="space-y-4 pt-6 border-t border-[var(--surface-border)]">
        <h2 className="text-2xl font-bold text-[var(--foreground)]">Core Architecture</h2>
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
          API Route Explorer is designed with modular boundaries ensuring separation between static AST inspection, diagnostic health calculation, and interactive Webview clients:
        </p>
        <div className="p-5 rounded-2xl bg-[#030508] border border-[var(--surface-border)] text-xs font-mono text-emerald-400 leading-relaxed overflow-x-auto whitespace-pre">
{`VS Code Workspace
  ├── AST Route Scanner (Offline AST Parsing)
  ├── RouteTreeProvider (Activity Bar Hierarchy)
  ├── Diagnostics Engine (Problems Panel Conflict Detection)
  ├── Native HTTP Client (Webview Panel + Node http/https)
  └── OpenAPI Generator (OpenAPI 3.0.3 Compiler)`}
        </div>
      </section>
    </div>
  );
}
