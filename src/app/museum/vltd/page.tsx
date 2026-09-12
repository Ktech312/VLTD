import type { Metadata } from "next";
import { Suspense } from "react";

import VltdMuseumAdminGate from "@/components/gallery/VltdMuseumAdminGate";

export const metadata: Metadata = {
  title: "VLTD Museum",
  description: "A first walkable pass at the VLTD Museum public campus.",
};

export default function VltdMuseumPage() {
  // Suspense boundary required by Next.js for the ?room= deep-link spawn
  // (VltdMuseumCampus.tsx's useSearchParams() call, 2026-09-12) — no other
  // behavior change here.
  return (
    <Suspense fallback={null}>
      <VltdMuseumAdminGate />
    </Suspense>
  );
}
