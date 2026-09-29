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
import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

// "Remember this device" (2026-09-27, EK's ask, previously requested and
// never built): a per-user trusted-device token stored only in this
// browser's localStorage, keyed by user id so more than one VLTD account
// on the same browser — or the same account trusted on several separate
// devices at once — each keep their own independent record. The token
// itself is opaque here; only its hash is ever checked server-side
// (public.check_trusted_device / public.trust_this_device).
//
// RE-ENABLED (2026-09-29): was off after EK caught a real bug in the
// first trust_this_device() — it never checked the CALLING session had
// itself completed a real MFA challenge (aal2), so an aal1 session could
// mint itself a permanent 2FA-skip token. Fixed and independently
// verified live before flipping this back on: test_mfa_trusted_device_
// security() (service_role only, migrations 20260927c/d/e +
// 20260929b) returns 10/10 passing — aal1 blocked at the RPC, no
// direct INSERT/UPDATE/DELETE grant or policy for authenticated/anon,
// aal2 succeeds with the 30-day clamp applied. Every admin/owner gate
// was also independently confirmed to still require a genuinely live
// aal2 session regardless of this flag (adminAuth.ts's check reads the
// real Supabase session AAL directly, never this trusted-device record),
// and now has a working inline step-up (MfaStepUp.tsx) instead of a dead
// end if it isn't. See HANDOFF.md's 2026-09-29 entry for the full trail.
const TRUSTED_DEVICE_FEATURE_ENABLED = true;
const TRUSTED_DEVICE_KEY = "vltd_mfa_trusted_device_v1";

