// Builds src/lib/detailFieldMatrix.generated.ts from the 2026-10-15 research matrix, after the review corrections below.
//   node scripts/build-detail-matrix.cjs            write the generated file + docs/design/.../REVIEW.md
//   node scripts/build-detail-matrix.cjs --check    print the review report only
//
// The research matrix (docs/design/category-details-research-2026-10-15/field-matrix.json) is a DRAFT. This script is where the
// draft is reviewed against the real taxonomy and the real VaultItem model. Every change it makes is listed in REVIEW.md.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const MATRIX = path.join(ROOT, "docs/design/category-details-research-2026-10-15/field-matrix.json");
const OUT = path.join(ROOT, "src/lib/detailFieldMatrix.generated.ts");
const REVIEW = path.join(ROOT, "docs/design/category-details-research-2026-10-15/REVIEW.md");
const CHECK_ONLY = process.argv.includes("--check");

const matrix = JSON.parse(fs.readFileSync(MATRIX, "utf8"));
const log = { dropped: [], remapped: [], corrected: [], added: [], demoted: [], collisions: [] };
const note = (kind, text) => { if (!log[kind].includes(text)) log[kind].push(text); };

// ── Existing VaultItem keys ───────────────────────────────────────────────────────────────────────────────────────────────
// Boolean keys on VaultItem (true / false / unset). Everything else is a string.
const BOOL_KEYS = new Set([
  "sportsIsRelic", "sportsIsAuto", "toyBoxIncluded", "toyAccessoriesIncluded", "toyIsComplete", "memorabiliaWitnessed", "memorabiliaGameUsed",
  "vinylInserts", "vinylGatefold", "artIsFramed", "artIsSigned", "watchBox", "watchPapers", "watchFullSet", "bagAuthCard", "bagDustbag", "bagBox",
  "apparelWorn", "coinKeyDate", "gameIsSealed", "gameIsCIB", "gameHasManual", "consoleCables", "consoleBox", "consoleTested",
]);
// What these keys were called and offered by the Add Item form this replaces (kept so nothing people already rely on is lost).
const KEY_META = {
  tcgRarity: { hint: "Holo Rare, Secret Rare, Ultra Rare, Common…" },
  tcgParallelType: { hint: "Rainbow Rare, Gold, Reverse Holo…" },
  tcgHoloType: { hint: "Cosmos Holo, Cracked Ice, Crosshatch…" },
  tcgSetCode: { hint: "SV3pt5, BW1, EX Dragon…" },
  tcgLanguage: { options: ["English", "Japanese", "Korean", "Chinese", "German", "French", "Spanish", "Italian", "Portuguese"] },
  tcgGradingCompany: { options: ["PSA", "BGS / Beckett", "CGC", "SGC", "ACE"] },
  sportsSport: { options: ["Baseball", "Basketball", "Football", "Soccer", "Hockey", "Golf", "Tennis", "UFC / MMA", "Racing", "Multi-Sport", "Other"] },
  sportsTeam: { hint: "Lakers, Yankees, Chiefs…" },
  sportsParallelType: { hint: "Prizm Silver, Reactive Blue, Gold Refractor…" },
  sportsSerialNumber: { hint: "/25, /10, 1/1…" },
  sportsGradingCompany: { options: ["PSA", "BGS / Beckett", "SGC", "CGC", "HGA", "KSA"] },
  sportsPop: { hint: "e.g., 12 at this grade, 3 higher" },
  sportsRelicDescription: { hint: "Game-used jersey, 3-color patch…" },
  sportsAutoAuth: { options: ["On-Card (PSA/DNA)", "On-Card (JSA)", "On-Card (Beckett)", "Stickered", "Unverified"] },
  memorabiliaTeam: { hint: "Lakers, Yankees, Team USA…" },
  memorabiliaEvent: { hint: "2000 Finals, 1998 World Series, Super Bowl LV…" },
  memorabiliaSigningDate: { hint: "March 12, 2023" },
  memorabiliaAuthCompany: { options: ["PSA/DNA", "JSA", "Beckett", "Steiner", "Fanatics", "Unverified"] },
  memorabiliaGameUsedDesc: { hint: "Jersey worn Game 7, bat used 2002 ALCS…" },
  vinylPressing: { hint: "Original Press, Reissue, 180g, Limited…" },
  vinylLabel: { hint: "Blue Note, Impulse!, Motown, Columbia…" },
  vinylCountry: { hint: "US, UK, Japan, Germany…" },
  vinylSpeedRpm: { options: ["33", "45", "78"], unit: "RPM" },
  vinylColor: { hint: "Black, Clear, Red, Picture Disc…" },
  vinylSleeveCondition: { options: ["Mint (M)", "Near Mint (NM)", "Very Good Plus (VG+)", "Very Good (VG)", "Good Plus (G+)", "Good (G)", "Fair (F)"] },
  vinylMatrix: { hint: "Etched matrix info from the dead wax" },
  comicPublisher: { hint: "Marvel, DC, Image, Dark Horse, IDW, Indie…" },
  comicIssueNumber: { hint: "#1, Vol 2 #4, Annual #1…" },
  comicCoverDate: { hint: "July 1962, Dec 1939 (as printed on cover)" },
  comicCoverVariant: { hint: "Variant A, Incentive, Sketch, Foil…" },
  comicArcTitle: { hint: "The Dark Phoenix Saga, Knightfall…" },
  comicGradingCompany: { options: ["CGC", "CBCS", "PGX", "CGS"] },
  // CGC's page-quality scale (White … Tan, with the in-between steps) added to the choices the form already offered; "Yellow" stays so no saved value becomes unlisted.
  comicPageQuality: { options: ["White", "Off-White/White", "Off-White", "Cream/Off-White", "Cream", "Light Tan/Cream", "Light Tan", "Tan", "Yellow"] },
  comicRestorationStatus: { options: ["None / Unrestored", "Slight", "Moderate", "Extensive", "Qualified"] },
  comicHolderType: { options: ["Universal", "Signature Series", "Pedigree", "Conserved", "Restored"] },
  comicCensusRank: { hint: "e.g., Highest Graded — 1 of 4" },
  toyBrand: { hint: "Hasbro, Mattel, NECA, McFarlane, Hot Toys, Funko…" },
  toyLine: { hint: "Marvel Legends, Star Wars Black Series, MOTU…" },
  toyScale: { hint: '1:6, 1:12, 3.75", 6", 12", Life-Size' },
  toyPackageCondition: { options: ["MOC (Mint on Card)", "MIB (Mint in Box)", "MISB (Mint in Sealed Box)", "C-9", "C-8", "Loose"] },
  artCardArtist: { hint: "Artist name" },
  artCardSet: { hint: "SDCC 2024, Artist Alley, Convention sketch…" },
  artCardType: { options: ["Sketch Card", "Artist Proof", "Limited Print", "Original Art"] },
  artMedium: { options: ["Oil on Canvas", "Acrylic on Canvas", "Watercolor", "Pen & Ink", "Pencil", "Mixed Media", "Digital Print", "Screenprint", "Lithograph", "Etching", "Photography", "Sculpture", "Other"] },
  artSurface: { hint: "Canvas, Panel, Bristol, Paper, Illustration Board…" },
  artWidth: { hint: 'e.g., 11"', unit: "in" },
  artHeight: { hint: 'e.g., 17"', unit: "in" },
  artDepth: { hint: 'e.g., 1.5" (optional)', unit: "in" },
  artSignatureLocation: { hint: "Lower right, lower left, verso…" },
  artProvenance: { hint: "Purchased from gallery / artist directly, collection history…" },
  artExhibitions: { hint: "Shows, galleries, or publications this piece has appeared in…" },
  watchBrand: { hint: "Rolex, Patek Philippe, AP, Omega, Seiko…" },
  watchReference: { hint: "116610LN, 5711/1A-010…" },
  watchMovement: { options: ["Automatic", "Manual Wind", "Quartz", "Solar", "Spring Drive"] },
  watchCaseMaterial: { options: ["Stainless Steel", "Yellow Gold", "White Gold", "Rose Gold", "Titanium", "Platinum", "Ceramic", "Other"] },
  watchCaseSize: { hint: "40mm, 36mm, 41mm…", unit: "mm" },
  watchDialColor: { hint: "Black, Blue, White, Champagne, Green…" },
  bagBrand: { hint: "Hermès, Chanel, Louis Vuitton, Gucci, Prada…" },
  bagColor: { hint: "Black, Togo Étoupe, Rose Gold…" },
  bagMaterial: { hint: "Togo, Clemence, Epsom, Canvas, Patent…" },
  bagHardware: { options: ["Gold Hardware (GHW)", "Silver Hardware (SHW)", "Palladium Hardware (PHW)", "Rose Gold Hardware (RGHW)", "Brushed Gold", "Ruthenium"] },
  apparelSize: { hint: "S, M, L, XL, XXL, 32W 30L, US 10…" },
  apparelColorway: { hint: "Triple White, University Red, Black/Gum…" },
  gamePlatform: { options: ["NES", "SNES", "N64", "GameCube", "Wii", "Wii U", "Nintendo Switch", "Game Boy", "GBA", "DS", "3DS", "Sega Genesis", "Sega Saturn", "Dreamcast", "PlayStation", "PS2", "PS3", "PS4", "PS5", "Xbox", "Xbox 360", "Xbox One", "Xbox Series", "Atari 2600", "PC", "Other"] },
  gameRegion: { options: ["NTSC-U (North America)", "PAL (Europe/Australia)", "NTSC-J (Japan)", "Other"] },
  gamePublisher: { hint: "Nintendo, Capcom, Konami, Square…" },
  gameGradingCompany: { options: ["WATA", "VGA", "CGC"] },
  coinDenomination: { hint: "Morgan Dollar, Lincoln Cent, Double Eagle…" },
  coinCountry: { hint: "USA, UK, Germany, Japan…" },
  coinMint: { hint: "Philadelphia, Denver, San Francisco, Carson City…" },
  coinMintMark: { hint: "P, D, S, CC, O, W — or none" },
  coinGradingCompany: { options: ["PCGS", "NGC", "ANACS", "ICG"] },
  coinPopulation: { hint: "e.g., 12 at this grade, 3 finer" },
  coinError: { hint: "Doubled Die, Off-Center, Struck Through…" },
  condition: { options: ["Mint", "Near Mint", "Excellent", "Very Good", "Good", "Fair", "Poor"] },
};
// Label overrides for existing keys, where the form's old wording was clearer than the matrix's.
const KEY_LABEL = {
  artHeight: "Height (in)", artWidth: "Width (in)", artDepth: "Depth (in)", watchCaseSize: "Case size (mm)",
  vinylSpeedRpm: "Speed (RPM)", sportsSerialNumber: "Serial / print run", sportsPop: "Pop report", coinPopulation: "Pop / census",
};
const MULTILINE_KEYS = new Set(["artProvenance", "artExhibitions"]);

