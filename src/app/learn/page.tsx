import type { Metadata } from "next";

import LearnClient from "@/components/learn/LearnClient";

export const metadata: Metadata = {
  title: "Learn — VLTD",
  alternates: { canonical: "/learn" },
  description:
    "Collector knowledge, insurance guidance, and market education. Guides on documenting, pricing, protecting, showcasing, and selling your collection.",
};

export default function LearnPage() {
  return <LearnClient />;
}
