import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Capture — VLTD",
  description: "Add items with AI-powered scanning",
};

export default function CaptureLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
