import ProtectedRoute from "@/components/ProtectedRoute";

export default function VaultLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
