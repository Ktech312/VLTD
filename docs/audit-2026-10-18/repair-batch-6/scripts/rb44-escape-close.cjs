// RC-29: Escape closes the photo preview and the Lounge composer; Close really closes the Watchlist details panel. Production, isolated QA owner;
// the temporary wishlist row is removed afterwards. Nothing is saved in the app.
//   AUDIT_MANIFEST=<manifest> node rb44-escape-close.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const X = require(path.join(SD, "audit-s-itm-lib.cjs"));
const { sleep, session, admin } = A;
const m = A.man(); const P = m.personalId;
const LABEL = process.argv[2] || "run";
const r = A.R("RB44");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] }; let n = 0;
async function rec(S, ok, control, expected, actual, page) {
  let ev = ""; if (S) { try { await sleep(250); ev = path.join(A.AUD, await S.jshot(`rb44-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page, control, expected, actual, evidence: ev ? path.relative(A.AUD, ev).replace(/\\/g, "/") : "", impact: "RC-29", repro: "" });
}
(async () => {
  let S; const wid = "rb44_wish_" + m.stamp;
  try {
    S = await session("owner", { width: 1440, height: 900 });
    // photo preview
    await X.openItem(S, X.ID.valued); await sleep(3500);
    const opened = await S.evaluate("(() => { const b = document.querySelector('button[aria-label=\"Open photo preview\"]'); if (!b) return false; b.click(); return true; })()");
    await sleep(800);
    const dlg = "!!document.querySelector('[role=dialog][aria-label=\"Photo preview\"]')";
    const open1 = await S.evaluate(dlg);
    await A.press(S, "Escape"); await sleep(700);
    const open2 = await S.evaluate(dlg);
    await rec(S, opened && open1 && !open2, "Item page: photo preview, press Escape", "the preview closes", `button found=${opened}; open=${open1}; open after Escape=${open2}`, "/vault/item/[id]");

    // Lounge composer
    await S.visit("/community-board"); await sleep(9000);
    await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => /Ask the Lounge/.test(x.innerText || '')); if (b) b.click(); })()"); await sleep(800);
    const cdlg = "!!document.querySelector('[role=dialog][aria-label=\"Ask the Lounge\"]')";
    const c1 = await S.evaluate(cdlg);
    await A.press(S, "Escape"); await sleep(700);
    const c2 = await S.evaluate(cdlg);
    await rec(S, c1 && !c2, "Lounge: 'Ask the Lounge' composer, press Escape", "the composer closes", `open=${c1}; open after Escape=${c2}`, "/community-board");

    // Watchlist panel
    await admin.from("wishlist").delete().eq("id", wid);
    await admin.from("wishlist").insert({ id: wid, profile_id: P, title: "RB44 Wish", target_price: 150, created_at: new Date().toISOString() });
    await S.visit("/watchlist"); await S.waitFor("document.body.innerText.includes('RB44 Wish')", 45000).catch(() => {}); await sleep(3000);
    await A.clickExpr(S, "[...document.querySelectorAll('button')].find((b) => b.innerText.includes('RB44 Wish') && /current value/i.test(b.innerText))"); await sleep(1200);
    const panel = "!!document.querySelector('button[aria-label=\"Close details\"]')";
    const w1 = await S.evaluate(panel);
    await A.clickSel(S, 'button[aria-label="Close details"]'); await sleep(900);
    const w2 = await S.evaluate(panel);
    await rec(S, w1 && !w2, "Watchlist: Close on the details panel", "the panel closes and stays closed (another entry used to take its place)", `open=${w1}; open after Close=${w2}`, "/watchlist");
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    try { await admin.from("wishlist").delete().eq("id", wid); } catch {}
    try { if (S) await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb44-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    for (const c of out.cases.filter((c) => !c.ok)) console.log("NOT OK:", c.control, "|", String(c.actual).slice(0, 420));
    process.exit(0);
  }
})();
