"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { getOnboardingStatus } from "@/lib/auth";
import { consumeAuthLinkFromHash } from "@/lib/authLink";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import VltdLogo from "@/components/VltdLogo";

// Where the "Confirm my email" button in the VLTD confirmation email lands. Supabase has already confirmed the address and
// signed the person in (the session arrives in the link); this page says so and moves them on, instead of dropping them on the
// public home page with no sign that anything happened.

type Phase = "checking" | "confirmed" | "needs_login" | "bad_link";

function linkProblem(): boolean {
  if (typeof window === "undefined") return false;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  return Boolean(hash.get("error") || hash.get("error_description") || query.get("error") || query.get("error_description"));
}

export default function EmailConfirmedPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  // Read before the auth client consumes the link and clears it from the address bar.
  const [problem] = useState(linkProblem);
  const moved = useRef(false);

  async function goOn() {
    if (moved.current) return;
    moved.current = true;
    const status = await getOnboardingStatus();
    router.replace(status.needsOnboarding ? "/onboarding" : "/dashboard");
    router.refresh();
  }

  useEffect(() => {
    if (problem) {
      setPhase("bad_link");
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let done = false;
    const confirmed = () => {
      if (done) return;
      done = true;
      setPhase("confirmed");
      window.setTimeout(() => void goOn(), 2200);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) confirmed();
    });
    // The confirmation link carries the session after "#", which the PKCE client rejects: start it from the link (src/lib/authLink.ts).
    void (async () => {
      const link = await consumeAuthLinkFromHash();
      if (link.failed) {
        done = true;
        setPhase("bad_link");
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) confirmed();
    })();
    // The address is confirmed even if this browser could not keep the session: say so and send them to log in.
    const giveUp = window.setTimeout(() => {
      if (!done) setPhase("needs_login");
    }, 7000);

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(giveUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem]);

  return (
    <main className="px-4 py-8 text-[color:var(--fg)] sm:px-6 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col">
        <div className="flex flex-1 items-center justify-center py-8">
          <div className="vltd-vault-surface w-full max-w-[560px] rounded-[34px] p-7 backdrop-blur-xl sm:p-10">
            <VltdLogo height={40} onDark />

            {phase === "checking" ? (
              <>
                <h1 className="mt-8 text-2xl font-black tracking-[-0.04em] sm:text-4xl">Confirming your email…</h1>
                <p className="mt-3 text-base text-[color:var(--muted)]">One moment.</p>
              </>
            ) : null}

            {phase === "confirmed" ? (
              <>
                <div className="mt-8 text-[12px] font-semibold uppercase tracking-[0.32em] text-[color:var(--muted2)]">Welcome to the VLTD Club</div>
                <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] sm:text-4xl">Your email is confirmed</h1>
                <p className="mt-3 text-base text-[color:var(--muted)]">You’re signed in. Taking you to the next step…</p>
                <div className="mt-7">
                  <button type="button" onClick={() => void goOn()} className="vltd-primary-button inline-flex h-14 items-center justify-center rounded-full px-8 text-base font-black transition">
                    Continue
                  </button>
                </div>
              </>
            ) : null}

            {phase === "needs_login" ? (
              <>
                <h1 className="mt-8 text-2xl font-black tracking-[-0.04em] sm:text-4xl">Your email is confirmed</h1>
                <p className="mt-3 text-base text-[color:var(--muted)]">Log in with your email and password to get started.</p>
                <div className="mt-7">
                  <Link href="/login" className="vltd-primary-button inline-flex h-14 items-center justify-center rounded-full px-8 text-base font-black transition">
                    Log in
                  </Link>
                </div>
              </>
            ) : null}

            {phase === "bad_link" ? (
              <>
                <h1 className="mt-8 text-2xl font-black tracking-[-0.04em] sm:text-4xl">This link has expired</h1>
                <p className="mt-3 text-base text-[color:var(--muted)]">
                  It may have been used already. If you’ve confirmed your email, just log in. Otherwise sign up again and we’ll send a new one.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link href="/login" className="vltd-primary-button inline-flex h-14 items-center justify-center rounded-full px-8 text-base font-black transition">
                    Log in
                  </Link>
                  <Link href="/signup" className="inline-flex h-14 items-center justify-center rounded-full px-6 text-base font-semibold text-[color:var(--muted)] transition hover:text-[color:var(--fg)]">
                    Sign up again
                  </Link>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
