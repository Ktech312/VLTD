// RC-13 (header search, command palette), RC-14 (install pill), RC-15 (phone details sheet), verified on PRODUCTION with the isolated QA fixture.
// The install pill is shown by dispatching the browser's own `beforeinstallprompt` event, as the earlier audit runs did. Nothing is installed or saved.
//   AUDIT_MANIFEST=<manifest> node rb27-search-banner-sheet.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const X = require(path.join(SD, "audit-s-itm-lib.cjs"));
const { sleep, session } = A;
const m = A.man();
const LABEL = process.argv[2] || "run";
const r = A.R("RB27");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] }; let n = 0;
async function rec(S, ok, control, expected, actual, page) {
  let ev = ""; if (S) { try { await sleep(250); ev = path.join(A.AUD, await S.jshot(`rb27-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page, control, expected, actual, evidence: ev ? path.relative(A.AUD, ev).replace(/\\/g, "/") : "", impact: "batch 7", repro: "" });
}
const body = async (S) => (await S.text().catch(() => "")).replace(/\s+/g, " ").trim();
const cards = (S) => S.evaluate("[...document.querySelectorAll('a[href^=\"/vault/item/\"]')].map((a) => (a.innerText || a.getAttribute('aria-label') || '').trim().split('\\n')[0]).filter(Boolean)");
const hit = (S, expr) => S.evaluate(`(() => { const el = ${expr}; if (!el) return null; el.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = el.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { ok: !!t && (t === el || el.contains(t) || t.contains(el)), top: t ? t.tagName + ':' + (t.innerText || '').trim().slice(0, 30) : null, y: Math.round(r.top) }; })()`);
const pill = (S) => S.evaluate("document.body.innerText.includes('Add to Home Screen')");
const showPill = async (S) => { await S.evaluate("window.dispatchEvent(new Event('beforeinstallprompt')); true"); await sleep(800); };
const paletteResults = (S) => S.evaluate("[...document.querySelectorAll('[class*=\"z-[10000]\"] button')].map((b) => ({ t: (b.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 70), href: b.getAttribute('data-href') || '' })).filter((x) => x.t)");
(async () => {
  const sessions = [];
  const open = async (kind, o) => { const S = await session(kind, o || { width: 1440, height: 900 }); sessions.push(S); return S; };
  try {
    // ================= RC-13 header search and palette (owner, desktop)
    const O = await open("owner");
    await O.visit("/dashboard"); await O.waitFor("!!document.querySelector('input[placeholder^=\"Search vault\"]')", 40000, "header").catch(() => {}); await sleep(2500);
    await A.typeInto(O, 'input[placeholder^="Search vault"]', "Album 17"); await A.press(O, "Enter"); await A.waitPath(O, /^\/vault/, 15000); await sleep(4500);
    let c = await cards(O); let url = await O.evaluate("location.pathname + location.search");
    await rec(O, /q=Album/i.test(url) && c.length >= 1 && c.every((t) => /album 17/i.test(t)), "Header search 'Album 17' + Enter", "the Vault lists only items titled Album 17", `url=${url}; cards=${JSON.stringify(c.slice(0, 5))}`, "/vault?q");
    await A.typeInto(O, 'input[placeholder^="Search vault"]', "zzzznomatch"); await A.press(O, "Enter"); await sleep(4500);
    c = await cards(O); let t = await body(O);
    await rec(O, c.length === 0 && /No items match/i.test(t), "Header search with no match", "no cards and an explicit 'No items match' message", `cards=${c.length}; message shown=${/No items match/i.test(t)}`, "/vault?q");
    // palette
    await O.visit("/dashboard"); await sleep(3500);
    const openPalette = async () => { await A.press(O, "k", 2); await sleep(700); };
    const pages = [["goals", /Go to Goals/], ["discover", /Go to Discover/], ["lounge", /Go to the Lounge/], ["insurance", /Go to Insurance/], ["messages", /Go to Messages/], ["alerts", /Go to Alerts/], ["for sale", /Go to Items For Sale/], ["insights", /Go to Insights/], ["billing", /Go to Billing/], ["sold", /Go to Sold Items/], ["settings", /Account Center/]];
    const found = [], missing = [];
    for (const [q, re] of pages) {
      await openPalette(); await A.typeInto(O, '[class*="z-[10000]"] input', q, { clear: true }); await sleep(500);
      const t2 = await body(O);
      (re.test(t2) ? found : missing).push(q);
      await A.press(O, "Escape"); await sleep(300);
    }
    await rec(O, missing.length === 0, "Command palette: typing the name of a main page", "each page is offered", `found=${JSON.stringify(found)}; missing=${JSON.stringify(missing)}`, "/dashboard");
    await openPalette(); await A.typeInto(O, '[class*="z-[10000]"] input', "goals"); await sleep(400); await A.press(O, "Enter"); await sleep(3000);
    await rec(O, (await O.path()) === "/goals", "Command palette: 'goals' then Enter", "opens /goals", `opened ${await O.path()}`, "/dashboard");
    await O.visit("/dashboard"); await sleep(3500); await openPalette(); await A.typeInto(O, '[class*="z-[10000]"] input', "Album 17"); await sleep(500);
    const first = await O.evaluate("(() => { const bs = [...document.querySelectorAll('[class*=\"z-[10000]\"] button')].map((b) => (b.innerText || '').trim().replace(/\\s+/g, ' ')).filter(Boolean); return bs.slice(0, 4); })()");
    await A.press(O, "Enter"); await sleep(3500);
    await rec(O, /^\/vault\/item\//.test(await O.path()), "Command palette: 'Album 17' then Enter", "opens that item's page", `first results=${JSON.stringify(first)}; opened ${await O.path()}`, "/dashboard");
    await O.close();

    // ================= RC-15 phone exhibitions sheet (owner, 390x844 touch)
    const M = await open("owner", { width: 390, height: 844, mobile: true });
    await M.visit("/museum"); await M.waitFor("document.body.innerText.includes('Exhibition')", 40000).catch(() => {}); await sleep(4000);
    const sheet = () => M.evaluate("(() => { const a = [...document.querySelectorAll('aside')].find((x) => /Exhibition Details/.test(x.textContent || '')); if (!a) return { exists: false, shown: false }; const r = a.getBoundingClientRect(); return { exists: true, shown: getComputedStyle(a).display !== 'none' && r.height > 0, h: Math.round(r.height) }; })()");
    let sh = await sheet();
    await rec(M, !sh.shown, "Exhibitions on a phone: first view", "no details sheet covering the list", JSON.stringify(sh), "/museum");
    for (const [label, expr] of [["Filter exhibitions", "[...document.querySelectorAll('button,[role=button],a,select,input')].find((e) => /filter exhibitions/i.test(e.getAttribute('aria-label') || ''))"], ["Sort exhibitions", "[...document.querySelectorAll('button,[role=button],a,select,input')].find((e) => /sort exhibitions/i.test(e.getAttribute('aria-label') || ''))"], ["Create Exhibition", "[...document.querySelectorAll('a,button')].find((e) => /Create Exhibition/i.test((e.innerText || '').trim()) && e.getBoundingClientRect().width > 0)"]]) {
      const h = await hit(M, expr);
      await rec(null, h && h.ok, `Exhibitions on a phone: '${label}' in the first view`, "visible and tappable (nothing on top)", JSON.stringify(h), "/museum");
    }
    await A.clickText(M, "^Show details for", "article,[role=button]", { touch: true }).catch(() => {});
    await A.clickExpr(M, "document.querySelector('article[aria-label^=\"Show details for\"]')", { touch: true }); await sleep(1200);
    sh = await sheet();
    await rec(M, sh.shown, "Exhibitions on a phone: tap an exhibition card", "the details sheet opens", JSON.stringify(sh), "/museum");
    await A.clickExpr(M, "document.querySelector('[aria-label=\"Close exhibition details\"]')", { touch: true }); await sleep(900);
    sh = await sheet();
    await rec(M, !sh.shown, "Exhibitions on a phone: Close on the details sheet", "the sheet closes", JSON.stringify(sh), "/museum");
    await M.close();
    const D = await open("owner"); // desktop keeps the side panel
    await D.visit("/museum"); await D.waitFor("document.body.innerText.includes('Exhibition Details')", 40000).catch(() => {}); await sleep(3000);
    const dshown = await D.evaluate("(() => { const a = [...document.querySelectorAll('aside')].find((x) => /Exhibition Details/.test(x.textContent || '')); return !!a && getComputedStyle(a).display !== 'none' && a.getBoundingClientRect().height > 0; })()");
    await rec(D, dshown, "Exhibitions on a wide screen", "the details side panel is still shown", `shown=${dshown}`, "/museum");
    await D.close();

    // ================= RC-14 install pill
    const P = await open("owner", { width: 390, height: 844, mobile: true });
    await P.visit("/dashboard"); await sleep(4000); await showPill(P);
    const onDash = await pill(P);
    for (const route of ["/vault/quick", "/vault/bulk"]) {
      await P.visit(route); await sleep(5000); await showPill(P);
      const shown = await pill(P);
      await rec(P, onDash && !shown, `Install pill on ${route} (phone)`, "not shown here (it does show on other pages, e.g. Home)", `shown on Home=${onDash}; shown here=${shown}`, route);
    }
    await P.close();
    const V = await open("visitor", { width: 390, height: 844, mobile: true });
    await V.visit("/"); await sleep(5000); await showPill(V);
    await V.evaluate("(() => { const s = document.querySelector('.vltd-content-wrap'); if (s) s.scrollTop = s.scrollHeight; window.scrollTo(0, document.body.scrollHeight); return true; })()"); await sleep(1200);
    const foot = [];
    for (const label of ["TCG", "Sports", "Pop Culture"]) {
      const h = await hit(V, `[...document.querySelectorAll('footer a, a')].filter((a) => (a.innerText || '').trim() === ${JSON.stringify(label)}).pop()`);
      await V.evaluate("(() => { const s = document.querySelector('.vltd-content-wrap'); if (s) s.scrollTop = s.scrollHeight; return true; })()"); await sleep(500);
      const h2 = await hit(V, `[...document.querySelectorAll('footer a, a')].filter((a) => (a.innerText || '').trim() === ${JSON.stringify(label)}).pop()`);
      foot.push({ label, ok: h2 && h2.ok, top: h2 && h2.top, firstTry: h && h.ok });
    }
    await rec(V, foot.every((f) => f.ok), "Landing page footer links with the install pill showing (phone)", "every footer link can be tapped (not the pill)", JSON.stringify(foot), "/");
    await V.close();
    const I = await open("owner", { width: 1440, height: 900 });
    await X.openItem(I, X.ID.valued); await sleep(1500); await showPill(I);
    await I.evaluate("(() => { const s = document.querySelector('.vltd-content-wrap'); if (s) s.scrollTop = s.scrollHeight; return true; })()"); await sleep(1200);
    const chips = await I.evaluate("(() => [...document.querySelectorAll('button')].filter((b) => /^\\+ /.test((b.innerText || '').trim())).map((b) => { const r = b.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { chip: b.innerText.trim(), ok: !!t && (t === b || b.contains(t) || t.contains(b)), top: t ? (t.innerText || '').trim().slice(0, 24) : null }; }))()");
    await rec(I, chips.length > 0 && chips.every((x) => x.ok), "Item page: suggested tag chips at the end of the page with the pill showing (desktop)", "every chip can be clicked", JSON.stringify(chips), "/vault/item/[id]");
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    for (const S of sessions) { try { await S.close(); } catch {} }
    fs.writeFileSync(path.join(EV, `rb27-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    for (const c of out.cases.filter((c) => !c.ok)) console.log("NOT OK:", c.control, "|", String(c.actual).slice(0, 400));
    process.exit(0);
  }
})();