// ── Review corrections ───────────────────────────────────────────────────────────────────────────────────────────────────
// 1. Fields that repeat the item's own title. The title is already the first thing entered; a second copy invites two versions.
const DROP_LABELS = new Set(["Card name", "Title", "Game / machine title"]);
// 2. Dropped because the existing art size keys are inches (as their form always said). A free unit beside them would
//    silently reinterpret the numbers already stored.
const DROP_WITH_ART_SIZE = new Set(["Dimensions unit"]);
// 3. Labels the matrix gave new storage although the item already has a key with that meaning.
//    rule: [label, universe|null, category|null, key, newLabel|null]
const YEAR_LABELS = ["Release year", "Year / period", "Date / period", "Manufacture year / period", "Year / season", "Model year", "Creation date / period", "Date / series", "Season / year"];
const REMAP = [
  ...YEAR_LABELS.map((l) => [l, null, null, "year", l === "Date / series" ? "Date / series" : null]),
  ...["Maker", "Manufacturer", "Publisher / maker", "Studio / maker", "Publisher", "Producer / distillery"].map((l) => [l, null, null, "brand", null]),
  ["Artist / performer", "MUSIC", null, "subject", null],
  ["Character", "POP_CULTURE", null, "subject", null],
  ["Collector number", "TCG", null, "number", null],
  ["Model", null, null, "number", "Model / number"],
  ["Edition", null, null, "edition", null],
  ["Edition / exclusive", null, null, "edition", null],
  ["Variant", "POP_CULTURE", null, "variant", null],
  // TCG family
  ["Language", "TCG", null, "tcgLanguage", null],
  ["Grading company", "TCG", null, "tcgGradingCompany", null],
  ["Finish / foil", "TCG", null, "tcgHoloType", null],
  ["Set code", "TCG", null, "tcgSetCode", null],
  // Sports family
  ["Sport", "SPORTS", null, "sportsSport", null],
  ["Player / team", "SPORTS", "Memorabilia", "memorabiliaTeam", "Player / team"],
  ["Event", "SPORTS", "Memorabilia", "memorabiliaEvent", "Event / season"],
  ["Signing date", "SPORTS", "Memorabilia", "memorabiliaSigningDate", null],
  ["Authentication company", "SPORTS", "Memorabilia", "memorabiliaAuthCompany", null],
  ["Witnessed", "SPORTS", "Memorabilia", "memorabiliaWitnessed", "Signing witnessed"],
  // Games
  ["Platform", "GAMES", "Hardware", "gamePlatform", null],
  ["Region", "GAMES", "Hardware", "gameRegion", null],
  ["Controller count", "GAMES", "Hardware", "consoleControllerCount", null],
  ["Cables included", "GAMES", "Hardware", "consoleCables", null],
  ["Box included", "GAMES", "Hardware", "consoleBox", null],
  ["Completeness", "GAMES", "Video Games", "gameIsCIB", "Complete in box (CIB)"],
  ["Tested status", "GAMES", "Hardware", "consoleTested", "Tested working"],
  // Apparel family (the item keeps one size / colorway / worn set for clothing and shoes)
  ["Size", "JEWELRY_APPAREL", "Apparel", "apparelSize", null],
  ["Size", "JEWELRY_APPAREL", "Footwear", "apparelSize", null],
  ["Size", "SPORTS", "Apparel", "apparelSize", null],
  ["Colorway", "JEWELRY_APPAREL", "Apparel", "apparelColorway", null],
  ["Colorway", "JEWELRY_APPAREL", "Footwear", "apparelColorway", null],
  ["Colorway", "SPORTS", "Apparel", "apparelColorway", null],
  // Comics original art
  ["Penciller", null, null, "artPenciller", null],
  ["Inker", null, null, "artInker", null],
  ["Colorist", null, null, "artColorist", null],
  ["Medium", "POP_CULTURE", "Comics", "artMedium", null],
];
// 4. Matrix labels that were mapped to an existing key whose meaning is different from the label.
//    `condition` held "User described / Professionally graded"; on the item it is the descriptive condition (Near Mint, Good…).
const FIXED_KEY_OPTIONS = { condition: KEY_META.condition.options };
// 5. Existing specialist keys the matrix never mentioned. Added to the categories where the old Add Item form offered them.
//    [universe, category|null, [subcategory...]|null, key, label, priority, controlOverride]
const ADD = [
  ["SPORTS", "Sports Cards", null, "sportsIsAuto", "Autograph", "additional"],
  ["SPORTS", "Sports Cards", null, "sportsAutoAuth", "Autograph authentication", "additional"],
  ["SPORTS", "Sports Cards", null, "sportsIsRelic", "Relic / patch card", "additional"],
  ["SPORTS", "Sports Cards", null, "sportsRelicDescription", "Relic description", "additional"],
  ["SPORTS", "Sports Cards", null, "sportsSerialNumber", null, "additional"],
  ["SPORTS", "Sports Cards", null, "sportsPop", null, "additional"],
  ["SPORTS", "Memorabilia", null, "memorabiliaTeam", "Player / team", "additional"],
  ["SPORTS", "Memorabilia", null, "memorabiliaEvent", "Event / season", "additional"],
  ["SPORTS", "Memorabilia", null, "memorabiliaSigningDate", "Signing date", "additional"],
  ["SPORTS", "Memorabilia", null, "memorabiliaWitnessed", "Signing witnessed", "additional"],
  ["SPORTS", "Memorabilia", null, "memorabiliaAuthCompany", "Authentication company", "additional"],
  ["SPORTS", "Memorabilia", null, "memorabiliaGameUsed", "Game used / match worn", "additional"],
  ["SPORTS", "Memorabilia", null, "memorabiliaGameUsedDesc", "Game-used description", "additional"],
  ["MUSIC", "Audio Formats", ["Vinyl Records", "Shellac 78s", "Acetate Discs", "Flexi Discs"], "vinylGatefold", "Gatefold sleeve", "additional"],
  ["MUSIC", "Audio Formats", ["Vinyl Records", "Shellac 78s", "Acetate Discs", "Flexi Discs"], "vinylInserts", "Inserts included", "additional"],
  ["MUSIC", "Audio Formats", ["Vinyl Records", "Shellac 78s", "Acetate Discs", "Flexi Discs"], "vinylSpeedRpm", null, "additional"],
  ["MUSIC", "Audio Formats", ["Vinyl Records", "Shellac 78s", "Acetate Discs", "Flexi Discs"], "vinylSleeveCondition", null, "additional"],
  ["MUSIC", "Audio Formats", ["Vinyl Records", "Shellac 78s", "Acetate Discs", "Flexi Discs"], "vinylMatrix", "Matrix / runout", "additional"],
  ["POP_CULTURE", "Comics", ["Book", "Squarebound", "Omnibuses", "Ashcans", "Fanzines"], "comicArcTitle", "Arc / story title", "additional"],
  ["POP_CULTURE", "Comics", ["Book", "Squarebound", "Omnibuses", "Ashcans", "Fanzines"], "comicHolderType", "Holder type", "additional"],
  ["POP_CULTURE", "Comics", ["Book", "Squarebound", "Omnibuses", "Ashcans", "Fanzines"], "comicCensusRank", "Census rank", "additional"],
  ["POP_CULTURE", "Comics", ["Original Art", "Original Comic Art"], "artType", "Art type", "additional"],
  ["POP_CULTURE", "Comics", ["Original Art", "Original Comic Art"], "artFirstAppearance", "First appearance", "additional"],
  ["POP_CULTURE", "Art Cards", null, "artCardSet", "Card set / event", "additional"],
  ["POP_CULTURE", "Art Cards", null, "artCardType", "Card type", "additional"],
  ["ART", "Art Cards", null, "artCardArtist", "Artist", "primary"],
  ["ART", "Art Cards", null, "artCardSet", "Card set / event", "additional"],
  ["ART", "Art Cards", null, "artCardType", "Card type", "additional"],
  ["ART", "Painting", null, "artIsSigned", "Signed by artist", "additional"],
  ["ART", "Painting", null, "artExhibitions", "Exhibition history", "additional"],
  ["ART", "Sculpture", null, "artIsSigned", "Signed by artist", "additional"],
  ["ART", "Sculpture", null, "artExhibitions", "Exhibition history", "additional"],
  ["JEWELRY_APPAREL", "Watches", null, "watchFullSet", "Full set (box + papers + accessories)", "additional"],
  ["JEWELRY_APPAREL", "Bags & Luggage", null, "bagAuthCard", "Authentication card included", "additional"],
  ["JEWELRY_APPAREL", "Apparel", null, "apparelWorn", "Worn / used", "additional"],
  ["JEWELRY_APPAREL", "Footwear", null, "apparelWorn", "Worn / used", "additional"],
  ["SPORTS", "Apparel", null, "apparelWorn", "Worn / used", "additional"],
  ["GAMES", "Video Games", null, "gameIsSealed", "Sealed / factory sealed", "additional"],
  ["GAMES", "Video Games", null, "gameIsCIB", "Complete in box (CIB)", "additional"],
  ["GAMES", "Hardware", null, "consoleTested", "Tested working", "additional"],
  ["MISC", "Coins & Currency", null, "coinPopulation", "Pop / census", "additional"],
  ["MISC", "Coins & Currency", null, "coinKeyDate", "Key date / semi-key", "additional"],
];
// 6. Specialist fields the research found missing (checked against grading-company and price-guide documentation, 2026-10-15).
//    [universe, category, subcategories|null, label, control, options|null, priority]
const SPEC_ADD = [
  ["MISC", "Coins & Currency", ["Coins", "Errors", "Graded", "Proof Sets", "Bullion", "Ancient Coins"], "Designation / strike type", "text", null, "additional"],
  ["MISC", "Coins & Currency", ["Coins", "Errors", "Graded", "Proof Sets", "Bullion"], "CAC sticker", "yes-no-unknown", null, "additional"],
  ["SPORTS", "Sports Cards", null, "Insert / subset / short print", "text", null, "additional"],
];
// Keys that must always have a home somewhere in the profiles (checked by the test).
const SPECIALIST_KEYS = Object.keys(KEY_META).filter((k) => k !== "condition");

