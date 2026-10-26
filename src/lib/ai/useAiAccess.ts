"use client";

import { useEffect, useState } from "react";

import { getCurrentUser, onAuthStateChange } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/ownerAccess";

// Whether THIS signed-in account has AI access, for the screens only: they show an AI button or an AI allowance only when it does. The server decides for real
// (lib/server/scanGuard.ts refuses every other account before any paid call), so this is a convenience that keeps people from being offered something that will be refused.
// It uses the same rule as the server: the owner's confirmed address. Until the answer is known it is "no", so an unknown account is never offered AI.

let known: boolean | null = null;

export function aiAccessFor(user: { email?: string | null; email_confirmed_at?: string | null; confirmed_at?: string | null } | null | undefined): boolean {
  return Boolean(user && (user.email_confirmed_at || user.confirmed_at) && isOwnerEmail(user.email));
}

export function useAiAccess(): boolean {
  const [access, setAccess] = useState<boolean>(known === true);
  useEffect(() => {
    let active = true;
    const apply = (user: Parameters<typeof aiAccessFor>[0]) => {
      known = aiAccessFor(user);
      if (active) setAccess(known);
    };
    void getCurrentUser().then((r) => apply(r.data.user)).catch(() => apply(null));
    const sub = onAuthStateChange((_event: string, session: { user?: Parameters<typeof aiAccessFor>[0] } | null) => apply(session?.user ?? null));
    const subscription = sub?.data?.subscription;
    return () => {
      active = false;
      subscription?.unsubscribe?.();
    };
  }, []);
  return access;
}
