"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { siteConfig } from "@/lib/site-config";
import { ThemeToggle } from "./ThemeToggle";

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--surface-border)] bg-[var(--background)]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <Image
            src="/icon.png"
            alt="API Route Explorer"
            width={34}
            height={34}
            className="w-8.5 h-8.5 rounded-lg object-contain shadow-sm transition-transform group-hover:scale-105"
            priority
          />
          <div className="flex flex-col leading-tight">
            <span className="font-semibold text-base sm:text-lg tracking-tight text-[var(--foreground)]">
              API Route <span className="text-emerald-400">Explorer</span>
            </span>
            <span className="text-[10px] text-[var(--muted)] font-mono tracking-tight">
              by Hussnain Ahmed
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[var(--muted)]">
          {siteConfig.navItems.map((item) => {
            const isActive =
              item.href === "/docs"
                ? pathname.startsWith("/docs")
                : pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`transition-colors hover:text-[var(--foreground)] ${
                  isActive
                    ? "text-emerald-400 font-semibold"
                    : "text-[var(--muted)]"
                }`}
              >
                {item.title}
              </Link>
            );
          })}
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          <a
            href={siteConfig.links.github}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--foreground)] transition-colors"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            GitHub
          </a>

          <Link
            href="/install"
            className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black font-semibold transition-all shadow-sm shadow-emerald-500/20"
          >
            Install
          </Link>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden w-9 h-9 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] flex items-center justify-center text-[var(--foreground)]"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[var(--surface-border)] bg-[var(--background)] px-4 py-4 space-y-3">
          {siteConfig.navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                pathname === item.href
                  ? "bg-emerald-500/10 text-emerald-400 font-semibold"
                  : "text-[var(--foreground)] hover:bg-[var(--surface)]"
              }`}
            >
              {item.title}
            </Link>
          ))}
          <div className="pt-2 border-t border-[var(--surface-border)] flex flex-col gap-2">
            <a
              href={siteConfig.links.github}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] flex items-center gap-2"
            >
              GitHub Repository ↗
            </a>
            <a
              href={siteConfig.links.marketplace}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] flex items-center gap-2"
            >
              VS Code Marketplace ↗
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
