"use client";

import * as React from "react";
import AppShellEffects from "@/components/AppShellEffects";
import MfaChallengeGate from "@/components/MfaChallengeGate";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppShellEffects />
      <MfaChallengeGate />
      {children}
    </>
  );
}