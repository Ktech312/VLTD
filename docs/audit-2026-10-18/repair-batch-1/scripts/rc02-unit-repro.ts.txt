// RC-02 unit-level reproduction with a synthetic item (no network, no real data). Sentinel strings stand in for private content.
import * as L from "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/src/lib/listingGenerator";
import { generateItemCopy } from "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/src/lib/generateItemCopy";

const PRIVATE_NOTE = "SENTINEL-PRIVATE-NOTE-7f3a";
const PUBLIC_DESC = "SENTINEL-PUBLIC-DESCRIPTION-91bc";
const PAID = 4321;
const item: any = { id: "synthetic-1", title: "Synthetic Test Comic", universe: "POP_CULTURE", category: "comics", status: "FOR_SALE", notes: `${PRIVATE_NOTE} bought from a private seller`, description: PUBLIC_DESC, purchasePrice: PAID, askingPrice: 99, grade: "CGC 9.4", createdAt: Date.now() };

const input = L.itemToListingInput(item);
const fns: [string, (i: any) => any][] = [["ebay", L.generateEbayListing], ["etsy", L.generateEtsyListing], ["icona", L.generateIconaListing], ["whatnot", L.generateWhatnotListing], ["discogs", L.generateDiscogsListing], ["mercari", L.generateMercariListing], ["facebook", L.generateFacebookListing], ["pwcc", L.generatePwccListing]];
const perPlatform: Record<string, any> = {};
for (const [name, fn] of fns) {
  const d = String(fn(input).description);
  perPlatform[name] = { privateNote: d.includes(PRIVATE_NOTE), publicDescription: d.includes(PUBLIC_DESC), purchasePrice: /4,?321/.test(d), costBasisLine: /Recorded cost basis/.test(d) };
}
const copyListing = generateItemCopy(item, "listing").text;
const copyDesc = generateItemCopy(item, "description").text;
const copySocial = generateItemCopy(item, "social").text;
console.log(JSON.stringify({
  itemToListingInputPassesDescription: "description" in (input as any) && !!(input as any).description,
  perPlatform,
  generateListingModeContainsPrivateNote: copyListing.includes(PRIVATE_NOTE),
  generateDescriptionModeContainsPrivateNote: copyDesc.includes(PRIVATE_NOTE),
  generateSocialModeContainsPrivateNote: copySocial.includes(PRIVATE_NOTE),
}, null, 1));