// ── Helpers ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
const CONTROL = { text: "t", "select-with-other": "s", "yes-no-unknown": "y", "multiline-text": "m", "year-or-period": "r", "partial-date": "d", "nonnegative-integer": "n", "number-with-unit": "u" };
const slug = (label) => label.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const rowKey = (r) => [r.universe, r.category, r.subcategory].join("|");

function fieldFromKey(key, label, matrixField) {
  const meta = KEY_META[key] || {};
  const isBool = BOOL_KEYS.has(key);
  let control = isBool ? "y" : matrixField ? CONTROL[matrixField.control] || "t" : "t";
  let options = meta.options || (matrixField && matrixField.options ? matrixField.options.filter((o) => o !== "Unknown") : null);
  if (isBool) options = null;
  if (options && options.length && !isBool) control = "s";
  if (!isBool && !(options && options.length) && control === "s") control = "t";
  if (key === "condition") { control = "s"; options = KEY_META.condition.options; }
  if (MULTILINE_KEYS.has(key)) control = "m";
  return { t: key, l: KEY_LABEL[key] || label, c: control, o: options && options.length ? options : null, h: meta.hint || null, u: meta.unit || null };
}

function fieldFromSpec(label, matrixField) {
  const options = matrixField.options ? matrixField.options.filter((o) => o !== "Unknown") : null;
  let control = CONTROL[matrixField.control] || "t";
  if (control === "s" && !(options && options.length)) control = "t";
  return { t: "s:" + slug(label), l: label, c: control, o: options && options.length ? options : null, h: null, u: null };
}

