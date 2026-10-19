// What an item needs before it can go in an insurance packet, and which items "need review".
// One definition, used by the Vault's summary cards (the counts) AND by the list they open (the destination), so a number and
// the items behind it can never disagree.
//
// An item has its DOCUMENTATION COMPLETE (internally still called insurance ready) when everything the insurance packet shows for it is actually there:
//   photo     at least one picture
//   value     a value someone entered or looked up (a purchase price standing in for a value does not count; the packet marks those *)
//   cost      a purchase price above $0 (not recorded, and recorded as $0, are flagged separately: a recorded $0 is not "missing")
//   identity  something that identifies it: grade, cert number, serial number, or a set / number
// An item that is missing any of these NEEDS REVIEW. Supplies (boxes, cases) are not counted either way.
import { valueBasis } from "@/lib/vaultStats";
import { getPrimaryImageUrl, type VaultItem } from "@/lib/vaultModel";

/** The four things on the checklist. */
export type ChecklistItem = "photo" | "value" | "cost" | "identity";
/**
 * What an item can be flagged with. The checklist asks for a purchase price ABOVE $0, but "not recorded" and "recorded as $0" are different
 * facts, so they are flagged separately: "cost" = no purchase price recorded; "cost_zero" = a purchase price of $0 was recorded.
 */
export type ReviewGap = ChecklistItem | "cost_zero";

export const REVIEW_GAP_LABEL: Record<ReviewGap, string> = {
  photo: "a photo",
  value: "a valuation",
  cost: "a purchase price",
  cost_zero: "a purchase price above $0",
  identity: "grade, cert or serial number, or set / number",
};

export const REVIEW_GAP_SHORT: Record<ReviewGap, string> = {
  photo: "Photo",
  value: "Valuation",
  cost: "Purchase price",
  cost_zero: "Purchase price above $0",
  identity: "Identifying detail",
};

/** The full text of each filter button. A cost recorded as $0 is never called missing: it is recorded, it just is not above zero. */
export const REVIEW_GAP_PILL: Record<ReviewGap, string> = {
  photo: "Missing photo",
  value: "Needs valuation",
  cost: "Purchase price not recorded",
  cost_zero: "Purchase price recorded as $0",
  identity: "Missing identifying detail",
};

/** How an item's own card names what is wrong with it ("Missing: ..."). */
export const REVIEW_GAP_ROW: Record<ReviewGap, string> = {
  photo: "photo",
  value: "valuation",
  cost: "purchase price",
  cost_zero: "purchase price above $0 (recorded as $0)",
  identity: "identifying detail",
};

/** The heading of a filtered list, after "Needs review: N items". */
export const REVIEW_GAP_HEADING: Record<ReviewGap, string> = {
  photo: "missing a photo",
  value: "needing a valuation",
  cost: "with no purchase price recorded",
  cost_zero: "with a purchase price recorded as $0",
  identity: "missing grade, cert or serial number, or set / number",
};

/** The checklist itself (four items, in order). */
export const REVIEW_GAPS: ChecklistItem[] = ["photo", "value", "cost", "identity"];
/** Every flag a filter button or link can use (the checklist's four, with the purchase price split in two). */
export const REVIEW_GAP_FILTERS: ReviewGap[] = ["photo", "value", "cost", "cost_zero", "identity"];

/** The exact documentation checklist, in the words shown to people. Each item is checked against these four things only. */
export const REVIEW_CHECKLIST: Record<ChecklistItem, { title: string; rule: string }> = {
  photo: { title: "Photo", rule: "at least one picture of the item" },
  value: { title: "Valuation", rule: "a value you entered or looked up (a purchase price standing in for a value does not count; an explicit $0 does)" },
  cost: { title: "Purchase price", rule: "what you paid, as an amount above $0. A cost you recorded as $0 stays recorded as $0; this checklist just asks for more than zero, so such an item is listed as \"Purchase price recorded as $0\", not as missing" },
  identity: { title: "Identifying detail", rule: "a grade, cert number, serial number, or set / number" },
};

/** Plain statement of what the checklist is and is not. Shown wherever the checklist is explained. */
export const REVIEW_CHECKLIST_NOTE =
  "This is a record-keeping checklist for your own insurance packet. It does not mean an item is insured, and it does not mean an insurer will accept it.";

function has(text: unknown) {
  return typeof text === "string" && text.trim() !== "";
}

/** The things this item is missing for an insurance packet (empty = nothing missing). */
export function reviewGaps(item: VaultItem): ReviewGap[] {
  const gaps: ReviewGap[] = [];
  const hasPhoto = Boolean(getPrimaryImageUrl(item)) || (Array.isArray(item.images) && item.images.length > 0);
  if (!hasPhoto) gaps.push("photo");
  if (valueBasis(item).basis !== "explicit") gaps.push("value"); // needs a valuation (an explicit $0 counts as one)
  const price = item.purchasePrice;
  if (price === undefined || price === null || !Number.isFinite(Number(price))) gaps.push("cost"); // nothing recorded
  else if (!(Number(price) > 0)) gaps.push("cost_zero"); // recorded as $0
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
  const byGap: Record<ReviewGap, number> = { photo: 0, value: 0, cost: 0, cost_zero: 0, identity: 0 };
  let ready = 0;
  for (const item of items) {
    const gaps = reviewGaps(item);
    if (gaps.length === 0) ready += 1;
    for (const gap of gaps) byGap[gap] += 1;
  }
  return { total: items.length, ready, needsReview: items.length - ready, byGap };
}
