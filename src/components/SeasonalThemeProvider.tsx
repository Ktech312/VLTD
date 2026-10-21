"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { fetchActiveTheme, type SeasonalTheme } from "@/lib/seasonalTheme";
import { applyThemeVars, clearThemeVars, hasAcceptedTheme } from "@/lib/seasonalConsent";

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
      // Never before consent: the theme is applied only when the person already said Yes to it. Otherwise the app is left as it is.
      if (!t) clearThemeVars();
      else if (hasAcceptedTheme(t.slug)) applyThemeVars(t);
    });
  }, []);

  return (
    <Ctx.Provider value={{ theme, loading }}>
      {children}
    </Ctx.Provider>
  );
}