function applyRemap(label, row) {
  for (const [l, u, c, key, newLabel] of REMAP) {
    if (l !== label) continue;
    if (u && u !== row.universe) continue;
    if (c && c !== row.category) continue;
    return { key, newLabel };
  }
  return null;
}

// ── Per-row profile ───────────────────────────────────────────────────────────────────────────────────────────────────────
const profiles = new Map(); // key -> fields[]
for (const row of matrix.rows) {
  const where = `${row.universe} > ${row.category} > ${row.subcategory}`;
  const used = new Set();
  const out = [];
  const hasArtSize = row.fields.some((f) => f.storage.key && /^art(Height|Width|Depth)$/.test(f.storage.key));
  const push = (field, priority, why) => {
    if (used.has(field.t)) {
      // Two fields in one profile pointing at the same stored value would edit the same data twice.
      if (why) note("collisions", `${where}: "${field.l}" would duplicate ${field.t}; kept the first`);
      return false;
    }
    used.add(field.t);
    out.push({ ...field, p: priority === "primary" ? 1 : 0 });
    return true;
  };

  for (const f of row.fields) {
    if (DROP_LABELS.has(f.label) && !f.storage.key) { note("dropped", `"${f.label}" (repeats the item title)`); continue; }
    if (hasArtSize && DROP_WITH_ART_SIZE.has(f.label)) { note("dropped", `"${f.label}" beside the inch-based art size fields (a free unit would reinterpret stored numbers)`); continue; }
    let field;
    if (f.storage.key) {
      field = fieldFromKey(f.storage.key, f.label, f);
      if (f.storage.key === "condition" && f.options) note("corrected", `"Condition" options "User described / Professionally graded / Unknown" described the source, not the condition; replaced by the condition words the item already uses (Mint … Poor)`);
    } else {
      const remap = applyRemap(f.label, row);
      if (remap && !used.has(remap.key)) {
        field = fieldFromKey(remap.key, remap.newLabel || f.label, f);
        note("remapped", `"${f.label}" → existing item field "${remap.key}"` + (remap.newLabel ? ` (label "${remap.newLabel}")` : ""));
      } else {
        if (remap) note("collisions", `${where}: "${f.label}" stays its own field because "${remap.key}" is already in this profile`);
        field = fieldFromSpec(f.label, f);
      }
    }
    push(field, f.priority, true);
  }

  // Existing specialist keys the matrix missed.
  for (const [u, c, subs, key, label, priority] of ADD) {
    if (u !== row.universe || c !== row.category) continue;
    if (subs && !subs.includes(row.subcategory)) continue;
    if (used.has(key)) continue;
    // A spec slug for the same concept (e.g. "Signing date") is replaced by the real key instead of showing both.
    const lab = label || KEY_LABEL[key] || key;
    const dupIdx = out.findIndex((x) => x.t.startsWith("s:") && slug(x.l) === slug(lab));
    const field = fieldFromKey(key, lab, null);
    if (dupIdx >= 0) { const [removed] = out.splice(dupIdx, 1); used.delete(removed.t); }
    if (push(field, priority, false)) note("added", `${u} > ${c}${subs ? " (" + subs.join(", ") + ")" : ""}: existing field "${key}" (${lab})`);
  }

  for (const [u, c, subs, label, control, options, priority] of SPEC_ADD) {
    if (u !== row.universe || c !== row.category) continue;
    if (subs && !subs.includes(row.subcategory)) continue;
    if (out.some((x) => slug(x.l) === slug(label))) continue;
    const field = fieldFromSpec(label, { control, options });
    if (push(field, priority, false)) note("added", `${u} > ${c}${subs ? " (" + subs.join(", ") + ")" : ""}: new field "${label}"`);
  }

  // No more than six primary fields.
  let primaries = 0;
  for (const f of out) {
    if (f.p) {
      primaries += 1;
      if (primaries > 6) { f.p = 0; note("demoted", `${where}: "${f.l}" moved to More details (limit of six primary fields)`); }
    }
  }
  profiles.set(rowKey(row), out);
}

