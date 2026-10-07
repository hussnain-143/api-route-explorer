import Link from "next/link";
import { siteConfig } from "@/lib/site-config";

export function Footer() {
  return (
    <footer className="border-t border-[var(--surface-border)] bg-[var(--background)] py-12 md:py-16 text-sm text-[var(--muted)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12 mb-12">
          {/* Brand Col */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center p-1">
                <svg
                  className="w-full h-full text-emerald-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="4" />
                </svg>
              </div>
              <span className="font-semibold text-[var(--foreground)] tracking-tight">
                API Route <span className="text-emerald-400">Explorer</span>
              </span>
            </Link>
            <p className="text-xs text-[var(--muted)] leading-relaxed max-w-sm mb-4">
              Discover, analyze, test, and document backend API routes directly inside VS Code.
              Built for speed, privacy, and local developer flow.
            </p>
            <div className="text-xs text-[var(--muted)]">
              Version {siteConfig.version} • MIT License
            </div>
          </div>

          {/* Product Col */}
          <div>
            <h3 className="font-semibold text-[var(--foreground)] text-xs uppercase tracking-wider mb-3">
              Product
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/features" className="hover:text-[var(--foreground)] transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/frameworks" className="hover:text-[var(--foreground)] transition-colors">
                  Frameworks
                </Link>
              </li>
              <li>
                <Link href="/install" className="hover:text-[var(--foreground)] transition-colors">
                  Installation
                </Link>
              </li>
              <li>
                <Link href="/changelog" className="hover:text-[var(--foreground)] transition-colors">
                  Changelog
                </Link>
              </li>
            </ul>
          </div>

          {/* Docs Col */}
          <div>
            <h3 className="font-semibold text-[var(--foreground)] text-xs uppercase tracking-wider mb-3">
              Documentation
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/docs/getting-started" className="hover:text-[var(--foreground)] transition-colors">
                  Getting Started
                </Link>
              </li>
              <li>
                <Link href="/docs/route-discovery" className="hover:text-[var(--foreground)] transition-colors">
                  Route Discovery
                </Link>
              </li>
              <li>
                <Link href="/docs/http-client" className="hover:text-[var(--foreground)] transition-colors">
                  HTTP Client
                </Link>
              </li>
              <li>
                <Link href="/docs/openapi" className="hover:text-[var(--foreground)] transition-colors">
                  OpenAPI 3.0
                </Link>
              </li>
              <li>
                <Link href="/docs/troubleshooting" className="hover:text-[var(--foreground)] transition-colors">
                  Troubleshooting
                </Link>
              </li>
            </ul>
          </div>

          {/* Community & Legal Col */}
          <div>
            <h3 className="font-semibold text-[var(--foreground)] text-xs uppercase tracking-wider mb-3">
              Community & Legal
            </h3>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href={siteConfig.links.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[var(--foreground)] transition-colors"
                >
                  GitHub ↗
                </a>
              </li>
              <li>
                <a
                  href={siteConfig.links.marketplace}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[var(--foreground)] transition-colors"
                >
                  VS Code Marketplace ↗
                </a>
              </li>
              <li>
                <a
                  href={siteConfig.links.issues}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[var(--foreground)] transition-colors"
                >
                  Issue Tracker ↗
                </a>
              </li>
              <li>
                <Link href="/security" className="hover:text-[var(--foreground)] transition-colors">
                  Security & Privacy
                </Link>
              </li>
              <li>
                <a
                  href={siteConfig.links.license}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[var(--foreground)] transition-colors"
                >
                  MIT License ↗
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-[var(--surface-border)] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div>
            © 2026 {siteConfig.author.name} and API Route Explorer Contributors.
          </div>
          <div className="text-[var(--muted)]">
            Open-source developer tooling for Visual Studio Code.
          </div>
        </div>
      </div>
    </footer>
  );
}
