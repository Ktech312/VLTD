"use client";

import { usePathname } from "next/navigation";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import PullToRefresh from "@/components/PullToRefresh";

export default function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStudio = pathname?.startsWith("/studio");
  // The public marketing home renders its own nav — don't stack the app shell nav on it.
  const isPublicHome = pathname === "/";

  if (isStudio || isPublicHome) {
    return <>{children}</>;
  }

  return (
    <>
      <TopNav />
      <PullToRefresh>{children}</PullToRefresh>
      <BottomNav />
    </>
  );
}
