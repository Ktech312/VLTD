import type { Metadata } from "next";

import VirtualGalleryRoom from "@/components/gallery/VirtualGalleryRoom";

export const metadata: Metadata = {
  title: "Virtual Room",
  description: "Walk through this VLTD gallery room.",
};

export default function VirtualRoomGuestPage() {
  return <VirtualGalleryRoom guest />;
}
