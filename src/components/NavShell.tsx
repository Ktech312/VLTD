"use client";

import { usePathname } from "next/navigation";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";

export default function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStudio = pathname?.startsWith("/studio");

  if (isStudio) {
    return <>{children}</>;
  }

  return (
    <>
      <TopNav />
      <div style={{ paddingTop: "var(--topnav-h)" }} className="vltd-content-wrap">
        {children}
      </div>
      <BottomNav />
    </>
  );
}
