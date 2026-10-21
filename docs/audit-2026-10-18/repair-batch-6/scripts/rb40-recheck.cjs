// Re-check of two RB39 cases whose first checks had test problems: the empty universe page (a sort order saved by an earlier run was treated as a filter) and
// the Watchlist's refusal message (read after the toast had gone). Production, isolated QA owner.
//   AUDIT_MANIFEST=<manifest> node rb40-recheck.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const { sleep, session, admin } = A;
const m = A.man(); const P = m.personalId;
const LABEL = process.argv[2] || "run";
const r = A.R("RB40");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] }; let n = 0;
async function rec(S, ok, control, expected, actual, page) {
  let ev = ""; if (S) { try { await sleep(250); ev = path.join(A.AUD, await S.jshot(`rb40-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page, control, expected, actual, evidence: ev ? path.relative(A.AUD, ev).replace(/\\/g, "/") : "", impact: "RC-24 / RC-26", repro: "" });
}
const body = async (S) => (await S.text().catch(() => "")).replace(/\s+/g, " ").trim();
(async () => {
  let S; const wid = "rb40_wish_" + m.stamp;
  try {
    S = await session("owner", { width: 1440, height: 900 });
    // a sort order other than the default is saved by earlier runs in this browser: the empty message must still show
    await S.visit("/vault"); await sleep(6000);
    await S.evaluate("(() => { const e = document.querySelector('select[aria-label=\"Sort the vault\"]'); if (!e) return false; const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(e, 'value_desc'); e.dispatchEvent(new Event('change', { bubbles: true })); return true; })()");
    await sleep(800);
    await S.visit("/vault/automotive"); await sleep(10000);
    let t = await body(S);
    await rec(S, /Nothing in .+ yet/i.test(t) && !/Your vault is empty/i.test(t) && !/No items match/i.test(t), "/vault/automotive (empty universe) with a non-default sort order", "says there is nothing in this universe yet, with a way to add or go back", `text: ${(t.match(/Nothing in [^.]*yet/i) || ["(none)"])[0]}; 'No items match' shown=${/No items match/i.test(t)}`, "/vault/automotive");
    await admin.from("wishlist").delete().eq("id", wid);
    await admin.from("wishlist").insert({ id: wid, profile_id: P, title: "RB40 Wish", target_price: 150, created_at: new Date().toISOString() });
    await S.visit("/watchlist"); await S.waitFor("document.body.innerText.includes('RB40 Wish')", 45000).catch(() => {}); await sleep(3000);
    await A.clickExpr(S, "[...document.querySelectorAll('button')].find((b) => b.innerText.includes('RB40 Wish') && /current value/i.test(b.innerText))"); await sleep(1200);
    await A.clickSel(S, '[aria-label="Set target price"]'); await sleep(800);
    await A.typeInto(S, 'input[placeholder="Target price"]', "abc"); await A.press(S, "Enter"); await sleep(700);
    t = await body(S);
    const db = (await admin.from("wishlist").select("target_price").eq("id", wid).maybeSingle()).data;
    await rec(S, Number(db.target_price) === 150 && /use numbers only/i.test(t), "Watchlist: target price 'abc' then Save", "refused with a message; the existing $150 is kept", `database target=${db.target_price}; message=${(t.match(/Target price is not a number[^.]*\./i) || ["(none)"])[0]}`, "/watchlist");
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    try { await admin.from("wishlist").delete().eq("id", wid); } catch {}
    try { if (S) await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb40-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    for (const c of out.cases.filter((c) => !c.ok)) console.log("NOT OK:", c.control, "|", String(c.actual).slice(0, 420));
    process.exit(0);
  }
})();
