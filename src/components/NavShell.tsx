"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import PullToRefresh from "@/components/PullToRefresh";

export default function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStudio = pathname?.startsWith("/studio");
  const isOwnerLab = pathname?.startsWith("/owner-lab");
  // The public marketing home renders its own nav — don't stack the app shell nav on it.
  const isPublicHome = pathname === "/";
  // The admin console (admin/characters/page.tsx) iframes other admin pages
  // (Users, Waitlist, Themes, etc.) into its own sidebar shell — each of
  // those, being a normal full page, also passes through THIS SAME
  // NavShell inside the iframe, stacking a second copy of the site's own
  // top/bottom nav on top of the first (EK caught this live, circled in a
  // screenshot). Detecting "am I actually inside an iframe" rather than
  // hardcoding a list of admin routes means this fixes itself for any
  // future page that gets embedded the same way, not just today's list.
  // Lazy useState initializer runs synchronously on first render (client
  // only — window is unavailable during SSR) so there's no flash of the
  // nav before this resolves, unlike computing it in a useEffect.
  const [isFramed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.self !== window.top;
    } catch {
      // Cross-origin frame access throws instead of returning false —
      // unable to reach window.top at all means we're definitely framed.
      return true;
    }
  });
  // Guest 3D room view: full-bleed below the header (EK's ask) — no mobile
  // bottom tab bar eating vertical space, and no pull-to-refresh, which
  // would fight the room's own click-drag-to-look/walk navigation.
  const isVirtualRoomGuest = pathname === "/museum/virtual-room/guest";

  if (isStudio || isOwnerLab || isPublicHome || isFramed) {
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
