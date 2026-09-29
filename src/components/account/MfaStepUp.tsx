"use client";

// Shared inline 2FA step-up challenge (2026-09-29) — extracted so every
// admin-only surface can offer a real, on-the-spot way to reach aal2
// instead of a dead-end "you don't have access"/"Not authorized" message.
//
// Why this needed to exist: adminAuth.ts's getMyAdminRole()/
// getMyAdminAccessStatus() correctly require a genuinely verified aal2
// session (not just role membership) — but until now, the ONLY thing that
// could ever actually take a session from aal1 to aal2 was the global
// MfaChallengeGate modal (mounted once at the Providers root) or fully
// re-enrolling 2FA from scratch via TwoFactorAuthCard. Neither is
// reachable from inside an admin page's own "pending 2FA" message. That
// was a latent gap even before "remember this device" existed — the
// global gate always ran on every load, so in practice it always caught
// this before an admin page's guard could matter — but once a trusted
// device makes the global gate skip its own challenge entirely for the
// rest of that session, an admin/owner route has no way left to force a
// fresh verification: the global gate has already stood down, and
// Account → Security's own 2FA card offers only "Disable 2FA," never a
// bare re-verify. This component is that missing path: same
// mfa.challenge()/mfa.verify() calls MfaChallengeGate.tsx and
// TwoFactorAuthCard.tsx already use, surfaced right where the block
// happens instead of requiring a trip elsewhere.
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function MfaStepUp({ onVerified }: { onVerified: () => void }) {
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [noFactor, setNoFactor] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      const { data } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      const verified = data?.totp?.find((f) => f.status === "verified");
      if (verified) setFactorId(verified.id);
      else setNoFactor(true);
    })();
    return () => {
      cancelled = true;
    };
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
      setCode("");
      onVerified();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="mx-auto mt-16 w-full max-w-sm rounded-2xl p-6 ring-1 ring-[color:var(--border)]"
      style={{ background: "var(--surface, #111318)" }}
    >
      <div className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
        Two-factor authentication
      </div>
      <h2 className="mt-2 text-xl font-black" style={{ color: "var(--fg)" }}>
        Verify to continue
      </h2>
      <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
        This page needs a freshly verified 2FA session, separate from the general app check.
      </p>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-400/35 bg-red-500/10 px-3 py-2 text-sm text-red-100">{error}</div>
      ) : null}

      {noFactor ? (
        <a href="/account/security" className="mt-4 block text-sm underline" style={{ color: "var(--fg)" }}>
          Set up 2FA at Account → Security first
        </a>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy && code.length === 6) void verify();
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
            placeholder="000000"
            inputMode="numeric"
            maxLength={6}
            autoFocus
            disabled={!factorId}
            className="mt-4 w-full rounded-xl px-3 py-3 text-center text-2xl ring-1 ring-[color:var(--border)] focus:outline-none disabled:opacity-50"
            style={{ background: "var(--pill)", color: "var(--fg)", letterSpacing: "0.4em" }}
          />
          <button
            type="submit"
            disabled={busy || !factorId || code.length !== 6}
            className="vltd-primary-button mt-4 inline-flex h-12 w-full items-center justify-center rounded-full px-6 text-sm font-black transition disabled:opacity-45"
          >
            {busy ? "Verifying..." : "Verify"}
          </button>
        </form>
      )}
    </div>
  );
}
