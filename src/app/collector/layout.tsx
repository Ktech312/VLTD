import ProtectedRoute from "@/components/ProtectedRoute";

export default function CollectorLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
