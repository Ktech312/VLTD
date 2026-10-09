// Where to read OTHER people's public items from.
// `public_vault_items` is a database view that only exposes the public columns of items marked public
// (never what was paid, private notes, order numbers and so on). Until that view exists in the database
// (supabase/migrations/20261008_public_vault_items_view.sql), this quietly falls back to the table.

type MinimalClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

const PUBLIC_VIEW = "public_vault_items";
let cached: Promise<string> | null = null;
let cachedAt = 0;

export function publicItemsTable(supabase: MinimalClient): Promise<string> {
  const now = Date.now();
  // Re-check every few minutes while it is on the fallback, so it switches over once the view exists.
  if (cached && now - cachedAt < 5 * 60 * 1000) return cached;
  cachedAt = now;
  cached = Promise.resolve(supabase.from(PUBLIC_VIEW).select("id").limit(1))
    .then((result: { error?: unknown }) => (result.error ? "vault_items" : PUBLIC_VIEW))
    .catch(() => "vault_items");
  return cached;
}
