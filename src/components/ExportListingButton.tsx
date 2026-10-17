"use client";

import { PillButton } from "@/components/ui/PillButton";
import { useMemo, useState } from "react";

import {
  generateDiscogsListing,
  generateEbayListing,
  generateEtsyListing,
  generateFacebookListing,
  generateIconaListing,
  generateMercariListing,
  generatePwccListing,
  generateWhatnotListing,
  itemToListingInput,
  type ListingOutput,
} from "@/lib/listingGenerator";
import type { VaultItem } from "@/lib/vaultModel";
import { discogsFits, fanaticsCollectFits } from "@/lib/marketplaces";
import { resolveCategoryLabel } from "@/lib/taxonomy";

type Platform = "ebay" | "mercari" | "facebook" | "etsy" | "whatnot" | "discogs" | "pwcc" | "icona";

const PLATFORM_LABEL: Record<Platform, string> = {
  ebay: "eBay",
  mercari: "Mercari",
  facebook: "Facebook",
  etsy: "Etsy",
  whatnot: "Whatnot",
  discogs: "Discogs",
  pwcc: "Fanatics Collect",
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

  // Discogs and Fanatics Collect only take certain categories (see lib/marketplaces.ts); the rest are offered for everything.
  const platforms = useMemo(() => {
    const place = { universe: item.universe, category: resolveCategoryLabel(item), subcategory: item.subcategoryLabel };
    return (Object.keys(PLATFORM_LABEL) as Platform[]).filter((id) => (id === "discogs" ? discogsFits(place) : id === "pwcc" ? fanaticsCollectFits(place) : true));
  }, [item]);
  const activePlatform: Platform = platforms.includes(platform) ? platform : "ebay";

  const input = useMemo(() => itemToListingInput(item), [item]);
  const listing = useMemo(() => {
    if (activePlatform === "mercari") return generateMercariListing(input);
    if (activePlatform === "facebook") return generateFacebookListing(input);
    if (activePlatform === "etsy") return generateEtsyListing(input);
    if (activePlatform === "whatnot") return generateWhatnotListing(input);
    if (activePlatform === "discogs") return generateDiscogsListing(input);
    if (activePlatform === "pwcc") return generatePwccListing(input);
    if (activePlatform === "icona") return generateIconaListing(input);
    return generateEbayListing(input);
  }, [input, activePlatform]);

  const copy = buildCopyText(listing);

  async function handleCopy() {
    try {
      await copyText(copy);
      setMessage(`${PLATFORM_LABEL[activePlatform]} listing copied.`);
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
            Paste-ready text for each marketplace, written from this record. Copy it and paste it into the marketplace yourself; nothing is listed or posted for you.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {platforms.map((option) => (
            <PillButton key={option} variant={activePlatform === option ? "active" : "default"} pressed={activePlatform === option} onClick={() => { setPlatform(option); setMessage(""); }}>{PLATFORM_LABEL[option]}</PillButton>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {listing.checklist.length > 0 || listing.warnings.length > 0 ? (
          <div className="rounded-2xl bg-[color:var(--pill)] p-4 ring-1 ring-[color:var(--border)]">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">Listing Readiness</div>
            <div className="mt-2 grid gap-2 text-sm text-[color:var(--muted)]">
              {listing.checklist.length > 0 ? (
                <div>
                  Missing: <span className="text-amber-300">{listing.checklist.join(", ")}</span>
                </div>
              ) : null}
              {listing.warnings.length > 0 ? (
                <div>{listing.warnings.join(" ")}</div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-emerald-950/40 p-4 text-sm text-emerald-100 ring-1 ring-emerald-400/20">
            Listing has the core fields needed for copy export.
          </div>
        )}
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
        <PillButton variant="active" onClick={() => void handleCopy()}>Copy Listing</PillButton>
        {message ? <div className="text-sm text-[color:var(--muted)]">{message}</div> : null}
      </div>
    </div>
  );
}
