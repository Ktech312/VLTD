"use client";

import Link from "next/link";

// VLTD is invite-only during private beta. Public account creation is disabled;
// people request access on the waitlist and receive an emailed invite link.
// (For hard enforcement, also toggle "Disable signups" in Supabase Auth — see HANDOFF.md.)
export default function SignupPage() {
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
              Private Beta
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-[-0.04em]">VLTD is invite-only.</h1>
            <p className="mt-3 text-base text-[color:var(--muted)]">
              We&apos;re in private beta and opening access in small waves. Join the early-access list and we&apos;ll
              email your invite when your spot is ready.
            </p>

            <div className="mt-8 flex flex-col gap-4">
              <Link
                href="/#early-access"
                className="vltd-primary-button inline-flex h-16 items-center justify-center rounded-full px-6 text-base font-black transition"
              >
                Request early access →
              </Link>
            </div>

            <div className="mt-7 rounded-2xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] px-4 py-3 text-sm text-[color:var(--muted)]">
              <span className="font-semibold text-text-primary">Already invited?</span> Check your email for your
              VLTD invite link — it&apos;ll get you in and let you set a password.
            </div>

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
