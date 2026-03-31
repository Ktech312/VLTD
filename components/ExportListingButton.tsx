
"use client";

import { generateEbayListing, generateEtsyListing, generateIconaListing } from "@/lib/listingGenerator";

export default function ExportListingButton({ item }: { item: any }) {
  function exportListing(platform: string) {
    let listing;

    if (platform === "ebay") listing = generateEbayListing(item);
    if (platform === "etsy") listing = generateEtsyListing(item);
    if (platform === "icona") listing = generateIconaListing(item);

    alert("Listing generated: " + JSON.stringify(listing, null, 2));
  }

  return (
    <div className="flex gap-2">
      <button onClick={() => exportListing("ebay")}>eBay</button>
      <button onClick={() => exportListing("etsy")}>Etsy</button>
      <button onClick={() => exportListing("icona")}>Icona</button>
    </div>
  );
}
