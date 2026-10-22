"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { fetchActiveThemes, type SeasonalTheme } from "@/lib/seasonalTheme";
import { applyAcceptedTheme } from "@/lib/seasonalConsent";

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
    fetchActiveThemes().then((themes) => {
      // The latest-starting active theme, as before.
      setTheme(themes.length ? themes[themes.length - 1] : null);
      setLoading(false);
      // Never before consent: a theme is applied only when the person already said Yes to it. With none active (or none accepted) the app is left as it
      // is, and anything seasonal that was left on is taken off.
      applyAcceptedTheme(themes);
    });
  }, []);

  return (
    <Ctx.Provider value={{ theme, loading }}>
      {children}
    </Ctx.Provider>
  );
}
