"use client";

import * as React from "react";
import AppShellEffects from "@/components/AppShellEffects";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppShellEffects />
      {children}
    </>
  );
}