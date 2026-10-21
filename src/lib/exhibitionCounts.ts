// How many items a VISITOR can see in each public exhibition, counted the way Discover counts them: an item counts when it is public in
// its owner's vault or the exhibition itself published it (its public snapshot). Private items that are only named in the exhibition's own
// list never count, so a saved or listed count never reveals them.
import { normalizeSupabaseItemIds } from "@/lib/galleryModel";
import { publicItemsTable } from "@/lib/publicItemsSource";
import { queryPublicGalleries } from "@/lib/publicGalleries";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export async function fetchVisibleItemCounts(galleryIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const supabase = getSupabaseBrowserClient();
  const ids = [...new Set(galleryIds.filter(Boolean))];
  if (!supabase || ids.length === 0) return out;

  const { data, error } = await queryPublicGalleries(supabase, "id, profile_id, layout, exhibition_layout", (q) => q.in("id", ids));
  if (error || !Array.isArray(data)) return out;

  type Row = Record<string, unknown>;
  const rows = data as Row[];
  const itemIdsByGallery = new Map<string, string[]>();
  const snapshotIds = new Map<string, Set<string>>();
  for (const row of rows) {
    const id = String(row.id);
    itemIdsByGallery.set(id, normalizeSupabaseItemIds(row));
    const layout = row.layout && typeof row.layout === "object" ? (row.layout as Row) : null;
    const exLayout = row.exhibition_layout && typeof row.exhibition_layout === "object" ? (row.exhibition_layout as Row) : null;
    const snaps = layout?.publicItemSnapshots ?? exLayout?.publicItemSnapshots;
    const set = new Set<string>();
    if (Array.isArray(snaps)) for (const snap of snaps) { const sid = (snap as Row | null)?.id; if (typeof sid === "string" && sid) set.add(sid); }
    snapshotIds.set(id, set);
  }

  const allItemIds = [...new Set([...itemIdsByGallery.values()].flat())];
  const publicIds = new Set<string>();
  if (allItemIds.length > 0) {
    const table = await publicItemsTable(supabase);
    for (let i = 0; i < allItemIds.length; i += 80) {
      const { data: itemRows, error: itemError } = await supabase.from(table).select("id").in("id", allItemIds.slice(i, i + 80));
      // If the public read fails, count only what the exhibition itself published rather than guessing.
      if (itemError) { publicIds.clear(); break; }
      for (const r of (itemRows ?? []) as { id: string }[]) publicIds.add(String(r.id));
    }
  }
  for (const [id, itemIds] of itemIdsByGallery) {
    const snaps = snapshotIds.get(id) ?? new Set<string>();
    out.set(id, itemIds.filter((itemId) => publicIds.has(itemId) || snaps.has(itemId)).length);
  }
  return out;
}
