import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/site-config";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CodeBlock } from "@/components/CodeBlock";

export const metadata: Metadata = {
  title: "Route Analysis & Health — Collision & Shadowing Diagnostics",
  description:
    "Learn how API Route Explorer performs static route validation, finding duplicate endpoints and shadowing bugs in VS Code.",
  alternates: {
    canonical: `${siteConfig.url}/docs/route-analysis`,
  },
  openGraph: {
    title: "Route Analysis & Health — API Route Explorer Docs",
    description: "Detect duplicate endpoints, route shadowing, and missing handlers directly inside VS Code.",
    url: `${siteConfig.url}/docs/route-analysis`,
  },
};

export default function RouteAnalysisPage() {
  return (
    <div className="space-y-10">
      <Breadcrumbs
        items={[
          { name: "Docs", href: "/docs" },
          { name: "Route Analysis", href: "/docs/route-analysis" },
        ]}
      />

      <div className="space-y-4">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)]">
          Route Analysis &amp; Health
        </h1>
        <p className="text-base text-[var(--muted)] leading-relaxed">
          API Route Explorer performs static route validation, catching duplicates, shadowing conflicts, and mounting errors before runtime.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-[var(--foreground)]">Health Status Ratings</h2>
        <ul className="space-y-3 text-xs sm:text-sm text-[var(--foreground)]">
          <li className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
            <strong className="text-emerald-400">Healthy (Green):</strong> Route has a valid HTTP method, unique normalized path, and valid handler function reference.
          </li>
          <li className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
            <strong className="text-amber-400">Warning (Yellow):</strong> Route shares an ambiguous parameter pattern or may shadow an adjacent static route.
          </li>
          <li className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5">
            <strong className="text-rose-400">Error (Red):</strong> Duplicate method + normalized path collision across multiple files or missing controller handler reference.
          </li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-[var(--foreground)]">Conflict &amp; Shadowing Detection</h2>
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
          In Express and other frameworks, declaration order matters. If a dynamic parameterized route is mounted before a static route on the same hierarchy, the static route may never be reached:
        </p>
        <CodeBlock
          language="typescript"
          title="Problematic Route Declaration"
          badge="Shadowing Bug"
          code={`// 1. Parameterized route mounted first
router.get('/users/:id', getUserById);

// 2. Static route declared after — SHADOWED by /:id pattern!
router.get('/users/me', getCurrentUser);`}
        />
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
          API Route Explorer&apos;s conflict detector analyzes parameter tokens and warns you when a static endpoint is shadowed by an earlier parameterized declaration.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-[var(--foreground)]">Duplicate Collision Prevention</h2>
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
          In large teams and microservice codebases, multiple developers might declare the same route verb and path across different router files. The duplicate detector checks normalized path signatures and alerts you to collisions across source files.
        </p>
      </section>

      {/* Navigation Footer */}
      <div className="pt-6 border-t border-[var(--surface-border)] flex items-center justify-between text-xs">
        <Link href="/docs/route-discovery" className="text-[var(--muted)] hover:text-[var(--foreground)]">
          ← Route Discovery
        </Link>
        <Link href="/docs/http-client" className="text-emerald-400 font-semibold hover:underline">
          Native HTTP Client Guide →
        </Link>
      </div>
    </div>
  );
}