// ── Category / universe fallbacks ────────────────────────────────────────────────────────────────────────────────────────
// Used when the item has a category but no (or an unlisted) subcategory: the fields most of the category's subcategories share.
const byCategory = new Map();
for (const row of matrix.rows) {
  const k = row.universe + "|" + row.category;
  if (!byCategory.has(k)) byCategory.set(k, []);
  byCategory.get(k).push(profiles.get(rowKey(row)));
}
const categoryProfiles = new Map();
for (const [k, list] of byCategory) {
  const count = new Map(); const first = new Map(); const prim = new Map();
  list.forEach((fields) => fields.forEach((f, i) => {
    count.set(f.t, (count.get(f.t) || 0) + 1);
    if (!first.has(f.t)) first.set(f.t, { ...f, rank: i });
    prim.set(f.t, (prim.get(f.t) || 0) + f.p);
  }));
  const picked = [...first.values()].filter((f) => count.get(f.t) >= Math.ceil(list.length / 2)).sort((a, b) => a.rank - b.rank);
  let primaries = 0;
  categoryProfiles.set(k, picked.map((f) => {
    const isPrimary = prim.get(f.t) >= count.get(f.t) / 2 && primaries < 6;
    if (isPrimary) primaries += 1;
    const { rank, ...rest } = f;
    return { ...rest, p: isPrimary ? 1 : 0 };
  }));
}

