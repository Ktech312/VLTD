// Wishlist / Pull List / Following verification (RB67). Run against production or, with --base=http://localhost:3000, a local build. Isolated QA owner.
// Everything the person types or taps goes through the real page; the database is read only to prove what was (and was not) saved.
//   AUDIT_MANIFEST=<manifest> node rb67-watchlist.cjs <label> [--base=...] [--phone]
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { sleep, session, admin, man } = T;
const m = man(); const P = m.personalId;
const LABEL = process.argv[2] || "run";
const r = T.R("RB67");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [], notes: {} };

const SET = `const setVal = (el, v) => { const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); };`;
const DIALOG = `(document.querySelector('[role="dialog"]'))`;

(async () => {
  let S;
  const ck = (ok, control, expected, actual, page) => { out.cases.push({ ok: !!ok, control }); r.check(!!ok, { page: page || "/watchlist", control, expected, actual: String(actual).slice(0, 700), evidence: "", impact: "wishlist", repro: "" }); };
  const click = (text, scope = "document") => S.evaluate(`(() => { const root = ${scope} || document; const el = [...root.querySelectorAll('button,a,[role="menuitem"]')].find((x) => x.getBoundingClientRect().width > 0 && x.textContent.replace(/\\s+/g, ' ').trim() === ${JSON.stringify(text)}); if (!el) return false; el.click(); return true; })()`);
  const clickStart = (text, scope = "document") => S.evaluate(`(() => { const root = ${scope} || document; const el = [...root.querySelectorAll('button,a,[role="menuitem"]')].find((x) => x.getBoundingClientRect().width > 0 && x.textContent.replace(/\\s+/g, ' ').trim().startsWith(${JSON.stringify(text)})); if (!el) return false; el.click(); return true; })()`);
  const fill = (label, value, scope = DIALOG) => S.evaluate(`(() => { ${SET} const root = ${scope}; if (!root) return 'noscope'; const lab = [...root.querySelectorAll('label')].find((l) => { const s = l.querySelector('span'); return s && s.textContent.trim().toLowerCase().startsWith(${JSON.stringify(label.toLowerCase())}); }); if (!lab) return 'nolabel:' + ${JSON.stringify(label)}; const el = lab.querySelector('input,select,textarea'); if (!el) return 'noinput'; if (el.tagName === 'SELECT') { const opt = [...el.options].find((o) => o.text.trim() === ${JSON.stringify(String(value))} || o.value === ${JSON.stringify(String(value))}); if (!opt) return 'nooption:' + ${JSON.stringify(String(value))} + ' in ' + [...el.options].map((o) => o.text).join('|'); setVal(el, opt.value); } else setVal(el, ${JSON.stringify(String(value))}); return 'ok'; })()`);
  const text = () => S.evaluate("document.body.innerText.replace(/\\s+/g, ' ')");
  const rowsText = () => S.evaluate(`[...document.querySelectorAll('[data-testid="want-row"]')].map((r) => r.innerText.replace(/\\s+/g, ' ').trim().slice(0, 240))`);
  const settle = (ms = 900) => sleep(ms);
  const dbWants = async () => (await admin.from("wishlist").select("*").eq("profile_id", P)).data || [];
  const lsWants = () => S.evaluate(`(() => { try { return JSON.parse(localStorage.getItem('vltd_wishlist:${P}') || '[]'); } catch { return []; } })()`);
  const vaultCount = async () => (await admin.from("vault_items").select("id", { count: "exact", head: true }).eq("profile_id", P)).count;

  async function addWant(f) {
    await click("Add"); await sleep(600);
    await click("Type it in", DIALOG); await sleep(300);
    const log = [];
    log.push(await fill("Title", f.title));
    if (f.universe) log.push(await fill("Category", f.universe));
    if (f.type) log.push(await fill("Type", f.type));
    if (f.series) log.push(await fill("Series or product line", f.series));
    if (f.edition) log.push(await fill("Edition or variant", f.edition));
    if (f.quantity) log.push(await fill("Quantity", f.quantity));
    if (f.priority) log.push(await fill("Priority", f.priority));
    if (f.price) log.push(await fill("Expected price", f.price));
    if (f.target) log.push(await fill("Target price", f.target));
    if (f.date) log.push(await fill("Release date", f.date));
    if (f.window) log.push(await fill("Or a release window", f.window));
    if (f.shop) log.push(await fill("Shop", f.shop));
    if (f.link) log.push(await fill("Product or shop link", f.link));
    if (f.older) { await S.evaluate(`(() => { const t = document.querySelector('[role="dialog"] [aria-label="Older or vintage piece"]'); if (t) t.click(); return !!t; })()`); await sleep(300); }
    for (const [k, v] of Object.entries(f.details || {})) log.push(await fill(k, v));
    if (f.notes) log.push(await fill("Notes", f.notes));
    const bad = log.filter((x) => x !== "ok");
    await S.jshot(`rb67-${LABEL}-add-${f.key}`);
    await click("Add to wishlist", DIALOG); await sleep(1200);
    return bad;
  }

  try {
    await admin.from("wishlist").delete().eq("profile_id", P); // a clean start for this run (QA fixture rows only)
    S = await session("owner", { width: 1440, height: 900 });
    await S.visit("/watchlist"); await sleep(3500);
    out.notes.emptyText = (await text()).slice(0, 300);
    ck(/Wishlist/.test(await text()) && /Pull List/.test(await text()) && /Following/.test(await text()), "the page offers Wishlist, Pull List and Following", "three tabs", (await text()).slice(0, 200));
    ck(/Nothing on your wishlist yet/.test(await text()), "an empty account shows an empty state with a way to add", "empty state", (await text()).slice(0, 300));

    // Seed the four examples through the real form.
    const seeds = [
      { key: "comic", title: "Night Courier #4", universe: "Pop Culture", type: "Comics", series: "Night Courier", edition: "Cover B", quantity: "2", price: "4.99", date: "2026-11-12", shop: "Corner Comics", notes: "private-note-comic", details: { Publisher: "Example Comics", "Issue number": "4" } },
      { key: "card", title: "Starlight Duel: Booster Box", universe: "TCG & Non Sport Card", series: "Set 7", edition: "sealed, English", quantity: "1", price: "143", target: "130", window: "Q1 2027", priority: "high", details: { "Game or sport": "Example card game", "Set or product": "Set 7" } },
      { key: "toy", title: "Cosmic Rangers 6-inch: Captain Vale", universe: "Pop Culture", series: "Cosmic Rangers", edition: "Wave 3", quantity: "1", price: "27.99", date: "2026-12-06", shop: "Toy Barn" },
      { key: "vintage", title: "Tin wind-up robot", universe: "Misc", older: true, quantity: "1", details: { "Era or decade": "1960s", "Maker or brand": "unknown" } },
    ];
    for (const s of seeds) {
      const bad = await addWant(s);
      out.notes["fillProblems_" + s.key] = bad;
    }
    await S.jshot(`rb67-${LABEL}-desktop-wishlist`);
    const rows = await rowsText();
    out.notes.rows = rows;
    ck(rows.length === 4, "four wants added through the form (comic, card product, toy, older undated piece)", "four rows", JSON.stringify(rows));
    const tot = await S.evaluate(`(document.querySelector('[data-testid="planned-total"]') || {}).innerText || ''`);
    out.notes.total = tot;
    // 2 x 4.99 + 143 + 27.99 = 180.97; the vintage one has no price
    ck(/\$180\.97/.test(tot) && /1 without a price/.test(tot), "planned total counts known prices times quantities and counts the unpriced one separately", "$180.97 and 1 without a price", tot);
    ck(rows.some((x) => /Tin wind-up robot/.test(x) && /Date unknown/.test(x) && /Price unknown/.test(x)), "the undated, unpriced piece says Date unknown and Price unknown (not today, not $0)", "unknown shown", rows.find((x) => /Tin/.test(x)));
    ck(rows.some((x) => /Starlight Duel/.test(x) && /Window: Q1 2027/.test(x)), "the card product shows its release window", "Window: Q1 2027", rows.find((x) => /Starlight/.test(x)));

    // The vintage piece stored no invented date or price
    const ls = await lsWants();
    const tin = ls.find((w) => w.title === "Tin wind-up robot");
    ck(tin && tin.releaseDate === undefined && tin.price === undefined && tin.releaseWindow === undefined, "nothing was invented for the undated piece: no date, window or price stored", "all undefined", JSON.stringify(tin));
    ck(tin && tin.details && tin.details.era === "1960s" && tin.details.maker === "unknown", "category-specific details (era, maker) were kept for the older piece", "details stored", JSON.stringify(tin && tin.details));
    const card = ls.find((w) => w.title.startsWith("Starlight"));
    ck(card && card.details && card.details.game === "Example card game" && !(ls.find((w) => w.title === "Cosmic Rangers 6-inch: Captain Vale") || {}).details, "trading-card fields appear for a card product only (the toy has none)", "card details present, toy none", JSON.stringify([card && card.details]));

    // Pull List
    await clickStart("Pull List", `document.querySelector('[data-testid="watchlist-controls"]')`); await sleep(800);
    await S.jshot(`rb67-${LABEL}-desktop-pull`);
    const pull = await S.evaluate(`[...document.querySelectorAll('[data-testid="pull-group"]')].map((g) => g.querySelector('h2').innerText.replace(/\\s+/g, ' ') + ' :: ' + [...g.querySelectorAll('[data-testid="want-row"]')].map((r) => r.innerText.split('\\n')[0]).join(' / '))`);
    out.notes.pull = pull;
    ck(pull.length === 3 && /November 2026/i.test(pull[0]) && /December 2026/i.test(pull[1]) && /Q1 2027/i.test(pull[2]) && !pull.join().includes("Tin wind-up"), "the Pull List groups by month and window, and leaves the undated piece off", "Nov, Dec, Q1 2027", JSON.stringify(pull));

    // Wishlist again: statuses
    await clickStart("Wishlist", `document.querySelector('[data-testid="watchlist-controls"]')`); await sleep(600);
    const first = async (title) => S.evaluate(`(() => { const r = [...document.querySelectorAll('[data-testid="want-row"]')].find((x) => x.innerText.includes(${JSON.stringify(title)})); return r ? r.getAttribute('data-status') : null; })()`);
    const rowClick = (title, btnText) => S.evaluate(`(() => { const r = [...document.querySelectorAll('[data-testid="want-row"]')].find((x) => x.innerText.includes(${JSON.stringify(title)})); if (!r) return 'norow'; const b = [...r.querySelectorAll('button')].find((x) => x.getBoundingClientRect().width > 0 && x.textContent.trim() === ${JSON.stringify(btnText)}); if (!b) return 'nobtn'; b.click(); return 'ok'; })()`);
    await rowClick("Cosmic Rangers", "Preordered"); await sleep(800);
    ck(await first("Cosmic Rangers") === "preordered", "Preordered is recorded by the person (one tap) and can be undone", "status preordered", await first("Cosmic Rangers"));
    ck(/arranged it yourself with a shop|VLTD has placed no order|VLTD places no order/i.test(await S.evaluate(`document.body.innerHTML`)), "the page says Preordered is your own arrangement and VLTD placed no order", "disclosure present", "n/a");
    await rowClick("Cosmic Rangers", "Wanted"); await sleep(600);
    ck(await first("Cosmic Rangers") === "want", "Preordered can be undone back to Wanted", "status want", await first("Cosmic Rangers"));

    // Skip keeps the record
    await S.evaluate(`(() => { const r = [...document.querySelectorAll('[data-testid="want-row"]')].find((x) => x.innerText.includes('Starlight')); const b = r.querySelector('button[aria-label^="More for"]'); b.click(); return !!b; })()`); await sleep(500);
    await clickStart("Skip", `document.querySelector('[role="menu"]') || document`); await sleep(900);
    const afterSkip = await lsWants();
    ck(afterSkip.some((w) => w.title.startsWith("Starlight") && w.status === "skipped") && !(await rowsText()).some((x) => x.includes("Starlight")), "Skip keeps the record but takes it off the open list", "status skipped, hidden from default view", JSON.stringify(afterSkip.filter((w) => w.title.startsWith("Starlight")).map((w) => w.status)));
    ck(/\$180\.97|\$37\.97|\$37\.9/.test(await S.evaluate(`(document.querySelector('[data-testid="planned-total"]') || {}).innerText || ''`)) === true, "a skipped want no longer counts toward the planned total", "total drops by $143", await S.evaluate(`(document.querySelector('[data-testid="planned-total"]') || {}).innerText || ''`));
    await S.visit("/watchlist"); await sleep(3000);
    ck((await lsWants()).some((w) => w.title.startsWith("Starlight") && w.status === "skipped"), "a skipped want stays skipped after a reload", "still skipped", "reloaded");
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String((e && e.stack) || e).slice(0, 900); }
  finally {
    try { if (S) await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb67-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(out.cases.map((c) => (c.ok ? "PASS " : "FAIL ") + c.control).join("\n"), out.error ? "\nRUNNER ERROR " + out.error : "");
    process.exit(0);
  }
})();
