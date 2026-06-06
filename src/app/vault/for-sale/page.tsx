"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  generateEbayListing,
  itemToListingInput,
  type ListingOutput,
} from "@/lib/listingGenerator";
import { getPrimaryImageUrl, loadItems, type VaultItem } from "@/lib/vaultModel";

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function itemPrice(item: VaultItem) {
  return Number(item.askingPrice ?? item.currentValue ?? item.valueMedian ?? item.estimatedValue ?? 0);
}

function listingText(listing: ListingOutput) {
  return [
    `Title: ${listing.title}`,
    `Platform: ${listing.platform}`,
    `Category: ${listing.category}`,
    `Price: ${listing.price > 0 ? money(listing.price) : "Set manually"}`,
    "",
    listing.description,
    "",
    `Social caption: ${listing.socialCaption}`,
  ].join("\n");
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function StatCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-2xl bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {helper ? <div className="mt-1 text-xs text-[color:var(--muted)]">{helper}</div> : null}
    </div>
  );
}

function ListingRow({ item }: { item: VaultItem }) {
  const listing = generateEbayListing(itemToListingInput(item));
  const imageUrl = getPrimaryImageUrl(item);
  const issueCount = listing.checklist.length + listing.warnings.length;

  return (
    <Link
      href={`/vault/item/${encodeURIComponent(item.id)}`}
      className="block rounded-2xl bg-[color:var(--pill)] p-3 ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]"
    >
      <div className="flex gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-black/20">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt={item.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-[color:var(--muted)]">No photo</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{item.title}</div>
              <div className="mt-1 line-clamp-1 text-xs text-[color:var(--muted)]">{listing.title}</div>
            </div>
            <div className="shrink-0 text-right text-xs">
              <div className="font-semibold text-[color:var(--fg)]">{money(itemPrice(item))}</div>
              <div className={issueCount > 0 ? "mt-1 text-amber-300" : "mt-1 text-emerald-300"}>
                {issueCount > 0 ? `${issueCount} issue${issueCount === 1 ? "" : "s"}` : "Ready"}
              </div>
            </div>
          </div>
          {issueCount > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[...listing.checklist, ...listing.warnings].slice(0, 3).map((issue) => (
                <span key={issue} className="rounded-full bg-[color:var(--surface)] px-2 py-1 text-[10px] text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
                  {issue}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export default function ForSalePage() {
  const [items] = useState<VaultItem[]>(() => loadItems().filter((item) => item.status === "FOR_SALE"));
  const [status, setStatus] = useState("");

  const report = useMemo(() => {
    const listings = items.map((item) => ({
      item,
      listing: generateEbayListing(itemToListingInput(item)),
    }));
    const ready = listings.filter(({ listing }) => listing.checklist.length === 0 && listing.warnings.length === 0);
    const totalAsk = items.reduce((sum, item) => sum + itemPrice(item), 0);
    const missingPrice = listings.filter(({ listing }) => listing.checklist.includes("Asking price or current value"));
    const missingCondition = listings.filter(({ listing }) => listing.warnings.some((warning) => warning.includes("Condition")));

    return { listings, ready, totalAsk, missingPrice, missingCondition };
  }, [items]);

  async function handleCopyAll() {
    if (report.listings.length === 0) {
      setStatus("No for-sale listings to copy.");
      return;
    }

    const text = report.listings
      .map(({ item, listing }, index) => [`#${index + 1} - ${item.title}`, listingText(listing)].join("\n"))
      .join("\n\n---\n\n");

    try {
      await copyText(text);
      setStatus(`Copied ${report.listings.length} eBay listing draft${report.listings.length === 1 ? "" : "s"}.`);
    } catch {
      setStatus("Copy failed. Open each item to copy manually.");
    }
  }

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted2)]">For Sale</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Listing prep</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--muted)]">
              Review every item marked for sale, catch missing listing fields, and copy a batch of marketplace drafts.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleCopyAll()}
              className="rounded-full bg-[color:var(--pill-active-bg)] px-4 py-2 text-sm font-semibold ring-1 ring-[color:var(--pill-active-bg)]"
            >
              Copy eBay drafts
            </button>
            <Link href="/vault" className="rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm ring-1 ring-[color:var(--border)]">
              Vault
            </Link>
          </div>
        </div>

        {status ? (
          <div className="mt-4 rounded-2xl bg-[color:var(--pill)] px-4 py-3 text-sm ring-1 ring-[color:var(--border)]">
            {status}
          </div>
        ) : null}

        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="For Sale Items" value={String(items.length)} helper="Marked FOR_SALE" />
          <StatCard label="Ready" value={String(report.ready.length)} helper="No readiness warnings" />
          <StatCard label="Asking Total" value={money(report.totalAsk)} helper="Based on asking/current value" />
          <StatCard label="Needs Work" value={String(items.length - report.ready.length)} helper={`${report.missingPrice.length} price / ${report.missingCondition.length} condition`} />
        </section>

        <section className="mt-6 rounded-[24px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Items</div>
              <div className="mt-1 text-sm text-[color:var(--muted)]">Open an item to edit asking price, condition, photos, or listing copy.</div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {items.map((item) => (
              <ListingRow key={item.id} item={item} />
            ))}
            {items.length === 0 ? (
              <div className="rounded-2xl bg-[color:var(--pill)] p-4 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
                No items are marked for sale yet.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
