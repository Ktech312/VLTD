"use client";

import Link from "next/link";
import { PillButton } from "@/components/ui/PillButton";

export default function SecurityPage() {
  const rows = [
    "Password and recovery options",
    "Device sessions",
    "Two-factor authentication placeholder",
    "Business workspace login policy placeholder",
    "Employee access review placeholder",
  ];

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link href="/account"><PillButton>Account Center</PillButton></Link>
          <Link href="/account/security"><PillButton variant="active">Security</PillButton></Link>
          <Link href="/account/billing"><PillButton>Billing</PillButton></Link>
        </div>
        <section className="vltd-panel-main rounded-[30px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="text-[11px] tracking-[0.24em] text-[color:var(--muted2)]">SECURITY</div>
          <h1 className="mt-3 text-3xl font-semibold">Account and workspace security</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--muted)]">This page is a placeholder shell for future login protection, device review, employee access audits, and workspace-specific security controls.</p>
          <div className="mt-6 grid gap-3">
            {rows.map((row) => <div key={row} className="vltd-panel-soft rounded-2xl bg-[color:var(--input)] px-4 py-3 ring-1 ring-[color:var(--border)] text-sm text-[color:var(--fg)]">{row}</div>)}
          </div>
        </section>
      </div>
    </main>
  );
}
