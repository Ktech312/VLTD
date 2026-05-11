import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Discover — VLTD",
  description: "Browse public galleries and curated collections from collectors around the world.",
};

export default function DiscoverLayout({ children }: { children: React.ReactNode }) {
  return children;
}
