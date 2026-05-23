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

function RouteTransitionInner({
  children,
  includeSearchParams = false,
}: {
  children: React.ReactNode;
  includeSearchParams?: boolean;
}) {
  const pathname = usePathname();
  const sp = useSearchParams();

  const routeKey = includeSearchParams
    ? `${pathname}?${sp.toString()}`
    : pathname;

  return (
    <div key={routeKey} className="vltd-route-enter">
      {children}
    </div>
  );
}

export default function RouteTransition(props: {
  children: React.ReactNode;
  includeSearchParams?: boolean;
}) {
  return (
    <Suspense fallback={<div className="vltd-route-enter" />}>
      <RouteTransitionInner {...props} />
    </Suspense>
  );
}