// What an item needs before it can go in an insurance packet, and which items "need review".
// One definition, used by the Vault's summary cards (the counts) AND by the list they open (the destination), so a number and
// the items behind it can never disagree.
//
// An item is INSURANCE READY when everything the insurance packet shows for it is actually there:
//   photo     at least one picture
//   value     a value someone entered or looked up (a purchase price standing in for a value does not count; the packet marks those *)
//   cost      a purchase price
//   identity  something that identifies it: grade, cert number, serial number, or a set / number
// An item that is missing any of these NEEDS REVIEW. Supplies (boxes, cases) are not counted either way.
import { insuranceValue } from "@/lib/vaultStats";
import { getPrimaryImageUrl, type VaultItem } from "@/lib/vaultModel";

export type ReviewGap = "photo" | "value" | "cost" | "identity";

export const REVIEW_GAP_LABEL: Record<ReviewGap, string> = {
  photo: "a photo",
  value: "a value",
  cost: "the purchase price",
  identity: "grade, cert or serial number, or set / number",
};

export const REVIEW_GAP_SHORT: Record<ReviewGap, string> = {
  photo: "Photo",
  value: "Value",
  cost: "Purchase price",
  identity: "Identifying detail",
};

export const REVIEW_GAPS: ReviewGap[] = ["photo", "value", "cost", "identity"];

function has(text: unknown) {
  return typeof text === "string" && text.trim() !== "";
}

/** The things this item is missing for an insurance packet (empty = nothing missing). */
export function reviewGaps(item: VaultItem): ReviewGap[] {
  const gaps: ReviewGap[] = [];
  const hasPhoto = Boolean(getPrimaryImageUrl(item)) || (Array.isArray(item.images) && item.images.length > 0);
  if (!hasPhoto) gaps.push("photo");
  const value = insuranceValue(item);
  if (!(value.amount > 0) || value.purchaseBased) gaps.push("value");
  if (!(Number(item.purchasePrice ?? 0) > 0)) gaps.push("cost");
  const identified = has(item.grade) || has(item.certNumber) || has(item.serialNumber) || has(item.number) || has(item.subtitle);
  if (!identified) gaps.push("identity");
  return gaps;
}

export function isInsuranceReady(item: VaultItem) {
  return reviewGaps(item).length === 0;
}

export type ReviewFilter = "all" | "insurance_ready" | "needs_review";

/** Does this item belong in the list a summary card opens? `gap` narrows "needs_review" to one missing thing. */
export function matchesReview(item: VaultItem, filter: ReviewFilter, gap: ReviewGap | null = null) {
  if (filter === "all") return true;
  const gaps = reviewGaps(item);
  if (filter === "insurance_ready") return gaps.length === 0;
  return gaps.length > 0 && (gap === null || gaps.includes(gap));
}

/** Counts for a set of (already supply-free) items: the numbers the cards show. */
export function reviewCounts(items: VaultItem[]) {
  const byGap: Record<ReviewGap, number> = { photo: 0, value: 0, cost: 0, identity: 0 };
  let ready = 0;
  for (const item of items) {
    const gaps = reviewGaps(item);
    if (gaps.length === 0) ready += 1;
    for (const gap of gaps) byGap[gap] += 1;
  }
  return { total: items.length, ready, needsReview: items.length - ready, byGap };
}
