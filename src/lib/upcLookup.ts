import { lookupBookByIsbn, normalizeIsbn, type BookLookupResult } from "@/lib/bookIsbn";

export type UpcLookupResult = {
  code: string;
  title: string;
  subtitle?: string;
  brand?: string;
  categoryLabel?: string;
  subcategoryLabel?: string;
  universe?: string;
  notes?: string;
  source: "upcitemdb" | "openlibrary";
};

function cleanCode(value?: string) {
  return String(value ?? "").replace(/\D/g, "").trim();
}

function looksLikeIsbn(code: string) {
  return code.length === 10 || code.length === 13;
}

function notesFromBook(book: BookLookupResult) {
  return [
    book.isbn ? `ISBN: ${book.isbn}` : "",
    book.authors?.length ? `Authors: ${book.authors.join(", ")}` : "",
    book.publishers?.length ? `Publishers: ${book.publishers.join(", ")}` : "",
    book.publishDate ? `Published: ${book.publishDate}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function lookupUpcItem(rawCode: string): Promise<UpcLookupResult | null> {
  const code = cleanCode(rawCode);
  if (!code) return null;

  const normalizedIsbn = looksLikeIsbn(code) ? normalizeIsbn(code) : "";
  if (normalizedIsbn) {
    const book = await lookupBookByIsbn(normalizedIsbn);
    if (!book) return null;

    return {
      code: normalizedIsbn,
      title: book.title,
      subtitle: book.subtitle,
      categoryLabel: "Books",
      subcategoryLabel: "Book",
      universe: "POP_CULTURE",
      notes: notesFromBook(book),
      source: "openlibrary",
    };
  }

  const response = await fetch(
    `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`,
    { method: "GET" }
  );

  if (!response.ok) {
    throw new Error(`UPC lookup failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    code?: string;
    total?: number;
    items?: Array<Record<string, unknown>>;
  };

  const item = Array.isArray(payload.items) ? payload.items[0] : null;
  if (!item) return null;

  const title = String(item.title ?? item.description ?? "").trim();
  if (!title) return null;

  const category = String(item.category ?? "").trim();
  const brand = String(item.brand ?? "").trim();

  return {
    code,
    title,
    brand: brand || undefined,
    categoryLabel: category || "Product",
    subcategoryLabel: brand || undefined,
    universe: "MISC",
    notes: String(item.description ?? "").trim() || undefined,
    source: "upcitemdb",
  };
}
