// Import "Undo last": which records does it act on, and which of them need a warning first. Pure (no storage, no network).
//
// Undo works on the EXACT ids the import created (never on matching titles). Before anything is removed, each of those records
// is compared with a fingerprint taken when it was imported, so a record the person has since edited or moved, or that now sits
// in an exhibition, is named and needs an explicit choice. (Audit ADD-357: Undo only removed the device's copy.)

/**
 * What counts as an edit: the fields a person types or changes, compared in a normalised form. Deliberately NOT everything on the
 * record: the import saves a record one way, and loading it back from the account fills in codes, timestamps, categories and
 * defaults that nobody edited. Comparing those would flag every record as "changed".
 */
const TEXT_FIELDS = ["title", "subtitle", "notes", "description", "serialNumber", "certNumber", "grade", "number", "storageLocation", "imageFrontUrl", "imageBackUrl"] as const;
const MONEY_FIELDS = ["purchasePrice", "purchaseTax", "purchaseShipping", "purchaseFees", "currentValue", "askingPrice"] as const;

function text(value: unknown): string {
  return value === undefined || value === null ? "" : String(value).trim();
}
function money(value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : text(value);
}

export function importFingerprint(item: Record<string, unknown>): string {
  return JSON.stringify([
    ...TEXT_FIELDS.map((key) => text(item[key])),
    ...MONEY_FIELDS.map((key) => money(item[key])),
    (text(item.status) || "COLLECTION").toUpperCase(),
    text(item.profile_id),
  ]);
}

export type UndoEntry = { itemIds: string[]; fingerprints?: Record<string, string>; profileId?: string };
export type UndoItemFlag = { id: string; title: string; reasons: string[] };
export type UndoPlan = {
  /** Records of this import that are still on this device. */
  present: { id: string; title: string }[];
  /** Ids of this import that are no longer on this device (already deleted). */
  missingIds: string[];
  /** Present records that changed since the import, or that other things depend on. */
  flagged: UndoItemFlag[];
  /** True for an import recorded before change tracking: nothing can be said about edits. */
  unverifiable: boolean;
};

export function planImportUndo(
  entry: UndoEntry,
  items: Array<Record<string, unknown> & { id: string | number }>,
  exhibitionCountById: Record<string, number> = {}
): UndoPlan {
  const byId = new Map(items.map((item) => [String(item.id), item]));
  const plan: UndoPlan = { present: [], missingIds: [], flagged: [], unverifiable: !entry.fingerprints };
  for (const id of entry.itemIds.map(String)) {
    const item = byId.get(id);
    if (!item) {
      plan.missingIds.push(id);
      continue;
    }
    const title = String(item.title ?? "Untitled");
    plan.present.push({ id, title });
    const reasons: string[] = [];
    if (entry.profileId && String(item.profile_id ?? "") !== entry.profileId) reasons.push("moved to another profile");
    if (entry.fingerprints) {
      const recorded = entry.fingerprints[id];
      if (recorded !== undefined && recorded !== importFingerprint(item)) reasons.push("edited since the import");
    }
    const inExhibitions = exhibitionCountById[id] ?? 0;
    if (inExhibitions > 0) reasons.push(`is in ${inExhibitions} exhibition${inExhibitions === 1 ? "" : "s"}`);
    if (reasons.length > 0) plan.flagged.push({ id, title, reasons });
  }
  return plan;
}

/** The sentence for the result of an undo: exact about what was removed, what is still in the account and what was kept on purpose. */
export function undoResultMessage(input: { sourceLabel: string; removed: number; total: number; stillThere: number; keptChanged: number; alreadyGone: number }): string {
  const { sourceLabel, removed, total, stillThere, keptChanged, alreadyGone } = input;
  const parts: string[] = [];
  if (stillThere === 0) parts.push(`Undid ${removed} of ${total} item${total === 1 ? "" : "s"} from ${sourceLabel}.`);
  else parts.push(`Removed ${removed} of ${total} item${total === 1 ? "" : "s"} from ${sourceLabel}. ${stillThere} could not be removed from your account and ${stillThere === 1 ? "is" : "are"} still there: press Undo last to try again.`);
  if (keptChanged > 0) parts.push(`${keptChanged} you had changed ${keptChanged === 1 ? "was" : "were"} kept.`);
  if (alreadyGone > 0) parts.push(`${alreadyGone} ${alreadyGone === 1 ? "was" : "were"} already gone.`);
  return parts.join(" ");
}
