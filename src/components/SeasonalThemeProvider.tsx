"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { fetchActiveTheme, type SeasonalTheme } from "@/lib/seasonalTheme";

interface SeasonalThemeCtx {
  theme: SeasonalTheme | null;
  loading: boolean;
}

const Ctx = createContext<SeasonalThemeCtx>({ theme: null, loading: true });

export function useSeasonalTheme() {
  return useContext(Ctx);
}

export default function SeasonalThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<SeasonalTheme | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveTheme().then((t) => {
      setTheme(t);
      setLoading(false);
      applyThemeVars(t);
    });
  }, []);

  return (
    <Ctx.Provider value={{ theme, loading }}>
      {children}
    </Ctx.Provider>
  );
}

function applyThemeVars(theme: SeasonalTheme | null) {
  const root = document.documentElement;
  if (!theme) {
    root.style.removeProperty("--seasonal-accent");
    root.style.removeProperty("--seasonal-accent-secondary");
    root.style.removeProperty("--seasonal-bg-tint");
    root.removeAttribute("data-seasonal");
    return;
  }
  if (theme.accent_color)     root.style.setProperty("--seasonal-accent", theme.accent_color);
  if (theme.accent_secondary) root.style.setProperty("--seasonal-accent-secondary", theme.accent_secondary);
  if (theme.bg_tint)          root.style.setProperty("--seasonal-bg-tint", theme.bg_tint);
  root.setAttribute("data-seasonal", theme.slug);
}
