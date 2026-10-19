// Repair batch 1 / RC-02 verification on PRODUCTION with a SYNTHETIC item and unmistakable sentinels:
// marketplace listing copy, Generate listing copy -> Accept -> public share page, private note preserved, readiness label.
//   AUDIT_MANIFEST=<manifest> node rb2-verify-listing.cjs <label>
const { session, sleep, admin, man, fs, AUD, R } = require("./audit-lib.cjs");
const LABEL = process.argv[2] || "run";
const r = R("RB2");
const OUT = AUD + "/repair-batch-1/evidence"; fs.mkdirSync(OUT, { recursive: true });
const log = { label: LABEL, fixtureOnly: true, steps: [] };
const NOTE = "PRIVATE-NOTE-SENTINEL-do-not-publish-9d41";
const PAID = 6543.21;
const PUB = "PUBLIC-DESCRIPTION-SENTINEL-2c7e";
(async () => {
  const m = man();
  const owned = (await admin.from("vault_items").select("id").eq("profile_id", m.personalId).eq("status", "COLLECTION").order("id")).data.map((x) => x.id);
  const ID = owned[5], ID2 = owned[6];
  const mclick = async (S, js) => { const pos = await S.evaluate(`(() => { const e = (${js})(); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`); if (!pos) return false; await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: pos.x, y: pos.y, button: "none" }); await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x: pos.x, y: pos.y, button: "left", clickCount: 1, buttons: 1 }); await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: pos.x, y: pos.y, button: "left", clickCount: 1, buttons: 0 }); return true; };
  const btn = (re, scope = "button") => `() => [...document.querySelectorAll(${JSON.stringify(scope)})].find((b) => ${re}.test((b.textContent || '').trim()) && b.getBoundingClientRect().width > 1)`;
  const leaks = (t) => ({ note: t.includes(NOTE) || /private seller/i.test(t), cost: /6,?543/.test(t) || /Recorded cost basis/i.test(t) });
  const pass = (ok, x) => { log.steps.push({ ok, control: x.control, actual: x.actual }); return r.check(ok, { impact: "privacy/data loss", ...x }); };
  const setup = async (id, extra = {}) => admin.from("vault_items").update({ status: "FOR_SALE", is_public: true, notes: `${NOTE} bought from a private seller`, purchase_price: PAID, asking_price: 120, description: null, grade: "CGC 9.4", ...extra }).eq("id", id);

  // ---- 1. marketplace listing copy (the Copy Listing panel), every platform offered for the item
  await setup(ID, { description: PUB });
  const S = await session("owner", { width: 1440, height: 900 });
  await S.visit(`/vault/item/${ID}`); await S.waitFor("document.body.innerText.includes('Listing Copy')", 40000, "listing panel").catch(() => {}); await sleep(2500);
  const chips = await S.evaluate(`(() => { const sec = [...document.querySelectorAll('*')].find((e) => e.children.length < 40 && /^Listing Copy$/i.test((e.textContent || '').trim())); const root = sec ? sec.closest('section,div[class*=rounded]') : null; return root ? [...root.querySelectorAll('button')].map((b) => b.textContent.trim()).filter((t) => t && !/Copy Listing/.test(t)) : []; })()`);
  const platformsSeen = []; let anyLeak = false, anyPublic = false;
  for (const label of chips.slice(0, 10)) {
    await mclick(S, btn(new RegExp("^" + label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$")) ); await sleep(500);
    await S.evaluate("window.__aud.clip.length = 0; true");
    await mclick(S, btn(/^Copy Listing$/)); await sleep(900);
    const clip = (await S.look())?.clip?.[0] || "";
    const panelText = await S.evaluate("document.body.innerText");
    const l = leaks(clip + "\n" + panelText.slice(panelText.indexOf("Listing Copy")));
    platformsSeen.push({ label, copied: clip.length, leaksNote: l.note, leaksCost: l.cost });
    if (l.note || l.cost) anyLeak = true; if (clip.includes(PUB)) anyPublic = true;
  }
  pass(chips.length > 0 && !anyLeak && anyPublic, { page: "/vault/item/<id> | owner, FOR_SALE item with a public description, private note and purchase price", control: "Listing Copy: every marketplace chip + Copy Listing", expected: "pasted text contains the public description and neither the private note nor what was paid", actual: `${chips.length} platform chips (${chips.join(", ")}); results: ${JSON.stringify(platformsSeen)}`, evidence: await S.jshot("rb2-" + LABEL + "-1-listing-copy"), repro: "Open a FOR_SALE item, choose each marketplace, press Copy Listing." });

  // ---- 2. readiness label with NO public description (private note present and long enough to have passed before)
  await setup(ID2);
  await S.visit(`/vault/item/${ID2}`); await sleep(5000);
  const ready = await S.evaluate("(() => { const h = [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && /^listing readiness$/i.test((e.textContent || '').trim()))[0]; const box = h ? h.closest('div[class*=rounded],section') : null; return (box ? box.innerText : '').replace(/\\s+/g, ' '); })()");
  const exportWarn = await S.evaluate("document.body.innerText.replace(/\\s+/g,' ')");
  pass(/Public description needed\./.test(ready + " " + exportWarn) && !ready.includes(NOTE.slice(0, 20)), { page: "/vault/item/<id> | FOR_SALE item, private note but no public description", control: "Listing readiness: Public description", expected: 'checklist says "Public description needed." and never shows the private note', actual: `label on the page: ${/Public description needed\./.test(ready + " " + exportWarn)}; private note text inside the readiness panel: ${ready.includes(NOTE.slice(0, 20))}; readiness panel text: ${ready.slice(0, 140)}`, evidence: await S.jshot("rb2-" + LABEL + "-2-readiness"), repro: "Open a FOR_SALE item with notes but no description." });

  // ---- 3. Generate listing copy -> Accept -> signed-out share page
  await mclick(S, btn(/^Generate listing copy$/)); await sleep(1500);
  const draft = await S.evaluate("(() => { const t = document.querySelector('textarea'); return t ? t.value : ''; })()");
  const dl = leaks(draft);
  pass(draft.length > 20 && !dl.note && !dl.cost, { page: "/vault/item/<id> | owner", control: "Generate listing copy (draft)", expected: "draft built from public facts: no private note, no cost", actual: `draft length ${draft.length}; contains private note: ${dl.note}; contains cost: ${dl.cost}`, evidence: await S.jshot("rb2-" + LABEL + "-3-draft"), repro: "Press Generate listing copy." });
  await mclick(S, btn(/Accept/)); await sleep(6000);
  const row = (await admin.from("vault_items").select("description,notes,purchase_price,is_public").eq("id", ID2).single()).data;
  pass(!!row.description && !leaks(row.description).note && !leaks(row.description).cost && String(row.notes).includes(NOTE) && Number(row.purchase_price) === PAID, { page: "/vault/item/<id> | owner", control: "Accept — apply to item", expected: "the saved public description has no private data; the private note and purchase price are still stored unchanged", actual: `description saved: ${!!row.description}; description leaks note: ${leaks(row.description || "").note}; leaks cost: ${leaks(row.description || "").cost}; private note preserved: ${String(row.notes).includes(NOTE)}; purchase price preserved: ${Number(row.purchase_price) === PAID}`, repro: "Generate -> Accept; read the record." });
  const V = await session("visitor", { width: 1440, height: 900 });
  await V.visit(`/share/${ID2}`); await sleep(4500);
  const share = await V.evaluate("document.body.innerText.replace(/\\s+/g,' ')"); const sl = leaks(share);
  const bodyHtml = await V.evaluate("document.documentElement.outerHTML");
  pass(!sl.note && !sl.cost && !leaks(bodyHtml).note && !leaks(bodyHtml).cost && share.length > 100, { page: "/share/<id> | signed-out visitor, after Generate -> Accept", control: "public share page", expected: "shows the item and its public description; contains neither the private note nor the cost (page text and page source)", actual: `visible text leaks note: ${sl.note}, cost: ${sl.cost}; page source leaks note: ${leaks(bodyHtml).note}, cost: ${leaks(bodyHtml).cost}; page has content: ${share.length > 100}`, evidence: await V.jshot("rb2-" + LABEL + "-3-share"), repro: "After Accept, open /share/<id> signed out." });
  await V.close();

  // ---- 4. For Sale page: readiness gap wording
  await S.visit("/vault/for-sale"); await sleep(6000);
  const fs2 = await S.evaluate("document.body.innerText.replace(/\\s+/g,' ')");
  log.steps.push({ ok: null, control: "For Sale page text", actual: `contains 'Public description needed': ${/Public description needed/.test(fs2)}` });
  r.nt({ page: "/vault/for-sale | owner", control: "readiness gap list wording", expected: "gap reads 'Public description needed'", actual: `On the page now: ${/Public description needed/.test(fs2) ? "label present" : "label not on screen for the default view (the gap list shows per platform; not asserted)"}`, impact: "none", repro: "Open For Sale." });
  await S.close();
  fs.writeFileSync(OUT + `/rb2-listing-${LABEL}.json`, JSON.stringify(log, null, 1));
  console.log("steps:", log.steps.map((x) => (x.ok === null ? "-" : x.ok ? "ok" : "FAIL")).join(" "));
  process.exit(0);
})().catch((e) => { console.error(e); try { fs.writeFileSync(OUT + `/rb2-listing-${LABEL}-crashed.json`, JSON.stringify(log, null, 1)); } catch {} process.exit(1); });
