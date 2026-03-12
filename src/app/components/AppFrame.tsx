"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUIMode } from "./UIModeProvider";

export default function AppFrame({
  nav,
  children,
}: {
  nav: React.ReactNode;
  children: React.ReactNode;
}) {
  const { mode, toggle } = useUIMode();
  const isDay = mode === "day";
  const pathname = usePathname();

  const isPokerPage = pathname === "/poker";

  const pageClass = isDay
    ? "min-h-screen bg-[#F4F0E6] text-slate-900"
    : "min-h-screen bg-zinc-950 text-zinc-100";

  const topBarClass = isPokerPage
    ? "sticky top-0 z-50 border-b border-red-950/30 bg-red-700"
    : "sticky top-0 z-50 border-b border-blue-950/30 bg-blue-800";

  const switchButtonClass = isPokerPage
    ? isDay
      ? "inline-flex items-center gap-2 rounded-xl border border-red-200/30 bg-red-950/20 px-3 py-2 text-xs font-semibold text-red-50 hover:bg-red-950/30"
      : "inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950/40 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-900"
    : isDay
      ? "inline-flex items-center gap-2 rounded-xl border border-blue-200/30 bg-blue-950/20 px-3 py-2 text-xs font-semibold text-blue-50 hover:bg-blue-950/30"
      : "inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950/40 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-900";

  const sectionButtonClass = isPokerPage
    ? isDay
      ? "inline-flex items-center rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
      : "inline-flex items-center rounded-xl border border-red-700 bg-red-950/30 px-3 py-2 text-xs font-semibold text-red-100 hover:bg-red-900/40"
    : isDay
      ? "inline-flex items-center rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50"
      : "inline-flex items-center rounded-xl border border-blue-700 bg-blue-950/30 px-3 py-2 text-xs font-semibold text-blue-100 hover:bg-blue-900/40";

  return (
    <div className={pageClass}>
      {/* TOP BAR */}
      <div className={topBarClass}>
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="text-white text-2xl font-semibold tracking-wide">
            {isPokerPage ? "SureBet Team Poker" : "SureBet Team"}
          </div>

          <div className="flex items-center gap-2">
            <Link href={isPokerPage ? "/" : "/poker"} className={sectionButtonClass}>
              {isPokerPage ? "Torna a Surebet" : "Poker"}
            </Link>

            <button
              type="button"
              onClick={toggle}
              className={switchButtonClass}
              title="Cambia modalità"
            >
              {mode === "day" ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M12 18a6 6 0 1 1 0-12 6 6 0 0 1 0 12Zm0-16h1v3h-1V2Zm0 17h1v3h-1v-3ZM2 11h3v1H2v-1Zm17 0h3v1h-3v-1ZM4.22 4.22l.7-.7 2.12 2.12-.7.7L4.22 4.22Zm12.96 12.96.7-.7 2.12 2.12-.7.7-2.12-2.12ZM19.78 4.22l.7.7-2.12 2.12-.7-.7 2.12-2.12ZM6.34 17.66l.7.7-2.12 2.12-.7-.7 2.12-2.12Z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M21 14.5A8.5 8.5 0 0 1 9.5 3a7 7 0 1 0 11.5 11.5Z" />
                </svg>
              )}
              <span>{mode === "day" ? "Day" : "Night"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* BODY */}
      {isPokerPage ? (
        <div>{children}</div>
      ) : isDay ? (
        <div className="flex">
          {nav}
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      ) : (
        <div>
          {nav}
          {children}
        </div>
      )}
    </div>
  );
}