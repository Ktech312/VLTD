// RC-23: Watchlist numbers, Market seller/link/sort/pills/prices. Production, isolated QA owner and QA public for-sale items; all temporary rows are QA-owned and restored/removed.
// The asking-price checks are run against whichever the public view offers: with the column (after the batch 7 SQL) cards say "asking"; without it they say "value".
//   AUDIT_MANIFEST=<manifest> node rb35-watchlist-market.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const env = require(path.join(SD, "..", "qa", "env.cjs"));
const { sleep, session, admin } = A;
const m = A.man(); const P = m.personalId;
const LABEL = process.argv[2] || "run";
const r = A.R("RB35");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] }; let n = 0;
async function rec(S, ok, control, expected, actual, page) {
  let ev = ""; if (S) { try { await sleep(250); ev = path.join(A.AUD, await S.jshot(`rb35-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page, control, expected, actual, evidence: ev ? path.relative(A.AUD, ev).replace(/\\/g, "/") : "", impact: "RC-23", repro: "" });
}
const body = async (S) => (await S.text().catch(() => "")).replace(/\s+/g, " ").trim();
(async () => {
  const sessions = []; const wishIds = []; const watchItemIds = [];
  let restore = null;
  try {
    const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const hasAsking = !(await anon.from("public_vault_items").select("id,asking_price").limit(1)).error;
    out.facts = { publicViewHasAskingPrice: hasAsking };

    // ---------- Watchlist
    const now = Date.now(); const hr = 3600e3;
    const wishes = [
      { id: "rb35_wish_a_" + m.stamp, profile_id: P, title: "RB35 Wish A", target_price: 100, created_at: new Date(now - 1 * hr).toISOString() },
      { id: "rb35_wish_b_" + m.stamp, profile_id: P, title: "RB35 Wish B", target_price: 2500, created_at: new Date(now - 30 * hr).toISOString() },
    ];
    await admin.from("wishlist").delete().in("id", wishes.map((w) => w.id));
    const wi = await admin.from("wishlist").insert(wishes); if (wi.error) throw new Error("wish insert: " + wi.error.message);
    wishIds.push(...wishes.map((w) => w.id));
    const watched = [{ item_id: "rb35_watch_a_" + m.stamp, title: "RB35 Watched A", current_value: 250, saved_at: new Date(now - 3 * hr).toISOString() }];
    await admin.from("watchlist").delete().in("item_id", watched.map((w) => w.item_id));
    const wl = await admin.from("watchlist").insert(watched.map((w) => ({ ...w, owner_profile_id: P }))); if (wl.error) throw new Error("watch insert: " + wl.error.message);
    watchItemIds.push(...watched.map((w) => w.item_id));

    const O = await session("owner", { width: 1440, height: 900 }); sessions.push(O);
    await O.visit("/watchlist"); await O.waitFor("document.body.innerText.includes('RB35 Wish A')", 45000, "watchlist").catch(() => {}); await sleep(3000);
    const cardOf = (name) => `[...document.querySelectorAll('button')].find((b) => b.innerText.includes(${JSON.stringify(name)}) && /current value/i.test(b.innerText))`;
    const card = (name) => O.evaluate(`(() => { const b = ${cardOf(name)}; return b ? b.innerText.replace(/\\s+/g, ' ') : null; })()`);
    const wa = await card("RB35 Wish A"), wb = await card("RB35 Wish B"), wc = await card("RB35 Watched A");
    await rec(O, wa && /CURRENT VALUE\s*--/i.test(wa) && /TARGET PRICE\s*\$100\b/i.test(wa) && wb && /CURRENT VALUE\s*--/i.test(wb) && /TARGET PRICE\s*\$2,500/i.test(wb), "Wishlist cards: Current Value for a wish that only has a target price", "'--' for Current Value (a wish has no market value), the target shown as entered", `A: ${String(wa).slice(0, 140)} | B: ${String(wb).slice(0, 140)}`, "/watchlist");
    await rec(O, wc && /CURRENT VALUE\s*\$250\b/i.test(wc) && /TARGET PRICE\s*--/i.test(wc), "Watched item card: Target Price", "'--' (no target was entered); the real value $250", `watched: ${String(wc).slice(0, 160)}`, "/watchlist");
    const t = await body(O);
    const wv = (t.match(/\$([\d,]+)\s*Watchlist value/i) || t.match(/Watchlist value\s*\$([\d,]+)/i) || [])[1];
    const al = (t.match(/(\d+)\s*Alerts active/i) || t.match(/Alerts active\s*(\d+)/i) || [])[1];
    const watchedTotal = (await admin.from("watchlist").select("current_value").eq("owner_profile_id", P)).data.reduce((s, x) => s + Number(x.current_value || 0), 0);
    await rec(O, Number(String(wv).replace(/,/g, "")) === watchedTotal && Number(al) === 0, "Watchlist summary strip", `Watchlist value = the real values of watched items ($${watchedTotal}); Alerts active 0`, `watchlist value=${wv}; alerts active=${al}`, "/watchlist");
    const order = await O.evaluate("[...document.querySelectorAll('button')].filter((b) => /current value/i.test(b.innerText)).map((b) => (b.innerText.match(/RB35 (Wish A|Watched A|Wish B)/) || [''])[0]).filter(Boolean)");
    await rec(O, JSON.stringify(order) === JSON.stringify(["RB35 Wish A", "RB35 Watched A", "RB35 Wish B"]), "Watchlist sort: Recently added", "newest first across wishlist and watched items (1h, 3h, 30h)", `order=${JSON.stringify(order)}`, "/watchlist");
    await O.close();

    // ---------- Market: QA items made public and for sale for the test, restored after
    const items = (await admin.from("vault_items").select("id,status,is_public,asking_price,current_value,universe").eq("profile_id", P).like("id", "qa_vz_%").order("id").limit(4)).data;
    restore = { items, profile: (await admin.from("profiles").select("is_public,onboarding_completed").eq("id", P).maybeSingle()).data, hadPublic: (await admin.from("public_profiles").select("*").eq("profile_id", P).maybeSingle()).data };
    await admin.from("profiles").update({ is_public: true, onboarding_completed: true }).eq("id", P);
    await admin.from("public_profiles").upsert({ profile_id: P, display_name: "RB35 Seller", bio: "synthetic QA seller" });
    const plan = [{ ask: 250, val: 100 }, { ask: 90, val: 40 }, { ask: 400, val: 200 }, { ask: null, val: 65 }];
    for (let i = 0; i < items.length; i++) await admin.from("vault_items").update({ status: "FOR_SALE", is_public: true, asking_price: plan[i].ask, current_value: plan[i].val }).eq("id", items[i].id);
    const shown = plan.map((p) => (hasAsking ? (p.ask ?? p.val) : p.val));
    const V = await session("visitor", { width: 1440, height: 900 }); sessions.push(V);
    await V.visit("/market"); await V.waitFor("document.body.innerText.includes('items listed')", 45000, "market").catch(() => {}); await sleep(3000);
    const cards = () => V.evaluate("[...document.querySelectorAll('a[href^=\"/v/\"], a[href=\"/market\"]')].filter((a) => /FOR SALE/.test(a.innerText)).map((a) => ({ href: a.getAttribute('href'), text: a.innerText.replace(/\\s+/g, ' ') }))");
    let cs = await cards(); const mine = cs.filter((c) => c.href === `/v/${P}`);
    await rec(V, mine.length >= 4 && cs.every((c) => !/undefined/.test(c.href)) && mine.every((c) => /RB35 Seller/.test(c.text)), "Market cards: seller and link", `each card names the seller (RB35 Seller) and links to /v/<seller profile id>`, `links to the seller=${mine.length} of ${cs.length}; names=${mine.every((c) => /RB35 Seller/.test(c.text))}`, "/market");
    await rec(V, mine.length >= 4 && mine.every((c) => /\$[\d,]+/.test(c.text) || /Price on request/.test(c.text)) && (hasAsking ? mine.some((c) => /\$250\s*asking/.test(c.text)) : mine.some((c) => /\$100\s*value/.test(c.text))), `Market cards: price (${hasAsking ? "asking price available" : "asking price not offered by the public view yet: the item's value, labelled 'value'"})`, hasAsking ? "$250 asking / $90 asking / $400 asking / $65 value" : "value amounts, each labelled 'value'", `cards: ${mine.map((c) => (c.text.match(/\$[\d,]+\s*(asking|value)?/) || ["?"])[0]).join(" | ")}`, "/market");
    // pills add up to All
    const pills = await V.evaluate("[...document.querySelectorAll('button')].map((b) => b.innerText.trim()).filter((t) => /\\(\\d+\\)$/.test(t))");
    const num = (s) => Number((s.match(/\((\d+)\)$/) || [])[1]);
    const all = num(pills.find((p) => /^All/.test(p)) || "");
    const others = pills.filter((p) => !/^All/.test(p)).map(num).reduce((a, b) => a + b, 0);
    await rec(V, all > 0 && all === others, "Market universe pills", "the universe pills add up to All", `pills=${JSON.stringify(pills)}`, "/market");
    // sort low -> high: unpriced last
    await A.clickSel(V, '[aria-label="Sort listings"]'); await sleep(500);
    await A.clickText(V, "Low", "[role=option],[role=menuitem],button,li"); await sleep(1200);
    cs = (await cards()).filter((c) => c.href === `/v/${P}`);
    const amounts = cs.map((c) => { const mm = c.text.match(/\$([\d,]+)/); return mm ? Number(mm[1].replace(/,/g, "")) : null; });
    const priced = amounts.filter((x) => x !== null);
    await rec(V, priced.every((x, i) => i === 0 || priced[i - 1] <= x) && (amounts.indexOf(null) === -1 || amounts.indexOf(null) >= priced.length), "Market sort: Price low to high", "ascending prices, no NaN, unpriced items last", `amounts in order: ${JSON.stringify(amounts)}`, "/market");
    const total = ((await body(V)).match(/Total asking:\s*\$([\d,]+)/) || [])[1];
    const expectTotal = shown.reduce((a, b) => a + b, 0);
    await rec(V, Number(String(total).replace(/,/g, "")) >= expectTotal, "Market: Total asking", `at least $${expectTotal} (the four QA listings)`, `total=${total}`, "/market");
    await V.close();
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    try { if (wishIds.length) await admin.from("wishlist").delete().in("id", wishIds); } catch {}
    try { if (watchItemIds.length) await admin.from("watchlist").delete().in("item_id", watchItemIds); } catch {}
    try {
      if (restore) {
        for (const i of restore.items) await admin.from("vault_items").update({ status: i.status, is_public: i.is_public, asking_price: i.asking_price, current_value: i.current_value }).eq("id", i.id);
        await admin.from("profiles").update({ is_public: restore.profile.is_public, onboarding_completed: restore.profile.onboarding_completed }).eq("id", P);
        if (restore.hadPublic) await admin.from("public_profiles").upsert(restore.hadPublic); else await admin.from("public_profiles").delete().eq("profile_id", P);
      }
    } catch {}
    for (const S of sessions) { try { await S.close(); } catch {} }
    fs.writeFileSync(path.join(EV, `rb35-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`, JSON.stringify(out.facts));
    for (const c of out.cases.filter((c) => !c.ok)) console.log("NOT OK:", c.control, "|", String(c.actual).slice(0, 400));
    process.exit(0);
  }
})();
