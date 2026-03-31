"use client";

import Link from "next/link";
import { PillButton } from "@/components/ui/PillButton";

export default function BillingPage() {
  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link href="/account"><PillButton>Account Center</PillButton></Link>
          <Link href="/account/billing"><PillButton variant="active">Billing</PillButton></Link>
          <Link href="/account/security"><PillButton>Security</PillButton></Link>
        </div>
        <section className="vltd-panel-main rounded-[30px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="text-[11px] tracking-[0.24em] text-[color:var(--muted2)]">BILLING</div>
          <h1 className="mt-3 text-3xl font-semibold">Billing placeholder</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--muted)]">Future business billing, invoicing, subscription controls, and add-on management will live here. Personal workspaces can ignore this section entirely.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="vltd-panel-soft rounded-2xl bg-[color:var(--input)] p-5 ring-1 ring-[color:var(--border)]"><div className="text-sm font-semibold">Current Plan</div><div className="mt-2 text-sm text-[color:var(--muted)]">Placeholder for workspace billing plan.</div></div>
            <div className="vltd-panel-soft rounded-2xl bg-[color:var(--input)] p-5 ring-1 ring-[color:var(--border)]"><div className="text-sm font-semibold">Invoices</div><div className="mt-2 text-sm text-[color:var(--muted)]">Placeholder for future invoice history.</div></div>
          </div>
        </section>
      </div>
    </main>
  );
}
