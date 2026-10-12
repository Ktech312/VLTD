"use client";

// Museum Alpha is owner-only (owner decision, 2026-10-11). Same check and MFA step-up as
// MuseumBuilderOwnerGate, for any other Museum Alpha page that needs it.
import { useEffect, useState, type ReactNode } from "react";

import { getMyAdminAccessStatus } from "@/lib/adminAuth";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import MfaStepUp from "@/components/account/MfaStepUp";

type AccessState = "checking" | "pending-mfa" | "authorized" | "denied";

export default function MuseumOwnerGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccessState>("checking");

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const { role, mfaOk } = await getMyAdminAccessStatus();
      if (cancelled) return;
      if (role !== "owner") {
        setState("denied");
        return;
      }
      setState(mfaOk ? "authorized" : "pending-mfa");
    }
    void check();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return () => { cancelled = true; };
    const { data: sub } = supabase.auth.onAuthStateChange(() => void check());
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (state === "checking") {
    return <div className="p-8 text-sm text-[color:var(--muted)]">Checking access…</div>;
  }
  if (state === "pending-mfa") {
    return <MfaStepUp onVerified={() => setState("authorized")} />;
  }
  if (state === "denied") {
    return <div className="p-8 text-sm text-red-400">Not authorized. Owner access required.</div>;
  }
  return <>{children}</>;
}
