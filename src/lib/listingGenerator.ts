
// src/lib/listingGenerator.ts

export type ListingInput = {
  title: string;
  category?: string;
  description?: string;
  price?: number;
};

export function generateEbayListing(input: ListingInput) {
  return {
    title: input.title,
    description: input.description ?? "",
    price: input.price ?? 0,
    category: input.category ?? "Collectibles",
    platform: "EBAY",
  };
}

export function generateEtsyListing(input: ListingInput) {
  return {
    title: input.title,
    description: input.description ?? "",
    price: input.price ?? 0,
    category: input.category ?? "Vintage",
    platform: "ETSY",
  };
}

export function generateIconaListing(input: ListingInput) {
  return {
    title: input.title,
    description: input.description ?? "",
    price: input.price ?? 0,
    category: input.category ?? "Auction",
    platform: "ICONA",
  };
}
