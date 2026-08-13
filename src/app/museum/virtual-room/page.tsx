import type { Metadata } from "next";

import VirtualGalleryRoom from "@/components/gallery/VirtualGalleryRoom";

export const metadata: Metadata = {
  title: "Virtual Room Builder",
  description:
    "Build an interactive VLTD gallery room from vault items and exhibitions.",
};

export default function VirtualRoomPage() {
  return <VirtualGalleryRoom />;
}
