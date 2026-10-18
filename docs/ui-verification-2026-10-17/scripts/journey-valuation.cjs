// LIVE: Manual Add and Quick Add must not turn purchase cost into a valuation. Synthetic account only (journey-setup.cjs first, journey-cleanup.cjs after).
//   node journey-valuation.cjs [--base=https://vltd.app]
process.env.CHROME_EXTRA = "--use-fake-device-for-media-stream --use-fake-ui-for-media-stream";
const { browser, admin, sleep, man } = require("./journey-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=https://vltd.app").slice(7);
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 500)); };
const info = (n, d) => console.log("INFO", n, JSON.stringify(d ?? "").slice(0, 600));
const row = async (pid, title) => (await admin.from("vault_items").select("*").eq("profile_id", pid).eq("title", title)).data?.[0];
const waitRow = async (pid, title, ms = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const r = await row(pid, title); if (r) return r; await sleep(1500); } return null; };
// the value of the input that sits under a given label text on the Add page
const fieldSel = (label) => `(() => { const lab = [...document.querySelectorAll('label, span, div, p')].find((e) => e.children.length <= 2 && e.textContent.trim().replace(/\\s+/g, ' ').replace(/[^A-Za-z ()$]/g, '').trim() === ${JSON.stringify(label)}); if (!lab) return null; let el = lab; for (let i = 0; i < 4 && el; i++) { const inp = el.querySelector('input'); if (inp) return inp; el = el.parentElement; } return null; })()`;
const setField = (S, label, v) => S.evaluate(`(() => { const i = ${fieldSel(label)}; if (!i) return false; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${JSON.stringify(v)}); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
const manualAdd = async (S, pid, title, cost, value) => {
  await S.go("/vault/add"); await S.waitFor("document.querySelector(\"input[placeholder*='Name this item']\")", 90000, "Add page"); await sleep(2500);
  await S.setVal("input[placeholder*='Name this item']", title);
  const a = cost === "" ? true : await setField(S, "Purchase Price", cost);
  const b = value === "" ? true : await setField(S, "Current Value", value);
  if (!a || !b) info("field not found", { cost: a, value: b, title });
  await sleep(500);
  await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Save'); b.click(); return true; })()");
  return waitRow(pid, title);
};

(async () => {
  const m = man(); const P = m.personalId;
  const S = await browser(BASE, { width: 1440, height: 900 });
  const made = [];
  try {
    const live = await (await fetch(BASE + "/")).text();
    info("deployed commit", (live.match(/name="vltd-commit" content="([^"]+)"/) || [])[1]);
    // ---- Manual Add ----
    const a1 = await manualAdd(S, P, "QA Val Cost Only", "120", ""); made.push(a1);
    check("[manual] cost $120 with no valuation saves the cost and NO value (current value stays empty)", a1 && Number(a1.purchase_price) === 120 && a1.current_value === null, a1 && [a1.purchase_price, a1.current_value]);
    const a2 = await manualAdd(S, P, "QA Val Explicit", "50", "80"); made.push(a2);
    check("[manual] an explicit valuation ($80) still saves, next to its cost ($50)", a2 && Number(a2.purchase_price) === 50 && Number(a2.current_value) === 80, a2 && [a2.purchase_price, a2.current_value]);
    const a3 = await manualAdd(S, P, "QA Val Zero Cost", "0", ""); made.push(a3);
    check("[manual] an explicit cost of 0 is kept as 0 and still gives no value", a3 && Number(a3.purchase_price) === 0 && a3.purchase_price !== null && a3.current_value === null, a3 && [a3.purchase_price, a3.current_value]);
    const a4 = await manualAdd(S, P, "QA Val Nothing", "", ""); made.push(a4);
    check("[manual] blank cost and blank value both stay blank (unknown, not 0)", a4 && a4.purchase_price === null && a4.current_value === null, a4 && [a4.purchase_price, a4.current_value]);
    const a5 = await manualAdd(S, P, "QA Val Explicit Zero", "10", "0"); made.push(a5);
    check("[manual] an explicitly typed valuation of 0 is kept as 0 (different from blank)", a5 && Number(a5.current_value) === 0 && a5.current_value !== null, a5 && [a5.purchase_price, a5.current_value]);

    // ---- Quick Add (the review sheet; one photo from Chrome's synthetic camera) ----
    const Q = await browser(BASE, { width: 390, height: 844, mobile: true });
    try {
      await Q.go("/vault/quick"); await Q.waitFor("document.querySelector('button[aria-label=\"Take picture\"]') && document.querySelector('video') && document.querySelector('video').readyState >= 2", 90000, "camera"); await sleep(2500);
      await Q.evaluate("document.querySelector('button[aria-label=\"Take picture\"]').click(); true"); await sleep(1600);
      await Q.evaluate("[...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Finished')).click(); true"); await sleep(2500);
      await Q.evaluate("[...document.querySelectorAll('button')].find((b) => /^Add \\d+ item/.test(b.textContent.trim())).click(); true");
      await Q.waitFor("document.querySelectorAll('input[aria-label=\"Cost\"]').length >= 1", 60000, "review sheet"); await sleep(1500);
      const set = (sel, v) => Q.evaluate("(() => { const i = " + sel + "; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, " + JSON.stringify(v) + "); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()");
      await set("document.querySelectorAll('input[placeholder=\"Item name\"]')[0]", "QA Val Quick"); await set("document.querySelectorAll('input[aria-label=\"Cost\"]')[0]", "40"); await sleep(600);
      await Q.evaluate("[...document.querySelectorAll('button')].find((b) => /Save \\d+ item/.test(b.textContent)).click(); true");
      const q1 = await waitRow(P, "QA Val Quick", 90000); if (q1) made.push(q1);
      check("[quick] Quick Add with cost $40 and no valuation saves the cost and NO value (same rule as Manual Add)", q1 && Number(q1.purchase_price) === 40 && q1.current_value === null, q1 && [q1.purchase_price, q1.current_value]);
    } finally { await Q.close(); }

    // ---- change the cost of the $120 item to $125, reload ----
    await S.go("/vault/item/" + a1.id); await S.waitFor("document.querySelector('[aria-label=\"Edit purchase\"]')", 120000, "item page"); await sleep(1500);
    await S.clickSel('[aria-label="Edit purchase"]'); await sleep(500);
    await S.setVal('input[aria-label="Purchase price"]', "125"); await S.clickSel('[aria-label="Save purchase"]'); await sleep(4000);
    let after = await row(P, "QA Val Cost Only");
    check("[edit] after changing the cost 120 -> 125 the saved cost is 125 and the value is STILL empty", Number(after.purchase_price) === 125 && after.current_value === null, [after.purchase_price, after.current_value]);
    await S.go("/vault/item/" + a1.id); await S.waitFor("/QA Val Cost Only/.test(document.body.innerText) && /\\$125/.test(document.body.innerText)", 90000, "item page after reload"); await sleep(2500);
    const it = await S.text();
    check("[edit] after a reload the item page shows the cost $125 and no invented return (no -$5, no $120)", /\$125/.test(it) && !/-\s?\$5\b/.test(it) && !/\$120\b/.test(it), it.match(/.{0,40}(-\s?\$5|\$120).{0,40}/)?.[0]);
    info("item page, market / return area", (it.match(/MARKET[\s\S]{0,260}/i) || [""])[0].replace(/\n+/g, " | "));

    // ---- a CLEAN second browser ----
    const B = await browser(BASE);
    try {
      await B.go("/dashboard"); await B.waitFor("/QA Val Cost Only/.test(document.body.innerText) && /COLLECTION OVERVIEW/.test(document.body.innerText)", 120000, "Home in a clean browser"); await sleep(5000);
      const home = (await B.text()); const flat = home.replace(/\n+/g, " | ");
      info("Home overview", (flat.match(/COLLECTION OVERVIEW[\s\S]{0,420}/) || [""])[0]);
      const chg = flat.match(/UNREALIZED CHANGE \| ([^|]+)/);
      check("[other browser] Home shows no negative return for the cost-only item (only the explicitly valued item counts toward the change)", chg && !/^-/.test(chg[1].trim()) && /\+\$30\b/.test(chg[1]), chg && chg[1]);
      check("[other browser] Home does not list the $120 or any -$5 anywhere", !/-\s?\$5\b/.test(flat) && !/QA Val Cost Only[^|]*\|[^|]*\$120/.test(flat), flat.match(/QA Val Cost Only[^|]*\|[^|]*/)?.[0]);
      check("[other browser] Home still says some items are counted at purchase price (the existing labelled fallback)", /counted at purchase price/i.test(home), flat.match(/Value basis[^|]*/)?.[0]);
      const rec = flat.match(/RECENTLY ADDED[\s\S]{0,300}/)?.[0];
      info("Home recently added", rec);
      await B.go("/vault"); await B.waitFor("/QA Val Cost Only/.test(document.body.innerText) && /QA Val Explicit/.test(document.body.innerText)", 120000, "Vault in a clean browser"); await sleep(3000);
      const vt = (await B.text()).replace(/\n+/g, " | ");
      info("Vault summary", (vt.match(/TOTAL VALUE[\s\S]{0,200}/) || [""])[0]);
      check("[other browser] the Vault shows no -$5 and no $120 for the cost-only item", !/-\s?\$5\b/.test(vt) && !/\$120\b/.test(vt), vt.match(/.{0,40}(-\s?\$5|\$120).{0,40}/)?.[0]);
      await B.go("/vault/item/" + a1.id); await B.waitFor("/\\$125/.test(document.body.innerText) && /QA Val Cost Only/.test(document.body.innerText)", 120000, "item page in a clean browser"); await sleep(2000);
      const bt = await B.text();
      check("[other browser] the item page shows the saved cost $125, still unvalued, no invented return", /\$125/.test(bt) && !/-\s?\$5\b/.test(bt) && !/\$120\b/.test(bt), bt.match(/.{0,40}(-\s?\$5|\$120).{0,40}/)?.[0]);
      const dbNow = await row(P, "QA Val Cost Only");
      check("[other browser] the database row is unchanged by viewing: cost 125, value empty", Number(dbNow.purchase_price) === 125 && dbNow.current_value === null);
    } finally { await B.close(); }
  } catch (e) { console.log("STOPPED", e.message); try { await S.c.captureDiag(String(e.message), "valuation-diag"); } catch { /* ignore */ } fail++; }
  finally {
    await S.close();
    // remove any photo the Quick Add item uploaded (exact paths from its own row)
    for (const r of made.filter(Boolean)) for (const x of (r.images_json || [])) { const mm = /\/object\/public\/([^/]+)\/(.+)$/.exec(String(x.url || "")); if (mm) await admin.storage.from(mm[1]).remove([decodeURIComponent(mm[2])]); }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
