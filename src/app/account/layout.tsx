import type { Metadata } from "next";
import { Suspense } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import SettingsShell from "@/components/account/SettingsShell";

export const metadata: Metadata = {
  title: "Account Settings — VLTD",
  description: "Account and profile settings",
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <Suspense fallback={null}>
        <SettingsShell>{children}</SettingsShell>
      </Suspense>
    </ProtectedRoute>
  );
}
