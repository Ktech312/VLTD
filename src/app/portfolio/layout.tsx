import ProtectedRoute from "@/components/ProtectedRoute";

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
