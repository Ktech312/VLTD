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

import { getMyAdminRole } from "@/lib/adminAuth";
import MuseumBuilder from "./MuseumBuilder";

export default function MuseumBuilderOwnerGate() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    getMyAdminRole().then((role) => setAuthorized(role === "owner"));
  }, []);

  if (authorized === null) {
    return <div className="p-8 text-sm text-[color:var(--muted)]">Checking access…</div>;
  }

  if (!authorized) {
    return <div className="p-8 text-sm text-red-400">Not authorized. Owner access required.</div>;
  }

  return <MuseumBuilder />;
}
