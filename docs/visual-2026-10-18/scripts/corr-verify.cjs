// Layout / colour / For Sale behaviour checks for the correction set (synthetic account; needs visual-fixture + forsale-fixture 3 + history rows).
//   node corr-verify.cjs --base=https://vltd.app
process.env.CHROME_PROFILE_ROOT = process.env.CHROME_PROFILE_ROOT || "C:/Users/EK/AppData/Local/Temp/qa-c";
const { browser, admin, sleep, man } = require("./journey-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=https://vltd.app").slice(7);
const SKIP = ((process.argv.find((a) => a.startsWith("--skip=")) || "--skip=").slice(7)).split(",").filter(Boolean);
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 500)); };
const rgb = (c) => (String(c).match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
const isRed = (c) => { const [r, g, b] = rgb(c); return r > 190 && g < 130 && b < 130; };
async function ready(S, expr, label) { await S.waitFor(expr, 180000, label); await sleep(3500); }
const SOLD_READY = "/Realized profit|REALIZED PROFIT/i.test(document.body.innerText) && document.querySelectorAll('article').length > 0";

(async () => {
  const m = man(); const P = m.personalId;
  // a second universe among the sold items, so the filter chips exist (exact id, removed with the account)
  await admin.from("vault_items").delete().eq("id", `qa_vz_${m.stamp}_stcg`);
  await admin.from("vault_items").insert({ id: `qa_vz_${m.stamp}_stcg`, profile_id: P, title: "QA Sold Pokemon Charizard EX", universe: "TCG", category: "TCG", category_label: "Pokemon", status: "SOLD", is_public: false, created_at: Date.now() - 40 * 86400e3, sold_price: 600, sold_at: Date.now() - 5 * 86400e3, sold_platform: "eBay", purchase_price: 20 });

  if (!SKIP.includes("sold")) for (const W of [1669, 1440, 1280]) {
    const S = await browser(BASE, { width: W, height: 900 });
    try {
      await S.go("/vault/sold"); await ready(S, SOLD_READY, "sold " + W);
      const L = await S.evaluate(`(() => {
        const sec = document.querySelector('#sales-analytics'); const chips = [...sec.querySelectorAll(':scope > div:first-child > div')].map((e) => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), t: Math.round(r.top) }; });
        const panels = [...sec.querySelectorAll(':scope > div:nth-child(2) > div')].map((e) => { const r = e.getBoundingClientRect(); return { t: Math.round(r.top), h: Math.round(r.height), l: Math.round(r.left), w: Math.round(r.width) }; });
        const input = document.querySelector('input[aria-label="Search sold items"]'); const ir = input.getBoundingClientRect();
        const chipsRow = [...document.querySelectorAll('button, a')].filter((b) => /^(All|Pop Culture|TCG)/.test(b.textContent.trim()) && b.getBoundingClientRect().top > ir.top - 20 && b.getBoundingClientRect().top < ir.bottom + 20).length;
        const cards = [...document.querySelectorAll('article')].map((e) => Math.round(e.getBoundingClientRect().height));
        const fixed = [...document.querySelectorAll('article a, article div')].filter((e) => getComputedStyle(e).height === '136px').length;
        return { chips, panels, search: { w: Math.round(ir.width), top: Math.round(ir.top) }, chipsOnSearchRow: chipsRow, cards, fixed136: fixed, sw: document.documentElement.scrollWidth, vw: innerWidth, h1: document.querySelector('h1').textContent, tabs: [...document.querySelectorAll('nav[data-local-nav] a')].map((a) => a.textContent.trim()).join(',') };
      })()`);
      check(`[1 @${W}] heading 'Vault' and the five tabs unchanged`, L.h1 === "Vault" && L.tabs === "Items,For Sale,Sold,Insights,Goals", L);
      check(`[1 @${W}] summary is four compact chips on one line, not stretched (each narrower than 330px, same top)`, L.chips.length === 4 && L.chips.every((c) => c.w < 330 && c.t === L.chips[0].t), L.chips);
      check(`[1 @${W}] Revenue, Profit/Loss, Category and ROI/Best Sale sit in ONE aligned row`, L.panels.length === 4 && L.panels.every((p) => p.t === L.panels[0].t && p.h === L.panels[0].h) && L.panels.every((p, i) => i === 0 || p.l > L.panels[i - 1].l), W >= 1280 ? L.panels : "");
      check(`[2 @${W}] search field is compact (<= 200px) and its filters are on the same row`, L.search.w <= 200 && L.chipsOnSearchRow >= 2, { search: L.search, chips: L.chipsOnSearchRow });
      check(`[2 @${W}] item cards have natural height (no fixed 136px bubbles; each card < 330px)`, L.fixed136 === 0 && L.cards.every((h) => h < 330), { fixed136: L.fixed136, cards: L.cards });
      check(`[1 @${W}] no sideways scroll`, L.sw <= L.vw, L);
    } catch (e) { console.log("STOPPED sold", W, e.message); fail++; } finally { await S.close(); }
  }
  if (!SKIP.includes("sold")) for (const W of [390, 320]) {
    const S = await browser(BASE, { width: W, height: 800, mobile: true });
    try {
      await S.go("/vault/sold"); await ready(S, SOLD_READY, "sold " + W);
      const L = await S.evaluate(`(() => { const sec = document.querySelector('#sales-analytics'); const panels = [...sec.querySelectorAll(':scope > div:nth-child(2) > div')].map((e) => { const r = e.getBoundingClientRect(); return { t: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; }); const bars = document.querySelector('[data-testid=monthly-bars]').getBoundingClientRect(); return { panels, barsW: Math.round(bars.width), barsH: Math.round(bars.height), sw: document.documentElement.scrollWidth, vw: innerWidth }; })()`);
      check(`[1 @${W}] panels stack in one column, full width, charts not tiny (>= ${W - 70}px wide, >= 100px tall)`, L.panels.every((p, i) => i === 0 || p.t > L.panels[i - 1].t) && L.panels.every((p) => p.w >= W - 40) && L.barsW >= W - 70 && L.barsH >= 100, L);
      check(`[1 @${W}] no sideways scroll`, L.sw <= L.vw, L);
    } catch (e) { console.log("STOPPED sold phone", W, e.message); fail++; } finally { await S.close(); }
  }

  // ---- 3 and 4: Insights cards, colour meaning
  for (const W of [1669, 1440, 1280]) {
    const S = await browser(BASE, { width: W, height: 900 });
    try {
      await S.go("/portfolio"); await ready(S, "/STALE PRICES/i.test(document.body.innerText)", "insights " + W);
      const L = await S.evaluate(`(() => {
        const labels = ['TOTAL VAULT VALUE', 'TOTAL VALUE CHANGE', 'DOCUMENTATION COMPLETE', 'STALE PRICES'];
        const out = labels.map((l) => { const lab = [...document.querySelectorAll('div')].find((d) => d.children.length === 0 || d.childElementCount <= 2 ? d.textContent.trim().replace(/\\s*i$/, '').toUpperCase() === l : false); if (!lab) return { l, missing: true }; let card = lab; while (card && !(card.getBoundingClientRect().height > 80 && card.getBoundingClientRect().width > 200 && getComputedStyle(card).borderTopWidth !== '0px')) card = card.parentElement; const cr = card.getBoundingClientRect(); const fig = [...card.querySelectorAll('div')].find((d) => parseFloat(getComputedStyle(d).fontSize) > 24); const lr = lab.getBoundingClientRect(); const fr = fig && fig.getBoundingClientRect(); return { l, top: Math.round(cr.top), h: Math.round(cr.height), labelY: Math.round(lr.top - cr.top), figY: fr ? Math.round(fr.top - cr.top) : null, figColor: fig ? getComputedStyle(fig).color : null, text: card.innerText.replace(/\\s+/g, ' ').slice(0, 170) }; });
        return out; })()`);
      const ok4 = L.every((c) => !c.missing);
      check(`[3 @${W}] all four summary cards found`, ok4, L);
      if (ok4) {
        check(`[3 @${W}] the four cards share one top and one height`, L.every((c) => c.top === L[0].top && c.h === L[0].h), L.map((c) => [c.top, c.h]));
        check(`[3 @${W}] labels and figures sit at the same height in every card`, L.every((c) => c.labelY === L[0].labelY && c.figY === L[0].figY), L.map((c) => [c.labelY, c.figY]));
        check(`[3 @${W}] card height is compact (<= 140px)`, L.every((c) => c.h <= 140), L.map((c) => c.h));
        if (W === 1440) {
          check("[4] Stale Prices is amber, not loss-red", !isRed(L[3].figColor) && rgb(L[3].figColor)[0] > 200 && rgb(L[3].figColor)[2] < 100, L[3].figColor);
          check("[4] Total Value Change is neutral (not red, not green) and says it is a recorded total, not profit", !isRed(L[1].figColor) && /not profit/i.test(L[1].text) && /Recorded total/i.test(L[1].text), L[1]);
          check("[4] Total Value Change keeps its honest negative number", /-\$3\d/.test(L[1].text), L[1].text);
          check("[4] Documentation Complete figure is not loss-red", !isRed(L[2].figColor), L[2].figColor);
          const more = await S.evaluate("(() => { const q = (t) => [...document.querySelectorAll('div')].find((d) => d.textContent.trim() === t); const conf = q('Low') || q('Medium'); const need = [...document.querySelectorAll('a')].find((a) => /^\\d+$/.test(a.textContent.trim()) && /needs_review/.test(a.getAttribute('href') || '')); return { conf: conf && getComputedStyle(conf).color, confText: conf && conf.textContent, need: need && getComputedStyle(need).color }; })()");
          check("[4] Low valuation confidence is amber, not loss-red", more.conf && !isRed(more.conf), more);
          check("[4] 'Needs documentation' count is amber, not loss-red", more.need && !isRed(more.need), more);
        }
      }
    } catch (e) { console.log("STOPPED insights", W, e.message); fail++; } finally { await S.close(); }
  }
  { // phone: cards stack; no overflow
    for (const W of [390, 320]) {
      const S = await browser(BASE, { width: W, height: 800, mobile: true });
      try { await S.go("/portfolio"); await ready(S, "/STALE PRICES/i.test(document.body.innerText)", "insights phone");
        check(`[3 @${W}] Insights has no sideways scroll`, await S.evaluate("document.documentElement.scrollWidth <= innerWidth")); } catch (e) { console.log("STOPPED insights phone", e.message); fail++; } finally { await S.close(); }
    }
  }

  // ---- 6: For Sale
  if (!SKIP.includes("forsale")) { const S = await browser(BASE, { width: 1669, height: 900 });
    try {
      await S.go("/vault/for-sale"); await ready(S, "document.querySelectorAll('[data-for-sale] article').length >= 3", "for sale");
      const L = await S.evaluate(`(() => { const t = document.body.innerText; const cards = [...document.querySelectorAll('[data-for-sale] article')].map((a) => { const r = a.getBoundingClientRect(); return { title: (a.querySelector('.truncate') || {}).textContent, w: Math.round(r.width), h: Math.round(r.height), t: Math.round(r.top), l: Math.round(r.left), suits: (a.innerText.match(/Suits ([^.]*)\\./) || [])[1] || '', text: a.innerText.replace(/\\s+/g, ' ') }; }); const nav = document.querySelector('nav[data-local-nav]').getBoundingClientRect(); return { cards, hasMatrix: /PLATFORM READINESS/i.test(t), facebook: /facebook/i.test(t), tiles: document.querySelectorAll('[data-for-sale] button').length, navLeft: Math.round(nav.left), nothingListed: /nothing is listed for you/i.test(t), sw: document.documentElement.scrollWidth, vw: innerWidth }; })()`);
      const byTitle = Object.fromEntries(L.cards.map((c) => [c.title, c]));
      check("[6] the large platform-tile matrix is gone (no 'Platform readiness' block, no Facebook)", !L.hasMatrix && !L.facebook, { hasMatrix: L.hasMatrix, facebook: L.facebook });
      check("[6] each item has ONE readiness explanation (one 'Suits…' line, no repeated platform badges)", L.cards.length === 3 && L.cards.every((c) => (c.text.match(/Suits /g) || []).length === 1), L.cards.map((c) => c.text.slice(0, 120)));
      check("[6] marketplaces follow the item's category: music gets Discogs, sports card gets Fanatics Collect (no Discogs), comic gets neither", /Discogs/.test(byTitle["QA Michael Jackson Thriller LP"]?.suits) && !/Fanatics/.test(byTitle["QA Michael Jackson Thriller LP"]?.suits) && /Fanatics Collect/.test(byTitle["QA Rookie Card PSA 9"]?.suits) && !/Discogs/.test(byTitle["QA Rookie Card PSA 9"]?.suits) && !/Discogs|Fanatics/.test(byTitle["QA Batman Comic CGC 9.4"]?.suits), L.cards.map((c) => [c.title, c.suits]));
      check("[6] it says readiness is a checklist, not a listing", L.nothingListed, null);
      check("[6] cards are compact and aligned with the workspace (same left edge as the tabs; each < 300px tall; equal heights in a row)", L.cards[0].l === L.navLeft && L.cards.every((c) => c.h < 300) && L.cards.every((c) => c.t === L.cards[0].t && c.h === L.cards[0].h), { navLeft: L.navLeft, cards: L.cards.map((c) => [c.l, c.t, c.w, c.h]) });
      check("[6] no sideways scroll", L.sw <= L.vw, L);
      // asking price editing
      const first = L.cards.find((c) => c.title === "QA Michael Jackson Thriller LP");
      await S.evaluate(`(() => { const a = [...document.querySelectorAll('[data-for-sale] article')].find((x) => x.innerText.includes('Thriller')); const chip = [...a.querySelectorAll('button')].find((b) => /Asking price/.test(b.textContent) && !/Set/.test(b.textContent)); chip.click(); return true; })()`);
      const focused = await S.evaluate("document.activeElement && document.activeElement.getAttribute('aria-label')");
      check("[6] the 'Asking price' chip jumps to the asking-price field", focused === "Asking price", focused);
      await S.evaluate(`(() => { const a = [...document.querySelectorAll('[data-for-sale] article')].find((x) => x.innerText.includes('Thriller')); const i = a.querySelector('input[aria-label="Asking price"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, '175'); i.dispatchEvent(new Event('input', { bubbles: true })); [...a.querySelectorAll('button')].find((b) => /^Set$|Set asking price/.test(b.textContent.trim()) || b.getAttribute('aria-label') === 'Set asking price').click(); return true; })()`);
      let ask = null; for (let i = 0; i < 20; i++) { await sleep(1500); ask = (await admin.from("vault_items").select("asking_price").eq("id", `qa_fs_${m.stamp}_1`).single()).data?.asking_price; if (Number(ask) === 175) break; }
      check("[6] asking-price editing still saves (database now holds 175)", Number(ask) === 175, ask);
      check("[6] Edit item still opens the item", await S.evaluate("[...document.querySelectorAll('[data-for-sale] a')].some((a) => a.textContent.trim() === 'Edit item' && /^\\/vault\\/item\\//.test(a.getAttribute('href')))"));
      // mark sold through the browser's own prompts
      S.c.on(async (e) => { if (e.method === "Page.javascriptDialogOpening") { const isPrice = /Sale price/i.test(e.params.message); await S.send("Page.handleJavaScriptDialog", { accept: true, promptText: isPrice ? "99" : "eBay" }); } });
      await S.send("Page.enable");
      await S.evaluate(`(() => { const a = [...document.querySelectorAll('[data-for-sale] article')].find((x) => x.innerText.includes('Batman')); [...a.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Mark sold').click(); return true; })()`);
      let sold = null; for (let i = 0; i < 25; i++) { await sleep(1500); sold = (await admin.from("vault_items").select("status,sold_price").eq("id", `qa_fs_${m.stamp}_3`).single()).data; if (sold?.status === "SOLD") break; }
      check("[6] Mark sold still works (item is SOLD at 99 in the database) and leaves the For Sale list", sold?.status === "SOLD" && Number(sold?.sold_price) === 99 && (await S.evaluate("document.querySelectorAll('[data-for-sale] article').length")) === 2, sold);
    } catch (e) { console.log("STOPPED forsale", e.message); fail++; } finally { await S.close(); }
  }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
