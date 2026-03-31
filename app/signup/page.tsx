"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { signInWithGoogle, signUpWithPassword } from "@/lib/auth";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSignup() {
    setSubmitting(true);
    setError("");

    try {
      await signUpWithPassword(email.trim(), password);
      router.replace("/onboarding");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignup() {
    setGoogleSubmitting(true);
    setError("");

    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign up failed.");
      setGoogleSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[color:var(--bg)] px-4 py-10 text-[color:var(--fg)]">
      <div className="mx-auto max-w-md rounded-[28px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] sm:p-8">
        <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted2)]">Signup</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Keep it fast. Get in, finish onboarding, start building.
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
              autoComplete="new-password"
              className="mt-2 h-12 w-full rounded-2xl bg-[color:var(--input)] px-4 ring-1 ring-[color:var(--border)] outline-none"
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSignup()}
            className="inline-flex h-11 items-center justify-center rounded-full bg-[color:var(--pill-active-bg)] px-5 text-sm font-semibold text-[color:var(--fg)] disabled:opacity-40"
          >
            {submitting ? "Creating..." : "Create Account"}
          </button>

          <button
            type="button"
            disabled={googleSubmitting}
            onClick={() => void handleGoogleSignup()}
            className="inline-flex h-11 items-center justify-center rounded-full bg-[color:var(--pill)] px-5 text-sm font-medium ring-1 ring-[color:var(--border)] disabled:opacity-40"
          >
            {googleSubmitting ? "Redirecting..." : "Continue with Google"}
          </button>
        </div>

        <div className="mt-6 text-sm text-[color:var(--muted)]">
          Already have an account?{" "}
          <Link href="/login" className="text-[color:var(--fg)] underline">
            Log in
          </Link>
        </div>
      </div>
    </main>
  );
}
