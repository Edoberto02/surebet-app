"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUIMode } from "./UIModeProvider";

const tabs = [
  { href: "/", label: "Saldi" },
  { href: "/scommesse", label: "Scommesse" },
  { href: "/riepilogo", label: "Riepilogo" },
];

export default function NavTabs() {
  const pathname = usePathname();
  const { mode, toggle } = useUIMode();

  return (
    <div className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-6 py-3">
        <div className="flex items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-2">
            {tabs.map((t) => {
              const active = pathname === t.href;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={[
                    "rounded-xl px-4 py-2 text-sm font-semibold transition",
                    active
                      ? "bg-zinc-800 text-zinc-100"
                      : "bg-zinc-900/40 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100",
                  ].join(" ")}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>

          {/* Toggle Day/Night */}
          <button
            type="button"
            onClick={toggle}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950/60 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-900"
            title={mode === "day" ? "Passa a Night" : "Passa a Day"}
          >
            {/* icona sole/luna (no emoji) */}
            {mode === "day" ? (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            )}
            <span>{mode === "day" ? "Night" : "Day"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
