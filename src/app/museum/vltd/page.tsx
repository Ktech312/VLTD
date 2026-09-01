import type { Metadata } from "next";

import VltdMuseumCampus from "@/components/gallery/VltdMuseumCampus";

export const metadata: Metadata = {
  title: "VLTD Museum",
  description: "A first walkable pass at the VLTD Museum public campus.",
};

export default function VltdMuseumPage() {
  return <VltdMuseumCampus />;
}
