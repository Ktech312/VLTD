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

import { getMyAdminRole } from "@/lib/adminAuth";
import VltdMuseumCampus from "@/components/gallery/VltdMuseumCampus";

export default function VltdMuseumAdminGate() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    getMyAdminRole().then((role) => setAuthorized(role !== null));
  }, []);

  if (authorized === null) {
    return <div className="p-8 text-sm text-[color:var(--muted)]">Checking access…</div>;
  }

  if (!authorized) {
    return <div className="p-8 text-sm text-red-400">Not authorized. Admin access required.</div>;
  }

  return <VltdMuseumCampus />;
}
