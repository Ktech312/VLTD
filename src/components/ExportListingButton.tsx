"use client";

import { useMemo, useState } from "react";

import {
  generateEbayListing,
  generateEtsyListing,
  generateIconaListing,
  itemToListingInput,
  type ListingOutput,
} from "@/lib/listingGenerator";
import type { VaultItem } from "@/lib/vaultModel";

type Platform = "ebay" | "etsy" | "icona";

const PLATFORM_LABEL: Record<Platform, string> = {
  ebay: "eBay",
  etsy: "Etsy",
  icona: "Icona",
};

function buildCopyText(listing: ListingOutput) {
  return [
    `Title: ${listing.title}`,
    `Platform: ${listing.platform}`,
    `Category: ${listing.category}`,
    `Price: ${listing.price > 0 ? `$${listing.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "Set manually"}`,
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

export default function ExportListingButton({ item }: { item: VaultItem }) {
  const [platform, setPlatform] = useState<Platform>("ebay");
  const [message, setMessage] = useState("");

  const input = useMemo(() => itemToListingInput(item), [item]);
  const listing = useMemo(() => {
    if (platform === "etsy") return generateEtsyListing(input);
    if (platform === "icona") return generateIconaListing(input);
    return generateEbayListing(input);
  }, [input, platform]);

  const copy = buildCopyText(listing);

  async function handleCopy() {
    try {
      await copyText(copy);
      setMessage(`${PLATFORM_LABEL[platform]} listing copied.`);
    } catch {
      setMessage("Copy failed. Select the text and copy manually.");
    }
  }

  return (
    <div className="rounded-[24px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted2)]">
            Listing Copy
          </div>
          <div className="mt-2 text-sm text-[color:var(--muted)]">
            Generate paste-ready marketplace text from this vault record.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PLATFORM_LABEL) as Platform[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setPlatform(option);
                setMessage("");
              }}
              className={[
                "rounded-full px-4 py-2 text-sm ring-1 transition",
                platform === option
                  ? "bg-[color:var(--pill-active-bg)] text-[color:var(--fg)] ring-[color:var(--pill-active-bg)]"
                  : "bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-[color:var(--border)]",
              ].join(" ")}
            >
              {PLATFORM_LABEL[option]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="rounded-2xl bg-[color:var(--pill)] p-4 ring-1 ring-[color:var(--border)]">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Title</div>
          <div className="mt-2 text-sm font-semibold">{listing.title}</div>
        </div>
        <textarea
          value={copy}
          readOnly
          className="min-h-[220px] rounded-2xl bg-[color:var(--pill)] p-4 text-sm leading-6 ring-1 ring-[color:var(--border)] focus:outline-none"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex h-10 items-center justify-center rounded-full bg-gold/15 px-4 text-sm font-medium text-cyan-100 ring-1 ring-gold/25"
        >
          Copy Listing
        </button>
        {message ? <div className="text-sm text-[color:var(--muted)]">{message}</div> : null}
      </div>
    </div>
  );
}
