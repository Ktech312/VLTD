// EXH suite 12: does merely opening an exhibition's URL (from the other profile / a viewer) change what the exhibition holds? Control: the same visit as the owner on the right profile.
const X = require("./audit-s-exh-lib.cjs");
const { session, admin, sleep, man, rows, gdb, gItemIds } = X;
const { execFileSync } = require("child_process");
const R = rows();
const m = man();
const ex = JSON.parse(require("fs").readFileSync(__dirname + "/exh-created.json", "utf8"));
const A = ex.A;
const reset = () => execFileSync(process.execPath, [__dirname + "/exh-reset-a.cjs"], { env: process.env, stdio: "pipe" });
const hold = async () => { const g = await gdb(A); return { layout: gItemIds(g).length, updated: g.updated_at }; };
(async () => {
  // control: the owner on the Personal profile opens the exhibition (cold browser), then leaves it alone
  reset();
  let before = await hold();
  let S = await session("owner");
  try { await S.visit("/museum/" + A); await sleep(12000); } finally { await S.close(); }
  let after = await hold();
  R.check(after.layout === before.layout, { page: "/museum/[galleryId] | owner, Personal (correct profile), clean browser, no edit", control: "Just opening an exhibition (control)", expected: `Items unchanged (${before.layout})`, actual: `items ${before.layout} -> ${after.layout}`, impact: "data loss", repro: "Open the exhibition and do nothing" });
  // same owner, Business profile active, opens the Personal exhibition's URL
  reset();
  before = await hold();
  S = await session("business");
  try { await S.visit("/museum/" + A); await sleep(14000); const t = (await S.text()).replace(/\s+/g, " "); var shown = t.slice(t.indexOf("MUSEUM"), t.indexOf("MUSEUM") + 80); const shot = await S.jshot("exh-profilewipe-business-opens-personal"); } finally { await S.close(); }
  after = await hold();
  R.check(after.layout === before.layout, { page: "/museum/[galleryId] | owner with the BUSINESS profile active opens a PERSONAL exhibition's URL, clean browser", control: "Opening the other profile's exhibition by its address", expected: `The page says it belongs to another profile and changes nothing (items ${before.layout})`, actual: `page: '${shown}'; database items ${before.layout} -> ${after.layout}${after.layout < before.layout ? " (the exhibition's items were removed just by opening it)" : ""}`, evidence: after.layout < before.layout ? "shots/exh-profilewipe-business-opens-personal.jpg" : "", impact: "privacy/data loss", repro: "Switch to the Business profile in a fresh browser, open /museum/<id of a Personal exhibition that has items>, wait 15 s, check the Personal exhibition" });
  // an unrelated signed-in viewer opens the owner's exhibition URL
  reset();
  await admin.from("galleries").update({ visibility: "PUBLIC" }).eq("id", A);
  before = await hold();
  S = await session("viewer");
  try { await S.visit("/museum/" + A); await sleep(14000); } finally { await S.close(); }
  after = await hold();
  R.check(after.layout === before.layout, { page: "/museum/[galleryId] | unrelated signed-in viewer opens a PUBLIC exhibition's editor URL, clean browser", control: "Another collector opening the exhibition's editor address", expected: `Items unchanged (${before.layout})`, actual: `items ${before.layout} -> ${after.layout}`, impact: "privacy/data loss", repro: "As another user open /museum/<public exhibition id>, wait 15 s" });
  await admin.from("galleries").update({ visibility: "LOCKED" }).eq("id", A);
  reset();
  console.log("DONE profilewipe");
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
