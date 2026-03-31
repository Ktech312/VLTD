"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import { getOnboardingStatus, signInWithGoogle, signInWithPassword } from "@/lib/auth";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const nextUrl = useMemo(() => searchParams.get("next") || "/", [searchParams]);

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
    <main className="min-h-screen bg-[color:var(--bg)] px-4 py-10 text-[color:var(--fg)]">
      <div className="mx-auto max-w-md rounded-[28px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] sm:p-8">
        <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted2)]">Login</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Get back into your vault fast.
        </p>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4">
          <div>
            <div className="text-sm font-medium">Email</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              className="mt-2 h-12 w-full rounded-2xl bg-[color:var(--input)] px-4 ring-1 ring-[color:var(--border)] outline-none"
            />
          </div>

          <div>
            <div className="text-sm font-medium">Password</div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              className="mt-2 h-12 w-full rounded-2xl bg-[color:var(--input)] px-4 ring-1 ring-[color:var(--border)] outline-none"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handlePasswordLogin()}
            className="inline-flex h-11 items-center justify-center rounded-full bg-[color:var(--pill-active-bg)] px-5 text-sm font-semibold text-[color:var(--fg)] disabled:opacity-40"
          >
            {submitting ? "Logging in..." : "Log In"}
          </button>

          <button
            type="button"
            disabled={googleSubmitting}
            onClick={() => void handleGoogleLogin()}
            className="inline-flex h-11 items-center justify-center rounded-full bg-[color:var(--pill)] px-5 text-sm font-medium ring-1 ring-[color:var(--border)] disabled:opacity-40"
          >
            {googleSubmitting ? "Redirecting..." : "Continue with Google"}
          </button>
        </div>

        <div className="mt-6 text-sm text-[color:var(--muted)]">
          Need an account?{" "}
          <Link href="/signup" className="text-[color:var(--fg)] underline">
            Sign up
          </Link>
        </div>
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
