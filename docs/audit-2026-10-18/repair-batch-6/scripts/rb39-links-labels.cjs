// RC-24 (links and drill-downs) and RC-26 (buttons that did something other than their label), verified on PRODUCTION with the isolated QA fixture.
// Temporary QA rows are removed/restored; nothing real is touched.
//   AUDIT_MANIFEST=<manifest> node rb39-links-labels.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const X = require(path.join(SD, "audit-s-itm-lib.cjs"));
const { sleep, session, admin } = A;
const m = A.man(); const P = m.personalId;
const LABEL = process.argv[2] || "run";
const r = A.R("RB39");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] }; let n = 0;
async function rec(S, ok, control, expected, actual, page) {
  let ev = ""; if (S) { try { await sleep(250); ev = path.join(A.AUD, await S.jshot(`rb39-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page, control, expected, actual, evidence: ev ? path.relative(A.AUD, ev).replace(/\\/g, "/") : "", impact: "RC-24 / RC-26", repro: "" });
}
const body = async (S) => (await S.text().catch(() => "")).replace(/\s+/g, " ").trim();
const hrefs = (S, re) => S.evaluate(`[...document.querySelectorAll('a')].filter((a) => ${re}.test(a.innerText || '')).map((a) => a.getAttribute('href'))`);
(async () => {
  const sessions = []; const cleanup = [];
  try {
    const open = async (kind, o) => { const S = await session(kind, o || { width: 1440, height: 900 }); sessions.push(S); return S; };
    const O = await open("owner");

    // ---------- Insights
    await O.visit("/portfolio"); await O.waitFor("document.body.innerText.includes('Cost And Value')", 45000).catch(() => {}); await sleep(5000);
    let t = await body(O);
    const rowHref = await O.evaluate("(() => { const a = [...document.querySelectorAll('a')].find((x) => /^\\/vault\\?q=/.test(x.getAttribute('href') || '') && /Cost \\$/.test(x.innerText || '')); return a ? { href: a.getAttribute('href'), text: a.innerText.replace(/\\s+/g, ' ').slice(0, 60) } : null; })()");
    await rec(O, /Cost And Value By Category/i.test(t) && !/Cost And Value By Universe/i.test(t) && !!rowHref, "Insights: breakdown heading and row links", "headed 'By Category' (the rows are categories); each row links to the Vault filtered to that category", `heading ok=${/Cost And Value By Category/i.test(t)}; first row link=${JSON.stringify(rowHref)}`, "/portfolio");
    const movers = await hrefs(O, "/View all movers/i"), review = await hrefs(O, "/^\\s*View all/i"), addnote = await hrefs(O, "/Review items|Add note/i");
    await rec(O, movers.includes("/vault?sort=gain_desc") && review.includes("/vault?review=needs_review") && addnote.every((h) => h !== "/vault"), "Insights: 'View all movers', 'View all', and the dashed tile", "go to a gain-sorted Vault, the needs-review list, and the review list (not a plain /vault)", `movers=${JSON.stringify(movers)}; view all=${JSON.stringify(review)}; tile=${JSON.stringify(addnote)}`, "/portfolio");
    // follow 'View all movers'
    const rows = (await admin.from("vault_items").select("title,status,current_value,purchase_price,purchase_tax,purchase_shipping,purchase_fees").eq("profile_id", P)).data.filter((i) => i.status !== "SOLD" && i.status !== "WISHLIST");
    const cost = (i) => Number(i.purchase_price || 0) + Number(i.purchase_tax || 0) + Number(i.purchase_shipping || 0) + Number(i.purchase_fees || 0);
    const best = rows.filter((i) => i.current_value !== null && cost(i) > 0).map((i) => ({ title: i.title, gain: Number(i.current_value) - cost(i) })).sort((a, b) => b.gain - a.gain)[0];
    await O.visit("/vault?sort=gain_desc"); await sleep(9000);
    const first = await O.evaluate("(() => { const a = document.querySelector('a[href^=\"/vault/item/\"]'); return a ? (a.innerText || '').trim().split('\\n')[0] : null; })()");
    await rec(O, first === best.title, "/vault?sort=gain_desc (what 'View all movers' opens)", `the Vault opens sorted by gain, biggest first (${best.title})`, `first card: ${first}`, "/vault?sort");

    // ---------- Open Exhibitions
    for (const url of ["/portfolio/insurance", "/reports/insurance"]) {
      await O.visit(url); await sleep(9000);
      const h = await hrefs(O, "/Open Exhibitions/i");
      await rec(null, h.length > 0 && h.every((x) => x === "/museum"), `'Open Exhibitions' on ${url}`, "opens /museum", `href=${JSON.stringify(h)}`, url);
    }

    // ---------- Universes
    await O.visit("/vault/not-a-universe"); await sleep(5000);
    t = await body(O);
    await rec(O, /That universe doesn.t exist/i.test(t) && !/Misc/.test(t.slice(0, 200)), "/vault/not-a-universe", "says the universe doesn't exist (not another universe's list)", `text: ${t.slice(0, 120)}`, "/vault/[universe]");
    await O.visit("/vault/automotive"); await sleep(8000);
    t = await body(O);
    await rec(O, /Nothing in .+ yet/i.test(t) && !/Your vault is empty/i.test(t), "/vault/automotive (empty universe, the vault itself has items)", "says there is nothing in this universe yet, with a way to add or go back (not 'Your vault is empty')", `text: ${(t.match(/Nothing in [^.]*yet/i) || ["(none)"])[0]}; old wording=${/Your vault is empty/i.test(t)}`, "/vault/automotive");
    await O.visit("/portfolio/universe/NOPE"); await sleep(5000);
    t = await body(O);
    await rec(O, /That universe doesn.t exist/i.test(t), "/portfolio/universe/NOPE", "not found (not the Misc universe)", `text: ${t.slice(0, 120)}`, "/portfolio/universe/[key]");
    const musicTotal = rows.filter((i) => false).length; // placeholder to keep rows used
    await O.evaluate("(() => { try { localStorage.removeItem('vltd_portfolio_time_range'); } catch {} return true; })()");
    await O.visit("/portfolio/universe/MUSIC"); await sleep(9000);
    t = await body(O);
    await rec(O, /All time|all time/.test(t) || !/Last 30 days/.test(t), "/portfolio/universe/MUSIC default window", "the whole universe (not only the last 30 days)", `shows 'Last 30 days'=${/Last 30 days/.test(t)}; text sample: ${(t.match(/(All time|Last \d+ days)[^.]{0,40}/) || [""])[0]}`, "/portfolio/universe/[key]");
    void musicTotal;

    // ---------- Exhibitions list: Duplicate and View public page
    await O.visit("/museum"); await sleep(9000);
    const before = ((await admin.from("galleries").select("id").eq("profile_id", P)).data || []).length;
    await O.evaluate("(() => { window.__opened = []; const o = window.open; window.open = function (u) { window.__opened.push(String(u)); return null; }; return true; })()");
    await A.clickText(O, "^View public page", "button"); await sleep(1000);
    const opened = await O.evaluate("window.__opened");
    await rec(O, opened.length === 1 && /\/museum\/share\/|\/gallery\//.test(opened[0]), "Exhibition details: View public page", "opens the public (share) page, not the owner's editor", `window.open called with: ${JSON.stringify(opened)}`, "/museum");
    await A.clickText(O, "^Duplicate$", "button"); await sleep(6000);
    const after = (await admin.from("galleries").select("id,title,visibility").eq("profile_id", P)).data || [];
    const copy = after.find((g) => / \(copy\)$/.test(g.title || ""));
    if (copy) cleanup.push(() => admin.from("galleries").delete().eq("id", copy.id));
    await rec(O, after.length === before + 1 && !!copy && copy.visibility === "LOCKED", "Exhibition details: Duplicate", "a copy appears (one more exhibition, titled '(copy)', private)", `exhibitions ${before} -> ${after.length}; copy=${copy ? copy.title + " / " + copy.visibility : "none"}`, "/museum");

    // ---------- Sign out everywhere asks first
    await O.visit("/account/security"); await sleep(7000);
    O.dialogs.length = 0; O.dialogMode = "dismiss";
    await A.clickText(O, "^Sign out all$", "button"); await sleep(2500);
    const stayed = (await O.path()).startsWith("/account/security");
    await rec(O, O.dialogs.length === 1 && /Sign out of every device/i.test(O.dialogs[0].message) && stayed, "Sign out all, then Cancel in the confirmation", "a confirmation is asked; cancelling keeps the person signed in on this page", `dialog=${JSON.stringify(O.dialogs)}; stayed=${stayed}`, "/account/security");

    // ---------- Watchlist target price
    const wid = "rb39_wish_" + m.stamp;
    await admin.from("wishlist").delete().eq("id", wid);
    await admin.from("wishlist").insert({ id: wid, profile_id: P, title: "RB39 Wish", target_price: 150, created_at: new Date().toISOString() });
    cleanup.push(() => admin.from("wishlist").delete().eq("id", wid));
    await O.visit("/watchlist"); await O.waitFor("document.body.innerText.includes('RB39 Wish')", 45000).catch(() => {}); await sleep(3000);
    await A.clickExpr(O, "[...document.querySelectorAll('button')].find((b) => b.innerText.includes('RB39 Wish') && /current value/i.test(b.innerText))"); await sleep(1200);
    await A.clickSel(O, '[aria-label="Set target price"]'); await sleep(800);
    const gotInput = await O.evaluate("!!document.querySelector('input[placeholder=\"Target price\"]')");
    if (gotInput) {
      await A.typeInto(O, 'input[placeholder="Target price"]', "abc"); await A.press(O, "Enter"); await sleep(2500);
      const tt = await body(O);
      const db = (await admin.from("wishlist").select("target_price").eq("id", wid).maybeSingle()).data;
      await rec(O, Number(db.target_price) === 150 && /not a number|Enter an amount/i.test(tt), "Watchlist: target price 'abc' then Save", "refused with a message; the existing $150 is kept", `database target=${db.target_price}; message=${(tt.match(/Target price is not a number[^.]*\./i) || ["(none)"])[0]}`, "/watchlist");
    } else await rec(O, false, "Watchlist: target price 'abc' then Save", "refused; $150 kept", "could not open the target editor in this test", "/watchlist");
    await O.close();

    // ---------- /auth/confirmed without a link
    const V = await open("visitor");
    await V.visit("/auth/confirmed"); await sleep(11000);
    t = await body(V);
    await rec(V, !/Your email is confirmed/i.test(t) && /link/i.test(t), "/auth/confirmed opened with no confirmation link", "does not say the email is confirmed; says the link is missing or expired", `text: ${t.slice(t.indexOf("Back"), t.indexOf("Back") + 160)}`, "/auth/confirmed");
    // ---------- The Flip links
    await V.close();
    const O2 = await open("owner");
    await O2.visit("/saved"); await sleep(6000);
    const fl = await hrefs(O2, "/Flip/i");
    await O2.visit("/discover?flip=1"); await sleep(9000);
    const deck = await O2.evaluate("!!document.querySelector('[role=dialog], [aria-modal=true]') || /swipe/i.test(document.body.innerText)");
    await rec(O2, fl.length > 0 && fl.every((h) => h === "/discover?flip=1") && deck, "Saved: the links named The Flip", "link to /discover?flip=1 and the deck opens there", `links=${JSON.stringify(fl)}; deck opened=${deck}`, "/saved");
    await O2.close();
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    for (const fn of cleanup.reverse()) { try { await fn(); } catch {} }
    for (const S of sessions) { try { await S.close(); } catch {} }
    fs.writeFileSync(path.join(EV, `rb39-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    for (const c of out.cases.filter((c) => !c.ok)) console.log("NOT OK:", c.control, "|", String(c.actual).slice(0, 420));
    process.exit(0);
  }
})();
