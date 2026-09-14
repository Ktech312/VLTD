"use client";

// Museum Builder pass (2026-09-12): EK's explicit instruction — "This museum
// page should only be on my Personal account, no other user should have
// access to it or be able to see it." Patterned directly after
// VltdMuseumAdminGate.tsx (the same small client-wrapper gate the shared
// VLTD Museum route itself already uses) but STRICTER: that gate accepts
// `role !== null` (owner OR any granted admin); this one only ever accepts
// `role === "owner"` — getMyAdminRole() (src/lib/adminAuth.ts) already
// distinguishes the one owner account (matched against
// NEXT_PUBLIC_OWNER_EMAIL) from the general admin role stored in
// user_roles, so a granted admin who is not the owner is refused here even
// though they'd pass the Map's own gate. Same "Not authorized" plain state
// as VltdMuseumAdminGate.tsx for anyone else — no different error, redirect
// message, or hint that this route exists.
import { useEffect, useState } from "react";

import { getMyAdminAccessStatus } from "@/lib/adminAuth";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import MuseumBuilder from "./MuseumBuilder";

type AccessState = "checking" | "pending-mfa" | "authorized" | "denied";

// 2026-09-14: same fix as VltdMuseumAdminGate.tsx, same reported
// regression — see that file's comment for the full root cause. This gate
// is stricter (role === "owner" only) but had the identical bug: a
// one-shot getMyAdminRole() call that couldn't tell "not the owner" apart
// from "the owner, but this session hasn't completed 2FA yet," and never
// re-checked after the global MfaChallengeGate modal resolved.
export default function MuseumBuilderOwnerGate() {
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
    if (!supabase) return;
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
    return (
      <div className="p-8 text-sm text-[color:var(--muted)]">
        Finishing 2FA verification… If nothing happens, complete it at{" "}
        <a href="/account/security" className="underline">
          Account → Security
        </a>
        .
      </div>
    );
  }

  if (state === "denied") {
    return <div className="p-8 text-sm text-red-400">Not authorized. Owner access required.</div>;
  }

  return <MuseumBuilder />;
}
