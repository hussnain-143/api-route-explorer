import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/site-config";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CodeBlock } from "@/components/CodeBlock";

export const metadata: Metadata = {
  title: "Troubleshooting — Common Diagnostics & Solutions",
  description:
    "Solve common issues in API Routes Explorer: ECONNREFUSED, 404 errors, route discovery issues, and authentication headers.",
  alternates: {
    canonical: `${siteConfig.url}/docs/troubleshooting`,
  },
  openGraph: {
    title: "Troubleshooting Guide — API Routes Explorer Docs",
    description: "Diagnose and resolve connection, discovery, and HTTP testing issues.",
    url: `${siteConfig.url}/docs/troubleshooting`,
  },
};

export default function TroubleshootingDocsPage() {
  return (
    <div className="space-y-10">
      <Breadcrumbs
        items={[
          { name: "Docs", href: "/docs" },
          { name: "Troubleshooting", href: "/docs/troubleshooting" },
        ]}
      />

      <div className="space-y-4">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)]">
          Troubleshooting Guide
        </h1>
        <p className="text-base text-[var(--muted)] leading-relaxed">
          Diagnostic steps and solutions for common questions regarding route discovery, HTTP network errors, and authentication.
        </p>
      </div>

      {/* 1. No routes found */}
      <section className="space-y-3 p-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)]">
        <h2 className="text-lg font-bold text-[var(--foreground)]">1. &quot;No routes found in workspace&quot;</h2>
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
          If scanning results in an empty tree view:
        </p>
        <ul className="space-y-2 text-xs sm:text-sm text-[var(--foreground)]">
          <li>
            • <strong>Check Workspace Root:</strong> Ensure you opened the directory containing your backend code (or <code>package.json</code>) directly in VS Code. If your backend is in a subfolder (e.g. <code>server/</code> in a monorepo), open that folder directly or add it as a multi-root workspace folder.
          </li>
          <li>
            • <strong>Verify Framework Syntax:</strong> Ensure your code declares routes using standard supported syntax (Express <code>router.get</code>, Next.js <code>export async function GET</code>, Fastify <code>fastify.get</code>, or NestJS <code>@Get()</code>).
          </li>
          <li>
            • <strong>Manual Re-scan:</strong> Press <kbd className="px-1.5 py-0.5 rounded bg-[var(--surface-elevated)] border border-[var(--surface-border)] text-xs">Cmd+Shift+P</kbd> and run <code>API Routes Explorer: Discover Routes</code>.
          </li>
        </ul>
      </section>

      {/* 2. ECONNREFUSED */}
      <section className="space-y-3 p-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)]">
        <h2 className="text-lg font-bold text-[var(--foreground)]">2. Connection Error: ECONNREFUSED</h2>
        <CodeBlock code="Error: connect ECONNREFUSED 127.0.0.1:5000" language="text" />
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
          <strong>Cause:</strong> The extension sent an HTTP request to the designated address, but no operating system process is listening on that port.
        </p>
        <p className="text-xs sm:text-sm text-[var(--foreground)] leading-relaxed">
          <strong>Solution:</strong> Start your local development server (e.g. <code>npm run dev</code>) and ensure the port configured in the HTTP Client matches the active server port.
        </p>
      </section>

      {/* 3. 404 Not Found */}
      <section className="space-y-3 p-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)]">
        <h2 className="text-lg font-bold text-[var(--foreground)]">3. 404 Not Found from Server</h2>
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
          <strong>Cause:</strong> Discovered routes reflect declarations in individual files. At runtime, your server may mount sub-routers under a global prefix (e.g. <code>app.use(&apos;/api/v1&apos;, router)</code> or NestJS <code>app.setGlobalPrefix(&apos;api&apos;)</code>).
        </p>
        <p className="text-xs sm:text-sm text-[var(--foreground)] leading-relaxed">
          <strong>Solution:</strong> Verify that the resolved URL in the HTTP Client address bar includes the required prefix before clicking <strong>Send</strong>.
        </p>
      </section>

      {/* 4. 401 Unauthorized */}
      <section className="space-y-3 p-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)]">
        <h2 className="text-lg font-bold text-[var(--foreground)]">4. 401 Unauthorized / 403 Forbidden</h2>
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
          <strong>Cause:</strong> API Routes Explorer does not bypass authentication middleware or fabricate credentials.
        </p>
        <p className="text-xs sm:text-sm text-[var(--foreground)] leading-relaxed">
          <strong>Solution:</strong> In the HTTP Client, switch to the <strong>Headers</strong> tab and add your required token:
        </p>
        <CodeBlock code="Authorization: Bearer YOUR_DEV_TOKEN" language="text" />
      </section>

      {/* Navigation Footer */}
      <div className="pt-6 border-t border-[var(--surface-border)] flex items-center justify-between text-xs">
        <Link href="/docs/openapi" className="text-[var(--muted)] hover:text-[var(--foreground)]">
          ← OpenAPI Generation
        </Link>
        <Link href="/install" className="text-emerald-400 font-semibold hover:underline">
          Installation Guide →
        </Link>
      </div>
    </div>
  );
}
