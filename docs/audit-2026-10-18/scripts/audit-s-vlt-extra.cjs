// VLT suite 13: remaining Vault controls (Flip drag/swipe, Gallery quick-look, tab row, Add buttons), recap Download re-check, and honest corrections for first-run test mistakes.
const X = require("./audit-s-vlt-vlib.cjs");
const { R, sleep, squash, clickEl, drag, touchSwipe, ids, setMode } = X; const r = R("VLT");
const INIT = `(() => { if (window.__vltDl) return; window.__vltDl = []; const ac = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { try { if (this.download) window.__vltDl.push(this.download); } catch (e) {} return ac.call(this); }; })();`;
const flipN = async (S) => { const mm = /(\d+) \/ (\d+)/.exec(squash(await S.text())); return mm ? Number(mm[1]) : null; };
(async () => {
  const S = await X.session("owner");
  try {
    await S.send("Page.addScriptToEvaluateOnNewDocument", { source: INIT });
    await S.visit("/vault"); await S.evaluate("localStorage.setItem('vltd_vault_view_mode', 'flip'); sessionStorage.clear(); true"); await S.visit("/vault");
    // ---- Flip: mouse drag over the card
    const card = await S.evaluate("(() => { const imgs = [...document.querySelectorAll('main img')].filter((i) => i.getBoundingClientRect().width > 150); const el = imgs[0]; if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()");
    await sleep(500);
    const n0 = await flipN(S); const p0 = await S.path();
    if (card) {
      await drag(S, card.x + 150, card.y, card.x - 200, card.y); await sleep(1200); const n1 = await flipN(S);
      r.check(n0 === 1 && n1 === 2 && (await S.path()) === p0, { page: "/vault | owner, Personal, Flip view", control: "Flip: drag the card left (mouse)", expected: "Dragging the top card left moves to the next card ('2 / N') without opening the item", actual: `${n0} -> ${n1}; path ${await S.path()}`, evidence: await S.jshot("vlt-flip-drag"), impact: "blocked workflow", repro: "Flip view; press on the card photo, drag left 350px, release" });
      const c2 = await S.evaluate("(() => { const imgs = [...document.querySelectorAll('main img')].filter((i) => i.getBoundingClientRect().width > 150); const r = imgs[0].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()");
      await drag(S, c2.x - 150, c2.y, c2.x + 200, c2.y); await sleep(1200); const n2 = await flipN(S);
      r.check(n2 === 1, { page: "/vault | owner, Personal, Flip view", control: "Flip: drag the card right (mouse)", expected: "Back to '1 / N'", actual: `${n1} -> ${n2}`, impact: "blocked workflow", repro: "drag right" });
    } else r.nt({ page: "/vault | Flip", control: "Flip drag", expected: "n/a", actual: "no card image found", impact: "none", repro: "" });
    // ---- Gallery quick look
    await X.setMode(S, "Gallery"); await S.evaluate("window.scrollTo(0,0); true");
    const cardBox = await S.evaluate("(() => { const cells = [...document.querySelectorAll('main a[href^=\"/vault/item/\"]')]; const a = cells[0]; const cell = a.closest('[class*=content-visibility]') || a.parentElement.parentElement; cell.scrollIntoView({ block: 'center' }); const r = cell.getBoundingClientRect(); return { x: r.left + 6, y: r.top + r.height - 8, w: r.width, h: r.height }; })()");
    await sleep(400); await X.mouseClick(S, cardBox.x, cardBox.y); await sleep(800);
    const dr = await S.evaluate("(() => { const d = document.querySelector('button[aria-label=\"Close item details\"]'); if (!d) return null; const sec = d.closest('section'); return { text: sec.innerText.replace(/\\s+/g, ' ').slice(0, 260), links: [...sec.querySelectorAll('a')].map((a) => a.innerText.trim() + ' -> ' + a.getAttribute('href')) }; })()");
    r.check(!!dr, { page: "/vault | owner, Personal, Gallery view", control: "Gallery card tap (quick-look drawer)", expected: "Tapping a card (not its link) opens the quick-look with value/cost and an Open link", actual: JSON.stringify(dr), evidence: await S.jshot("vlt-vault-quicklook"), impact: "usability", repro: "Gallery: click the empty area of a card" });
    if (dr) {
      await clickEl(S, 'button[aria-label="Close item details"]'); await sleep(500);
      r.check(!(await S.evaluate("!!document.querySelector('button[aria-label=\"Close item details\"]')")), { page: "/vault | owner, Personal, Gallery view", control: "Quick-look close (x)", expected: "Drawer closes", actual: "closed", impact: "usability", repro: "click x" });
    }
    // ---- tab row and Add buttons
    await S.visit("/vault");
    const tabs = await S.evaluate("[...document.querySelectorAll('nav[aria-label=\"Vault\"] a')].map((a) => a.innerText.trim() + ' -> ' + a.getAttribute('href') + (a.getAttribute('aria-current') ? ' [current]' : ''))");
    r.check(JSON.stringify(tabs) === JSON.stringify(["Items -> /vault [current]", "For Sale -> /vault/for-sale", "Sold -> /vault/sold", "Insights -> /portfolio", "Goals -> /goals", "Insurance -> /insurance"]), { page: "/vault | owner, Personal", control: "Vault tab row (Items, For Sale, Sold, Insights, Goals, Insurance)", expected: "Six tabs to their pages with Items current", actual: JSON.stringify(tabs), impact: "blocked workflow", repro: "read the tab row" });
    for (const [lab, href] of [["For Sale", "/vault/for-sale"], ["Sold", "/vault/sold"], ["Insights", "/portfolio"], ["Goals", "/goals"], ["Insurance", "/insurance"]]) {
      await S.visit("/vault"); await clickEl(S, `[...document.querySelectorAll('nav[aria-label="Vault"] a')].find((a) => a.innerText.trim() === '${lab}')`, { js: true }); await sleep(2000); await S.settle({ max: 20000 });
      const cur = await S.evaluate("(() => { const c = document.querySelector('nav[aria-label=\"Vault\"] [aria-current=page]'); return c ? c.innerText.trim() : null; })()");
      r.check((await S.path()) === href && cur === lab, { page: "/vault | owner, Personal", control: `Tab '${lab}' (real click)`, expected: `Opens ${href} with '${lab}' marked current in the same tab row`, actual: `${await S.path()}; current tab '${cur}'`, impact: "blocked workflow", repro: `Click ${lab}` });
    }
    await S.visit("/vault");
    const add = await S.evaluate("[...document.querySelectorAll('[data-add-item-actions] a')].map((a) => a.innerText.trim() + ' -> ' + a.getAttribute('href'))");
    r.check(add.length === 2 && /Quick Add -> \/vault\/quick/.test(add.join("|")) && /ADD ITEM -> \/capture/i.test(add.join("|")), { page: "/vault | owner, Personal", control: "Quick Add and Add Item on the Vault header", expected: "Quick Add -> /vault/quick; Add Item -> /capture", actual: JSON.stringify(add), impact: "blocked workflow", repro: "read buttons" });
    await clickEl(S, "[...document.querySelectorAll('[data-add-item-actions] a')].find((a) => /Quick Add/.test(a.innerText))", { js: true }); await sleep(2000); await S.settle({ max: 20000 });
    r.check((await S.path()).startsWith("/vault/quick"), { page: "/vault | owner, Personal", control: "Quick Add (real click)", expected: "Opens /vault/quick", actual: await S.path(), impact: "blocked workflow", repro: "click Quick Add" });
    // ---- recap download re-check
    await S.visit("/vault"); await S.visit("/portfolio"); await sleep(1500);
    await clickEl(S, "[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Collection tools')", { js: true }); await sleep(500);
    await clickEl(S, "[...document.querySelectorAll('[role=menuitem]')].find((a) => /Collection recap/.test(a.innerText))", { js: true }); await sleep(2000);
    await clickEl(S, "[...document.querySelectorAll('[role=dialog] button')].find((b) => /Generate recap card/.test(b.innerText))", { js: true });
    for (let i = 0; i < 15 && !(await S.evaluate("!!document.querySelector('[role=dialog] img[alt=\"Collection recap card\"]')")); i++) await sleep(1000);
    await S.evaluate("window.__vltDl.length = 0; true");
    await clickEl(S, "[...document.querySelectorAll('[role=dialog] button')].find((b) => b.innerText.trim() === 'Download')", { js: true }); await sleep(1000);
    const dl = await S.evaluate("window.__vltDl.slice()");
    r.check(dl.includes("vltd-wrapped-2026.png"), { page: "/portfolio | owner, Personal | Collection recap sheet", control: "Recap Download (re-run with an in-page recorder)", expected: "Saves vltd-wrapped-2026.png", actual: JSON.stringify(dl), impact: "blocked workflow", repro: "Generate recap card; Download" });
  } finally { console.log("errors", S.consoleErrors.slice(0, 4)); await S.close(); }

  // ---- Flip swipe on a phone (browser-emulated)
  const M = await X.session("owner", { width: 390, height: 844, mobile: true });
  try {
    await M.visit("/vault"); await M.evaluate("localStorage.setItem('vltd_vault_view_mode', 'flip'); true"); await M.visit("/vault");
    const card = await M.evaluate("(() => { const imgs = [...document.querySelectorAll('main img')].filter((i) => i.getBoundingClientRect().width > 150); const el = imgs[0]; if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()");
    await sleep(500); const n0 = await flipN(M); const p0 = await M.path();
    if (card) {
      await touchSwipe(M, card.x + 110, card.y, card.x - 130, card.y); await sleep(1200); const n1 = await flipN(M);
      r.check(n0 === 1 && n1 === 2 && (await M.path()) === p0, { page: "/vault | owner, Personal, Flip view, 390 phone (browser-emulated touch)", control: "Flip: swipe the card left (browser-emulated touch)", expected: "Swiping left moves to the next card without opening the item", actual: `${n0} -> ${n1}; path ${await M.path()}`, evidence: await M.jshot("vlt-flip-swipe-390"), impact: "blocked workflow", repro: "Flip view; swipe left on the card (emulated)" });
    } else r.nt({ page: "/vault | Flip 390", control: "Flip swipe", expected: "n/a", actual: "no card image found", impact: "none", repro: "" });
  } finally { await M.close(); }

  // ---- corrections: honest notes about first-run test mistakes (first-failure rows stay as recorded)
  const P1 = "/dashboard | owner, Personal";
  r.pass({ page: P1, control: "(test note) VLT-012..015 and VLT-027 first-run failures", expected: "n/a", actual: "Those four hash-link checks failed because MY comparison used location.pathname+search, which excludes the '#section' part, so '/portfolio#cost-breakdown' never equalled '/portfolio'. The links themselves land correctly with the section in view (VLT-031..034). VLT-027 over-asserted: the Insights headline shows value and ROI, and the per-universe Cost figures add up to the Purchase Cost (VLT-038).", evidence: "", impact: "none", repro: "audit-s-vlt-home1.cjs follow()" });
  r.pass({ page: P1, control: "(test note) VLT-074 and VLT-080/088", expected: "n/a", actual: "VLT-074: my assertion was inverted ('No' should change nothing; it changes nothing, which is correct; the real defect is that the seasonal theme is applied before the question, see VLT-073). VLT-080/088: my 'plural' regex matched the natural phrase 'On 1 of 1 items'; the one-item Home reads correctly (singular '1 item', $40, $100, +$60).", evidence: "", impact: "none", repro: "see scripts" });
  r.pass({ page: "/vault | owner, Personal", control: "(test note) VLT-133, VLT-424, page labels", expected: "n/a", actual: "VLT-133: the view was Gallery (two links per card), so 12 links = 6 sold items; not a defect. VLT-424: the 'All time' range chosen earlier on the universe page is remembered, so the category page did not default to 30 days; the remembered range is intended. Several row titles say '34 listed' where the true listed count was 36 at the time (the expected text in each row carries the real numbers).", evidence: "", impact: "none", repro: "see scripts" });
  r.pass({ page: "/portfolio/insurance, /portfolio/universe/MUSIC | refused connection", control: "(observation) VLT-435/436 wording", expected: "n/a", actual: "With the data connection refused and nothing saved on the device, these pages stay on 'Still checking your account. This is taking longer than usual.' with no Retry button (screenshots vlt-insurance-refused.jpg, vlt-universe-refused.jpg). They do not claim an empty collection, but there is no way forward except reloading.", evidence: "shots/vlt-insurance-refused.jpg", impact: "improvement", repro: "Fresh browser; refuse supabase REST; open /portfolio/insurance" });
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });
