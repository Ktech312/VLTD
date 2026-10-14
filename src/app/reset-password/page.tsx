"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// What kind of emailed link brought the visitor here, read from the URL before the auth client consumes and clears it.
// "invite" = an admin invitation (Supabase signs the person in with no password set yet), "recovery" = a password reset.
function readLinkKind(): "invite" | "recovery" | "other" | "none" {
  if (typeof window === "undefined") return "none";
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const type = hash.get("type") || query.get("type");
  if (type === "invite") return "invite";
  if (type === "recovery") return "recovery";
  if (hash.get("access_token") || query.get("code") || query.get("token_hash")) return "other";
  return "none";
}

import { consumeAuthLinkFromHash } from "@/lib/authLink";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  // The emailed link was refused or never produced a session (expired, or already used).
  const [linkProblem, setLinkProblem] = useState(false);
  // Read during the first client render, before any effect lets the auth client strip the link from the URL.
  const [linkKind] = useState(readLinkKind);

  // A reset link makes Supabase fire "PASSWORD_RECOVERY". An invitation link does NOT: it signs the person in
  // ("SIGNED_IN") with no password set, so waiting only for PASSWORD_RECOVERY left invited people on "Verifying link…" forever
  // and they could never log in. The auth client also processes the link (and clears it from the address bar) before this page
  // renders, so its event can fire before this page subscribes: the link marker above can be gone and the event missed.
  // The reliable signal is the session itself: if the link was good there is a session now, and the form can be shown
  // (updateUser needs that session anyway). No session means the link was bad or expired, and the "request a new one" text stays.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION"))) {
        setReady(true);
      }
    });
    // Links the app's server sends carry the session after "#", which this site's PKCE client rejects: start the session from
    // the link here (see src/lib/authLink.ts), then show the form.
    let cancelled = false;
    let gotSession = false;
    void (async () => {
      const link = await consumeAuthLinkFromHash();
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        gotSession = true;
        setReady(true);
      } else if (link.failed) {
        setLinkProblem(true);
      }
    })();
    // A link that was already used (or has expired) comes back with no session and no error in the address, so the page used to
    // sit on "Verifying link…" for ever. After a short wait with no session, say plainly that the link is no good.
    const giveUp = window.setTimeout(() => {
      if (!cancelled && !gotSession) setLinkProblem(true);
    }, 6000);

    return () => {
      cancelled = true;
      window.clearTimeout(giveUp);
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit() {
    if (!password || password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase not ready");

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setDone(true);
      setTimeout(() => router.replace("/login"), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update password.");
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

            {done ? (
              <>
                <div className="mt-8 text-[12px] font-semibold uppercase tracking-[0.32em] text-[color:var(--muted2)]">All set</div>
                <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] sm:text-4xl">Password updated</h1>
                <p className="mt-3 text-base text-[color:var(--muted)]">Redirecting you to login…</p>
              </>
            ) : !ready && linkProblem ? (
              <>
                <div className="mt-8 text-[12px] font-semibold uppercase tracking-[0.32em] text-[color:var(--muted2)]">Account recovery</div>
                <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] sm:text-4xl">This link has expired</h1>
                <p className="mt-3 text-base text-[color:var(--muted)]">
                  Emailed links work once and only for a short time, so it may have been used already. If you have already chosen a new password, just log in. Otherwise we can send you a new link.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link href="/forgot-password" className="vltd-primary-button inline-flex h-14 items-center justify-center rounded-full px-8 text-base font-black transition">
                    Send me a new link
                  </Link>
                  <Link href="/login" className="inline-flex h-14 items-center justify-center rounded-full px-6 text-base font-semibold text-[color:var(--muted)] transition hover:text-[color:var(--fg)]">
                    Log in
                  </Link>
                </div>
              </>
            ) : !ready ? (
              <>
                <div className="mt-8 text-[12px] font-semibold uppercase tracking-[0.32em] text-[color:var(--muted2)]">Account recovery</div>
                <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] sm:text-4xl">Verifying link…</h1>
                <p className="mt-3 text-base text-[color:var(--muted)]">
                  If this takes more than a few seconds, your reset link may have expired.{" "}
                  <Link href="/forgot-password" className="font-semibold text-[color:var(--fg)] underline underline-offset-4">Request a new one.</Link>
                </p>
              </>
            ) : (
              <>
                <div className="mt-8 text-[12px] font-semibold uppercase tracking-[0.32em] text-[color:var(--muted2)]">{linkKind === "invite" ? "Welcome to VLTD" : "Account recovery"}</div>
                <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] sm:text-4xl">{linkKind === "invite" ? "Set your password" : "Choose a new password"}</h1>

                {error ? <div className="mt-5 rounded-2xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}

                <div className="mt-8 grid gap-5">
                  <label className="block">
                    <span className="text-base font-medium text-[color:var(--muted)]">New password</span>
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      type="password"
                      autoComplete="new-password"
                      autoFocus
                      placeholder="At least 8 characters"
                      className="vltd-input mt-3 h-16 w-full rounded-[22px] px-6 text-lg"
                    />
                  </label>

                  <label className="block">
                    <span className="text-base font-medium text-[color:var(--muted)]">Confirm password</span>
                    <input
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void handleSubmit(); }}
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="vltd-input mt-3 h-16 w-full rounded-[22px] px-6 text-lg"
                    />
                  </label>
                </div>

                <div className="mt-7">
                  <button
                    type="button"
                    disabled={submitting || !password || !confirm}
                    onClick={() => void handleSubmit()}
                    className="vltd-primary-button inline-flex h-16 w-full items-center justify-center rounded-full px-6 text-base font-black transition disabled:translate-y-0 disabled:opacity-45"
                  >
                    {submitting ? "Updating..." : "Update password"}
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
