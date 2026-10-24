// Fields that only matter for some kinds of collectible. The add form shows them only when the chosen universe or category calls for them, so a want in
// any category can be typed in, and a category that needs nothing extra shows nothing extra. Values are kept in the want's `details`.
export type FieldDef = { key: string; label: string; placeholder?: string };

const ERA: FieldDef[] = [
  { key: "era", label: "Era or decade", placeholder: "e.g. 1960s" },
  { key: "maker", label: "Maker or brand", placeholder: "or unknown" },
  { key: "conditionOk", label: "Condition I would accept", placeholder: "e.g. any, good, boxed" },
];

/** The extra fields for a universe + category. `older` reveals era and maker for any category (an old, undated piece). */
export function fieldsFor(universe: string, category: string, older: boolean): FieldDef[] {
  const cat = category.toLowerCase();
  const out: FieldDef[] = [];
  if (/comic|manga|graphic/.test(cat)) {
    out.push({ key: "publisher", label: "Publisher" }, { key: "issue", label: "Issue number" }, { key: "gradeWanted", label: "Raw or graded", placeholder: "e.g. raw, CGC 9.8" });
  } else if (universe === "TCG" || /trading card|tcg|booster|sealed/.test(cat)) {
    out.push({ key: "game", label: "Game or sport", placeholder: "e.g. a card game" }, { key: "set", label: "Set or product" }, { key: "cardNumber", label: "Card or product number" }, { key: "format", label: "Single card or sealed product", placeholder: "single, booster box…" }, { key: "gradeWanted", label: "Raw or graded", placeholder: "e.g. raw, PSA 10" });
  } else if (universe === "SPORTS") {
    out.push({ key: "sport", label: "Sport" }, { key: "player", label: "Player or team" }, { key: "year", label: "Year" }, { key: "set", label: "Set or brand" }, { key: "gradeWanted", label: "Raw or graded", placeholder: "e.g. raw, PSA 9" });
  } else if (/toy|figure|funko|action|statue|collectible figure/.test(cat)) {
    out.push({ key: "line", label: "Brand or toy line" }, { key: "wave", label: "Wave or series" }, { key: "character", label: "Character" }, { key: "scale", label: "Scale", placeholder: "e.g. 6-inch" });
  } else if (universe === "MUSIC") {
    out.push({ key: "artist", label: "Artist" }, { key: "label", label: "Label" }, { key: "format", label: "Format or pressing", placeholder: "e.g. 12-inch, first press" });
  } else if (universe === "GAMES") {
    out.push({ key: "platform", label: "Platform" }, { key: "region", label: "Region" }, { key: "completeness", label: "Complete in box?", placeholder: "loose, complete, sealed" });
  } else if (universe === "JEWELRY_APPAREL") {
    out.push({ key: "brand", label: "Brand" }, { key: "model", label: "Model or reference" }, { key: "size", label: "Size" });
  } else if (universe === "AUTOMOTIVE") {
    out.push({ key: "makeModel", label: "Make and model" }, { key: "scale", label: "Scale or year" });
  } else if (universe === "ART") {
    out.push({ key: "artist", label: "Artist" }, { key: "medium", label: "Medium" }, { key: "size", label: "Size" });
  }
  if (older || /vintage|antique/.test(cat)) for (const f of ERA) if (!out.some((o) => o.key === f.key)) out.push(f);
  return out;
}

export function detailKeysFor(universe: string, category: string, older: boolean): string[] {
  return fieldsFor(universe, category, older).map((f) => f.key);
}
