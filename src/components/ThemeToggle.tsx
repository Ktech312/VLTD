"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

export default function ThemeToggle() {
  const { theme, setTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button
        className="h-10 w-10 rounded-full bg-[var(--pill)] ring-1 ring-[var(--pill-ring)] shadow-sm"
        aria-label="Theme"
      />
    );
  }

  const resolved = theme === "system" ? systemTheme : theme;
  const isDark = resolved === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={[
        "h-10 w-10 rounded-full grid place-items-center select-none",
        "bg-[var(--pill)] ring-1 ring-[var(--pill-ring)] shadow-sm",
        "hover:bg-[var(--pill-hover)] hover:ring-[var(--pill-ring-hover)] transition-all",
      ].join(" ")}
      aria-label="Toggle theme"
      title={isDark ? "Switch to Light" : "Switch to Dark"}
    >
      <span className="text-sm">{isDark ? "🌙" : "☀️"}</span>
    </button>
  );
}