import ProtectedRoute from "@/components/ProtectedRoute";

export default function MuseumLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}
