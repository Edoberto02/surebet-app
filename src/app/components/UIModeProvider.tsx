"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type UIMode = "night" | "day";

type Ctx = {
  mode: UIMode;
  setMode: (m: UIMode) => void;
  toggle: () => void;
};

const UIModeContext = createContext<Ctx | null>(null);

function applyDomMode(mode: UIMode) {
  // mettiamo una classe su <html> così possiamo targettare "day" ovunque
  const root = document.documentElement;
  root.classList.remove("ui-day", "ui-night");
  root.classList.add(mode === "day" ? "ui-day" : "ui-night");
}

export function UIModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<UIMode>("night");

  useEffect(() => {
    const saved = (localStorage.getItem("uiMode") as UIMode | null) ?? null;
    const m: UIMode = saved === "day" || saved === "night" ? saved : "night";
    setModeState(m);
    applyDomMode(m);
  }, []);

  const setMode = (m: UIMode) => {
    setModeState(m);
    localStorage.setItem("uiMode", m);
    applyDomMode(m);
  };

  const toggle = () => setMode(mode === "day" ? "night" : "day");

  const value = useMemo(() => ({ mode, setMode, toggle }), [mode]);

  return <UIModeContext.Provider value={value}>{children}</UIModeContext.Provider>;
}

export function useUIMode() {
  const ctx = useContext(UIModeContext);
  if (!ctx) throw new Error("useUIMode must be used within UIModeProvider");
  return ctx;
}
