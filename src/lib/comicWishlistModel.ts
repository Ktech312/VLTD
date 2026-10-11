"use client";

// Upcoming Comics: Want / Ordered / Own for one issue.
//
// Want and Pre-ordered live on the profile's account wishlist (wishlistModel,
// source "metron"), so they show on the Watchlist > Wishlist tab and on the
// shared wishlist link. Own adds the issue to the vault with its stock cover
// and details (addedVia "catalog", catalogRef "metron:<id>"). The older
// per-login comic_wishlist table is no longer read; its rows were copied into
// the wishlist by 20261011_wishlist_comics_and_sharing.sql.

import type { UpcomingIssue } from "@/app/api/comic-upcoming/route";
import type { MetronIssueResult } from "@/app/api/comic-lookup/route";
import { getStoredActiveProfileId } from "@/lib/auth";
import { appendItems, loadItems, type VaultItem } from "@/lib/vaultModel";
import { emitVaultUpdate } from "@/lib/vaultEvents";
import { enqueueVaultItemSync, processVaultSyncQueue } from "@/lib/vaultSyncQueue";
import { deleteVaultItemEverywhere } from "@/lib/vaultActions";
import {
  findCatalogWish,
  loadWishlist,
  removeWishlistItem,
  setCatalogWish,
  syncWishlistFromSupabase,
  type WishStatus,
} from "@/lib/wishlistModel";

export type ComicStatus = "want" | "preordered" | "own";

export const COMIC_STATUS_LABEL: Record<ComicStatus, string> = {
  want: "Want",
  preordered: "Pre-ordered",
  own: "Own",
};

const SOURCE = "metron";

export function comicCatalogRef(metronId: number | string) {
  return `${SOURCE}:${metronId}`;
}

function pickFor(issue: UpcomingIssue) {
  return {
    source: SOURCE,
    externalId: String(issue.id),
    title: `${issue.series} #${issue.number}`.trim(),
    imageUrl: issue.imageUrl ?? undefined,
    releaseDate: issue.storeDate ?? undefined,
    universe: "POP_CULTURE",
    category: "Comics",
    subject: issue.publisher || undefined,
  };
}

/** The vault item already added from this issue (active profile), if any. */
export function findOwnedComic(metronId: number | string): VaultItem | undefined {
  const ref = comicCatalogRef(metronId);
  return loadItems().find((item) => item.catalogRef === ref && item.status !== "SOLD");
}

/** metron id -> status, from the local copies of the wishlist and vault. */
export function loadComicStatuses(): Map<number, ComicStatus> {
  const map = new Map<number, ComicStatus>();
  for (const w of loadWishlist()) {
    if (w.source !== SOURCE || !w.externalId) continue;
    map.set(Number(w.externalId), w.status === "preordered" ? "preordered" : "want");
  }
  for (const item of loadItems()) {
    const m = item.catalogRef?.match(/^metron:(\d+)$/);
    if (m && item.status !== "SOLD") map.set(Number(m[1]), "own");
  }
  return map;
}

/** Pull the latest wishlist from the account, then read statuses. */
export async function refreshComicStatuses(): Promise<Map<number, ComicStatus>> {
  await syncWishlistFromSupabase();
  return loadComicStatuses();
}

/** Want / Pre-ordered / off. Returns false if it couldn't reach the account. */
export async function setComicWish(issue: UpcomingIssue, status: WishStatus | null): Promise<boolean> {
  return setCatalogWish(pickFor(issue), status);
}

async function fetchIssueDetail(metronId: number): Promise<MetronIssueResult | null> {
  try {
    const res = await fetch(`/api/comic-lookup?id=${metronId}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: MetronIssueResult | null };
    return data.result ?? null;
  } catch {
    return null;
  }
}

/**
 * Own: add the issue to the vault with its stock cover and details.
 * Price paid = cover price when the catalog has one (editable later); value is
 * left empty, so totals show it at purchase price until it's priced.
 * Takes it off the wishlist. Returns what Undo needs.
 */
export async function ownComic(
  issue: UpcomingIssue
): Promise<{ ok: true; item: VaultItem; previousWish: WishStatus | null; alreadyOwned: boolean } | { ok: false; error: string }> {
  const owned = findOwnedComic(issue.id);
  if (owned) return { ok: true, item: owned, previousWish: null, alreadyOwned: true };

  const detail = await fetchIssueDetail(issue.id);
  const coverPrice = Number(detail?.price ?? "");
  const now = Date.now();
  const series = detail?.series || issue.series;
  const number = detail?.number || issue.number;
  const item: VaultItem = {
    id: `vault_${now}_${Math.random().toString(36).slice(2, 8)}`,
    profile_id: getStoredActiveProfileId() || undefined,
    title: number ? `${series} #${number}` : series,
    universe: "POP_CULTURE",
    category: "COMICS",
    categoryLabel: "Comics",
    subcategoryLabel: "Comic Book",
    brand: detail?.publisher || issue.publisher || undefined,
    comicPublisher: detail?.publisher || issue.publisher || undefined,
    comicIssueNumber: number || undefined,
    comicCoverDate: detail?.coverDate ?? issue.coverDate ?? undefined,
    notes: detail?.description ?? undefined,
    // Stock cover from the catalog, linked (not copied), like other linked photos.
    imageFrontUrl: detail?.imageUrl ?? issue.imageUrl ?? undefined,
    purchasePrice: Number.isFinite(coverPrice) && coverPrice > 0 ? coverPrice : undefined,
    status: "COLLECTION",
    createdAt: now,
    isNew: true,
    addedVia: "catalog",
    catalogRef: comicCatalogRef(issue.id),
  };

  const wish = findCatalogWish(SOURCE, String(issue.id));
  const previousWish = wish?.status ?? (wish ? "want" : null);

  appendItems([item]);
  enqueueVaultItemSync(item.id);
  emitVaultUpdate();
  if (wish) removeWishlistItem(wish.id);
  void processVaultSyncQueue();

  return { ok: true, item, previousWish, alreadyOwned: false };
}

/** Own straight from a saved wishlist entry (Watchlist "+ Add to Vault"). */
export async function ownComicFromWish(wish: { externalId?: string; title: string; imageUrl?: string; releaseDate?: string; subject?: string }) {
  if (!wish.externalId) return { ok: false as const, error: "Not a catalog comic." };
  const issue: UpcomingIssue = {
    id: Number(wish.externalId),
    series: wish.title,
    number: "",
    publisher: wish.subject ?? "",
    storeDate: wish.releaseDate ?? null,
    coverDate: null,
    imageUrl: wish.imageUrl ?? null,
  };
  return ownComic(issue);
}

/** Undo an Own: remove the added item and put the wishlist status back. */
export async function undoOwnComic(issue: UpcomingIssue, itemId: string, previousWish: WishStatus | null) {
  await deleteVaultItemEverywhere(itemId);
  if (previousWish) await setComicWish(issue, previousWish);
}
