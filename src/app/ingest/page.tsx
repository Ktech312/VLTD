"use client";

import Link from "next/link";

function PillLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex h-10 items-center rounded-full px-5 text-sm font-medium ring-1 transition no-underline",
        "bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-[color:var(--border)]",
        "hover:bg-[color:var(--pill-hover)]",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}

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
      className="block rounded-3xl bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] hover:bg-[color:var(--surface-strong)] transition"
    >
      <div className="text-xs tracking-widest text-[color:var(--muted2)]">INGEST</div>
      <div className="mt-2 text-xl font-semibold">{title}</div>
      <div className="mt-2 text-sm text-[color:var(--muted)]">{desc}</div>
      <div className="mt-4 inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold ring-1 transition bg-[color:var(--pill)] text-[color:var(--fg)] ring-[color:var(--pill-active-ring)] vltd-pill-main-glow hover:bg-[color:var(--pill-hover)]">
        {cta}
      </div>
    </Link>
  );
}

export default function IngestHubPage() {
  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs tracking-widest text-[color:var(--muted2)]">VLTD</div>
            <h1 className="mt-2 text-4xl font-semibold">Ingest</h1>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Get inventory in fast. Spreadsheet import is now the primary migration path.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PillLink href="/">Home</PillLink>
            <PillLink href="/vault">Open Museum</PillLink>
            <PillLink href="/portfolio">Portfolio</PillLink>
          </div>
        </div>

        <div className="mt-8 grid gap-3 md:grid-cols-3">
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
            href="/vault/capture"
            cta="Capture Item"
          />
        </div>
      </div>
    </main>
  );
}
