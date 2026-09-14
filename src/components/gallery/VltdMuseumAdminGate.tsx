"use client";

// 2026-09-11: EK's ask — the shared VLTD Museum stays admin/owner-only for
// now (same restriction as the Gallery Builder's Map tab, which already
// gates via getMyAdminRole()). This is a separate gate on the direct
// /museum/vltd route itself, so a non-admin can't reach the museum just by
// typing the URL. Deliberately its own small client wrapper rather than
// touching VltdMuseumCampus.tsx (untouched, per repeated instruction) or
// making page.tsx a client component (which would lose its `metadata`
// export — Next.js only allows that on Server Components).
import { useEffect, useState } from "react";

import { getMyAdminAccessStatus } from "@/lib/adminAuth";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import VltdMuseumCampus from "@/components/gallery/VltdMuseumCampus";

type AccessState = "checking" | "pending-mfa" | "authorized" | "denied";

// 2026-09-14, EK-reported regression: this used to call getMyAdminRole()
// once on mount and collapse two very different situations into the same
// "Not authorized" denial — a genuine non-admin, AND an admin/owner whose
// session simply hadn't completed its 2FA challenge yet (the global
// MfaChallengeGate in Providers.tsx handles that challenge, as a modal
// layered on top of whatever page is showing). Since that modal check and
// this page's own check are two independent async calls with no ordering
// guarantee, this page's faster check could resolve first and flash "Not
// authorized" before the modal even appeared — and, worse, once the user
// verified successfully, THIS component never re-checked, so it stayed
// stuck showing the denial forever. Now uses getMyAdminAccessStatus() to
// tell "not an admin at all" apart from "pending 2FA," and re-checks on
// every Supabase auth-state change (the same event source the 2FA modal
// itself reacts to) so it recovers on its own once verification succeeds.
export default function VltdMuseumAdminGate() {
  const [state, setState] = useState<AccessState>("checking");

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const { role, mfaOk } = await getMyAdminAccessStatus();
      if (cancelled) return;
      if (!role) {
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
    return <div className="p-8 text-sm text-red-400">Not authorized. Admin access required.</div>;
  }

  return <VltdMuseumCampus />;
}
