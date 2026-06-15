"use client";

import { usePathname } from "next/navigation";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import VaultSyncStatusChip from "@/components/VaultSyncStatusChip";

export default function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStudio = pathname?.startsWith("/studio");

  if (isStudio) {
    return <>{children}</>;
  }

  return (
    <>
      <TopNav />
      <div
        className="vltd-content-wrap"
        style={{
          paddingTop: "var(--topnav-h)",
          paddingBottom: "calc(var(--bottomnav-h) + max(env(safe-area-inset-bottom, 0px), 16px))",
        }}
      >
        {children}
      </div>
      <VaultSyncStatusChip />
      <BottomNav />
    </>
  );
}
