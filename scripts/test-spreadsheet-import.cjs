// Regression tests for the spreadsheet importer, run against synthetic files (never customer data).
//   npm run test:import
//
// Each group below was written for a defect demonstrated on 2026-10-14 with the fixture in this file:
//   - amounts with thousands separators ("1,250.00") were read as "missing" and imported as $0
//   - a CSV's leading zeros ("00123") were turned into numbers by the spreadsheet reader
//   - dates in an Excel file came through as serial numbers ("45366") in the notes
//   - notes were joined with a literal backslash-n instead of a line break
//   - the same description with different serial numbers was treated as a duplicate (and could be skipped)
//   - copies made from one row's Quantity were treated as duplicates of each other
//   - an explicit $0 purchase price was counted as "missing cost"
//   - totals rows were imported as items; malformed amounts and dates were accepted silently

const fs = require("fs");
const os = require("os");
const path = require("path");
const Module = require("module");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const out = fs.mkdtempSync(path.join(os.tmpdir(), "vltd-import-"));
const src = fs.readFileSync(path.join(root, "src", "lib", "spreadsheetImport.ts"), "utf8");
fs.writeFileSync(
  path.join(out, "spreadsheetImport.js"),
  ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
);

let n = 0;
const mocks = {
  id: { newId: () => "id-" + ++n },
  vaultLocalStore: { readVaultLocalJson: () => null },
  vaultModel: { appendItems: () => {}, getAllLocalItems: () => [], saveItems: () => {} },
  vaultSyncQueue: { enqueueVaultItemSync: () => {}, removeVaultItemFromSyncQueue: () => {} },
};
const origLoad = Module._load;
Module._load = function (request, parent, ...rest) {
  if (request === "xlsx") return origLoad.call(this, path.join(root, "node_modules", "xlsx"), parent, ...rest);
  const m = request.match(/^(?:\.\/|@\/lib\/)([A-Za-z0-9_]+)$/);
  if (m && mocks[m[1]]) return mocks[m[1]];
  return origLoad.call(this, request, parent, ...rest);
};
const imp = require(path.join(out, "spreadsheetImport.js"));
const XLSX = require(path.join(root, "node_modules", "xlsx"));

let pass = 0, fail = 0;
const t = (name, ok, detail) => { if (ok) { pass++; console.log("PASS", name); } else { fail++; console.log("FAIL", name, detail === undefined ? "" : JSON.stringify(detail)); } };

const csv = [
  "Name,Reference#,Number,Serial Number,Purchase Price,Current Value,Asking Price,Purchase Date,Notes,Quantity",
  '"Fender Stratocaster, Sunburst",00123,0007,SN-000123,"1,250.00",1800,2000,2024-03-15,"Line one',
  'Line two",1',
  '"Fender Stratocaster, Sunburst",00124,0008,SN-000124,"$1,300.00",1850,2100,2024-03-16,Another,1',
  "Café Racer – Édition,0042,,A-77,0,,,2024-13-45,,1",
  "Zero Cost Item,009,,,0,,,,explicit zero,1",
  "Missing Cost Item,010,,,,,,,blank cost,1",
  "Bad Amount Item,011,,B-1,abc,12x,10-20,not a date,,1",
  "Three Copies,012,,,5,,,,,3",
  ",,,,,,,,,",
  "Total,,,,\"2,500.00\",,,,,",
].join("\n");

function fileFrom(name, content, type) {
  const data = typeof content === "string" ? Buffer.from(content, "utf8") : content;
  return new File([data], name, { type });
}

