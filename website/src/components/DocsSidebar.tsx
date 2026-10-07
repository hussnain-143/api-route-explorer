"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { siteConfig } from "@/lib/site-config";

export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full lg:w-64 shrink-0 lg:sticky lg:top-20 lg:h-[calc(100vh-5rem)] overflow-y-auto pr-4 space-y-8 pb-8 text-sm">
      {siteConfig.docsNavigation.map((group) => (
        <div key={group.title} className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)] px-3">
            {group.title}
          </h4>
          <ul className="space-y-1">
            {group.items.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      isActive
                        ? "bg-emerald-500/10 text-emerald-400 font-medium"
                        : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]"
                    }`}
                  >
                    <span>{item.title}</span>
                    {item.badge && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </aside>
  );
}
