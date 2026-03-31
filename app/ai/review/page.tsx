"use client";

import Link from "next/link";
import { PillButton } from "@/components/ui/PillButton";

export default function AIReviewPage() {
  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link href="/account"><PillButton>Account Center</PillButton></Link>
          <Link href="/ai/drafts"><PillButton>AI Draft Queue</PillButton></Link>
          <Link href="/ai/review"><PillButton variant="active">AI Review Queue</PillButton></Link>
        </div>
        <section className="vltd-panel-main rounded-[30px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="text-[11px] tracking-[0.24em] text-[color:var(--muted2)]">AI REVIEW</div>
          <h1 className="mt-3 text-3xl font-semibold">Human review before vault save</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--muted)]">The AI assistant should create drafts, not final records. This placeholder page is where owners or approved staff will review extracted fields, confidence, alternates, and missing metadata before converting a draft into a vault item.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="vltd-panel-soft rounded-2xl bg-[color:var(--input)] p-5 ring-1 ring-[color:var(--border)]">
              <div className="text-sm font-semibold">Review Actions</div>
              <div className="mt-3 text-sm text-[color:var(--muted)]">Approve, edit and approve, reject, or request more images.</div>
            </div>
            <div className="vltd-panel-soft rounded-2xl bg-[color:var(--input)] p-5 ring-1 ring-[color:var(--border)]">
              <div className="text-sm font-semibold">Permission Gate</div>
              <div className="mt-3 text-sm text-[color:var(--muted)]">Inventory managers can draft. Owners and admins can approve. Viewers cannot access AI confidence or queues.</div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