// Anything with no usable category: the fields the old Details card always showed, plus condition.
const genericField = (key, label, primary) => ({ ...fieldFromKey(key, label, null), p: primary ? 1 : 0 });
const GENERIC = [
  genericField("subtitle", "Subtitle / set", true), genericField("number", "Number / model", true), genericField("year", "Year", true),
  genericField("brand", "Brand / maker", true), genericField("grade", "Grade", true), genericField("condition", "Condition", true),
  genericField("serialNumber", "Serial #", false), genericField("certNumber", "Cert #", false), genericField("subject", "Subject", false),
  genericField("edition", "Edition", false), genericField("variant", "Variant", false),
];

// ── Emit ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const targets = []; const targetIdx = new Map();
const labels = []; const labelIdx = new Map();
const optionSets = []; const optionIdx = new Map();
const hints = []; const hintIdx = new Map();
const units = []; const unitIdx = new Map();
const intern = (list, map, value) => { if (value === null || value === undefined) return -1; if (!map.has(value)) { map.set(value, list.length); list.push(value); } return map.get(value); };
const enc = (f) => [intern(targets, targetIdx, f.t), intern(labels, labelIdx, f.l), f.c, intern(optionSets, optionIdx, f.o ? JSON.stringify(f.o) : null), f.p, intern(hints, hintIdx, f.h), intern(units, unitIdx, f.u)];

