import Link from "next/link";
import { siteConfig } from "@/lib/site-config";
import { ProductPreview } from "@/components/ProductPreview";

export default function HomePage() {
  return (
    <div className="space-y-24 sm:space-y-32 pb-24">
      {/* 1. HERO SECTION */}
      <section className="relative pt-12 sm:pt-20 lg:pt-28 overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-emerald-500/10 via-cyan-500/5 to-transparent blur-3xl pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[var(--surface-border)] bg-[var(--surface)] text-xs font-medium text-[var(--muted)]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>OPEN SOURCE • VS CODE EXTENSION</span>
            <span className="text-[var(--surface-border-strong)]">•</span>
            <span className="text-emerald-400 font-semibold">v{siteConfig.version}</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-[var(--foreground)] max-w-4xl mx-auto leading-[1.1]">
            See every API route.{" "}
            <span className="gradient-text">Jump straight to the code.</span>
          </h1>

          {/* Subheading */}
          <p className="text-base sm:text-lg lg:text-xl text-[var(--muted)] max-w-2xl mx-auto leading-relaxed">
            API Route Explorer discovers, analyzes, tests, and documents backend API routes directly inside VS Code.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              href="/install"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-sm transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
            >
              <span>Install for VS Code</span>
              <span>→</span>
            </Link>
            <a
              href={siteConfig.links.github}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--foreground)] font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              <span>View on GitHub</span>
              <span className="text-xs">↗</span>
            </a>
          </div>

          {/* Supported Frameworks Ticker */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-2 text-xs text-[var(--muted)]">
            <span className="mr-2 font-medium text-[var(--foreground)]">Verified Support:</span>
            {["Express", "Next.js App Router", "Next.js Pages Router", "Fastify", "NestJS", "OpenAPI 3.0.3"].map(
              (fw) => (
                <span
                  key={fw}
                  className="px-2.5 py-1 rounded-md border border-[var(--surface-border)] bg-[var(--surface)]"
                >
                  {fw}
                </span>
              )
            )}
          </div>

          {/* Product Visual */}
          <div className="pt-8 max-w-5xl mx-auto">
            <ProductPreview />
          </div>

          {/* Micro-Proof Metrics */}
          <div className="pt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
            <div className="p-4 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)]">
              <div className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono">250+</div>
              <div className="text-xs text-[var(--muted)] mt-1">Automated tests passed</div>
            </div>
            <div className="p-4 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)]">
              <div className="text-xl sm:text-2xl font-bold text-teal-400 font-mono">118</div>
              <div className="text-xs text-[var(--muted)] mt-1">Routes benchmark validated</div>
            </div>
            <div className="p-4 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)]">
              <div className="text-xl sm:text-2xl font-bold text-cyan-400 font-mono">3.0.3</div>
              <div className="text-xs text-[var(--muted)] mt-1">OpenAPI compliant</div>
            </div>
            <div className="p-4 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)]">
              <div className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono">Local-first</div>
              <div className="text-xs text-[var(--muted)] mt-1">Zero cloud dependencies</div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. THE PROBLEM SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface)] p-8 sm:p-12 lg:p-16">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-12">
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-[var(--foreground)]">
              Stop switching between tools.
            </h2>
            <p className="text-sm sm:text-base text-[var(--muted)]">
              Backend development shouldn&apos;t require copying URLs into separate API clients and searching through files just to find your route handlers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* The Old Way */}
            <div className="p-6 rounded-2xl border border-rose-500/20 bg-rose-500/5 space-y-4 text-xs font-mono">
              <div className="text-rose-400 font-semibold uppercase tracking-wider text-[11px]">
                The Traditional Tool-Switching Loop
              </div>
              <div className="space-y-2 text-[var(--muted)]">
                <div>1. Write backend controller code</div>
                <div>2. Manually search files to locate route mount path</div>
                <div>3. Copy URL &amp; open Postman / Insomnia</div>
                <div>4. Configure parameters, headers, and payload</div>
                <div>5. Send request and inspect response</div>
                <div>6. Return to VS Code and search for the handler again</div>
              </div>
            </div>

            {/* The API Route Explorer Way */}
            <div className="p-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 space-y-4 text-xs font-mono">
              <div className="text-emerald-400 font-semibold uppercase tracking-wider text-[11px]">
                With API Route Explorer
              </div>
              <div className="space-y-2 text-[var(--foreground)]">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>Routes automatically listed in Activity Bar</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>1-click jump from route tree to exact source code</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>Native HTTP Client pre-populated with method &amp; params</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>Local requests with cancellation and latency metrics</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span>Export standardized OpenAPI 3.0.3 without leaving editor</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. PRODUCT WORKFLOW (5 STEPS) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            Workflow
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-[var(--foreground)]">
            A complete route lifecycle in your editor
          </h2>
          <p className="text-sm text-[var(--muted)]">
            Five unified stages designed to eliminate friction in API development.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[
            {
              step: "01",
              title: "Discover",
              desc: "Offline AST parsing detects every endpoint in Express, Next.js, Fastify, and NestJS.",
            },
            {
              step: "02",
              title: "Analyze",
              desc: "Evaluates route health, identifies parameter collisions, and detects shadowed paths.",
            },
            {
              step: "03",
              title: "Test",
              desc: "Native HTTP Client pre-populated with URL, dynamic path parameters, and headers.",
            },
            {
              step: "04",
              title: "Inspect",
              desc: "Measures millisecond roundtrips, response status, headers, and formatted JSON bodies.",
            },
            {
              step: "05",
              title: "Document",
              desc: "Converts discovered endpoints into OpenAPI 3.0.3 specs exported to JSON or YAML.",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="p-5 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] hover:border-emerald-500/40 transition-colors space-y-3"
            >
              <div className="font-mono text-2xl font-bold text-emerald-400">{item.step}</div>
              <h3 className="font-semibold text-base text-[var(--foreground)]">{item.title}</h3>
              <p className="text-xs text-[var(--muted)] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. FEATURE HIGHLIGHTS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="text-xs font-semibold uppercase tracking-wider text-teal-400">
            Feature Matrix
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-[var(--foreground)]">
            Engineered for precision and productivity
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] space-y-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              ⚡
            </div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Route Intelligence</h3>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Tree view grouped by file, framework, or HTTP method. Fuzzy quick-pick search across paths, parameters, and handler names with 1-click source jumping.
            </p>
            <ul className="text-xs text-[var(--foreground)] space-y-1.5 pt-2 border-t border-[var(--surface-border)]">
              <li>• Offline static AST parsing</li>
              <li>• Multi-dimensional grouping</li>
              <li>• Conflict &amp; duplicate detection</li>
            </ul>
          </div>

          <div className="p-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] space-y-4">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              🔌
            </div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">Native HTTP Client</h3>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Test endpoints directly inside a secure Webview. Automatically interpolates dynamic path parameters (:id, [slug]), custom headers, and JSON bodies.
            </p>
            <ul className="text-xs text-[var(--foreground)] space-y-1.5 pt-2 border-t border-[var(--surface-border)]">
              <li>• Local-first request execution</li>
              <li>• In-flight abort cancellation</li>
              <li>• POSIX cURL export</li>
            </ul>
          </div>

          <div className="p-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] space-y-4">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              📄
            </div>
            <h3 className="text-lg font-semibold text-[var(--foreground)]">OpenAPI 3.0.3</h3>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Generate standards-compliant API documentation from discovered routes without running external Swagger servers or adding complex build plugins.
            </p>
            <ul className="text-xs text-[var(--foreground)] space-y-1.5 pt-2 border-t border-[var(--surface-border)]">
              <li>• Full workspace JSON &amp; YAML export</li>
              <li>• Route-level operation preview</li>
              <li>• Deterministic schema conversion</li>
            </ul>
          </div>
        </div>

        <div className="text-center pt-4">
          <Link href="/features" className="text-sm font-semibold text-emerald-400 hover:underline">
            Explore All Features &amp; Capabilities →
          </Link>
        </div>
      </section>

      {/* 5. BUILT FOR YOUR STACK */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
            Ecosystem
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-[var(--foreground)]">
            Built for modern backend frameworks
          </h2>
          <p className="text-sm text-[var(--muted)]">
            Analyzes your codebase with dedicated parsers tailored to each framework&apos;s routing semantics.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {siteConfig.frameworks.map((fw) => (
            <div
              key={fw.name}
              className="p-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-base text-[var(--foreground)]">{fw.name}</h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono">
                  Verified
                </span>
              </div>
              <p className="text-xs font-mono text-emerald-400/90">{fw.tagline}</p>
              <p className="text-xs text-[var(--muted)] leading-relaxed">{fw.desc}</p>
              <div className="p-3 rounded-lg bg-[var(--code-bg)] border border-[var(--surface-border)] text-[11px] font-mono text-[var(--muted)] overflow-x-auto whitespace-pre">
                <code>{fw.example}</code>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center pt-4">
          <Link href="/frameworks" className="text-sm font-semibold text-emerald-400 hover:underline">
            View Framework Routing Guide &amp; Detection Patterns →
          </Link>
        </div>
      </section>

      {/* 6. SECURITY & PRIVACY */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface)] p-8 sm:p-12 space-y-8">
          <div className="max-w-2xl space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Security &amp; Privacy
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)]">
              Your code stays on your machine.
            </h2>
            <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
              API Route Explorer operates exclusively within your local VS Code environment. We believe developer tools should respect your proprietary code and workspace confidentiality.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-3">
              <div className="font-semibold text-emerald-400 uppercase tracking-wider text-[11px]">
                What The Extension Does
              </div>
              <ul className="space-y-2 text-[var(--foreground)]">
                <li>• Scans routes locally using AST parsing</li>
                <li>• Executes requests directly on localhost / target URL</li>
                <li>• Generates OpenAPI specifications offline</li>
                <li>• Operates 100% without an account or cloud login</li>
              </ul>
            </div>

            <div className="p-5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] space-y-3">
              <div className="font-semibold text-[var(--muted)] uppercase tracking-wider text-[11px]">
                What It Does NOT Do
              </div>
              <ul className="space-y-2 text-[var(--muted)]">
                <li>• Never sends routes or source code to remote servers</li>
                <li>• Never collects usage telemetry or tracking metrics</li>
                <li>• Never scans or parses .env or credential secrets</li>
                <li>• Never stores or syncs credentials in cloud databases</li>
              </ul>
            </div>
          </div>

          <div className="pt-2">
            <Link href="/security" className="text-xs font-semibold text-emerald-400 hover:underline">
              Read Complete Privacy Architecture &amp; Security Model →
            </Link>
          </div>
        </div>
      </section>

      {/* 7. FINAL CTA */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-[var(--foreground)] tracking-tight">
          Ready to see every route in your codebase?
        </h2>
        <p className="text-sm sm:text-base text-[var(--muted)] max-w-xl mx-auto">
          Install the free, open-source VS Code extension and explore your backend routes in seconds.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Link
            href="/install"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-sm transition-all shadow-lg shadow-emerald-500/25"
          >
            Install for VS Code
          </Link>
          <a
            href={siteConfig.links.github}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--foreground)] font-semibold text-sm transition-colors"
          >
            Star on GitHub
          </a>
        </div>
      </section>
    </div>
  );
}
