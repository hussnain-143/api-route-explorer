import type { Metadata } from "next";
import { siteConfig } from "@/lib/site-config";
import { CodeBlock } from "@/components/CodeBlock";

export const metadata: Metadata = {
  title: "Install API Routes Explorer — VS Code Marketplace & CLI",
  description:
    "Install API Routes Explorer for Visual Studio Code via Marketplace, CLI command, or offline VSIX package.",
  alternates: {
    canonical: `${siteConfig.url}/install`,
  },
  openGraph: {
    title: "Install API Routes Explorer for VS Code",
    description: "One-click install from the VS Code Marketplace or install using the VS Code CLI.",
    url: `${siteConfig.url}/install`,
  },
};

export default function InstallPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
      {/* Header */}
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-xs font-medium text-emerald-400 font-mono">
          Installation Guide
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[var(--foreground)]">
          Install API Routes Explorer
        </h1>
        <p className="text-base sm:text-lg text-[var(--muted)] leading-relaxed">
          Get up and running in under 60 seconds. Free, open source, and available across all VS Code compatible editors.
        </p>
      </div>

      {/* Primary Install Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Option 1: Marketplace UI */}
        <div className="p-8 rounded-3xl border border-emerald-500/30 bg-emerald-500/5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 font-mono">
              Recommended
            </span>
            <h2 className="text-xl font-bold text-[var(--foreground)]">VS Code Marketplace</h2>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Install directly from the official Microsoft Visual Studio Code Extension Marketplace with automatic background updates.
            </p>
          </div>
          <a
            href={siteConfig.links.marketplace}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs text-center transition-all shadow-md shadow-emerald-500/20"
          >
            Install from VS Code Marketplace ↗
          </a>
        </div>

        {/* Option 2: Quick Open in VS Code */}
        <div className="p-8 rounded-3xl border border-[var(--surface-border)] bg-[var(--surface)] space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] font-mono">
              Inside Editor
            </span>
            <h2 className="text-xl font-bold text-[var(--foreground)]">VS Code Quick Open</h2>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Press <kbd className="px-1.5 py-0.5 rounded bg-[var(--surface-elevated)] border border-[var(--surface-border)] text-[11px]">Cmd+P</kbd> (macOS) or <kbd className="px-1.5 py-0.5 rounded bg-[var(--surface-elevated)] border border-[var(--surface-border)] text-[11px]">Ctrl+P</kbd> (Windows/Linux) and paste:
            </p>
            <CodeBlock code={siteConfig.install.ext} language="text" />
          </div>
        </div>
      </div>

      {/* CLI Installation */}
      <section className="p-8 rounded-3xl border border-[var(--surface-border)] bg-[var(--surface)] space-y-4">
        <h2 className="text-xl font-bold text-[var(--foreground)]">Command Line Installation</h2>
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
          If you have the <code>code</code> executable configured in your shell path, run:
        </p>
        <CodeBlock code={siteConfig.install.cli} language="bash" title="Terminal Command" />
      </section>

      {/* Offline VSIX */}
      <section className="p-8 rounded-3xl border border-[var(--surface-border)] bg-[var(--surface)] space-y-4">
        <h2 className="text-xl font-bold text-[var(--foreground)]">Offline / Air-Gapped VSIX Installation</h2>
        <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
          For restricted corporate or air-gapped environments without internet access, download the pre-compiled <code>.vsix</code> binary from GitHub Releases:
        </p>
        <CodeBlock
          code={`code --install-extension api-routes-explorer-${siteConfig.version}.vsix --force`}
          language="bash"
          title="Install from local VSIX"
        />
        <div className="pt-2">
          <a
            href={siteConfig.links.releases}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-emerald-400 hover:underline"
          >
            Download latest .vsix from GitHub Releases ↗
          </a>
        </div>
      </section>

      {/* System Requirements */}
      <section className="p-8 rounded-3xl border border-[var(--surface-border)] bg-[var(--surface)] space-y-4">
        <h2 className="text-xl font-bold text-[var(--foreground)]">System Requirements</h2>
        <ul className="space-y-2 text-xs sm:text-sm text-[var(--muted)]">
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 font-bold">•</span>
            <span><strong>Visual Studio Code:</strong> Version ^1.90.0 or later (also compatible with Cursor, VSCodium, and Windsurf).</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 font-bold">•</span>
            <span><strong>Operating System:</strong> macOS (Apple Silicon &amp; Intel), Windows 10/11, or Linux (x64/arm64).</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-emerald-400 font-bold">•</span>
            <span><strong>Project Type:</strong> Any project using Express, Next.js, Fastify, or NestJS.</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
