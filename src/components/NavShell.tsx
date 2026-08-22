"use client";

import { usePathname } from "next/navigation";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import PullToRefresh from "@/components/PullToRefresh";

export default function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStudio = pathname?.startsWith("/studio");
  const isOwnerLab = pathname?.startsWith("/owner-lab");
  // The public marketing home renders its own nav — don't stack the app shell nav on it.
  const isPublicHome = pathname === "/";
  // Guest 3D room view: full-bleed below the header (EK's ask) — no mobile
  // bottom tab bar eating vertical space, and no pull-to-refresh, which
  // would fight the room's own click-drag-to-look/walk navigation.
  const isVirtualRoomGuest = pathname === "/museum/virtual-room/guest";

  if (isStudio || isOwnerLab || isPublicHome) {
    return <>{children}</>;
  }

  if (isVirtualRoomGuest) {
    return (
      <>
        <TopNav />
        {children}
      </>
    );
  }

  return (
    <>
      <TopNav />
      <PullToRefresh>{children}</PullToRefresh>
      <BottomNav />
    </>
  );
}
