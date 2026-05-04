"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import { getOnboardingStatus, signInWithGoogle, signInWithPassword } from "@/lib/auth";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = useMemo(() => searchParams.get("next") || "/dashboard", [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handlePasswordLogin() {
    setSubmitting(true);
    setError("");

    try {
      await signInWithPassword(email.trim(), password);
      const status = await getOnboardingStatus();
      router.replace(status.needsOnboarding ? "/onboarding" : nextUrl);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    setGoogleSubmitting(true);
    setError("");

    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign in failed.");
      setGoogleSubmitting(false);
    }
  }

  return (
    <main className="vltd-page-depth min-h-screen px-4 py-8 text-[color:var(--fg)] sm:px-6 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col">
        <Link href="/" className="w-fit text-sm font-medium text-[color:var(--muted2)] transition hover:text-[color:var(--fg)]">
          &lsaquo; Back to VLTD
        </Link>

        <div className="flex flex-1 items-center justify-center py-8">
          <div className="vltd-vault-surface w-full max-w-[560px] rounded-[34px] p-7 backdrop-blur-xl sm:p-10">
            <div className="flex items-center gap-3">
              <span className="vltd-brand-dot" />
              <div className="text-2xl font-black tracking-[0.08em]">VLTD <span className="align-super text-[9px] text-[color:var(--muted2)]">TM</span></div>
            </div>

            <div className="mt-8 text-[12px] font-semibold uppercase tracking-[0.32em] text-[color:var(--muted2)]">Welcome back</div>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.04em]">Log in to your vault</h1>
            <p className="mt-2 text-base text-[color:var(--muted)]">Get back into your vault.</p>

            {error ? <div className="mt-5 rounded-2xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}

            <div className="mt-8 grid gap-5">
              <label className="block">
                <span className="text-base font-medium text-[color:var(--muted)]">Email</span>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="you@example.com" className="vltd-input mt-3 h-16 w-full rounded-[22px] px-6 text-lg" />
              </label>

              <label className="block">
                <span className="text-base font-medium text-[color:var(--muted)]">Password</span>
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" placeholder="••••••••" className="vltd-input mt-3 h-16 w-full rounded-[22px] px-6 text-lg" />
              </label>
            </div>

            <div className="mt-7 flex flex-col gap-4">
              <button type="button" disabled={submitting} onClick={() => void handlePasswordLogin()} className="vltd-primary-button inline-flex h-16 items-center justify-center rounded-full px-6 text-base font-black transition disabled:translate-y-0 disabled:opacity-45">
                {submitting ? "Logging in..." : "Log in"}
              </button>

              <div className="flex items-center gap-4 text-sm text-[color:var(--muted2)]"><span className="h-px flex-1 bg-[color:var(--border)]" />or<span className="h-px flex-1 bg-[color:var(--border)]" /></div>

              <button type="button" disabled={googleSubmitting} onClick={() => void handleGoogleLogin()} className="inline-flex h-14 items-center justify-center gap-3 rounded-full border border-[color:var(--border)] bg-[color:var(--pill)] px-6 text-base font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--pill-hover)] hover:text-[color:var(--fg)] disabled:opacity-45">
                <span className="text-xl font-black text-[color:var(--accent)]">G</span>
                {googleSubmitting ? "Redirecting..." : "Continue with Google"}
              </button>
            </div>

            <div className="mt-7 text-center text-base text-[color:var(--muted2)]">
              Don&apos;t have a VLTD account? <Link href="/signup" className="font-semibold text-[color:var(--fg)] underline underline-offset-4">Sign up free</Link>
            </div>
          </div>
        </div>

        <p className="pb-2 text-center text-sm italic text-[color:var(--muted2)]">VLTD — pronounced &quot;Vaulted&quot;</p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
