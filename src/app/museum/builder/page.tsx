import type { Metadata } from "next";

import MuseumBuilderOwnerGate from "@/components/gallery/MuseumBuilderOwnerGate";

// Museum Builder (2026-09-12): a new, separate, owner-only page — EK's
// direct ask, after using the in-Gallery-Builder museum room popup, to
// split real-museum room editing out of the Gallery Builder's personal-Hall
// flow entirely. `/museum/virtual-room` (the Gallery Builder) is completely
// untouched by this page. Gated client-side by MuseumBuilderOwnerGate
// (role === "owner" specifically — see src/lib/adminAuth.ts) the same way
// VltdMuseumAdminGate.tsx already gates `/museum/vltd`, and for the same
// reason: keeping this a plain Server Component with its own `metadata`
// export means the actual gate check has to live in a client child instead
// of making this whole page a client component.
export const metadata: Metadata = {
  title: "Museum Builder",
  description: "Owner-only room editor for the real, shared VLTD Museum.",
};

export default function MuseumBuilderPage() {
  return <MuseumBuilderOwnerGate />;
}
