import type { Metadata } from "next";

import MuseumPrototypeRoom from "@/components/gallery/MuseumPrototypeRoom";

export const metadata: Metadata = {
  title: "Museum Standard-Room Prototype",
  description: "Phase 1 scale prototype: one exact 21 x 26 x 9.15 standard room with two working doorways.",
};

export default function CampusPrototypePage() {
  return <MuseumPrototypeRoom />;
}
