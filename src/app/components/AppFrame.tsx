"use client";

import React from "react";
import { useUIMode } from "./UIModeProvider";

export default function AppFrame({ children }: { children: React.ReactNode }) {
  const { mode, toggle } = useUIMode();
  const isDay = mode === "day";

  // background pagina
  const pageClass = isDay
    ? "min-h-screen bg-[#F4F0E6] text-slate-900"
    : "min-h-screen bg-zinc-950 text-zinc-100";

  // topbar IDENTICA in entrambe le mode (cambiano solo i colori)
  const topBarClass = isDay
    ? "sticky top-0 z-50 border-b border-blue-950/25 bg-blue-700"
    : "sticky top-0 z-50 border-b border-blue-950/25 bg-blue-700";

  const toggleBtnClass = isDay
    ? "inline-flex items-center gap-2 rounded-xl border border-blue-200/30 bg-blue-950/20 px-3 py-2 text-xs font-semibold text-blue-50 hover:bg-blue-950/30"
    : "inline-flex items-center gap-2 rounded-xl border border-blue-200/30 bg-blue-950/20 px-3 py-2 text-xs font-semibold text-blue-50 hover:bg-blue-950/30";

  return (
    <div className={pageClass}>
      {/* TOP BAR (sempre) */}
      <div className={topBarClass}>
        <div className="px-6 py-3 flex items-center justify-between">
          <div
            className="
              text-blue-50
              text-2xl
              font-semibold
              tracking-wide
              normal-case
            "
            style={{ fontStretch: "expanded" as any }}
          >
            SureBet Team
          </div>

          <button type="button" onClick={toggle} className={toggleBtnClass} title="Cambia modalità">
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

      {children}
    </div>
  );
}
