import type { Metadata } from "next";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Changelog — Release History & Version Timeline",
  description:
    "Version history and release notes for API Route Explorer. Discover new features, framework enhancements, and performance optimizations.",
  alternates: {
    canonical: `${siteConfig.url}/changelog`,
  },
  openGraph: {
    title: "API Route Explorer Changelog — Version Timeline",
    description: "Release notes for v1.5.0 and previous versions of API Route Explorer.",
    url: `${siteConfig.url}/changelog`,
  },
};

export default function ChangelogPage() {
  const releases = [
    {
      version: "v1.5.0",
      date: "October 2026",
      title: "Public Launch & Ecosystem Release",
      badge: "Latest Release",
      highlights: [
        "Official public launch across VS Code Marketplace and Open VSX.",
        "Production website with dedicated documentation hub and framework guides.",
        "Verified support across Express, Next.js App Router, Next.js Pages Router, Fastify, and NestJS.",
        "250+ automated unit and integration tests passing in CI.",
        "High-scale AST benchmarks validated across 118+ complex endpoints.",
      ],
    },
    {
      version: "v1.4.0",
      date: "October 2026",
      title: "HTTP Client Hardening & UX Polish",
      highlights: [
        "Dynamic path parameter interpolation supporting Express (:param), Next.js ([param]), and OpenAPI ({param}).",
        "Full request cancellation support using native Node AbortController.",
        "cURL export formatting POSIX-compliant terminal commands with headers and payload.",
        "Millisecond response latency and byte payload size measurement.",
        "Hardened Webview Content Security Policy with cryptographic nonces.",
      ],
    },
    {
      version: "v1.3.0",
      date: "October 2026",
      title: "Native HTTP Client Webview",
      highlights: [
        "Embedded Request Builder and Response Inspector panel inside VS Code.",
        "Headers editor with standard presets for Authorization and Content-Type.",
        "Formatted, collapsible JSON response viewer with one-click copy.",
        "Zero-cloud execution routing requests directly across localhost adapters.",
      ],
    },
    {
      version: "v1.2.0",
      date: "October 2026",
      title: "OpenAPI 3.0.3 Generation & Export",
      highlights: [
        "Offline OpenAPI 3.0.3 specification compiler.",
        "Export workspace API schema directly to openapi.json or openapi.yaml.",
        "Route-level OpenAPI operation preview and clipboard copy.",
        "Deterministic operation ID generation and tag categorization.",
      ],
    },
    {
      version: "v1.1.0",
      date: "September 2026",
      title: "Advanced Route Intelligence & Conflict Analysis",
      highlights: [
        "Static route collision and shadowing conflict detector.",
        "Integration into standard VS Code Problems panel with clickable source references.",
        "Multi-dimensional grouping by file hierarchy, framework, and HTTP verb.",
        "Fuzzy QuickPick search with handler and parameter token matching.",
      ],
    },
    {
      version: "v1.0.0",
      date: "September 2026",
      title: "Initial Extension Release",
      highlights: [
        "Core Activity Bar route tree provider.",
        "Offline Express and Next.js AST scanner.",
        "One-click source code jumping from tree nodes to handler definitions.",
        "File-system watcher with incremental cache updates.",
      ],
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
      {/* Header */}
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-xs font-medium text-emerald-400 font-mono">
          Releases &amp; Changelog
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[var(--foreground)]">
          Product Changelog
        </h1>
        <p className="text-base sm:text-lg text-[var(--muted)] leading-relaxed">
          Stay up to date with the latest features, enhancements, and performance updates to API Route Explorer.
        </p>
      </div>

      {/* Timeline */}
      <div className="space-y-12">
        {releases.map((release) => (
          <article
            key={release.version}
            className="p-8 rounded-3xl border border-[var(--surface-border)] bg-[var(--surface)] space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--surface-border)] pb-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xl font-bold text-emerald-400">
                  {release.version}
                </span>
                {release.badge && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium">
                    {release.badge}
                  </span>
                )}
              </div>
              <span className="text-xs text-[var(--muted)] font-mono">{release.date}</span>
            </div>

            <h2 className="text-lg font-bold text-[var(--foreground)]">{release.title}</h2>

            <ul className="space-y-2 text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
              {release.highlights.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
