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
      {/*
        Content scrolls inside this fixed-position container — NOT the body.
        This is the only approach that reliably keeps fixed nav bars locked
        on iOS Safari, which breaks position:fixed when body itself scrolls.
      */}
      <div
        className="vltd-content-wrap"
        style={{
          position: "fixed",
          top: "var(--topnav-h)",
          left: 0,
          right: 0,
          bottom: "calc(var(--bottomnav-h) + max(env(safe-area-inset-bottom, 0px), 0px))",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          overscrollBehaviorY: "contain",
        }}
      >
        {children}
      </div>
      <VaultSyncStatusChip />
      <BottomNav />
    </>
  );
}
