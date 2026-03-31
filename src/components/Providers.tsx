"use client";

import * as React from "react";
import AppShellEffects from "@/components/AppShellEffects";
import RouteTransition from "@/components/RouteTransition";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppShellEffects />
      <RouteTransition>{children}</RouteTransition>
    </>
  );
}