const profileList = []; const profileIdx = new Map();
const internProfile = (fields) => {
  const encoded = JSON.stringify(fields.map(enc));
  if (!profileIdx.has(encoded)) { profileIdx.set(encoded, profileList.length); profileList.push(encoded); }
  return profileIdx.get(encoded);
};
const rows = {};
for (const row of matrix.rows) rows[rowKey(row)] = internProfile(profiles.get(rowKey(row)));
const categories = {};
for (const [k, fields] of categoryProfiles) categories[k] = internProfile(fields);
const generic = internProfile(GENERIC);

// Report ----------------------------------------------------------------------------------------------------------------------------
const allSpecs = new Set(); let existingSlots = 0; let specSlots = 0;
for (const fields of profiles.values()) for (const f of fields) { if (f.t.startsWith("s:")) { allSpecs.add(f.t); specSlots += 1; } else existingSlots += 1; }
const reachable = new Set(); for (const fields of profiles.values()) for (const f of fields) reachable.add(f.t);
const missingKeys = SPECIALIST_KEYS.filter((k) => !reachable.has(k));
const lines = [];
lines.push("# Category Details review (generated)", "", "Generated by `scripts/build-detail-matrix.cjs` from `field-matrix.json`. Do not edit by hand; change the script.", "");
lines.push(`- Subcategory profiles: ${matrix.rows.length} (all of the current taxonomy), ${profileList.length} distinct field lists after sharing identical ones`);
lines.push(`- Field slots: ${existingSlots} use a field the item already stores, ${specSlots} use the new \`specs\` storage (${allSpecs.size} distinct specialist fields)`);
lines.push(`- Existing specialist item fields with no home in any profile: ${missingKeys.length ? missingKeys.join(", ") : "none"}`, "");
for (const [title, key] of [["Dropped", "dropped"], ["Corrected mappings", "corrected"], ["Moved to an existing item field", "remapped"], ["Existing item fields added (the matrix never mentioned them)", "added"], ["Same stored value twice in one profile", "collisions"], ["Moved to More details", "demoted"]]) {
  lines.push(`## ${title} (${log[key].length})`, "", ...(log[key].length ? log[key].map((x) => "- " + x) : ["- none"]), "");
}
const dumpAt = process.argv.indexOf("--dump");
if (dumpAt > 0) {
  for (const k of process.argv.slice(dumpAt + 1)) {
    const p = profiles.get(k);
    console.log("\n## " + k);
    for (const x of p || []) console.log((x.p ? "P " : "  ") + x.l.padEnd(34) + " [" + x.c + (x.o ? ":" + x.o.slice(0, 4).join("/") : "") + "] -> " + x.t);
  }
  process.exit(0);
}
if (CHECK_ONLY) { console.log(lines.join("\n")); process.exit(0); }
fs.writeFileSync(REVIEW, lines.join("\n") + "\n");

