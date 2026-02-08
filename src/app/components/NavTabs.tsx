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
  const { mode } = useUIMode();


  // DAY: sidebar
  if (mode === "day") {
    return (
      <aside className="sticky top-0 h-screen w-56 shrink-0 border-r border-blue-900/20 bg-[#f5f1e8] text-zinc-900">
        <div className="p-4">
          <div className="text-xs font-semibold text-zinc-500 mb-3">Menu</div>

          <div className="flex flex-col gap-2">
            {tabs.map((t) => {
              const active = pathname === t.href;
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={[
                    "rounded-xl px-4 py-3 text-sm font-semibold transition",
                    active
                      ? "bg-blue-700 text-white"
                      : "bg-white/60 text-zinc-800 hover:bg-white",
                  ].join(" ")}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>

          {/* ✅ Niente toggle qui: in Day lo switch sta nella barra blu */}
        </div>
      </aside>
    );
  }

  // NIGHT: barra sopra + toggle
  return (
    <div className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-6 py-3">
        <div className="flex items-center justify-between gap-3">
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


        </div>
      </div>
    </div>
  );
}
