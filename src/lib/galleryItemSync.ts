// Planning for the exhibition's link rows (gallery_items), kept free of any network code so it can be tested on its own.
//
// The old save deleted EVERY link row of the exhibition and inserted them all again whenever the stored order or positions differed in any way.
// Between the delete and the insert the exhibition had no links, and if the insert failed the restore could fail too. This plan only ever
// changes what must change, and the caller runs it in a safe order: insert what is missing, then fix positions, then delete only rows that
// no longer belong. At no point are there fewer links than the exhibition should have.

export type LinkRow = { id?: string | number; artifact_id: string; position: number };

export type LinkPlan = {
  toInsert: { artifact_id: string; position: number }[];
  toUpdate: { id: string | number; position: number }[];
  /** Existing rows that are no longer wanted (artifact removed, or a duplicate row for an artifact that is kept once). */
  toDelete: (string | number)[];
};

export function planGalleryItemSync(existing: LinkRow[], desired: { artifact_id: string; position: number }[]): LinkPlan {
  const pool = new Map<string, LinkRow[]>();
  for (const row of [...existing].sort((a, b) => a.position - b.position)) {
    const key = String(row.artifact_id);
    if (!pool.has(key)) pool.set(key, []);
    pool.get(key)!.push(row);
  }
  const kept = new Set<LinkRow>();
  const plan: LinkPlan = { toInsert: [], toUpdate: [], toDelete: [] };
  for (const want of desired) {
    const match = pool.get(String(want.artifact_id))?.find((row) => !kept.has(row));
    if (!match) {
      plan.toInsert.push({ artifact_id: want.artifact_id, position: want.position });
      continue;
    }
    kept.add(match);
    if (match.position !== want.position && match.id !== undefined) plan.toUpdate.push({ id: match.id, position: want.position });
  }
  for (const row of existing) {
    if (!kept.has(row) && row.id !== undefined) plan.toDelete.push(row.id);
  }
  return plan;
}