(async () => {
  // ---- CSV ----
  const source = await imp.parseSpreadsheetSource(fileFrom("synthetic.csv", csv, "text/csv"));
  const sheet = source.sheets[0];
  t("csv: header row found and blank row skipped", sheet && sheet.headers.length === 10 && sheet.rows.length === 8, sheet && { h: sheet.headers.length, r: sheet.rows.length });
  const mapping = imp.buildDefaultMappingProfile(source);
  const built = imp.buildItemsFromSource(source, mapping);
  const byTitle = (title) => built.items.filter((i) => i.title === title);
  const strat = byTitle("Fender Stratocaster, Sunburst");

  t("csv: quoted comma in a title is kept", strat.length === 2);
  t("csv: leading zeros kept in the issue/card number (0007)", strat[0] && strat[0].number === "0007", strat[0] && strat[0].number);
  t("csv: leading zeros kept in the reference (00123)", strat[0] && /Reference: 00123(\n|$)/.test(strat[0].notes || ""), strat[0] && strat[0].notes);
  t("csv: serial numbers kept exactly", strat[0].serialNumber === "SN-000123" && strat[1].serialNumber === "SN-000124");
  t("csv: accented names kept", byTitle("Café Racer – Édition").length === 1);
  t("amounts: thousands separator is read (1,250.00 -> 1250)", strat[0].purchasePrice === 1250, strat[0].purchasePrice);
  t("amounts: currency sign and separator are read ($1,300.00 -> 1300)", strat[1].purchasePrice === 1300, strat[1].purchasePrice);
  t("amounts: purchase price, current value and asking price stay distinct", strat[0].purchasePrice === 1250 && strat[0].currentValue === 1800 && strat[0].askingPrice === 2000, { p: strat[0].purchasePrice, c: strat[0].currentValue, a: strat[0].askingPrice });
  t("notes: a note's own line break is kept", /Line one\nLine two/.test(strat[0].notes || ""), strat[0].notes);
  t("notes: fields are joined with a real line break, not a typed backslash-n", !/\\n/.test(strat[0].notes || ""), strat[0].notes);

  const zero = byTitle("Zero Cost Item")[0];
  const missing = byTitle("Missing Cost Item")[0];
  t("zero vs missing: an explicit 0 is not flagged as missing", zero && zero.purchasePrice === 0 && zero.missingCost === false, zero && { p: zero.purchasePrice, m: zero.missingCost });
  t("zero vs missing: a blank cost is flagged as missing", missing && missing.missingCost === true);
  t("zero vs missing: a blank cost stays UNKNOWN (undefined), different from the explicit 0", missing && missing.purchasePrice === undefined && zero && zero.purchasePrice === 0, missing && missing.purchasePrice);
  const summary = imp.buildImportSummary(built.items, built.ignoredRows);
  t("summary: only blank costs are counted as missing (not explicit zeros)", summary.missingCostCount === 2, summary.missingCostCount);
  // Missing Cost Item (blank) and Bad Amount Item ("abc") are missing; Zero Cost Item and Cafe Racer are explicit zeros.
  t("summary: totals row is not an item", byTitle("Total").length === 0 && built.ignoredRows.some((r) => /total/i.test(r.reason)), built.ignoredRows.map((r) => r.reason));

  const bad = byTitle("Bad Amount Item")[0];
  t("malformed amounts are not guessed (no value taken from \"abc\", \"12x\" or \"10-20\")", bad && bad.currentValue === undefined && bad.askingPrice === undefined && bad.missingCost === true, bad && { c: bad.currentValue, a: bad.askingPrice });
  t("warnings: malformed amounts are reported", bad && Array.isArray(bad.warnings) && bad.warnings.some((w) => /amount/i.test(w)), bad && bad.warnings);
  t("warnings: an invalid date is reported, not guessed", bad && Array.isArray(bad.warnings) && bad.warnings.some((w) => /date/i.test(w)), bad && bad.warnings);
  const cafe = byTitle("Café Racer – Édition")[0];
  t("warnings: an impossible date (2024-13-45) is reported", cafe && Array.isArray(cafe.warnings) && cafe.warnings.some((w) => /date/i.test(w)), cafe && cafe.warnings);
  t("warnings: a clean row has none", strat[0].warnings === undefined || strat[0].warnings.length === 0, strat[0].warnings);

  // ---- duplicates ----
  const groups = imp.detectDuplicateGroups(built.items);
  t("duplicates: the same description with different serial numbers is not a duplicate", !groups.some((g) => g.items.some((i) => i.title === "Fender Stratocaster, Sunburst")), groups.map((g) => g.key));
  t("duplicates: copies from one row's Quantity are not duplicates of each other", !groups.some((g) => g.items.some((i) => i.title === "Three Copies")), groups.map((g) => g.key));
  const same = [
    { ...strat[0], id: "x1", sourceRowKey: "a#1" },
    { ...strat[0], id: "x2", sourceRowKey: "a#9" },
  ];
  t("duplicates: the same description AND serial number is a duplicate", imp.detectDuplicateGroups(same).length === 1);
  const existing = [{ id: "e1", title: "Fender Stratocaster, Sunburst", serialNumber: "SN-000999" }];
  t("existing vault: same description, different serial number is not an exact match", imp.detectExistingDuplicateGroups(strat, existing).length === 0, imp.detectExistingDuplicateGroups(strat, existing).length);
  const existingSame = [{ id: "e2", title: "Fender Stratocaster, Sunburst", serialNumber: "SN-000123" }];
  t("existing vault: same description and serial number is an exact match", imp.detectExistingDuplicateGroups(strat, existingSame).length === 1);
  const existingNoSerial = [{ id: "e3", title: "Fender Stratocaster, Sunburst" }];
  t("existing vault: no serial number on one side is still shown for review", imp.detectExistingDuplicateGroups(strat, existingNoSerial).length === 1 || imp.findLikelyDuplicateCandidates(strat, existingNoSerial).length > 0);

  // ---- XLSX ----
  const wb = XLSX.utils.book_new();
  const aoa = [
    ["Name", "Serial Number", "Purchase Price", "Purchase Date", "Reference#"],
    ["Excel Item", "00987", 15, new Date(Date.UTC(2024, 2, 15)), "00123"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true });
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const xbuf = XLSX.write(wb, { type: "buffer", bookType: "xlsx", cellDates: true });
  const xsrc = await imp.parseSpreadsheetSource(fileFrom("synthetic.xlsx", xbuf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
  const xbuilt = imp.buildItemsFromSource(xsrc, imp.buildDefaultMappingProfile(xsrc));
  const xi = xbuilt.items[0];
  t("xlsx: a text serial number with leading zeros is kept", xi && xi.serialNumber === "00987", xi && xi.serialNumber);
  t("xlsx: a date cell is written as a date, not a serial number", xi && /Purchase Date: 2024-03-15/.test(xi.notes || ""), xi && xi.notes);

  // ---- files that cannot be read: say why and what to do next ----
  const pdf = await imp.parseSpreadsheetSource(fileFrom('fender.pdf', '%PDF-1.4', 'application/pdf'));
  t('unreadable: a PDF is explained, not just "no rows"', pdf.sheets.length === 0 && /PDF/.test(pdf.problem || '') && /csv|xlsx/i.test(pdf.problem || ''), pdf.problem);
  const empty = await imp.parseSpreadsheetSource(fileFrom('empty.csv', '', 'text/csv'));
  t('unreadable: an empty file says it is empty', empty.sheets.length === 0 && /empty/i.test(empty.problem || ''), empty.problem);
  const nohead = await imp.parseSpreadsheetSource(fileFrom('nohead.csv', 'foo,bar,baz\n1,2,3', 'text/csv'));
  t('unreadable: no recognised column names says what is needed', nohead.sheets.length === 0 && /column names/i.test(nohead.problem || ''), nohead.problem);
  const broken = await imp.parseSpreadsheetSource(fileFrom('broken.xlsx', Buffer.from([1,2,3,4,5]), 'application/octet-stream'));
  t('unreadable: a damaged workbook says so', broken.sheets.length === 0 && typeof broken.problem === 'string' && broken.problem.length > 20, broken.problem);

  // ---- negative cost: not imported as a negative; explicit 0 and positive amounts unchanged ----
  const negCsv = ["Name,Purchase Price,Current Value,Notes", "Neg Cost Item,-5,10,n", "Neg Paren Item,(7.50),10,n", "Zero Item,0,10,n", "Pos Item,12.5,10,n"].join("\n");
  const negSource = await imp.parseSpreadsheetSource(fileFrom("neg.csv", negCsv, "text/csv"));
  const negBuilt = imp.buildItemsFromSource(negSource, imp.buildDefaultMappingProfile(negSource));
  const nb = (title) => negBuilt.items.find((i) => i.title === title);
  t("negative cost (-5): the cost is not imported as -5, and not as 0 either (it stays blank)", nb("Neg Cost Item") && nb("Neg Cost Item").purchasePrice === undefined, nb("Neg Cost Item") && nb("Neg Cost Item").purchasePrice);
  t("negative cost (-5): the row is flagged as missing cost and warns why", nb("Neg Cost Item") && nb("Neg Cost Item").missingCost === true && (nb("Neg Cost Item").warnings || []).some((w) => /negative/i.test(w)), nb("Neg Cost Item") && nb("Neg Cost Item").warnings);
  t("negative cost in brackets ((7.50)) is not imported as a cost either (stays blank)", nb("Neg Paren Item") && nb("Neg Paren Item").purchasePrice === undefined, nb("Neg Paren Item") && nb("Neg Paren Item").purchasePrice);
  t("explicit 0 and a positive cost are unchanged next to a negative one", nb("Zero Item").purchasePrice === 0 && nb("Zero Item").missingCost === false && nb("Pos Item").purchasePrice === 12.5);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
