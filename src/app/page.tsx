import ProtectedRoute from "@/components/ProtectedRoute";
import HomeClient from "./HomeClient";

export default function Page() {
  return (
    <ProtectedRoute>
      <HomeClient />
    </ProtectedRoute>
  );
}
