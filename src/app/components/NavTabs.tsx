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

  const isDay = mode === "day";

  return (
    <div
      className={
        isDay
          ? "border-b border-blue-950/10 bg-[#F8F5EE]"
          : "sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur"
      }
    >
      <div className="mx-auto max-w-6xl px-6 py-3">
        <div className="flex items-center gap-2">
          {tabs.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={[
                  "rounded-xl px-4 py-2 text-sm font-semibold transition",
                  isDay
                    ? active
                      ? "bg-blue-900 text-blue-50"
                      : "bg-[#EFE8DA] text-slate-800 hover:bg-blue-900 hover:text-blue-50"
                    : active
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
  );
}
