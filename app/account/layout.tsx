import ProtectedRoute from "@/components/ProtectedRoute";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
