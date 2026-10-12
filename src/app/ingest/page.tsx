"use client";

import Link from "next/link";

import { PageHeader } from "@/components/layout/PageHeader";
import { PillButton, pillClassName } from "@/components/ui/PillButton";

// Compatibility entry for the old Ingest hub: it is still linked from older bookmarks and the text-import page, so it stays,
// now named for what people do here (add items) and built from the shared header and controls.
function Card({
  title,
  desc,
  href,
  cta,
}: {
  title: string;
  desc: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-3xl bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] transition hover:bg-[color:var(--surface-strong)]"
    >
      <div className="text-xl font-semibold">{title}</div>
      <div className="mt-2 text-sm text-[color:var(--muted)]">{desc}</div>
      <div className={pillClassName("active", false, "mt-4")}>{cta}</div>
    </Link>
  );
}

export default function AddItemsHubPage() {
  return (
    <main className="text-[color:var(--fg)]">
      <PageHeader
        title="Add items"
        description="Get inventory in fast. Spreadsheet import is the primary migration path."
        actions={
          <>
            <PillButton href="/dashboard">Home</PillButton>
            <PillButton href="/vault">Vault</PillButton>
            <PillButton href="/museum">Exhibitions</PillButton>
            <PillButton href="/portfolio">Insights</PillButton>
          </>
        }
      />
      <div className="mx-auto max-w-6xl px-5 pb-10">
        <div className="grid gap-3 md:grid-cols-3">
          <Card
            title="Quick Add"
            desc="One-step, phone-first entry. Start with image if you want it. Save with minimal fields."
            href="/vault/quick"
            cta="Start Quick Add"
          />
          <Card
            title="Spreadsheet Import"
            desc="Upload Excel or CSV, paste Google Sheet rows, or download the blank VLTD workbook."
            href="/vault/import"
            cta="Open Import"
          />
          <Card
            title="Capture"
            desc="Guided image-first item creation for slower, more detailed entry."
            href="/capture"
            cta="Capture Item"
          />
        </div>
      </div>
    </main>
  );
}
