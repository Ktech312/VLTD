"use client";

// 3D Gallery is invite-only (owner decision, 2026-10-11): only profiles the owner has approved
// (museum_beta_enabled, which only an admin can set) and the owner account itself can open the
// builder. The "request access" button on Exhibitions only records a request; it never grants access.
// This gate protects the direct /museum/virtual-room URL, not just the button.
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { getMyAdminRole } from "@/lib/adminAuth";
import { getMuseumBetaStatus } from "@/lib/museumBeta";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type AccessState = "checking" | "allowed" | "denied";

export default function VirtualRoomApprovalGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccessState>("checking");

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const beta = await getMuseumBetaStatus();
      if (cancelled) return;
      if (beta.enabled) {
        setState("allowed");
        return;
      }
      const role = await getMyAdminRole();
      if (cancelled) return;
      setState(role === "owner" ? "allowed" : "denied");
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

  if (state === "denied") {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <div className="text-lg font-semibold">3D Gallery is invite-only</div>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Your account has not been approved for the 3D Gallery yet. You can ask for access from Exhibitions.
        </p>
        <Link
          href="/museum"
          className="mt-4 inline-flex h-9 items-center rounded-[8px] px-4 text-[13px] font-medium ring-1 ring-[color:var(--border)]"
        >
          Back to Exhibitions
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
