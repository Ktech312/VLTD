"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { getOnboardingStatus } from "@/lib/auth";
import { routeAccess } from "@/lib/routeAccess";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

// Enforces the access rules in src/lib/routeAccess.ts on every route, not just by hiding links:
//   signed out → /login (and back to the page they asked for afterwards)
//   signed in, setup unfinished → /onboarding
//   setup finished → the page they asked for
// It runs on a direct URL, a refresh, a header/bottom-bar link and the browser's Back button, because each of those changes
// the path. The page content is not rendered until the check passes, so nothing from a guarded page flashes first.

// A finished setup is remembered briefly so moving around the app doesn't re-check on every click. An unfinished setup or a
// signed-out visitor is never remembered, and signing out clears it.
const SETUP_OK_MS = 60_000;
let setupOkUntil = 0;
let listening = false;

function listenForSignOut() {
  if (listening) return;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  listening = true;
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT" || event === "USER_UPDATED") setupOkUntil = 0;
  });
}

export default function RouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const access = routeAccess(pathname);
  const [allowedFor, setAllowedFor] = useState<string | null>(null);

  useEffect(() => {
    if (access === "public") return;
    listenForSignOut();

    let cancelled = false;
    const here = pathname ?? "/";

    async function check() {
      if (access === "setup" && Date.now() < setupOkUntil) {
        if (!cancelled) setAllowedFor(here);
        return;
      }
      const status = await getOnboardingStatus();
      if (cancelled) return;

      if (!status.isAuthenticated) {
        setupOkUntil = 0;
        const query = typeof window !== "undefined" ? window.location.search : "";
        router.replace(`/login?next=${encodeURIComponent(here + query)}`);
        return;
      }
      if (access === "setup" && status.needsOnboarding) {
        setupOkUntil = 0;
        router.replace("/onboarding");
        return;
      }
      if (access === "setup") setupOkUntil = Date.now() + SETUP_OK_MS;
      setAllowedFor(here);
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [pathname, access, router]);

  // A recent "setup finished" check lets a normal click through with no blank flash; the effect above still re-checks when it lapses.
  const recentlyChecked = access === "setup" && Date.now() < setupOkUntil;
  if (access === "public" || recentlyChecked) return <>{children}</>;
  if (allowedFor !== (pathname ?? "/")) return <div aria-busy="true" aria-label="Checking your account" className="min-h-[60vh]" />;
  return <>{children}</>;
}