function getStoredTrustedToken(userId: string): string | null {
  try {
    const raw = localStorage.getItem(TRUSTED_DEVICE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    return typeof map[userId] === "string" ? map[userId] : null;
  } catch {
    return null;
  }
}

function storeTrustedToken(userId: string, token: string) {
  try {
    const raw = localStorage.getItem(TRUSTED_DEVICE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[userId] = token;
    localStorage.setItem(TRUSTED_DEVICE_KEY, JSON.stringify(map));
  } catch {
    // Best-effort — worst case this device just gets asked again next time.
  }
}

function clearStoredTrustedToken(userId: string) {
  try {
    const raw = localStorage.getItem(TRUSTED_DEVICE_KEY);
    if (!raw) return;
    const map = JSON.parse(raw) as Record<string, string>;
    delete map[userId];
    localStorage.setItem(TRUSTED_DEVICE_KEY, JSON.stringify(map));
  } catch {
    // Not fatal — check_trusted_device will just keep saying no.
  }
}

export default function MfaChallengeGate() {
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);

  // 2026-09-14: reverted a same-day change here that tried to fix an
  // EK-reported "unwanted re-challenge on navigation" complaint by adding
  // a 400ms settle-and-recheck. That introduced a worse regression —
  // EK reported being unable to reach the 2FA modal AT ALL — almost
  // certainly a race: onAuthStateChange commonly fires more than one
  // event in quick succession on a single page load (e.g. INITIAL_SESSION
  // then TOKEN_REFRESHED), each starting its own overlapping checkAal()
  // call; with an artificial delay in the middle and no sequencing guard,
  // an OLDER call's late-arriving "no challenge needed" could clobber a
  // NEWER call's correct "show the modal" state.
  //
  // 2026-09-27: EK reported the opposite failure now — the modal
  // reopening after a successful verify, on plain navigation/refresh/token
  // refresh within the same already-verified session. Same root cause the
  // note above already named, just the other direction: TOKEN_REFRESHED
  // (and INITIAL_SESSION, USER_UPDATED, etc.) keep firing for the rest of
  // the tab's life, each starting a brand-new checkAal() call with no
  // memory that this session was already resolved, and a slow one
  // resolving after a fast one (or after verify() itself) can re-show the
  // modal. Fixed properly this time, the way the note above already
  // pointed at: a sequence counter so a superseded call's result is always
  // discarded, plus a resolvedRef so a session that's already been cleared
  // (no challenge needed, or successfully verified) is never re-derived
  // from scratch again — only a genuine SIGNED_IN/SIGNED_OUT transition
  // resets it.
  const resolvedRef = useRef(false);
  const checkSeqRef = useRef(0);

  async function checkAal() {
    if (resolvedRef.current) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const seq = ++checkSeqRef.current;
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (seq !== checkSeqRef.current) return; // a newer check (or verify()) already resolved this
    if (aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (seq !== checkSeqRef.current) return;

      // A device this account already trusted skips the challenge
      // entirely — checked server-side by hash, never trusted on the
      // client's say-so alone.
      if (TRUSTED_DEVICE_FEATURE_ENABLED && userId) {
        const storedToken = getStoredTrustedToken(userId);
        if (storedToken) {
          const { data: trusted } = await supabase.rpc("check_trusted_device", {
            p_token: storedToken,
          });
          if (seq !== checkSeqRef.current) return;
          if (trusted) {
            resolvedRef.current = true;
            setFactorId("");
            return;
          }
          // Expired, revoked, or never valid — stop sending it.
          clearStoredTrustedToken(userId);
        }
      }

      const { data: factors } = await supabase.auth.mfa.listFactors();
      if (seq !== checkSeqRef.current) return;
      const verified = factors?.totp?.find((f) => f.status === "verified");
      if (verified) {
        setFactorId(verified.id);
        return;
      }
    }
    resolvedRef.current = true;
    setFactorId("");
  }

  useEffect(() => {
    void checkAal();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        resolvedRef.current = false;
        checkSeqRef.current++; // discard any check still in flight from before sign-out
        setFactorId("");
        return;
      }
      if (event === "SIGNED_IN") {
        // A genuinely new login always gets a fresh look, even if this
        // tab had already resolved a previous session.
        resolvedRef.current = false;
      }
      // INITIAL_SESSION (page load with an existing session), SIGNED_IN
      // (any sign-in method), TOKEN_REFRESHED, and MFA_CHALLENGE_VERIFIED
      // all warrant a fresh look at the current assurance level — but
      // checkAal() itself now no-ops once resolvedRef is set, so none of
      // these can reopen an already-resolved session.
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

      if (TRUSTED_DEVICE_FEATURE_ENABLED && remember) {
        try {
          const { data: userData } = await supabase.auth.getUser();
          const userId = userData?.user?.id;
          if (userId) {
            const { data: token } = await supabase.rpc("trust_this_device", {
              p_label: null,
              p_days: 30,
            });
            if (typeof token === "string" && token) storeTrustedToken(userId, token);
          }
        } catch {
          // Best-effort — worse case is just being asked again next time,
          // not a reason to fail a verification that already succeeded.
        }
      }

      resolvedRef.current = true;
      checkSeqRef.current++; // discard any check still in flight
      setFactorId("");
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  async function signOutInstead() {
    // Multi-device fix (2026-09-22): local only, same reasoning as
    // src/lib/auth.ts's own signOut() — this is a stuck-at-the-2FA-prompt
    // escape hatch for THIS device, not a reason to log out every other
    // device the account is signed into.
    const supabase = getSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut({ scope: "local" });
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
            className="mt-4 w-full rounded-xl px-3 py-3 text-center text-2xl ring-1 ring-[color:var(--border)] focus:outline-none"
            style={{ background: "var(--pill)", color: "var(--fg)", letterSpacing: "0.4em" }}
          />

          {TRUSTED_DEVICE_FEATURE_ENABLED && (
            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              Remember this device for 30 days
            </label>
          )}

          <div className="mt-5 flex flex-col gap-2">
            <button
              type="submit"
              disabled={busy || code.length !== 6}
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
        </form>
      </div>
    </div>
  );
}
