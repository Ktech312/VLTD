"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { getOnboardingStatus, retryAccountLookups } from "@/lib/auth";
import { routeAccess } from "@/lib/routeAccess";
import { storedSessionUserId } from "@/lib/sessionGuard";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { describeLoadFailure, markLoadStage } from "@/lib/loadDiagnostics";
import { PillButton } from "@/components/ui/PillButton";

// Enforces the access rules in src/lib/routeAccess.ts on every route, not just by hiding links:
//   signed out → /login (and back to the page they asked for afterwards)
//   signed in, setup unfinished → /onboarding
//   setup finished → the page they asked for
// It runs on a direct URL, a refresh, a header/bottom-bar link and the browser's Back button, because each of those changes
// the path. The page content is not rendered until the check passes, so nothing from a guarded page flashes first.

// A finished setup is remembered briefly so moving around the app doesn't re-check on every click. An unfinished setup or a
// signed-out visitor is never remembered, and signing out clears it.
const SETUP_OK_MS = 60_000;
// The account check had no limit: if it never answered (a stalled connection) or threw, the page stayed on an empty placeholder for ever.
// After this long the person is told, with a way to try again; the check keeps running and a late answer still lets the page through.
const GUARD_STALL_MS = 10_000;
// Before that, after this long the empty placeholder says it is still working, so a slow check does not look like a blank page.
const GUARD_SLOW_MS = 4_000;
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
  const [problem, setProblem] = useState<null | "stalled" | "error">(null);
  const [attempt, setAttempt] = useState(0);
  const [slow, setSlow] = useState(false);

  // Another tab signed out, or signed in as someone else, while this one had a page open. This tab's memory still holds the
  // previous person's pages and data, and its running requests are for them. A signed-out tab on a private page leaves it for
  // the sign-in page; a tab whose account changed starts over. (A full page load, not a client-side move: it clears everything
  // this tab was holding in memory.)
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let knownUser = storedSessionUserId();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const uid = session?.user?.id ?? null;
      if (event === "SIGNED_OUT") {
        const had = knownUser;
        knownUser = null;
        if (had && routeAccess(window.location.pathname) !== "public") window.location.replace("/login");
        return;
      }
      if (uid) {
        const previous = knownUser;
        knownUser = uid;
        if (previous && previous !== uid) window.location.reload();
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (access === "public") return;
    listenForSignOut();

    let cancelled = false;
    let settled = false;
    const here = pathname ?? "/";
    const startedAt = Date.now();
    setSlow(false);
    const slowTimer = window.setTimeout(() => {
      if (cancelled || settled) return;
      markLoadStage("guard:account-check:slow", true, "still waiting after 4 s");
      setSlow(true);
    }, GUARD_SLOW_MS);
    const stallTimer = window.setTimeout(() => {
      if (cancelled || settled) return;
      markLoadStage("guard:account-check", false, `no answer after ${Math.round(GUARD_STALL_MS / 1000)} s`);
      setProblem("stalled");
    }, GUARD_STALL_MS);

    async function check() {
      if (access === "setup" && Date.now() < setupOkUntil) {
        settled = true;
        if (!cancelled) setAllowedFor(here);
        return;
      }
      markLoadStage("guard:account-check:start", true, access);
      let status: Awaited<ReturnType<typeof getOnboardingStatus>>;
      try {
        status = await getOnboardingStatus();
      } catch (error) {
        settled = true;
        if (!cancelled) {
          markLoadStage("guard:account-check", false, "threw " + (error instanceof Error ? error.name : "error"));
          setProblem("error");
        }
        return;
      }
      settled = true;
      if (cancelled) return;
      setProblem(null);
      markLoadStage("guard:account-check", true, `${status.isAuthenticated ? (status.error ? "answered with a warning" : "signed in") : "signed out"} in ${Date.now() - startedAt} ms`);

      if (!status.isAuthenticated) {
        setupOkUntil = 0;
        const query = typeof window !== "undefined" ? window.location.search : "";
        router.replace(`/login?next=${encodeURIComponent(here + query)}`);
        return;
      }
      if (access === "setup" && status.needsOnboarding) {
        setupOkUntil = 0;
        // Tell the setup page why the person landed there, so the bounce is explained instead of silent.
        try { window.sessionStorage.setItem("vltd:setup-bounce", "1"); } catch { /* the notice is optional */ }
        router.replace("/onboarding");
        return;
      }
      if (access === "setup") setupOkUntil = Date.now() + SETUP_OK_MS;
      setAllowedFor(here);
    }

    void check();
    return () => {
      cancelled = true;
      window.clearTimeout(stallTimer);
      window.clearTimeout(slowTimer);
    };
  }, [pathname, access, router, attempt]);

  // A recent "setup finished" check lets a normal click through with no blank flash; the effect above still re-checks when it lapses.
  const recentlyChecked = access === "setup" && Date.now() < setupOkUntil;
  if (access === "public" || recentlyChecked) return <>{children}</>;
  if (allowedFor !== (pathname ?? "/")) {
    // Never a silent blank: if the check did not answer or failed, say so and offer to try again.
    if (problem) return <GuardProblem onRetry={() => { retryAccountLookups(); setProblem(null); setAttempt((n) => n + 1); }} />;
    return (
      <div aria-busy="true" aria-label="Checking your account" className="min-h-[60vh]">
        {slow ? <p role="status" className="pt-10 text-center text-sm text-[color:var(--muted)]">Still checking your account. This is taking longer than usual.</p> : null}
      </div>
    );
  }
  return <>{children}</>;
}

function GuardProblem({ onRetry }: { onRetry: () => void }) {
  const detail = describeLoadFailure();
  return (
    <section className="mx-auto mt-10 max-w-xl rounded-[18px] bg-[color:var(--surface)] p-8 text-center ring-1 ring-[color:var(--border)]" role="alert">
      <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">COULD NOT FINISH LOADING</div>
      <h2 className="mt-2 text-2xl font-semibold">We could not check your account just now</h2>
      <p className="mt-2 text-sm text-[color:var(--muted)]">
        Your items are safe: nothing has been changed or lost. This is only the step that decides which page to show. Check your connection and try again.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <PillButton variant="primary" onClick={onRetry}>Try again</PillButton>
        <PillButton href="/login">Sign in</PillButton>
      </div>
      {detail ? <p className="mt-4 break-words text-[11px] text-[color:var(--muted2)]">Details: {detail}</p> : null}
    </section>
  );
}
