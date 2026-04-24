import ProtectedRoute from "@/components/ProtectedRoute";
import HomeClient from "@/app/HomeClient";

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <HomeClient />
    </ProtectedRoute>
  );
}
