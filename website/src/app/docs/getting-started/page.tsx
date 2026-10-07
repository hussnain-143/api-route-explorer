import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/site-config";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CodeBlock } from "@/components/CodeBlock";

export const metadata: Metadata = {
  title: "Getting Started — Quick Start Guide",
  description:
    "Get started with API Route Explorer in under two minutes. Step-by-step instructions for installation, scanning, testing, and OpenAPI generation.",
  alternates: {
    canonical: `${siteConfig.url}/docs/getting-started`,
  },
  openGraph: {
    title: "Getting Started — API Route Explorer",
    description: "Learn how to install and scan your first backend project in VS Code.",
    url: `${siteConfig.url}/docs/getting-started`,
  },
};

export default function GettingStartedPage() {
  return (
    <div className="space-y-10">
      <Breadcrumbs
        items={[
          { name: "Docs", href: "/docs" },
          { name: "Getting Started", href: "/docs/getting-started" },
        ]}
      />

      <div className="space-y-4">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)]">
          Getting Started with API Route Explorer
        </h1>
        <p className="text-base text-[var(--muted)] leading-relaxed">
          Learn how to install API Route Explorer, scan your backend routes, and start testing in under two minutes.
        </p>
      </div>

      {/* Step 1 */}
      <section className="space-y-3 p-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)]">
        <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-semibold">
          <span>STEP 01</span>
        </div>
        <h2 className="text-lg font-bold text-[var(--foreground)]">Install the Extension</h2>
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
          Open the VS Code Extension view (<kbd className="px-1.5 py-0.5 rounded bg-[var(--surface-elevated)] border border-[var(--surface-border)] text-xs">Cmd+Shift+X</kbd>), search for <strong>API Route Explorer</strong>, and click <strong>Install</strong>. Alternatively, install via terminal:
        </p>
        <CodeBlock code={siteConfig.install.cli} language="bash" />
      </section>

      {/* Step 2 */}
      <section className="space-y-3 p-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)]">
        <div className="flex items-center gap-2 text-teal-400 font-mono text-xs font-semibold">
          <span>STEP 02</span>
        </div>
        <h2 className="text-lg font-bold text-[var(--foreground)]">Open Your Backend Project</h2>
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
          Open any Node.js or TypeScript workspace utilizing <strong>Express</strong>, <strong>Next.js</strong>, <strong>Fastify</strong>, or <strong>NestJS</strong>. API Route Explorer activates automatically when it detects backend route declarations.
        </p>
      </section>

      {/* Step 3 */}
      <section className="space-y-3 p-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)]">
        <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs font-semibold">
          <span>STEP 03</span>
        </div>
        <h2 className="text-lg font-bold text-[var(--foreground)]">Discover Routes</h2>
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
          Click the <strong>API Route Explorer</strong> icon in the Activity Bar. If this is your first time opening the project, click <strong>Discover Routes</strong>. The offline AST engine will parse your project files and display every discovered route in a tree.
        </p>
      </section>

      {/* Step 4 */}
      <section className="space-y-3 p-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)]">
        <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-semibold">
          <span>STEP 04</span>
        </div>
        <h2 className="text-lg font-bold text-[var(--foreground)]">Inspect &amp; Jump to Code</h2>
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
          Click any endpoint in the tree to navigate straight to the controller file, cursor focused directly on the handler function definition.
        </p>
      </section>

      {/* Step 5 */}
      <section className="space-y-3 p-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)]">
        <div className="flex items-center gap-2 text-teal-400 font-mono text-xs font-semibold">
          <span>STEP 05</span>
        </div>
        <h2 className="text-lg font-bold text-[var(--foreground)]">Test in the Native HTTP Client</h2>
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
          Click the <strong>Test</strong> (⚡) icon on any route item to launch the embedded HTTP Client. Populate path parameters and request headers, then click <strong>Send</strong>.
        </p>
      </section>

      {/* Navigation Footer */}
      <div className="pt-6 border-t border-[var(--surface-border)] flex items-center justify-between text-xs">
        <Link href="/docs" className="text-[var(--muted)] hover:text-[var(--foreground)]">
          ← Introduction
        </Link>
        <Link href="/docs/route-discovery" className="text-emerald-400 font-semibold hover:underline">
          Route Discovery Guide →
        </Link>
      </div>
    </div>
  );
}
