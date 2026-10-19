// VLT suite 7: /vault/[universe] pages, /vault/print, /vault/readiness, /vault/halls, /vault/frames, /vault/sync (owner, Personal, 1440). Includes fresh-device direct URLs.
const X = require("./audit-s-vlt-vlib.cjs");
const { R, sleep, squash, clickEl, ids, typeInto, stats, admin, money, fs, AUD } = X; const r = R("VLT");
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const uni = (u) => String(u).toUpperCase();
const SLUGS = { "pop-culture": "POP_CULTURE", sports: "SPORTS", tcg: "TCG", music: "MUSIC", "jewelry-apparel": "JEWELRY_APPAREL", games: "GAMES", "built-botany": "BUILT_BOTANY", misc: "MISC", automotive: "AUTOMOTIVE", art: "ART" };
const TITLES = { POP_CULTURE: "Pop Culture", SPORTS: "Sports", TCG: "TCG & Non Sport Card", MUSIC: "Music", JEWELRY_APPAREL: "Jewelry & Apparel", GAMES: "Games", BUILT_BOTANY: "Built, Botany & Bar", MISC: "Misc", AUTOMOTIVE: "Gears & Gasoline", ART: "Art" };
const INIT = `(() => { if (window.__vltDl) return; window.__vltDl = []; const ac = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { try { if (this.download) window.__vltDl.push(this.download); } catch (e) {} return ac.call(this); }; })();`;
(async () => {
  const m = X.man(); const P = m.personalId, B = m.businessId, st = m.stamp;
  const all = await X.rows(P); const listed = all.filter((x) => !X.isSold(x)); const cnt = listed.filter(X.counted);
  const E = X.expected(all); const idOf = (rows) => rows.map((x) => x.id);
  const S = await X.session("owner");
  try {
    await S.send("Page.addScriptToEvaluateOnNewDocument", { source: INIT });
    await S.visit("/vault"); await S.evaluate("localStorage.setItem('vltd_vault_view_mode', 'gallery'); sessionStorage.clear(); true");
    // ---------- universe pages
    if (!process.env.SKIP_UNI) {
    for (const [slug, key] of Object.entries(SLUGS)) {
      await S.visit("/vault/" + slug);
      const h1 = await S.evaluate("(document.querySelector('h1') || {}).innerText"); const got = await ids(S); const want = listed.filter((x) => uni(x.universe) === key);
      const s2 = await stats(S); const txt = squash(await S.text());
      const link = await S.evaluate("[...document.querySelectorAll('a')].some((a) => /All Universes/.test(a.textContent) && a.getAttribute('href') === '/vault')");
      const emptyOk = want.length > 0 || /No items match|NO MATCHES|empty/i.test(txt);
      r.check(h1 === TITLES[key] && same(got, idOf(want)) && link && emptyOk, { page: `/vault/${slug} | owner, Personal, ${want.length} items in this universe`, control: `Universe page /vault/${slug}`, expected: `Title '${TITLES[key]}', only its ${want.length} items, 'All Universes' link to /vault${want.length === 0 ? ", an explicit empty message" : ""}`, actual: `h1='${h1}'; shown ${got.length}; link=${link}; empty message=${/No items match|NO MATCHES/i.test(txt)}; cards items=${s2.itemsCard}`, evidence: want.length === 0 || same(got, idOf(want)) ? "" : await S.jshot("vlt-universe-" + slug), impact: "misleading result", repro: `Open /vault/${slug}` });
    }
    await S.visit("/vault/not-a-universe");
    const uh1 = await S.evaluate("(document.querySelector('h1') || {}).innerText"); const uids = await ids(S);
    r.check(!(uh1 === "Misc" && uids.length > 0), { page: "/vault/not-a-universe | owner, Personal", control: "Unknown universe slug", expected: "A not-found page or redirect to /vault; not another universe's list", actual: `h1='${uh1}'; items shown ${uids.length} (the Misc universe's list); URL stays ${await S.path()}`, evidence: await S.jshot("vlt-universe-unknown"), impact: "misleading result", repro: "Open /vault/not-a-universe" });
    await S.visit("/vault/SPORTS"); const up = await S.evaluate("(document.querySelector('h1') || {}).innerText");
    r.check(up === "Sports", { page: "/vault/SPORTS | owner, Personal", control: "Universe slug in capitals / underscores", expected: "Works like /vault/sports", actual: `h1='${up}'`, impact: "usability", repro: "Open /vault/SPORTS" });
    // universe page + search + back to all
    await S.visit("/vault/sports"); await typeInto(S, X.PAGE_SEARCH, "zero"); const sg = await ids(S);
    r.check(same(sg, idOf(listed.filter((x) => uni(x.universe) === "SPORTS" && /zero/i.test(x.title)))), { page: "/vault/sports | owner, Personal", control: "Search inside a universe page", expected: "Searches only within Sports (QA VLT Explicit Zero Value)", actual: sg.join(","), impact: "misleading result", repro: "/vault/sports; search zero" });
    await clickEl(S, "[...document.querySelectorAll('a')].find((a) => /All Universes/.test(a.textContent))", { js: true }); await sleep(2000); await S.settle({ max: 20000 });
    r.check((await S.path()) === "/vault", { page: "/vault/sports | owner, Personal", control: "'All Universes' button", expected: "Goes to /vault", actual: await S.path(), impact: "blocked workflow", repro: "Click All Universes" });

    }
    // ---------- fresh-device direct URLs for the pages that read this device's copy only
    for (const [path, label, probe, expectOk] of [
      ["/vault/print", "Collection report", () => /TOTAL ITEMS\s*(\d+)/i.exec(document.body.innerText.replace(/s+/g, " ")), (t) => Number(t) === cnt.length],
      ["/vault/readiness", "Listing Readiness", () => /No for-sale listings yet/.test(document.body.innerText) ? ["", "none"] : [document.body.innerText.replace(/\s+/g, " ").slice(0, 100), "some"], (t) => t === "some"],
    ]) {
      const F = await X.session("owner");
      try {
        await F.visit(path); await sleep(3000);
        const raw = await F.evaluate(`(${probe.toString()})()`); const tx = squash(await F.text());
        const shown = path === "/vault/print" ? (raw && raw[1]) : (raw && raw[1]);
        r.check(expectOk(shown), { page: `${path} | owner, Personal, fresh device (nothing saved here yet), direct URL`, control: `${label}: direct URL on a device that has not opened the Vault yet`, expected: path === "/vault/print" ? `Report lists the ${cnt.length} owned items and their value` : "Lists the 4 for-sale items with readiness", actual: path === "/vault/print" ? `TOTAL ITEMS ${shown}; text: ${tx.slice(tx.indexOf("Save as PDF"), tx.indexOf("Save as PDF") + 160)}` : tx.slice(tx.indexOf("Listing Readiness"), tx.indexOf("Listing Readiness") + 220), evidence: await F.jshot("vlt-fresh-" + path.split("/").pop()), impact: "misleading result", repro: `Sign in on a new browser; open ${path} directly (cloud holds ${path === "/vault/print" ? cnt.length + " owned" : "4 for-sale"} items)` });
      } finally { await F.close(); }
    }

    // ---------- Print (populated, device copy present)
    await S.visit("/vault"); await S.visit("/vault/print"); await sleep(1500);
    const pr = await S.evaluate("(() => { const t = document.body.innerText.replace(/\\s+/g, ' '); const g = (re) => (re.exec(t) || [])[1]; return { items: g(/TOTAL ITEMS (\\d+)/i), value: g(/EST\\. COLLECTION VALUE (\\$[\\d,.]+\\*?)/i), cats: g(/CATEGORIES (\\d+)/i), note: g(/(\\* Based on purchase price[^(]*\\(\\d+ of \\d+ items\\))/), groups: [...document.querySelectorAll('.group-header')].map((e) => e.innerText.replace(/\\s+/g, ' ')) }; })()");
    const insVal = cnt.reduce((a, x) => a + (X.basis(x).b === "explicit" ? X.effective(x) : X.basis(x).b === "purchase" ? X.cost(x) : 0), 0);
    const ghosts = cnt.filter((x) => X.basis(x).b === "purchase" && X.cost(x) > 0).length;
    const nCats = new Set(cnt.map((x) => x.universe)).size;
    r.check(pr.items === String(cnt.length) && pr.value === `$${insVal.toLocaleString("en-US", { minimumFractionDigits: 2 })}*` && pr.cats === String(nCats), { page: "/vault/print | owner, Personal, device copy present", control: "Collection report figures", expected: `Total items ${cnt.length} (owned only), value $${insVal.toLocaleString("en-US", { minimumFractionDigits: 2 })}* (value rule; * = purchase-cost based for ${ghosts} items), ${nCats} categories`, actual: JSON.stringify({ items: pr.items, value: pr.value, cats: pr.cats, note: pr.note }), evidence: await S.jshot("vlt-print-report", { full: true }), impact: "misleading result", repro: "Open /vault then /vault/print" });
    r.check(pr.groups.every((g) => !/^[A-Z_]+ ·/.test(g)) , { page: "/vault/print | owner, Personal", control: "Collection report group headings", expected: "Groups titled with the universe's name (e.g. 'Pop Culture')", actual: JSON.stringify(pr.groups), evidence: "shots/vlt-print-report.jpg", impact: "cosmetic", repro: "Read the group headings" });
    await S.evaluate("window.__aud.print = 0; true"); await clickEl(S, "button.print-btn"); await sleep(600);
    r.check((await S.look()).print === 1, { page: "/vault/print | owner, Personal", control: "Save as PDF (button)", expected: "Calls the browser's print (window.print stubbed)", actual: `print calls: ${(await S.look()).print}`, impact: "blocked workflow", repro: "Click Save as PDF" });

    // ---------- Readiness (device copy present)
    await S.visit("/vault"); await S.visit("/vault/readiness"); await sleep(1500);
    const fs4 = listed.filter((x) => x.status === "FOR_SALE");
    const tabs = await S.evaluate("[...document.querySelectorAll('button')].map((b) => b.innerText.replace(/\\s+/g, ' ').trim()).filter((t) => /^(All|Ready|Almost|Needs work)/.test(t))");
    const rows = async () => S.evaluate("[...document.querySelectorAll('a[href^=\"/vault/item/\"]')].map((a) => /\\/vault\\/item\\/([^?]+)/.exec(a.getAttribute('href'))[1]).filter((v, i, a) => a.indexOf(v) === i)");
    let rr = await rows();
    r.check(same(rr, idOf(fs4)) && tabs[0] === `All ${fs4.length}`, { page: "/vault/readiness | owner, Personal, 4 for sale", control: "Listing Readiness list", expected: `The ${fs4.length} for-sale items, tab 'All ${fs4.length}'`, actual: `rows ${rr.length}; tabs ${JSON.stringify(tabs)}`, evidence: await S.jshot("vlt-readiness"), impact: "misleading result", repro: "Open /vault then /vault/readiness" });
    const sum = tabs.slice(1).reduce((a, t) => a + Number((/ (\d+)$/.exec(t) || [0, 0])[1]), 0);
    r.check(sum === fs4.length, { page: "/vault/readiness | owner, Personal", control: "Readiness tab counts", expected: "Ready + Almost + Needs work = All", actual: JSON.stringify(tabs), impact: "misleading result", repro: "Read tabs" });
    for (const lab of ["Ready", "Almost", "Needs work"]) {
      const want = Number(((tabs.find((t) => t.startsWith(lab)) || "").match(/(\d+)$/) || [0, 0])[1]);
      await clickEl(S, `[...document.querySelectorAll('button')].find((b) => b.innerText.trim().startsWith('${lab}'))`, { js: true }); await sleep(700);
      const n = (await rows()).length; const none = /No listings in this category/.test(await S.text());
      r.check(n === want && (want > 0 || none), { page: "/vault/readiness | owner, Personal", control: `Readiness tab '${lab}'`, expected: `${want} rows${want === 0 ? " and 'No listings in this category.'" : ""}`, actual: `rows ${n}; empty message ${none}`, impact: "misleading result", repro: `Click ${lab}` });
    }
    const link = await S.evaluate("[...document.querySelectorAll('a')].filter((a) => /^\\+ /.test(a.textContent.trim())).map((a) => a.textContent.trim() + ' -> ' + a.getAttribute('href')).slice(0, 3)");
    r.pass({ page: "/vault/readiness | owner, Personal", control: "'+ missing item' chips", expected: "(observation) each chip links to the item to fix it", actual: JSON.stringify(link), impact: "none", repro: "inspect" });

    // ---------- Halls
    await S.visit("/vault/halls"); await sleep(1500);
    const gal = (await admin.from("galleries").select("id,title,visibility,layout,exhibition_layout").eq("profile_id", P)).data;
    const hallTxt = squash(await S.text());
    const hallOk = gal.every((g) => { const n = (g.layout?.itemIds ?? g.exhibition_layout?.itemIds ?? []).length; return hallTxt.includes(`${g.title} ${n} item${n === 1 ? "" : "s"} · ${g.visibility === "LOCKED" ? "Private" : "Shared"}`); });
    r.check(hallOk, { page: "/vault/halls | owner, Personal, 5 exhibitions", control: "Your Halls list", expected: "Each exhibition with its item count and Private/Shared", actual: hallTxt.slice(hallTxt.indexOf("YOUR HALLS"), hallTxt.indexOf("YOUR HALLS") + 330), evidence: await S.jshot("vlt-halls"), impact: "misleading result", repro: "Open /vault/halls" });
    const hrefs = await S.evaluate("[...document.querySelectorAll('a[href^=\"/museum/\"]')].map((a) => a.getAttribute('href'))");
    r.check(same(hrefs, gal.map((g) => "/museum/" + g.id)), { page: "/vault/halls | owner, Personal", control: "Hall links", expected: "Each hall opens /museum/<id>", actual: `${hrefs.length} links`, impact: "blocked workflow", repro: "inspect" });
    const addTerm = async (t) => { await clickEl(S, 'input[placeholder*="Search by name"], input[placeholder="Add another term…"]'); await S.send("Input.insertText", { text: t }); await S.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" }); await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 }); await sleep(800); };
    await addTerm("zebra");
    let hs = squash(await S.text()); let hi = await rows();
    r.check(/1 of 1 selected/.test(hs) && hi.length === 1, { page: "/vault/halls | owner, Personal", control: "Halls: search term 'zebra'", expected: "1 of 1 selected, the Zebra Comic, value $50", actual: `${(/\d+ of \d+ selected[^A-Z]*/.exec(hs) || ["no count"])[0]}; tiles ${hi.length}`, evidence: await S.jshot("vlt-halls-search"), impact: "misleading result", repro: "Halls: type zebra, Enter" });
    await addTerm("paint"); hs = squash(await S.text());
    r.check(/2 of 2 selected/.test(hs), { page: "/vault/halls | owner, Personal", control: "Halls: second term adds (OR) matches", expected: "'zebra' OR 'paint' = 2 of 2 selected, value $500 (50 + 450)", actual: (/\d+ of \d+ selected[^A-Z]*/.exec(hs) || ["no count"])[0], impact: "misleading result", repro: "add term paint" });
    const sumTxt = /selected · (\$[\d.,KM]+)/.exec(hs); r.check(!!sumTxt && sumTxt[1] === "$500", { page: "/vault/halls | owner, Personal", control: "Halls: selected value total", expected: "$500", actual: sumTxt ? sumTxt[1] : "no total", impact: "misleading result", repro: "read total" });
    await clickEl(S, 'button[title="Remove from selection"]'); await sleep(500); hs = squash(await S.text());
    r.check(/1 of 2 selected/.test(hs), { page: "/vault/halls | owner, Personal", control: "Halls: untick an item", expected: "1 of 2 selected", actual: (/\d+ of \d+ selected/.exec(hs) || ["?"])[0], impact: "usability", repro: "click the tick on a tile" });
    await clickEl(S, "[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Select all')", { js: true }); await sleep(500); hs = squash(await S.text());
    r.check(/2 of 2 selected/.test(hs), { page: "/vault/halls | owner, Personal", control: "Halls: Select all", expected: "2 of 2 selected", actual: (/\d+ of \d+ selected/.exec(hs) || ["?"])[0], impact: "usability", repro: "Select all" });
    await clickEl(S, 'button[aria-label="Remove paint"]'); await sleep(500);
    r.check(/1 of 1 selected/.test(squash(await S.text())), { page: "/vault/halls | owner, Personal", control: "Halls: remove a term (x)", expected: "Back to 1 of 1", actual: (/\d+ of \d+ selected/.exec(squash(await S.text())) || ["?"])[0], impact: "usability", repro: "click x on the paint chip" });
    await addTerm("qqqnomatch"); hs = squash(await S.text());
    r.check(/No items match "zebra" or "qqqnomatch"/.test(hs) || /No items match/.test(hs), { page: "/vault/halls | owner, Personal", control: "Halls: no result", expected: "Only the zebra match remains because terms OR (zebra still matches)", actual: (/\d+ of \d+ selected/.exec(hs) || ["?"])[0], impact: "none", repro: "add nonsense term" });
    await clickEl(S, 'button[aria-label="Remove qqqnomatch"]'); await sleep(400); await clickEl(S, 'button[aria-label="Remove zebra"]'); await sleep(400);
    // value rule: ghost with fees (50 + 5 + 5 = 60 by the value rule; Halls adds only the price)
    await addTerm("Ghost With Fees"); hs = squash(await S.text()); const ghostTotal = /selected · (\$[\d.,KM]+)/.exec(hs);
    r.check(!!ghostTotal && ghostTotal[1] === "$60", { page: "/vault/halls | owner, Personal", control: "Halls: selected value for an unpriced item bought for $50 + $5 tax + $5 shipping", expected: "$60 (the value rule counts price + tax + shipping + fees as the purchase cost everywhere else)", actual: ghostTotal ? ghostTotal[1] : "(no total shown)", evidence: await S.jshot("vlt-halls-ghost"), impact: "misleading result", repro: "Halls: search 'Ghost With Fees' and read the total" });
    await clickEl(S, 'button[aria-label="Remove Ghost With Fees"]'); await sleep(400);
    // save as hall
    await addTerm("zebra"); await clickEl(S, "[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Save as Hall')", { js: true }); await sleep(700);
    const modal = squash(await S.text());
    r.check(/Name this Hall/.test(modal) && /1 item selected/.test(modal), { page: "/vault/halls | owner, Personal", control: "Save as Hall (dialog)", expected: "'Name this Hall' with '1 item selected · private'", actual: (/Name this Hall[^.]*/.exec(modal) || ["no dialog"])[0], evidence: await S.jshot("vlt-halls-save-dialog"), impact: "usability", repro: "Search zebra; Save as Hall" });
    const disabledSave = await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'Save Hall'); return b ? b.disabled : null; })()");
    r.check(disabledSave === true, { page: "/vault/halls | owner, Personal", control: "Save Hall with empty name", expected: "Disabled until a name is typed", actual: String(disabledSave), impact: "usability", repro: "Open the dialog; look at Save Hall" });
    await clickEl(S, "[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Cancel')", { js: true }); await sleep(500);
    const noNew = (await admin.from("galleries").select("id").eq("profile_id", P)).data.length;
    r.check(noNew === gal.length, { page: "/vault/halls | owner, Personal", control: "Name this Hall > Cancel", expected: "No exhibition created", actual: `exhibitions in db ${noNew} (was ${gal.length})`, impact: "data loss", repro: "Cancel the dialog" });
    await clickEl(S, "[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Save as Hall')", { js: true }); await sleep(500);
    await clickEl(S, 'input[placeholder^="e.g. Spider"]'); await S.send("Input.insertText", { text: "QA VLT Hall Zebra" }); await clickEl(S, "[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Save Hall')", { js: true }); await sleep(3500); await S.settle({ max: 20000 });
    const hp = await S.path(); const created = (await admin.from("galleries").select("id,title,visibility,layout").eq("profile_id", P).eq("title", "QA VLT Hall Zebra")).data;
    r.check(/^\/museum\//.test(hp) && created.length === 1 && created[0].visibility === "LOCKED" && (created[0].layout?.itemIds || []).length === 1, { page: "/vault/halls | owner, Personal", control: "Save Hall", expected: "Creates one private exhibition holding the 1 selected item and opens it", actual: `path ${hp}; rows ${created.length}; visibility ${created[0] && created[0].visibility}; items ${(created[0]?.layout?.itemIds || []).length}`, evidence: await S.jshot("vlt-halls-saved"), impact: "data loss", repro: "Save as Hall > name > Save Hall" });
    await admin.from("gallery_items").delete().in("gallery_id", created.map((c) => c.id)); await admin.from("galleries").delete().in("id", created.map((c) => c.id));

    // ---------- Frames
    await S.visit("/vault"); await S.visit("/vault/frames"); await sleep(1200);
    const fcount = await S.evaluate("[...document.querySelectorAll('button')].filter((b) => /QA /.test(b.innerText)).length");
    r.check(fcount === all.length, { page: "/vault/frames | owner, Personal", control: "Frame Studio item list", expected: `Lists the account's items (${all.length} records incl. sold)`, actual: `${fcount} buttons`, evidence: await S.jshot("vlt-frames"), impact: "misleading result", repro: "Open /vault/frames" });
    await typeInto(S, 'input[placeholder="Search items…"]', "zebra"); const fz = await S.evaluate("[...document.querySelectorAll('button')].filter((b) => /QA /.test(b.innerText)).map((b) => b.innerText.split('\\n')[0])");
    r.check(fz.length === 2 && fz.every((t) => /Zebra/.test(t)), { page: "/vault/frames | owner, Personal", control: "Frame Studio search 'zebra'", expected: "Zebra Comic and the sold Zebra Print", actual: JSON.stringify(fz), impact: "misleading result", repro: "search zebra" });
    await clickEl(S, "[...document.querySelectorAll('button')].find((b) => /QA VLT Zebra Comic/.test(b.innerText))", { js: true }); await sleep(1500);
    const hasPrev = await S.evaluate("!!document.querySelector('[style*=\"inline-flex\"]') && /Frame-fitted canvas/.test(document.body.innerText)");
    const sig = () => S.evaluate("(() => { const c = [...document.querySelectorAll('div')].find((d) => d.style && d.style.background && /^(rgb|#)/.test(d.style.background) && d.querySelector('img')); return c ? c.outerHTML.length + ':' + getComputedStyle(c).backgroundColor + ':' + Math.round(c.getBoundingClientRect().width) + 'x' + Math.round(c.getBoundingClientRect().height) : null; })()");
    const s0 = await sig();
    r.check(hasPrev && !!s0, { page: "/vault/frames | owner, Personal", control: "Frame Studio: choose an item", expected: "Preview of the item in the default frame appears", actual: `preview=${hasPrev}; sig=${s0}`, evidence: await S.jshot("vlt-frames-selected"), impact: "blocked workflow", repro: "Pick the Zebra Comic" });
    const sigs = [];
    for (const f of ["One-Touch", "Aluminum Case", "Comic Panel", "Neon Case", "Grade Slab"]) { await clickEl(S, `[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === '${f}')`, { js: true }); await sleep(500); sigs.push(await S.evaluate("document.querySelector('[style*=\"inline-flex\"]')?.innerHTML.length")); }
    r.check(new Set(sigs).size >= 4, { page: "/vault/frames | owner, Personal", control: "Frame styles (5 buttons)", expected: "Each style changes the preview's markup", actual: JSON.stringify(sigs), evidence: await S.jshot("vlt-frames-styles"), impact: "misleading result", repro: "Click each frame style" });
    await clickEl(S, "[...document.querySelectorAll('button')].find((b) => /^Navy/.test(b.innerText.trim()) || b.innerText.trim() === 'Navy')", { js: true }); await sleep(500);
    const bg = await S.evaluate("(() => { const c = [...document.querySelectorAll('div')].find((d) => d.style && d.style.background && d.querySelector('img')); return c ? getComputedStyle(c).backgroundColor : null; })()");
    r.check(bg === "rgb(13, 27, 42)", { page: "/vault/frames | owner, Personal", control: "Background 'Navy'", expected: "Preview background becomes #0d1b2a", actual: bg, impact: "usability", repro: "Click Navy" });
    await clickEl(S, "[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === '1:1')", { js: true }); await sleep(600);
    const dim = await S.evaluate("(() => { const c = [...document.querySelectorAll('div')].find((d) => d.style && d.style.overflow === 'hidden' && d.style.width && d.querySelector('img')); return c ? c.style.width + 'x' + c.style.height : null; })()");
    r.check(!!dim && dim.split("x")[0] === dim.split("x")[1], { page: "/vault/frames | owner, Personal", control: "Ratio '1:1'", expected: "Square canvas", actual: dim, impact: "usability", repro: "Click 1:1" });
    await clickEl(S, "[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Hot')", { js: true }); await sleep(600);
    r.check(await S.evaluate("document.body.innerText.includes('Hot')") && (await S.evaluate("[...document.querySelectorAll('button')].some((b) => b.innerText.trim() === 'Hot' && getComputedStyle(b).backgroundColor === 'rgb(249, 115, 22)')")), { page: "/vault/frames | owner, Personal", control: "Sticker 'Hot'", expected: "Sticker turns on (button filled orange; sticker on the preview)", actual: "button active=" + (await S.evaluate("[...document.querySelectorAll('button')].some((b) => b.innerText.trim() === 'Hot' && getComputedStyle(b).backgroundColor === 'rgb(249, 115, 22)')")), impact: "usability", repro: "Click Hot" });
    await S.evaluate("window.__vltDl.length = 0; true"); await clickEl(S, "[...document.querySelectorAll('button')].find((b) => /Download PNG/.test(b.innerText))", { js: true });
    let dlName = null; for (let i = 0; i < 25 && !dlName; i++) { await sleep(1000); dlName = (await S.evaluate("window.__vltDl.slice()"))[0] || null; }
    const dlErr = await S.evaluate("[...document.querySelectorAll('div')].map((d) => d.innerText).find((t) => /Download failed/.test(t || ''))");
    r.check(dlName === "vltd-qa-vlt-zebra-comic-1x1.png", { page: "/vault/frames | owner, Personal", control: "Download PNG", expected: "Produces vltd-qa-vlt-zebra-comic-1x1.png (renders the preview with the chosen frame/ratio)", actual: `file=${dlName}; error text=${dlErr ? dlErr.slice(0, 80) : "none"}`, evidence: await S.jshot("vlt-frames-download"), impact: "blocked workflow", repro: "Pick item, 1:1, Download PNG" });

    // ---------- Sync page
    await S.visit("/vault/sync"); await sleep(2500);
    const sy = squash(await S.text()); const dbCount = (await X.rows(P)).length;
    const mt = /(\d+) items on this device match the cloud/.exec(sy);
    r.check(!!mt && Number(mt[1]) === dbCount && /Up to date/.test(sy), { page: "/vault/sync | owner, Personal", control: "Offline capture queue status", expected: `'Up to date', and '${dbCount} items on this device match the cloud'`, actual: `${(mt || ["no match line"])[0]}; ${(/STATUS [^.]*\./.exec(sy) || [""])[0]}`, evidence: await S.jshot("vlt-sync"), impact: "misleading result", repro: "Open /vault/sync" });
    for (const [lab, href] of [["Smart Scan camera", "/capture"], ["Quick add", "/vault/quick"], ["Spreadsheet import", "/vault/import"], ["Back to Vault", "/vault"]]) {
      const h = await S.evaluate(`[...document.querySelectorAll('a')].find((a) => a.textContent.trim().includes(${JSON.stringify(lab)}))?.getAttribute('href')`);
      r.check(h === href, { page: "/vault/sync | owner, Personal", control: `Link '${lab}'`, expected: href, actual: String(h), impact: "blocked workflow", repro: "inspect" });
    }
    await clickEl(S, "[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Refresh')", { js: true }); await sleep(3000);
    const sy2 = squash(await S.text()); r.check(/match the cloud/.test(sy2), { page: "/vault/sync | owner, Personal", control: "Refresh", expected: "Re-counts device vs cloud and still reports they match", actual: (/(\d+) items on this device match the cloud/.exec(sy2) || sy2.slice(300, 500))[0], impact: "usability", repro: "Click Refresh" });
    await clickEl(S, "[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Retry Sync')", { js: true }); await sleep(3000);
    const sy3 = squash(await S.text()); r.check(/Up to date/.test(sy3) && !/failed|error/i.test(sy3), { page: "/vault/sync | owner, Personal", control: "Retry Sync (empty queue)", expected: "Stays 'Up to date' without error", actual: (/STATUS .{0,120}/.exec(sy3) || [""])[0], impact: "usability", repro: "Click Retry Sync" });
  } finally { console.log("errors", S.consoleErrors.slice(0, 4)); await S.close(); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });
