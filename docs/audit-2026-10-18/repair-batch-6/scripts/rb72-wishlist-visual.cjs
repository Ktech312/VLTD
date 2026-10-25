// Wishlist / Pull List / Following: populated, settled screenshots (desktop 1440x900 and phone 390x844) plus the measurements behind a visual review (RB72).
// This script gives EVIDENCE for a person to judge; it does not decide visual acceptance. The functional results (RB67/RB68) are separate.
// The QA owner's account is filled through the database (so the page is populated across categories exactly as a long-time user's would be), then read through the real page.
//   AUDIT_MANIFEST=<manifest> node rb72-wishlist-visual.cjs <label> [seed|shoot|both]
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { sleep, session, admin, man } = T;
const m = man(); const P = m.personalId;
const LABEL = process.argv[2] || "run";
const MODE = process.argv[3] || "both";
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, shots: [], measure: {} };

const W = (id, o) => ({ id, profile_id: P, title: o.title, universe: o.universe, category: o.category, status: o.status || "want", priority: o.priority || "medium", quantity: o.quantity || 1, quantity_acquired: o.acquired || 0, edition: o.edition ?? null, release_date: o.date ?? null, release_window: o.window ?? null, expected_price: o.price ?? null, target_price: o.target ?? null, shop: o.shop ?? null, notes: o.notes ?? null, details: o.details ?? null, series: o.series ?? null, source: o.source || "manual", source_identity: o.identity ?? null, rule_id: o.rule ?? null, skipped_at: o.skipped ? new Date().toISOString() : null });
const WANTS = [
  W("qa_v_comic", { title: "Absolute Batman #26", universe: "POP_CULTURE", category: "Comics", edition: "Standard cover", date: "2026-11-12", price: 4.99, series: "Absolute Batman", source: "metron", identity: "metron:issue:qa26", rule: "qa_rule_comic" }),
  W("qa_v_comic2", { title: "Absolute Batman #27", universe: "POP_CULTURE", category: "Comics", edition: "Standard cover", date: "2026-12-10", price: 4.99, series: "Absolute Batman", source: "metron", identity: "metron:issue:qa27", rule: "qa_rule_comic" }),
  W("qa_v_tcg", { title: "Starlight Duel Booster Box, Set 7", universe: "TCG", category: "Trading cards", edition: "Sealed, English", window: "Q1 2027", price: 143, target: 130, quantity: 2, details: { game: "Starlight Duel", set: "Set 7" }, shop: "Local card shop" }),
  W("qa_v_sports", { title: "2026 Prizm Football Hobby Box", universe: "SPORTS", category: "Sports cards", edition: "Hobby", date: "2026-12-04", price: 389, shop: "Dealer preorder", notes: "Ask about the case-break price before ordering." }),
  W("qa_v_toy", { title: "Pocket Hero Figure, wave 3", universe: "POP_CULTURE", category: "Toys", edition: "Chase variant", date: "2026-11-20", price: 24.99, quantity: 3 }),
  W("qa_v_vinyl", { title: "Night Courier Soundtrack LP", universe: "MUSIC", category: "Vinyl", edition: "Limited colored vinyl", date: "2026-12-12", price: 35 }),
  W("qa_v_game", { title: "Harbor Quest Collector's Edition", universe: "GAMES", category: "Video games", edition: "Collector's Edition", date: "2027-02-14", price: 149.99, status: "preordered", shop: "Publisher store" }),
  W("qa_v_watch", { title: "Field watch, steel, 38 mm", universe: "JEWELRY_APPAREL", category: "Watches", priority: "high" }),
  W("qa_v_car", { title: "1:18 Roadster, die-cast", universe: "AUTOMOTIVE", category: "Die-cast", edition: "Race livery", window: "Spring 2027", price: 89 }),
  W("qa_v_art", { title: "Signed screen print, 'Harbor at Dusk'", universe: "ART", category: "Prints", notes: "Artist is announcing the edition size next month. Watch for a numbered edition under 300, signed and numbered, with a certificate of authenticity from the printer." }),
  W("qa_v_tin", { title: "Tin wind-up robot", universe: "MISC", category: "Other", details: { era: "1960s", maker: "unknown" } }),
  W("qa_v_partial", { title: "Pocket Hero Figure, wave 2", universe: "POP_CULTURE", category: "Toys", edition: "Standard", quantity: 2, acquired: 1, price: 19.99, date: "2026-11-05" }),
  W("qa_v_skipped", { title: "Skipped item (should not show in the list)", universe: "MISC", category: "Other", status: "skipped", skipped: true }),
];
const RULES = [
  { id: "qa_rule_comic", profile_id: P, kind: "comic_series", name: "Absolute Batman", publisher: "DC Comics", year_began: 2024, source: "metron", source_key: "metron:series:8477", quantity: 1, state: "following", last_result: "2 releases found: 2 added, 0 date changes." },
  { id: "qa_rule_card", profile_id: P, kind: "card_product", name: "Starlight Duel booster boxes", source: "manual", quantity: 2, format_note: "Sealed English boxes only", state: "following" },
  { id: "qa_rule_toy", profile_id: P, kind: "toy_line", name: "Pocket Hero figures", source: "manual", quantity: 1, state: "paused" },
  { id: "qa_rule_old", profile_id: P, kind: "card_product", name: "Retired set", source: "manual", quantity: 1, state: "stopped" },
];

