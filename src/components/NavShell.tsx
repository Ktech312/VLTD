"use client";

import { usePathname } from "next/navigation";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import VaultSyncStatusChip from "@/components/VaultSyncStatusChip";
import PullToRefresh from "@/components/PullToRefresh";

export default function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStudio = pathname?.startsWith("/studio");

  if (isStudio) {
    return <>{children}</>;
  }

  return (
    <>
      <TopNav />
      <PullToRefresh>{children}</PullToRefresh>
      <VaultSyncStatusChip />
      <BottomNav />
    </>
  );
}