const ts = `// GENERATED by scripts/build-detail-matrix.cjs from docs/design/category-details-research-2026-10-15/field-matrix.json. Do not edit.
// Field tuple: [target, label, control, options, primary, hint, unit] (indexes into the tables below; -1 = none).
// target: an existing VaultItem key, or "s:<id>" for a value kept in \`item.specs\`.
// control: t text, s choice (with other), y yes/no/unknown, m multi-line, r year or period, d partial date, n whole number, u number with unit.
export type RawDetailField = [number, number, string, number, number, number, number];
export const DETAIL_TARGETS: string[] = ${JSON.stringify(targets)};
export const DETAIL_LABELS: string[] = ${JSON.stringify(labels)};
export const DETAIL_OPTION_SETS: string[][] = ${JSON.stringify(optionSets.map((o) => JSON.parse(o)))};
export const DETAIL_HINTS: string[] = ${JSON.stringify(hints)};
export const DETAIL_UNITS: string[] = ${JSON.stringify(units)};
export const DETAIL_PROFILES: RawDetailField[][] = [
${profileList.map((p) => "  " + p).join(",\n")}
];
/** "UNIVERSE|Category|Subcategory" -> profile index */
export const DETAIL_ROWS: Record<string, number> = ${JSON.stringify(rows)};
/** "UNIVERSE|Category" -> profile index (used when the item has no subcategory) */
export const DETAIL_CATEGORY_ROWS: Record<string, number> = ${JSON.stringify(categories)};
export const DETAIL_GENERIC_PROFILE = ${generic};
`;
fs.writeFileSync(OUT, ts);
console.log(`wrote ${path.relative(ROOT, OUT)} (${(ts.length / 1024).toFixed(0)} KB) and REVIEW.md; ${profileList.length} profiles; specs ${allSpecs.size}; missing keys: ${missingKeys.join(",") || "none"}`);
