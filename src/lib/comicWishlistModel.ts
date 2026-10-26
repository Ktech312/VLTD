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
import { enqueueVaultItemSync, processVaultSyncQueue, removeVaultItemFromSyncQueue } from "@/lib/vaultSyncQueue";
import { deleteVaultItemEverywhere } from "@/lib/vaultActions";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { VAULT_ITEMS_TABLE } from "@/lib/vaultCloud";
import { issueToRelease } from "@/lib/pullRules";
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

// The same release, described the same way Following describes it (title, date, series, cover, identity), so a want made here and one made by a rule are one entry.
function pickFor(issue: UpcomingIssue) {
  const release = issueToRelease(issue);
  return {
    source: SOURCE,
    externalId: release.externalId,
    title: release.title,
    imageUrl: release.imageUrl,
    releaseDate: release.date ?? undefined,
    universe: "POP_CULTURE",
    category: "Comics",
    subject: issue.publisher || undefined,
    series: issue.series,
    edition: release.edition,
    sourceIdentity: release.identity,
    sourceUrl: release.url,
  };
}

export function comicTitle(series: string, number: string) {
  return number ? `${series} #${number}` : series;
}

function isOwnedCatalogItem(item: VaultItem) {
  return item.addedVia === "catalog" && item.status !== "SOLD";
}

/**
 * The vault item already added from this issue (active profile), if any.
 * Matches the catalog tag, or (until vault_items.catalog_ref exists in the
 * database and survives a sync) an item added from the catalog with the same
 * title, so Own never adds a duplicate.
 */
export function findOwnedComic(issue: { id: number; series: string; number: string }): VaultItem | undefined {
  const ref = comicCatalogRef(issue.id);
  const title = comicTitle(issue.series, issue.number);
  // A copy received through the Wishlist (Acquired) carries the same tag, so it counts as owned here too. Older ones are found through the record of Vault ids kept on their want.
  const byTag = loadItems().find((item) => item.status !== "SOLD" && item.catalogRef === ref);
  if (byTag) return byTag;
  const ids = new Set(findCatalogWish(SOURCE, String(issue.id))?.acquiredItemIds ?? []);
  const viaWant = ids.size ? loadItems().find((item) => item.status !== "SOLD" && ids.has(String(item.id))) : undefined;
  if (viaWant) return viaWant;
  return loadItems().find((item) => isOwnedCatalogItem(item) && !item.catalogRef && item.title === title);
}

/** Titles of comics added from the catalog without a surviving catalog tag (see findOwnedComic). */
export function loadOwnedCatalogTitles(): Set<string> {
  return new Set(loadItems().filter((item) => isOwnedCatalogItem(item) && !item.catalogRef).map((item) => item.title));
}

/** metron id -> status, from the local copies of the wishlist and vault. */
export function loadComicStatuses(): Map<number, ComicStatus> {
  const map = new Map<number, ComicStatus>();
  for (const w of loadWishlist()) {
    if (w.source !== SOURCE || !w.externalId) continue;
    if (w.status === "skipped") continue; // a skipped release is not lit as Want (the record stays so Following never adds it again)
    map.set(Number(w.externalId), w.status === "preordered" ? "preordered" : w.status === "acquired" ? "own" : "want");
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
  const owned = findOwnedComic(issue);
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

  // appendItems keeps only covers that are in the photo list, so the stock
  // cover goes in as a linked (not uploaded) primary photo, same shape as the
  // vault's other linked photos.
  const coverUrl = item.imageFrontUrl;
  if (coverUrl) {
    item.images = [{ id: "catalog-cover", storageKey: coverUrl, url: coverUrl, order: 0, localOnly: false, role: "primary" }];
    item.primaryImageKey = coverUrl;
  }

  const wish = findCatalogWish(SOURCE, String(issue.id));
  const previousWish = wish?.status ?? (wish ? "want" : null);

  appendItems([item]);
  enqueueVaultItemSync(item.id);
  emitVaultUpdate();
  if (wish) removeWishlistItem(wish.id);
  // Upload before offering Undo, so Undo deletes a row that's really there.
  await processVaultSyncQueue();

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

async function cloudHasItem(itemId: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const { data, error } = await supabase.from(VAULT_ITEMS_TABLE).select("id").eq("id", itemId).limit(1);
  return !error && Array.isArray(data) && data.length > 0;
}

/**
 * Undo an Own: remove the added item and put the wishlist status back.
 * An upload already in flight (another sync run) can land after the delete
 * and bring the row back, so the cloud is re-checked and the delete repeated.
 */
export async function undoOwnComic(issue: UpcomingIssue, itemId: string, previousWish: WishStatus | null): Promise<boolean> {
  removeVaultItemFromSyncQueue(itemId);
  let res = await deleteVaultItemEverywhere(itemId);
  for (let attempt = 0; attempt < 3; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    if (!(await cloudHasItem(itemId))) break;
    res = await deleteVaultItemEverywhere(itemId);
  }
  const gone = !(await cloudHasItem(itemId));
  if (gone && previousWish) await setComicWish(issue, previousWish);
  return res.ok && gone;
}
