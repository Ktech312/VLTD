"use client";

import Link from "next/link";

import CaptureCamera from "@/components/CaptureCamera";

export default function CapturePage() {
  return (
    <main className="min-h-screen px-4 py-6 text-[color:var(--fg)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <section
          className="relative overflow-hidden rounded-[34px] p-5 sm:p-7"
          style={{
            background: 'var(--theme-elevated, rgba(20,32,55,0.9))',
            border: '1px solid var(--theme-gold-border, rgba(245,181,72,0.25))',
            boxShadow: '0 26px 86px rgba(0,0,0,0.32)',
          }}
        >
          <div className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(circle at 20% 0%, var(--theme-gold-subtle, rgba(245,181,72,0.06)), transparent 30%)' }} />

          <div className="relative grid gap-7 lg:grid-cols-[1fr_360px] lg:items-center">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.34em] text-[color:var(--muted2)]">
                Smart Scan
              </div>
              <h1 className="mt-3 text-4xl font-black leading-[0.98] tracking-[-0.055em] text-text-primary sm:text-5xl">
                Add an item to your VLTD vault.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[color:var(--muted)]">
                Capture the item first. VLTD will use the image as the starting point for item identification, valuation, and record building.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-[color:var(--border)] bg-vault-card p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted2)]">1</div>
                  <div className="mt-2 text-sm font-black text-text-primary">Capture</div>
                  <div className="mt-1 text-xs leading-5 text-[color:var(--muted)]">Use camera or upload a photo.</div>
                </div>
                <div className="rounded-2xl border border-[color:var(--border)] bg-vault-card p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted2)]">2</div>
                  <div className="mt-2 text-sm font-black text-text-primary">Identify</div>
                  <div className="mt-1 text-xs leading-5 text-[color:var(--muted)]">Confirm title, category, and universe.</div>
                </div>
                <div className="rounded-2xl border border-[color:var(--border)] bg-vault-card p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted2)]">3</div>
                  <div className="mt-2 text-sm font-black text-text-primary">Vault</div>
                  <div className="mt-1 text-xs leading-5 text-[color:var(--muted)]">Save it with value and notes.</div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/vault/quick"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-[color:var(--border)] bg-vault-card px-5 text-sm font-semibold text-[color:var(--muted)] transition hover:text-text-primary"
                >
                  Quick Add instead
                </Link>
                <Link
                  href="/vault/add"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-[color:var(--border)] bg-vault-card px-5 text-sm font-semibold text-[color:var(--muted)] transition hover:text-text-primary"
                >
                  Manual Add
                </Link>
              </div>
            </div>

            <CaptureCamera />
          </div>
        </section>
      </div>
    </main>
  );
}
