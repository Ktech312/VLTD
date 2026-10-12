import type { Metadata } from "next";

import VirtualGalleryRoom from "@/components/gallery/VirtualGalleryRoom";
import VirtualRoomApprovalGate from "@/components/gallery/VirtualRoomApprovalGate";

export const metadata: Metadata = {
  title: "Virtual Room Builder",
  description:
    "Build an interactive VLTD gallery room from vault items and exhibitions.",
};

export default function VirtualRoomPage() {
  return (
    <VirtualRoomApprovalGate>
      <VirtualGalleryRoom />
    </VirtualRoomApprovalGate>
  );
}
