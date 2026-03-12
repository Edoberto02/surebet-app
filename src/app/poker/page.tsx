"use client";

import { useUIMode } from "../components/UIModeProvider";

export default function PokerPage() {
  const { mode } = useUIMode();
  const isDay = mode === "day";

  return (
    <main className={isDay ? "min-h-[calc(100vh-64px)] bg-white" : "min-h-[calc(100vh-64px)] bg-zinc-950"}>
      {/* Pagina volutamente vuota per ora */}
    </main>
  );
}