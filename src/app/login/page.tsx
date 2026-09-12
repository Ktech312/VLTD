"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

import { getOnboardingStatus, signInWithGoogle, signInWithPassword } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = useMemo(() => searchParams.get("next") || "/dashboard", [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState("");

  // 2026-09-12, EK: signing back in never asked for her authenticator code
  // even with 2FA enabled, and every admin/owner page (getMyAdminRole() in
  // adminAuth.ts, added 2026-08-27 specifically to require a real verified
  // MFA session, not just a password login) silently read that as "not
  // authorized" with no explanation. Root cause: this page called
  // signInWithPassword and redirected straight away — nothing here ever
  // challenged the second factor, so a session could never actually reach
  // aal2 through normal login. `mfaFactorId` set means a verified TOTP
  // factor exists and the current session hasn't cleared it yet; the code
  // step below reuses the exact same mfa.challenge()/mfa.verify() calls
  // TwoFactorAuthCard.tsx already uses for enrollment, not a new flow.
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaSubmitting, setMfaSubmitting] = useState(false);

  async function completeLogin() {
    const status = await getOnboardingStatus();
    router.replace(status.needsOnboarding ? "/onboarding" : nextUrl);
    router.refresh();
  }

  async function handlePasswordLogin() {
    setSubmitting(true);
    setError("");

    try {
      await signInWithPassword(email.trim(), password);

      const supabase = getSupabaseBrowserClient();
      const { data: aal } = supabase ? await supabase.auth.mfa.getAuthenticatorAssuranceLevel() : { data: null };
      const needsMfa = Boolean(aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2");

      if (needsMfa && supabase) {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const verifiedFactor = factors?.totp?.find((f) => f.status === "verified");
        if (verifiedFactor) {
          setMfaFactorId(verifiedFactor.id);
          setSubmitting(false);
          return; // Show the code step below instead of redirecting yet.
        }
      }

      await completeLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyMfaCode() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !mfaFactorId) return;
    if (mfaCode.trim().length !== 6) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setMfaSubmitting(true);
    setError("");
    try {
      // A fresh challenge every attempt — a challenge can only be verified
      // once, so retrying after a wrong/expired code needs a new one, not
      // a reused challengeId.
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
      if (challengeError || !challenge) {
        setError(challengeError?.message ?? "Couldn't start verification — try again.");
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.id,
        code: mfaCode.trim(),
      });
      if (verifyError) {
        setError(verifyError.message || "That code didn't match — try again.");
        return;
      }
      await completeLogin();
    } finally {
      setMfaSubmitting(false);
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
    <main className="px-4 py-8 text-[color:var(--fg)] sm:px-6 sm:py-10">
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

            {mfaFactorId ? (
              <>
                <div className="mt-8 text-[12px] font-semibold uppercase tracking-[0.32em] text-[color:var(--muted2)]">Two-factor authentication</div>
                <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] sm:text-4xl">Enter your code</h1>
                <p className="mt-2 text-base text-[color:var(--muted)]">Open your authenticator app and enter the 6-digit code.</p>

                {error ? <div className="mt-5 rounded-2xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}

                <div className="mt-8 grid gap-5">
                  <label className="block">
                    <span className="text-base font-medium text-[color:var(--muted)]">Authentication code</span>
                    <input
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                      placeholder="000000"
                      inputMode="numeric"
                      maxLength={6}
                      autoFocus
                      className="vltd-input mt-3 h-16 w-full rounded-[22px] px-6 text-center text-2xl tracking-[0.4em]"
                    />
                  </label>
                </div>

                <div className="mt-7 flex flex-col gap-4">
                  <button
                    type="button"
                    disabled={mfaSubmitting || mfaCode.length !== 6}
                    onClick={() => void handleVerifyMfaCode()}
                    className="vltd-primary-button inline-flex h-16 items-center justify-center rounded-full px-6 text-base font-black transition disabled:translate-y-0 disabled:opacity-45"
                  >
                    {mfaSubmitting ? "Verifying..." : "Verify"}
                  </button>
                  <button
                    type="button"
                    disabled={mfaSubmitting}
                    onClick={() => { setMfaFactorId(""); setMfaCode(""); setError(""); }}
                    className="inline-flex h-14 items-center justify-center rounded-[8px] border border-[color:var(--border)] bg-[color:var(--pill)] px-6 text-base font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--pill-hover)] hover:text-[color:var(--fg)] disabled:opacity-45"
                  >
                    Back
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mt-8 text-[12px] font-semibold uppercase tracking-[0.32em] text-[color:var(--muted2)]">Welcome back</div>
                <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] sm:text-4xl">Log in to your vault</h1>
                <p className="mt-2 text-base text-[color:var(--muted)]">Get back into your vault.</p>

                {error ? <div className="mt-5 rounded-2xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}

                <div className="mt-8 grid gap-5">
                  <label className="block">
                    <span className="text-base font-medium text-[color:var(--muted)]">Email</span>
                    <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="you@example.com" className="vltd-input mt-3 h-16 w-full rounded-[22px] px-6 text-lg" />
                  </label>

                  <label className="block">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-medium text-[color:var(--muted)]">Password</span>
                      <Link href="/forgot-password" className="text-sm font-medium text-[color:var(--muted2)] transition hover:text-[color:var(--fg)]">Forgot password?</Link>
                    </div>
                    <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" placeholder="••••••••" className="vltd-input mt-3 h-16 w-full rounded-[22px] px-6 text-lg" />
                  </label>
                </div>

                <div className="mt-7 flex flex-col gap-4">
                  <button type="button" disabled={submitting} onClick={() => void handlePasswordLogin()} className="vltd-primary-button inline-flex h-16 items-center justify-center rounded-full px-6 text-base font-black transition disabled:translate-y-0 disabled:opacity-45">
                    {submitting ? "Logging in..." : "Log in"}
                  </button>

                  <div className="flex items-center gap-4 text-sm text-[color:var(--muted2)]"><span className="h-px flex-1 bg-[color:var(--border)]" />or<span className="h-px flex-1 bg-[color:var(--border)]" /></div>

                  <button type="button" disabled={googleSubmitting} onClick={() => void handleGoogleLogin()} className="inline-flex h-14 items-center justify-center gap-3 rounded-[8px] border border-[color:var(--border)] bg-[color:var(--pill)] px-6 text-base font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--pill-hover)] hover:text-[color:var(--fg)] disabled:opacity-45">
                    <span className="text-xl font-black text-[color:var(--accent)]">G</span>
                    {googleSubmitting ? "Redirecting..." : "Continue with Google"}
                  </button>
                </div>

                <div className="mt-7 text-center text-base text-[color:var(--muted2)]">
                  Don&apos;t have a VLTD account? <Link href="/signup" className="font-semibold text-[color:var(--fg)] underline underline-offset-4">Sign up free</Link>
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

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
