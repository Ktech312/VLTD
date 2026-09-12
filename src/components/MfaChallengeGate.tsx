"use client";

// 2026-09-12, EK: even after the login page (src/app/login/page.tsx) was
// fixed to challenge a verified TOTP factor after password sign-in, she
// was still never asked for her code. Root cause of THAT: she signs in
// via "Continue with Google," a completely separate path — Google OAuth
// redirects back with the session already established via the URL
// fragment (supabase-js's own detectSessionInUrl), never passing through
// the login page's own post-signInWithPassword code at all. Patching each
// sign-in method individually would keep missing the next one (magic
// link, sign-up auto-login, etc.) — this is a global, mounted-once gate
// instead: it reacts to Supabase's own onAuthStateChange (which fires for
// every sign-in method alike) AND checks on initial mount, so it also
// catches an already-open tab sitting on a stale aal1 session from before
// this fix existed, not just new sign-ins. Uses the exact same
// mfa.challenge()/mfa.verify() calls TwoFactorAuthCard.tsx already uses
// for enrollment — same underlying check adminAuth.ts's getMyAdminRole()
// already gates admin/owner pages on, just surfaced here as something the
// user can actually resolve instead of a silent "Not authorized."
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function MfaChallengeGate() {
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function checkAal() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const verified = factors?.totp?.find((f) => f.status === "verified");
      if (verified) {
        setFactorId(verified.id);
        return;
      }
    }
    setFactorId("");
  }

  useEffect(() => {
    void checkAal();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setFactorId("");
        return;
      }
      // INITIAL_SESSION (page load with an existing session), SIGNED_IN
      // (any sign-in method), TOKEN_REFRESHED, and MFA_CHALLENGE_VERIFIED
      // all warrant a fresh look at the current assurance level.
      void checkAal();
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function verify() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !factorId) return;
    if (code.trim().length !== 6) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      // A fresh challenge every attempt — one can only be verified once.
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError || !challenge) {
        setError(challengeError?.message ?? "Couldn't start verification — try again.");
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (verifyError) {
        setError(verifyError.message || "That code didn't match — try again.");
        return;
      }
      setFactorId("");
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function signOutInstead() {
    const supabase = getSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (!factorId) return null;

  return (
    <div
      // This must out-rank literally everything else in the app — TopNav
      // alone uses z-[9999], and the scan sheets go up to z-[100001]. A
      // security gate that a nav bar or a stray panel can visually cover
      // (even without truly blocking clicks) is worse than none, since it
      // looks broken/ignorable instead of clearly blocking. Picked well
      // above every z-index found in this codebase (grepped for
      // `z-[\d{3,}]` across src/ before choosing this number).
      className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Two-factor authentication required"
    >
      <div className="w-full max-w-sm rounded-2xl p-6 ring-1 ring-[color:var(--border)]" style={{ background: "var(--surface)" }}>
        <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
          Two-factor authentication
        </div>
        <h2 className="mt-2 text-xl font-black" style={{ color: "var(--fg)" }}>Enter your code</h2>
        <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
          Your account has 2FA enabled — enter the 6-digit code from your authenticator app to continue.
        </p>

        {error ? <div className="mt-4 rounded-xl border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</div> : null}

        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
          placeholder="000000"
          inputMode="numeric"
          maxLength={6}
          autoFocus
          className="mt-4 w-full rounded-xl px-3 py-3 text-center text-2xl ring-1 ring-[color:var(--border)] focus:outline-none"
          style={{ background: "var(--pill)", color: "var(--fg)", letterSpacing: "0.4em" }}
        />

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            disabled={busy || code.length !== 6}
            onClick={() => void verify()}
            className="vltd-primary-button inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-black transition disabled:opacity-45"
          >
            {busy ? "Verifying..." : "Verify"}
          </button>
          <button
            type="button"
            onClick={() => void signOutInstead()}
            className="inline-flex h-11 items-center justify-center rounded-[8px] border border-[color:var(--border)] px-6 text-sm font-semibold transition"
            style={{ background: "var(--pill)", color: "var(--muted)" }}
          >
            Sign out instead
          </button>
        </div>
      </div>
    </div>
  );
}
