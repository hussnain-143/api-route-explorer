import Link from "next/link";

export default function NotFound() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-24 sm:py-32 text-center space-y-6">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-rose-500/30 bg-rose-500/10 text-xs text-rose-400 font-mono">
        404 Not Found
      </div>
      <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--foreground)]">
        Route Not Found
      </h1>
      <p className="text-base text-[var(--muted)] leading-relaxed">
        The page you are looking for does not exist in our route table. It may have been moved or the path was typed incorrectly.
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
        <Link
          href="/"
          className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs transition-all shadow-md shadow-emerald-500/20"
        >
          Return to Home
        </Link>
        <Link
          href="/docs"
          className="px-6 py-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-[var(--foreground)] font-semibold text-xs transition-colors"
        >
          Browse Documentation
        </Link>
      </div>
    </div>
  );
}
