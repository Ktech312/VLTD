// The agreed value rule in the real UI, in a CLEAN second browser (no saved copy: data comes from the cloud). Synthetic items only; removed with the account.
//   node value-rule-ui.cjs --base=https://vltd.app
process.env.CHROME_PROFILE_ROOT = process.env.CHROME_PROFILE_ROOT || "C:/Users/EK/AppData/Local/Temp/qa-c";
const { browser, admin, sleep, man } = require("./journey-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=https://vltd.app").slice(7);
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 500)); };
(async () => {
  const m = man(); const P = m.personalId; const st = m.stamp;
  await admin.from("vault_items").delete().eq("profile_id", P);
  const img = { image_front_url: "/collectibles/comic-slab.png", image_front_storage_path: "/collectibles/comic-slab.png", images_json: [{ id: "/collectibles/comic-slab.png#0", storageKey: "/collectibles/comic-slab.png", url: "/collectibles/comic-slab.png", order: 0, localOnly: false, role: "primary", isPrivateStorage: false }] };
  const base = { profile_id: P, universe: "POP_CULTURE", category: "comics", category_label: "Comics", status: "COLLECTION", is_public: false, grade: "CGC 9.4", ...img };
  const t0 = Date.now();
  const rows = [
    { id: `qa_vr_${st}_A`, title: "QA Rule A explicit value", current_value: 50, purchase_price: 20 },
    { id: `qa_vr_${st}_B`, title: "QA Rule B cost only", purchase_price: 30 },
    { id: `qa_vr_${st}_C`, title: "QA Rule C neither" },
    { id: `qa_vr_${st}_D`, title: "QA Rule D explicit zero", current_value: 0, purchase_price: 10 },
    { id: `qa_vr_${st}_E`, title: "QA Rule E recorded zero cost", purchase_price: 0 },
  ].map((r, i) => ({ ...base, ...r, created_at: t0 - i * 1000 }));
  const ins = await admin.from("vault_items").insert(rows); if (ins.error) throw new Error(ins.error.message);
  const db = (await admin.from("vault_items").select("id,current_value,purchase_price").eq("profile_id", P).like("id", `qa_vr_${st}_%`)).data;
  check("the database keeps nothing written into valuation fields for B, C, E (null) and keeps D's explicit 0", db.filter((r) => /_(B|C|E)$/.test(r.id)).every((r) => r.current_value === null) && db.find((r) => /_D$/.test(r.id)).current_value === 0, db);

  const S = await browser(BASE, { width: 1440, height: 900 });
  try {
    await S.go("/dashboard"); await S.waitFor("/COLLECTION OVERVIEW/.test(document.body.innerText) && document.querySelectorAll('[data-recent-item]').length >= 5", 240000, "home"); await sleep(3500);
    const home = (await S.text()).replace(/\s+/g, " ");
    const ev = home.match(/ESTIMATED VALUE \$([\d,.]+)/);
    check("[Home] estimated value = known total: explicit 50 + at-purchase-cost 30 + explicit 0 + recorded-$0 cost 0 = $80 (the missing item adds nothing)", ev && Number(ev[1].replace(/,/g, "")) === 80, ev);
    check("[Home] discloses the counts: '2 of 5 priced', '2 at purchase cost', '1 missing value, not counted'", /2 of 5 priced/.test(home) && /2 at purchase cost/.test(home) && /1 missing value, not counted/.test(home), home.match(/ESTIMATED VALUE.{0,200}/)?.[0]);
    const cards = await S.evaluate("Object.fromEntries([...document.querySelectorAll('[data-recent-item]')].map((a) => [a.getAttribute('data-recent-item').split('_').pop(), a.innerText.replace(/\\s+/g, ' ')]))");
    check("[Home] card A shows its explicit value ($50)", /\$50\b/.test(cards.A) && !/purchase cost|Missing/.test(cards.A), cards.A);
    check("[Home] card B shows '$30 at purchase cost'", /\$30 at purchase cost/.test(cards.B), cards.B);
    check("[Home] card C shows 'Missing value' (not $0, not a cost)", /Missing value/.test(cards.C) && !/\$0/.test(cards.C), cards.C);
    check("[Home] card D shows its explicit $0 (not replaced by its $10 cost)", /\$0\b/.test(cards.D) && !/purchase cost|\$10/.test(cards.D) && !/Missing/.test(cards.D), cards.D);
    check("[Home] card E (recorded $0 cost, no valuation) shows '$0 at purchase cost', not 'Missing value'", /\$0 at purchase cost/.test(cards.E) && !/Missing/.test(cards.E), cards.E);
    const chg = home.match(/UNREALIZED CHANGE \+?(-?\$[\d,]+) \(([+-]?[\d.]+)%\)/);
    check("[Home] unrealized change measures only valued items with a cost: +$30 (A) and -$10 (D, an explicit $0) = +$20; the three unvalued items are not counted and create no loss", chg && chg[1] === "$20" && /3 without a value/.test(home), { chg, tail: home.match(/UNREALIZED CHANGE.{0,200}/)?.[0] });

    await S.go("/vault"); await S.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length >= 5", 240000, "vault"); await sleep(3000);
    await S.evaluate("[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Gallery')?.click(); true"); await sleep(2000);
    const vg = (await S.text()).replace(/\s+/g, " ");
    check("[Vault, Gallery view] only item C carries the words 'Missing value' on its card", (vg.match(/Missing value/g) || []).length === 1, (vg.match(/Missing value/g) || []).length);
    check("[Vault] the summary says '1 missing value, not counted'", /1 missing value, not counted/.test(vg), vg.match(/at purchase cost.{0,60}/)?.[0]);
    await S.evaluate("[...document.querySelectorAll('button')].find((b) => /^Needs Review/i.test(b.textContent.trim()))?.click(); true"); await sleep(2500);
    const v = (await S.text()).replace(/\s+/g, " ");
    check("[Vault] the checklist pill says 'Needs valuation 3' (B, C, E); no pill says 'Missing value'", /Needs valuation\s*3/.test(v), v.match(/Needs valuation.{0,40}/)?.[0]);
    const idC = `qa_vr_${st}_C`;
    await S.go("/vault/item/" + idC); await S.waitFor("document.body.innerText.includes('QA Rule C neither')", 120000, "item C"); await sleep(2500);
    const it = (await S.text()).replace(/\s+/g, " ");
    check("[Item page] C shows 'Missing value' and says no valuation and no purchase cost are recorded", /Missing value/.test(it) && /No valuation and no purchase cost recorded/i.test(it), it.match(/MARKET.{0,120}/)?.[0]);

    await S.go("/portfolio"); await S.waitFor("/STALE PRICES/i.test(document.body.innerText)", 240000, "insights"); await sleep(3500);
    const ins2 = (await S.text()).replace(/\s+/g, " ");
    check("[Insights] review reasons keep 'Needs valuation' (cost only) apart from 'Missing value' (neither)", /Needs valuation/.test(ins2) && /Missing value/.test(ins2), ins2.match(/ITEMS NEEDING REVIEW.{0,300}/)?.[0]);
    check("[Insights] the total card discloses the missing item", /1 missing value, not counted/.test(ins2), ins2.match(/TOTAL VAULT VALUE.{0,160}/)?.[0]);
    const amber = await S.evaluate("(() => { const els = [...document.querySelectorAll('div')].filter((d) => d.childElementCount === 0 && /^(Needs valuation|Missing value)$/.test(d.textContent.trim())); return els.map((e) => getComputedStyle(e).color); })()");
    check("[Insights] those reasons are amber, never loss-red", amber.length > 0 && amber.every((c) => { const [r, g, b] = (c.match(/\d+/g) || []).map(Number); return !(r > 190 && g < 130 && b < 130); }), amber);
  } catch (e) { console.log("STOPPED", e.message); fail++; } finally { await S.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
