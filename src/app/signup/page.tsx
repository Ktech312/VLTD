"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signUpWithPassword } from "@/lib/auth";

type LaunchAccessStatus = {
  capacity: number;
  claimed: number;
  remaining: number;
  isOpen: boolean;
};

export default function SignupPage() {
  const router = useRouter();
  const [status, setStatus] = useState<LaunchAccessStatus | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function loadStatus() {
    try {
      const response = await fetch("/api/launch-access", { cache: "no-store" });
      if (response.ok) setStatus((await response.json()) as LaunchAccessStatus);
    } catch {
      // The database trigger remains the authoritative final check if the
      // public aggregate endpoint is briefly unavailable.
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function handleSignup(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (status?.isOpen === false) {
      setError("All 50 founding spots have been claimed.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const data = await signUpWithPassword(email.trim(), password);
      await loadStatus();
      if (data.session) {
        router.replace("/onboarding");
        router.refresh();
      } else {
        setConfirmationSent(true);
      }
    } catch (err) {
      await loadStatus();
      const message = err instanceof Error ? err.message : "Account creation failed.";
      if (/50 of 50|founding access is full|database error saving new user/i.test(message)) {
        setError("All 50 founding spots have been claimed. Join the waitlist for the next opening.");
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const isFull = status?.isOpen === false;

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

            <div className="mt-8 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: "#C8CDD2", borderColor: "rgba(203,208,213,0.32)", background: "rgba(203,208,213,0.07)" }}>
              Founding Access
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-[-0.04em] sm:text-4xl">
              {isFull ? "The first 50 spots are claimed." : "Create your free collector account."}
            </h1>

            {status ? (
              <div className="mt-5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold">Founding collectors</span>
                  <span className="font-black text-[color:var(--accent)]">{status.claimed}/{status.capacity}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[color:var(--pill)]" role="progressbar" aria-label="Founding collector spots claimed" aria-valuemin={0} aria-valuemax={status.capacity} aria-valuenow={status.claimed}>
                  <div className="h-full rounded-full bg-[color:var(--accent)]" style={{ width: `${Math.min(100, (status.claimed / status.capacity) * 100)}%` }} />
                </div>
                <p className="mt-2 text-xs text-[color:var(--muted)]">{status.remaining} free spot{status.remaining === 1 ? "" : "s"} remaining. Existing real accounts are included.</p>
              </div>
            ) : null}

            {isFull ? (
              <div className="mt-7">
                <p className="text-base leading-7 text-[color:var(--muted)]">Join the waitlist and we’ll contact you when another group opens.</p>
                <Link href="/#early-access" className="vltd-primary-button mt-5 inline-flex h-14 w-full items-center justify-center rounded-full px-6 text-base font-black">
                  Join the waitlist →
                </Link>
              </div>
            ) : confirmationSent ? (
              <div className="mt-7 rounded-2xl border border-green-400/35 bg-green-500/10 px-5 py-4 text-sm leading-6 text-green-200">
                Check your email to confirm your account. Your founding spot has been reserved.
              </div>
            ) : (
              <form onSubmit={handleSignup} className="mt-7 grid gap-5">
                {error ? <div className="rounded-2xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div> : null}
                <label className="block">
                  <span className="text-base font-medium text-[color:var(--muted)]">Email</span>
                  <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required placeholder="you@example.com" className="vltd-input mt-3 h-16 w-full rounded-[22px] px-6 text-lg" />
                </label>
                <label className="block">
                  <span className="text-base font-medium text-[color:var(--muted)]">Password</span>
                  <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="new-password" required minLength={8} placeholder="At least 8 characters" className="vltd-input mt-3 h-16 w-full rounded-[22px] px-6 text-lg" />
                </label>
                <label className="block">
                  <span className="text-base font-medium text-[color:var(--muted)]">Confirm password</span>
                  <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" autoComplete="new-password" required minLength={8} placeholder="Repeat your password" className="vltd-input mt-3 h-16 w-full rounded-[22px] px-6 text-lg" />
                </label>
                <button type="submit" disabled={submitting} className="vltd-primary-button mt-1 inline-flex h-16 items-center justify-center rounded-full px-6 text-base font-black transition disabled:opacity-50">
                  {submitting ? "Creating account…" : "Claim free account"}
                </button>
              </form>
            )}

            <div className="mt-7 text-center text-base text-[color:var(--muted2)]">
              Already have a VLTD account? <Link href="/login" className="font-semibold text-[color:var(--fg)] underline underline-offset-4">Log in</Link>
            </div>
          </div>
        </div>

        <p className="pb-2 text-center text-sm italic text-[color:var(--muted2)]">VLTD — pronounced &quot;Vaulted&quot;</p>
      </div>
    </main>
  );
}