const MEASURE = `(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const rows = [...document.querySelectorAll('[data-testid="want-row"]')].filter(vis);
  const rects = rows.map((r) => Math.round(r.getBoundingClientRect().height));
  const rules = [...document.querySelectorAll('[data-testid="rule-card"]')].filter(vis);
  const ctl = [...document.querySelectorAll('button,a,[role="tab"],input,select')].filter(vis).map((e) => { const r = e.getBoundingClientRect(); return { t: (e.getAttribute('aria-label') || e.textContent || e.placeholder || '').replace(/\\s+/g, ' ').trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) }; });
  const small = ctl.filter((c) => c.h < 36 || c.w < 36);
  const text = document.body.innerText.replace(/\\s+/g, ' ');
  const pricingPanels = [...document.querySelectorAll('[data-testid="planned-total"]')].map((e) => e.innerText.replace(/\\s+/g, ' ').slice(0, 120));
  const labels = ctl.map((c) => c.t).filter(Boolean);
  const dupLabels = Object.entries(labels.reduce((a, l) => (a[l] = (a[l] || 0) + 1, a), {})).filter(([, n]) => n > 1).map(([l, n]) => l + ' x' + n);
  return { rowCount: rows.length, rowHeights: { min: Math.min(...rects), max: Math.max(...rects), avg: Math.round(rects.reduce((a, b) => a + b, 0) / Math.max(1, rects.length)) }, ruleCards: rules.length, controlsUnder36: small.slice(0, 12), controlCount: ctl.length, repeatedControlLabels: dupLabels.slice(0, 20), pricingPanels, overflowX: document.documentElement.scrollWidth - innerWidth, hasLoading: /Loading|Syncing/.test(text), textSample: text.slice(0, 160) };
})()`;

(async () => {
  if (MODE === "seed" || MODE === "both") {
    await admin.from("wishlist").delete().eq("profile_id", P); await admin.from("pull_rules").delete().eq("profile_id", P);
    const a = await admin.from("wishlist").insert(WANTS); const b = await admin.from("pull_rules").insert(RULES);
    console.log("seeded wishlist", a.error ? a.error.message : WANTS.length, "rules", b.error ? b.error.message : RULES.length);
    if (a.error || b.error) process.exit(1);
  }
  if (MODE === "seed") process.exit(0);
  for (const dev of [{ name: "desktop", width: 1440, height: 900, mobile: false }, { name: "phone", width: 390, height: 844, mobile: true }]) {
    const S = await session("owner", { width: dev.width, height: dev.height, mobile: dev.mobile });
    try {
      await S.visit("/watchlist"); await sleep(6000); await S.settle({ quiet: 1500 });
      // the browser's own "Add to Home Screen" promotion appears on a first visit and sits over the page: dismissed so the page itself can be judged (it is noted in the review)
      await S.evaluate(`(() => { const box = [...document.querySelectorAll('div')].find((d) => /Add to Home Screen/.test(d.textContent || '') && d.querySelectorAll('button').length <= 3 && d.getBoundingClientRect().height < 120); const x = box && [...box.querySelectorAll('button')].find((b) => /^[×✕x]$/i.test(b.textContent.trim()) || /close|dismiss/i.test(b.getAttribute('aria-label') || '')); if (x) { x.click(); return true; } return false; })()`);
      await sleep(600);
      const click = (label, scope) => S.evaluate(`(() => { const root = ${scope || "document"}; const el = [...root.querySelectorAll('button,a,[role="tab"]')].find((x) => x.getBoundingClientRect().width > 0 && x.textContent.replace(/\s+/g, ' ').trim().startsWith(${JSON.stringify(label)})); if (!el) return false; el.click(); return true; })()`);
      const tabs = `document.querySelector('[data-testid="watchlist-controls"]')`;
      const shotAt = async (name, y) => { await S.evaluate(`window.scrollTo(0, ${y}); true`); await sleep(700); out.shots.push(await S.jshot(name)); };
      for (const tab of ["Wishlist", "Pull List", "Following"]) {
        await click(tab, tabs); await sleep(2500); await S.settle({ quiet: 1200 });
        const meas = await S.evaluate(MEASURE);
        out.measure[`${dev.name}:${tab}`] = meas;
        const slug = tab.toLowerCase().replace(/W+/g, "-");
        await shotAt(`rb72-${LABEL}-${dev.name}-${slug}-top`, 0);
        if (meas.rowCount > 6) await shotAt(`rb72-${LABEL}-${dev.name}-${slug}-middle`, dev.mobile ? 900 : 650);
        await S.evaluate("window.scrollTo(0, 0); true");
      }
      // details: one row opened as a person would, scrolled into view
      await click("Wishlist", tabs); await sleep(2000);
      await S.evaluate(`(() => { const r = [...document.querySelectorAll('[data-testid="want-row"]')].find((x) => x.innerText.includes('Prizm')); const b = r && (r.querySelector('button[aria-expanded]') || r.querySelector('button')); if (b) b.click(); return !!b; })()`);
      await sleep(1200);
      await S.evaluate(`(() => { const r = [...document.querySelectorAll('[data-testid="want-row"]')].find((x) => x.innerText.includes('Prizm')); if (r) r.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80); return true; })()`);
      await sleep(700);
      out.measure[`${dev.name}:row-open`] = await S.evaluate(MEASURE);
      out.shots.push(await S.jshot(`rb72-${LABEL}-${dev.name}-wishlist-row-open`));
      // does the open row follow you to another tab?
      await click("Pull List", tabs); await sleep(2000);
      out.measure[`${dev.name}:pull-list-after-open`] = { openFormVisible: await S.evaluate(`!![...document.querySelectorAll('label,div')].find((e) => /EDITION OR VARIANT/i.test(e.textContent || '') && e.getBoundingClientRect().height > 0)`) };
    } catch (e) { out.error = String((e && e.stack) || e).slice(0, 600); console.error(e); }
    finally { try { await S.close(); } catch {} }
  }
  fs.writeFileSync(path.join(EV, `rb72-${LABEL}.json`), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ shots: out.shots, measure: out.measure }, null, 1));
  process.exit(0);
})();
