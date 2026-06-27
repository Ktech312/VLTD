"use client";

import Link from "next/link";
import { useState } from "react";

import { resetPasswordForEmail } from "@/lib/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!email.trim()) return;
    setSubmitting(true);
    setError("");

    try {
      await resetPasswordForEmail(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="px-4 py-8 text-[color:var(--fg)] sm:px-6 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl flex-col">
        <Link href="/login" className="w-fit text-sm font-medium text-[color:var(--muted2)] transition hover:text-[color:var(--fg)]">
          &lsaquo; Back to login
        </Link>

        <div className="flex flex-1 items-center justify-center py-8">
          <div className="vltd-vault-surface w-full max-w-[560px] rounded-[34px] p-7 backdrop-blur-xl sm:p-10">
            <div className="flex items-center gap-3">
              <span className="vltd-brand-dot" />
              <div className="text-2xl font-black tracking-[0.08em]">VLTD <span className="align-super text-[9px] text-[color:var(--muted2)]">TM</span></div>
            </div>

            {sent ? (
              <>
                <div className="mt-8 text-[12px] font-semibold uppercase tracking-[0.32em] text-[color:var(--muted2)]">Check your inbox</div>
                <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] sm:text-4xl">Reset link sent</h1>
                <p className="mt-3 text-base text-[color:var(--muted)]">
                  If <span className="font-semibold text-[color:var(--fg)]">{email}</span> has a VLTD account, you&apos;ll receive a password reset link shortly.
                </p>
                <p className="mt-2 text-sm text-[color:var(--muted2)]">Check your spam folder if it doesn&apos;t arrive within a few minutes.</p>
                <div className="mt-8">
                  <Link href="/login" className="vltd-primary-button inline-flex h-14 items-center justify-center rounded-full px-8 text-base font-black transition">
                    Back to login
                  </Link>
                </div>
              </>
            ) : (
              <>
                <div className="mt-8 text-[12px] font-semibold uppercase tracking-[0.32em] text-[color:var(--muted2)]">Account recovery</div>
                <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] sm:text-4xl">Reset your password</h1>
                <p className="mt-2 text-base text-[color:var(--muted)]">Enter your email and we&apos;ll send you a reset link.</p>

                {error ? <div className="mt-5 rounded-2xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}

                <div className="mt-8">
                  <label className="block">
                    <span className="text-base font-medium text-[color:var(--muted)]">Email</span>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void handleSubmit(); }}
                      type="email"
                      autoComplete="email"
                      autoFocus
                      placeholder="you@example.com"
                      className="vltd-input mt-3 h-16 w-full rounded-[22px] px-6 text-lg"
                    />
                  </label>
                </div>

                <div className="mt-7">
                  <button
                    type="button"
                    disabled={submitting || !email.trim()}
                    onClick={() => void handleSubmit()}
                    className="vltd-primary-button inline-flex h-16 w-full items-center justify-center rounded-full px-6 text-base font-black transition disabled:translate-y-0 disabled:opacity-45"
                  >
                    {submitting ? "Sending..." : "Send reset link"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <p className="pb-2 text-center text-sm italic text-[color:var(--muted2)]">VLTD — pronounced &quot;Vaulted&quot;</p>
      </div>
    </main>
  );
}
