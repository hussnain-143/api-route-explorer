import type { Metadata } from "next";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Security & Privacy — Local-First Architecture",
  description:
    "Learn about API Route Explorer's security model. Local AST analysis, zero cloud tracking, strict CSP Webviews, and no credential persistence.",
  alternates: {
    canonical: `${siteConfig.url}/security`,
  },
  openGraph: {
    title: "Security & Privacy Architecture — API Route Explorer",
    description:
      "Your code stays on your machine. Zero cloud telemetry, no credential scanning, and offline AST analysis.",
    url: `${siteConfig.url}/security`,
  },
};

export default function SecurityPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-20">
      {/* Header */}
      <div className="max-w-3xl space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-xs font-medium text-emerald-400 font-mono">
          Security &amp; Privacy Architecture
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[var(--foreground)]">
          Your code stays on your machine.
        </h1>
        <p className="text-base sm:text-lg text-[var(--muted)] leading-relaxed">
          API Route Explorer is built on a strict local-first philosophy. We do not operate remote servers, collect code telemetry, or persist your private API credentials.
        </p>
      </div>

      {/* Local Architecture Diagram */}
      <section className="p-8 sm:p-12 rounded-3xl border border-[var(--surface-border)] bg-[var(--surface)] space-y-6">
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--foreground)]">
          Local Isolation Model
        </h2>
        <div className="p-6 rounded-2xl bg-[#030508] border border-[var(--surface-border)] font-mono text-xs sm:text-sm text-emerald-400 leading-relaxed overflow-x-auto whitespace-pre">
{`YOUR WORKSPACE (VS Code)
       │
       ▼
API Route Explorer
       │
 ┌─────┼─────┐
 ▼     ▼     ▼
Scan  Test  OpenAPI
       │
       ▼
Localhost / Target Server

[ NO CLOUD SERVERS ]   [ NO USER ACCOUNTS ]   [ NO TELEMETRY ]`}
        </div>
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
          The extension runs directly inside your local VS Code process. It parses code files on your filesystem, computes route hierarchies in memory, and triggers requests using Node&apos;s loopback socket.
        </p>
      </section>

      {/* Side-by-Side: What it does vs What it does not do */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-8 rounded-3xl border border-emerald-500/30 bg-emerald-500/5 space-y-4">
          <h3 className="text-lg font-bold text-emerald-400">What The Extension Does</h3>
          <ul className="space-y-3 text-xs sm:text-sm text-[var(--foreground)] leading-relaxed">
            <li className="flex items-start gap-2.5">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Static AST Parsing:</strong> Inspects syntax trees on local disk without booting server processes or requiring external APIs.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Direct HTTP Requests:</strong> Sends calls directly to the URL you configure (typically <code>localhost</code> or your staging server).</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Local OpenAPI Generation:</strong> Produces JSON/YAML documentation in memory and writes directly to your chosen workspace file.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Open Source Transparency:</strong> Every line of code is published under the MIT license on GitHub.</span>
            </li>
          </ul>
        </div>

        <div className="p-8 rounded-3xl border border-[var(--surface-border)] bg-[var(--surface)] space-y-4">
          <h3 className="text-lg font-bold text-[var(--muted)]">What The Extension Does NOT Do</h3>
          <ul className="space-y-3 text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
            <li className="flex items-start gap-2.5">
              <span className="text-rose-400 font-bold">✕</span>
              <span><strong>No Cloud Transmission:</strong> We never upload source code, endpoint URLs, or payload data to any remote cloud.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-rose-400 font-bold">✕</span>
              <span><strong>No Telemetry or Tracking:</strong> There are zero analytics libraries, pixels, or telemetry beacons included in the extension.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-rose-400 font-bold">✕</span>
              <span><strong>No Secret Harvesting:</strong> The scanner actively ignores <code>.env</code> files, API keys, credentials, and configuration secrets.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-rose-400 font-bold">✕</span>
              <span><strong>No Cloud Accounts:</strong> You never need to sign up, log in, or provide an email to use the extension.</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Webview Security & CSP */}
      <section className="p-8 sm:p-12 rounded-3xl border border-[var(--surface-border)] bg-[var(--surface)] space-y-6">
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--foreground)]">
          Webview Security &amp; Content Security Policy
        </h2>
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed max-w-3xl">
          The HTTP Client interface runs in an isolated VS Code Webview with a hardened Content Security Policy (CSP):
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
          <div className="p-5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] space-y-2">
            <h3 className="font-semibold text-sm text-[var(--foreground)]">Cryptographic Nonces</h3>
            <p className="text-[var(--muted)]">
              All scripts executed in the Webview must match a random per-session cryptographic nonce to prevent script injection.
            </p>
          </div>
          <div className="p-5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] space-y-2">
            <h3 className="font-semibold text-sm text-[var(--foreground)]">No Remote Scripts</h3>
            <p className="text-[var(--muted)]">
              CSP rules block external script origins (<code>script-src &apos;nonce-...&apos;</code>), guaranteeing no untrusted code execution.
            </p>
          </div>
          <div className="p-5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] space-y-2">
            <h3 className="font-semibold text-sm text-[var(--foreground)]">Strict Message Validation</h3>
            <p className="text-[var(--muted)]">
              Bidirectional communication between the Webview and the extension host is strictly type-checked and sanitized.
            </p>
          </div>
        </div>
      </section>

      {/* Contact and Reporting */}
      <div className="p-8 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-sm text-[var(--foreground)]">Responsible Disclosure</h3>
          <p className="text-xs text-[var(--muted)]">
            If you discover a security vulnerability in API Route Explorer, please report it via GitHub Security Advisories.
          </p>
        </div>
        <a
          href={siteConfig.links.issues}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 px-4 py-2 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-xs font-semibold text-[var(--foreground)] transition-colors"
        >
          Security Advisories ↗
        </a>
      </div>
    </div>
  );
}
