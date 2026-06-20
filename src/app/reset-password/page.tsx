"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  // Supabase sends the recovery token as a hash fragment.
  // onAuthStateChange fires with event "PASSWORD_RECOVERY" once it's exchanged.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
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
    <main className="min-h-screen px-4 py-8 text-[color:var(--fg)] sm:px-6 sm:py-10">
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
                <div className="mt-8 text-[12px] font-semibold uppercase tracking-[0.32em] text-[color:var(--muted2)]">Account recovery</div>
                <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] sm:text-4xl">Choose a new password</h1>

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
