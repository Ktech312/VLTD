import type { Metadata } from "next";
import ProtectedRoute from "@/components/ProtectedRoute";

export const metadata: Metadata = {
  title: "Insights — VLTD",
  description: "Collection analytics and insights",
};

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
