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
import { useRouter, useSearchParams } from "next/navigation";

import { getMyAdminAccessStatus } from "@/lib/adminAuth";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import VltdMuseumCampus from "@/components/gallery/VltdMuseumCampus";
import VltdMuseumCampusV2 from "@/components/gallery/VltdMuseumCampusV2";
import MuseumCampusOverview from "@/components/gallery/MuseumCampusOverview";
import { CAMPUS_ROOMS, type CampusRoomId } from "@/lib/campusLayout";

function resolveCampusRoomId(raw: string | null): CampusRoomId | null {
  const match = CAMPUS_ROOMS.find((r) => r.id === raw);
  return match ? match.id : null;
}

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomParam = searchParams.get("room");

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

  // Perf pass (2026-09-21, EK's own idea): land on the existing lightweight
  // room-picker map first instead of jumping straight into the full
  // walkable 3D build — nothing 3D loads until a room is actually chosen.
  // Clicking a room on this map already navigates to this same route with
  // ?room=<id> (MuseumCampusOverview's own existing Link, unchanged) — the
  // exact same param VltdMuseumCampus.tsx already reads to pick its spawn
  // point, so entering a room now happens in direct response to a click
  // instead of automatically on page load, and the wait that follows reads
  // as an expected transition instead of the page looking stuck. Neither
  // VltdMuseumCampus.tsx nor MuseumCampusOverview.tsx needed any change for
  // this — both already did exactly the right thing, this file just wasn't
  // using them together yet. See HANDOFF.md's 2026-09-21 entry.
  if (!roomParam) {
    return <MuseumCampusOverview onBackToRoom={() => router.push("/museum")} />;
  }

  // Museum Runtime V2 proof (2026-09-23): ?runtime=v2 routes to the new,
  // separate streamed-neighborhood runtime instead of the legacy
  // whole-campus build — plain ?room=<id> (no runtime param) is completely
  // unchanged, still VltdMuseumCampus, so the existing production museum
  // stays the default and the fallback. An unrecognized room id under
  // runtime=v2 falls through to the legacy component rather than crashing.
  const v2RoomId = searchParams.get("runtime") === "v2" ? resolveCampusRoomId(roomParam) : null;
  if (v2RoomId) {
    return <VltdMuseumCampusV2 roomId={v2RoomId} />;
  }

  return <VltdMuseumCampus />;
}
