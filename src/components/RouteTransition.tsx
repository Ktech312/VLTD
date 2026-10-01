// Path: src/components/RouteTransition.tsx
"use client";

import React, { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * RouteTransition
 * Simple, dependency-free page transitions.
 * - Fades/raises page on navigation
 * - Skips re-animating on query-string-only changes by default
 *
 * Notes:
 * - If you want search param changes to animate too, set includeSearchParams=true.
 * - CSS lives in globals.css (preferred) to avoid per-route style injection.
 */

function QueryTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  return (
    <div key={`${pathname}?${sp.toString()}`} className="vltd-route-enter">
      {children}
    </div>
  );
}

export default function RouteTransition(props: {
  children: React.ReactNode;
  includeSearchParams?: boolean;
}) {
  const pathname = usePathname();
  const content = <div key={pathname} className="vltd-route-enter">{props.children}</div>;
  // Only the opt-in query animation reads search params. Public page content
  // must remain in the server HTML, including while a child suspends.
  // Existing app pages may read search params themselves. Keep their boundary,
  // but do not make every public page suspend by reading them here.
  if (!props.includeSearchParams) {
    return <Suspense fallback={<div className="vltd-route-enter" />}>{content}</Suspense>;
  }
  return (
    <Suspense fallback={content}>
      <QueryTransition>{props.children}</QueryTransition>
    </Suspense>
  );
}
