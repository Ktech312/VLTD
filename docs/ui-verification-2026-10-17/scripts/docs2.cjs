// LIVE: (1) documentation checklist wording for $0 vs not recorded, counts = destinations; (2) Cost to Sell outbound shipping. Synthetic account.
process.env.CHROME_PROFILE_ROOT = process.env.CHROME_PROFILE_ROOT || "C:/Users/EK/AppData/Local/Temp/qa-c";
const { browser, admin, sleep, man } = require("./journey-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=https://vltd.app").slice(7);
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 500)); };
const info = (n, d) => console.log("INFO", n, JSON.stringify(d ?? "").slice(0, 600));
const row = async (pid, title) => (await admin.from("vault_items").select("*").eq("profile_id", pid).eq("title", title)).data?.[0];
const waitRow = async (pid, title, ms = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const r = await row(pid, title); if (r) return r; await sleep(1500); } return null; };
const fieldSel = (label) => `(() => { const lab = [...document.querySelectorAll('label, span, div, p')].find((e) => e.children.length <= 2 && e.textContent.trim().replace(/\\s+/g, ' ').replace(/[^A-Za-z ()$]/g, '').trim() === ${JSON.stringify(label)}); if (!lab) return null; let el = lab; for (let i = 0; i < 4 && el; i++) { const inp = el.querySelector('input'); if (inp) return inp; el = el.parentElement; } return null; })()`;
const setField = (S, label, v) => S.evaluate(`(() => { const i = ${fieldSel(label)}; if (!i) return false; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${JSON.stringify(v)}); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
const manualAdd = async (S, pid, title, cost) => {
  await S.go("/vault/add"); await S.waitFor("document.querySelector(\"input[placeholder*='Name this item']\")", 90000, "Add page"); await sleep(2500);
  await S.setVal("input[placeholder*='Name this item']", title);
  if (cost !== "") await setField(S, "Purchase Price", cost);
  await sleep(400);
  await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Save'); b.click(); return true; })()");
  return waitRow(pid, title);
};
const flat = async (S) => (await S.text()).split("\n").join(" | ");
const pills = (txt) => {
  const a = txt.match(/Purchase price not recorded\s*\|?\s*(\d+)/), b = txt.match(/Purchase price recorded as \$0\s*\|?\s*(\d+)/);
  return { notRecorded: a ? Number(a[1]) : null, zero: b ? Number(b[1]) : null, missingPrice: /Missing purchase price/.test(txt) };
};
const dlRead = (S) => S.evaluate("Object.fromEntries([...document.querySelectorAll('section[aria-label=\"Cost to sell\"] dl > div')].map((d) => [d.querySelector('dt').textContent.trim(), d.querySelector('dd').textContent.trim()]))");
const n = (s) => Number(String(s).replace(/[^0-9.\-]/g, ""));
const cardLine = (S, title, other) => S.evaluate(`(() => { const t = ${JSON.stringify(title)}, o = ${JSON.stringify(other)}; const els = [...document.querySelectorAll('div')].filter((d) => /^Missing:/.test(d.textContent.trim()) && d.children.length === 0); for (const e of els) { let c = e; for (let i = 0; i < 8 && c; i++) { const x = c.textContent; if (x.includes(t) && !x.includes(o)) return e.textContent.trim(); if (x.includes(o) && !x.includes(t)) break; c = c.parentElement; } } return ''; })()`);

(async () => {
  const m = man(); const P = m.personalId;
  const S = await browser(BASE, { width: 1440, height: 900 });
  try {
    info("deployed commit", ((await (await fetch(BASE + "/")).text()).match(/name="vltd-commit" content="([^"]+)"/) || [])[1]);
    const zero = await manualAdd(S, P, "QA Doc Zero Cost", "0");
    const blank = await manualAdd(S, P, "QA Doc Blank Cost", "");
    const pos = await manualAdd(S, P, "QA Doc Ship Item", "60");
    check("[setup] explicit $0, blank and $60 costs saved as 0 / null / 60", Number(zero.purchase_price) === 0 && zero.purchase_price !== null && blank.purchase_price === null && Number(pos.purchase_price) === 60, [zero.purchase_price, blank.purchase_price, pos.purchase_price]);
    // ---------- 1. documentation checklist ----------
    await S.go("/vault?review=needs_review"); await S.waitFor("/Needs review:/i.test(document.body.innerText) && /QA Doc/.test(document.body.innerText)", 120000, "needs review list"); await sleep(4000);
    const vt = await flat(S); const vp = pills(vt);
    info("Vault filter pills", vp);
    check("[checklist] the Vault's filters say 'Purchase price not recorded' (2 here: the blank one and the $60 item has a price so 1+...) and 'Purchase price recorded as $0' (1), and never 'Missing purchase price'", vp.notRecorded === 1 && vp.zero === 1 && vp.missingPrice === false, vp);
    await S.clickText("Gallery"); await sleep(2500); // the per-item "Missing:" line is shown in Gallery view
    const zeroCard = await cardLine(S, "QA Doc Zero Cost", "QA Doc Blank Cost");
    const blankCard = await cardLine(S, "QA Doc Blank Cost", "QA Doc Zero Cost");
    info("zero-cost card line", zeroCard); info("blank-cost card line", blankCard);
    check("[checklist] the $0 item's card says its price is recorded as $0", /purchase price above \$0 \(recorded as \$0\)/.test(zeroCard), zeroCard);
    check("[checklist] the blank-cost item's card says purchase price is missing and does not say $0", /Missing:[^|]*purchase price/.test(blankCard) && !/recorded as \$0/.test(blankCard), blankCard);
    const expl = await S.evaluate("(document.querySelector('[aria-label=\"Documentation checklist\"]') || {}).innerText || ''");
    info("checklist explanation", expl.split("\n").join(" | ").slice(0, 500));
    check("[checklist] the checklist explains separately that it needs a price above $0 and that a recorded $0 stays recorded, not 'missing'", /above \$0/.test(expl) && /recorded as \$0/.test(expl) && /not as missing/.test(expl), expl);
    for (const [gap, title, other] of [["cost", "QA Doc Blank Cost", "QA Doc Zero Cost"], ["cost_zero", "QA Doc Zero Cost", "QA Doc Blank Cost"]]) {
      await S.go("/vault?review=needs_review&gap=" + gap); await S.waitFor("/Needs review:/i.test(document.body.innerText)", 120000); await sleep(5000);
      const t = await flat(S);
      const heading = (t.match(/Needs review: \d+ items?[^|]*/) || [""])[0];
      const links = await S.evaluate("[...document.querySelectorAll('a[href^=\"/vault/item/\"]')].map((a) => a.textContent.replace(/\\s+/g, ' ')).filter((x) => /QA Doc/.test(x))");
      const pc = pills(t)[gap === "cost" ? "notRecorded" : "zero"];
      info("filter gap=" + gap, { heading, shown: links.map((x) => x.slice(0, 28)), pillCount: pc });
      check("[destination] the " + (gap === "cost" ? "'not recorded'" : "'recorded as $0'") + " filter lists exactly its own item, and its count (" + pc + ") matches the list", links.some((x) => x.includes(title)) && !links.some((x) => x.includes(other)) && pc === 1, { heading, links });
    }
    await S.go("/portfolio"); await S.waitFor("/NEEDS DOCUMENTATION/i.test(document.body.innerText)", 120000); await sleep(4000);
    const ip = pills(await flat(S));
    check("[insights] Insights uses the same two filters with the same counts and no 'Missing purchase price'", ip.notRecorded === vp.notRecorded && ip.zero === vp.zero && ip.missingPrice === false, ip);
    const hrefs = await S.evaluate("[...document.querySelectorAll('a')].map((a) => a.getAttribute('href') || '').filter((h) => /gap=cost/.test(h))");
    check("[insights] its two links point at gap=cost and gap=cost_zero", hrefs.some((h) => /gap=cost$/.test(h)) && hrefs.some((h) => /gap=cost_zero$/.test(h)), hrefs);

    // ---------- 2. Cost to Sell: outbound shipping ----------
    await S.go("/vault/item/" + pos.id); await S.waitFor("document.querySelector('[aria-label=\"Edit purchase\"]')", 120000); await sleep(1500);
    await S.clickSel('[aria-label="Edit purchase"]'); await sleep(500); await S.setVal('input[aria-label="Shipping"]', "10"); await S.clickSel('[aria-label="Save purchase"]'); await sleep(3500);
    const after = await row(P, "QA Doc Ship Item");
    check("[shipping] acquisition shipping $10 is saved on the item (cost 60 + shipping 10 = basis 70)", Number(after.purchase_shipping) === 10);
    await S.go("/vault/item/" + pos.id); await S.waitFor("document.querySelector('section[aria-label=\"Cost to sell\"] dl')", 120000); await sleep(3000);
    const field = await S.evaluate("(() => { const i = document.querySelector('input[aria-label=\"Estimated outbound shipping\"]'); const sec = document.querySelector('section[aria-label=\"Cost to sell\"]'); return { exists: !!i, value: i ? i.value : null, label: /Estimated outbound shipping/i.test(sec.innerText), oldLabel: /Shipping cost/i.test(sec.innerText) }; })()");
    check("[shipping] the field is labelled 'Estimated outbound shipping' and is EMPTY although the item has $10 acquisition shipping", field.exists && field.value === "" && field.label && !field.oldLabel, field);
    await S.setVal('section[aria-label="Cost to sell"] input[placeholder="What you expect"]', "100"); await sleep(800);
    let d = await dlRead(S); let note = await S.evaluate("(document.querySelector('[data-testid=\"cost-to-sell-shipping-note\"]') || {}).innerText || ''");
    info("not entered", { d, note: note.slice(0, 200) });
    check("[shipping] with nothing entered the panel says 'Not entered' and explains that net excludes postage to the buyer", d["Outbound shipping"] === "Not entered" && /does NOT include postage to the buyer/.test(note) && /already includes what you paid for shipping when you bought it/.test(note), { d, note });
    check("[shipping] fees are the marketplace's on $100 only (13.6% + $0.40 = $14.00) and net is $86.00: the $10 acquisition shipping is NOT taken off the sale", Math.abs(n(d.Fees) - 14) < 0.02 && Math.abs(n(d.Net) - 86) < 0.02, d);
    check("[shipping] net gain = net $86 - cost basis $70 = +$16 (acquisition shipping counted once, in the cost basis)", /^\+\$16\.00/.test(d["Net gain / loss"]) && /Cost basis \$70\.00/.test(d["Net gain / loss"]), d["Net gain / loss"]);
    await S.setVal('input[aria-label="Estimated outbound shipping"]', "0"); await sleep(700);
    d = await dlRead(S); note = await S.evaluate("(document.querySelector('[data-testid=\"cost-to-sell-shipping-note\"]') || {}).innerText || ''");
    check("[shipping] an entered 0 reads 'Free ($0)', is explained as free shipping, and leaves net unchanged ($86)", d["Outbound shipping"] === "Free ($0)" && Math.abs(n(d.Net) - 86) < 0.02 && /free/.test(note), { d, note: note.slice(0, 160) });
    await S.setVal('input[aria-label="Estimated outbound shipping"]', "8"); await sleep(700);
    d = await dlRead(S);
    check("[shipping] an outbound estimate of $8 reduces net once ($78) and gain once (+$8); fees are unchanged ($14)", Math.abs(n(d.Net) - 78) < 0.02 && /^\+\$8\.00/.test(d["Net gain / loss"]) && Math.abs(n(d.Fees) - 14) < 0.02 && d["Outbound shipping"] === "$8.00", d);
    const keep = await row(P, "QA Doc Ship Item");
    check("[shipping] nothing about the item changed: purchase shipping still $10, cost still $60", Number(keep.purchase_shipping) === 10 && Number(keep.purchase_price) === 60);
  } catch (e) { console.log("STOPPED", e.message); fail++; try { await S.shot("docs2-stop.png"); } catch { /* ignore */ } }
  finally { await S.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
