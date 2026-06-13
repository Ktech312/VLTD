"use client";

import * as React from "react";
import { ThemeBoot } from "@/components/ThemeBoot";

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  // We do NOT use next-themes here because your app uses:
  // - `.dark` class
  // - `theme-mirror` / `theme-purple` classes
  // and next-themes was overriding them inconsistently.
  return (
    <>
      <ThemeBoot />
      {children}
    </>
  );
}