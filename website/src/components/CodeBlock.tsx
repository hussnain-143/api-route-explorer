"use client";

import { useState } from "react";

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
  badge?: string;
}

export function CodeBlock({ code, language = "text", title, badge }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="relative rounded-xl border border-[var(--surface-border)] bg-[var(--code-bg)] overflow-hidden my-4 group">
      {(title || badge) && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--surface-border)] bg-[var(--surface)] text-xs text-[var(--muted)] font-mono">
          <span className="font-medium text-[var(--foreground)]">{title || language}</span>
          <div className="flex items-center gap-2">
            {badge && (
              <span className="px-2 py-0.5 rounded bg-[var(--surface-hover)] border border-[var(--surface-border)] text-[10px]">
                {badge}
              </span>
            )}
            <button
              type="button"
              onClick={handleCopy}
              className="px-2 py-1 rounded bg-[var(--surface-hover)] hover:bg-[var(--surface-border-strong)] transition-colors text-[11px] text-[var(--foreground)]"
              aria-label="Copy code to clipboard"
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
      {!title && !badge && (
        <button
          type="button"
          onClick={handleCopy}
          className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity px-2.5 py-1 rounded border border-[var(--surface-border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] text-xs text-[var(--foreground)]"
          aria-label="Copy code to clipboard"
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      )}
      <pre className="p-4 text-xs sm:text-sm overflow-x-auto text-[var(--foreground)] leading-relaxed font-mono">
        <code>{code}</code>
      </pre>
    </div>
  );
}
