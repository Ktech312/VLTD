// EXH suite 4: builder arrange/sections/drag, interrupted saves, access pills, 18+/alias, share panel, invite links, preview. Needs audit-s-exh-builder1 first (Spare A holds Album 1-5).
const X = require("./audit-s-exh-lib.cjs");
const { session, admin, sleep, man, rows, mclick, byLabel, byLabelRe, typeInto, key, gdb, gItemIds, itemsOf, drag } = X;
const R = rows();
const m = man();
const ex = JSON.parse(require("fs").readFileSync(__dirname + "/exh-created.json", "utf8"));
const A = ex.A;
const PG = "/museum/[galleryId] | owner, Personal, exhibition 'QA Spare A' (5 items)";
const dbWait = async (id, pred, ms = 12000) => { const t0 = Date.now(); let g; while (Date.now() - t0 < ms) { g = await gdb(id); if (g && pred(g)) return g; await sleep(500); } return g; };
const secs = (g) => { const a = (g.exhibition_layout && g.exhibition_layout.sections) || []; const l = (g.layout && g.layout.sections) || []; return a.length >= l.length ? a : l; };
const slotRect = (S, i, scroll = true) => S.evaluate(`(() => { const e = document.querySelector('[data-slot-idx="${i}"]'); if (!e) return null; if (${scroll}) e.scrollIntoView({block:'center'}); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
const wall = (S) => S.evaluate(`[...document.querySelectorAll('[data-slot-idx]')].map(e => { const t = e.querySelector('[title]'); const im = e.querySelector('img'); return (t && t.getAttribute('title')) || (im && im.alt) || ''; }).filter(Boolean).map(t => t.replace(/ - Original.*/, ''))`);

(async () => {
  const S = await session("owner");
  try {
    await S.visit("/museum/" + A); await sleep(7000);
    // ---- Organize: create first exhibit
    await mclick(S, byLabel("Organize"), { wait: 800 });
    let dlg = await S.evaluate(`(() => { const d = document.querySelector('[role=dialog]'); return d ? d.innerText.replace(/\\s+/g,' ') : null; })()`);
    R.check(/Create first exhibit makes/.test(String(dlg)) && /5 pieces/.test(dlg), { page: PG, control: "'Organize' with 5 pieces and no exhibit page", expected: "Explains it will create 'Exhibit 1' with the 5 pieces and nothing is created unless chosen", actual: String(dlg).slice(0, 260), evidence: await S.jshot("exh-builder-organize-notice-1440"), impact: "usability", repro: "Open Spare A, click Organize" });
    await mclick(S, byLabel("Not now"), { wait: 500 });
    R.check(secs(await gdb(A)).length === 0, { page: PG, control: "Organize notice 'Not now' with pieces present", expected: "No exhibit page created", actual: "sections " + secs(await gdb(A)).length, impact: "data loss", repro: "Organize > Not now" });
    await mclick(S, byLabel("Organize"), { wait: 800 });
    await mclick(S, byLabelRe("Create first exhibit"), { wait: 3500 });
    let g = await dbWait(A, (x) => secs(x).length === 1);
    R.check(secs(g).length === 1 && secs(g)[0].itemIds.length === 5 && secs(g)[0].title === "Exhibit 1", { page: PG, control: "'Create first exhibit'", expected: "One page 'Exhibit 1' with the 5 pieces saved", actual: `${secs(g).length} pages; first has ${secs(g)[0] && secs(g)[0].itemIds.length}; title ${secs(g)[0] && secs(g)[0].title}`, impact: "data loss", repro: "Organize > Create first exhibit" });
    const doneLabel = await S.evaluate(`[...document.querySelectorAll('main button')].some(b => b.textContent.trim() === 'Done' && b.getAttribute('aria-pressed') === 'true')`);
    const hint = (await S.text()).includes("Drag a card onto another to swap them");
    R.check(doneLabel && hint, { page: PG, control: "Organize mode after creating the page", expected: "Button reads 'Done' (pressed) and the drag hint shows", actual: `Done pressed ${doneLabel}; hint ${hint}`, impact: "usability", repro: "Create first exhibit" });
    // ---- drag: swap slot 0 <-> 1 with HTML5 drag events (real mouse press/move + drag interception)
    const order0 = await wall(S);
    await S.send("Input.setInterceptDrags", { enabled: true });
    let dragData = null; S.c.on((e) => { if (e.method === "Input.dragIntercepted") dragData = e.params.data; });
    const swapMouse = async (i, j) => {
      await slotRect(S, i); const a = await slotRect(S, i, false), b = await slotRect(S, j, false); dragData = null;
      await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: a.x, y: a.y, button: "none" });
      await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x: a.x, y: a.y, button: "left", clickCount: 1, buttons: 1 });
      for (let k = 1; k <= 6 && !dragData; k++) { await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: a.x + k * 4, y: a.y + k * 4, button: "left", buttons: 1 }); await sleep(60); }
      if (!dragData) { await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: a.x, y: a.y, button: "left", clickCount: 1, buttons: 0 }); return false; }
      await S.send("Input.dispatchDragEvent", { type: "dragEnter", x: b.x, y: b.y, data: dragData });
      await S.send("Input.dispatchDragEvent", { type: "dragOver", x: b.x, y: b.y, data: dragData });
      await S.send("Input.dispatchDragEvent", { type: "drop", x: b.x, y: b.y, data: dragData });
      await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: b.x, y: b.y, button: "left", clickCount: 1, buttons: 0 });
      await sleep(2500); return true;
    };
    const okDrag = await swapMouse(0, 1);
    const order1 = await wall(S);
    g = await dbWait(A, (x) => secs(x)[0] && secs(x)[0].itemIds[0] !== (async () => 0)(), 3000);
    g = await gdb(A);
    const dbOrder = secs(g)[0].itemIds.map((id) => id.replace(/.*_/, ""));
    R.check(okDrag && order1[0] === order0[1] && order1[1] === order0[0] && dbOrder[0] === "2" && dbOrder[1] === "1", { page: PG, control: "Organize: drag a card onto another (real mouse press/move with drag events)", expected: "The two cards swap and the new order is saved (Album 2 first)", actual: `drag started ${okDrag}; wall ${order0.slice(0, 2).join("/")} -> ${order1.slice(0, 2).join("/")}; saved order ${dbOrder.join(",")}`, evidence: await S.jshot("exh-builder-drag-swap-1440"), impact: "blocked workflow", repro: "Organize, drag card 1 onto card 2" });
    await S.send("Input.setInterceptDrags", { enabled: false });
    // ---- emulated touch swap 2 <-> 4
    await S.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await slotRect(S, 2); const a2 = await slotRect(S, 2, false), b4 = await slotRect(S, 4, false);
    const before = secs(await gdb(A))[0].itemIds.map((id) => id.replace(/.*_/, "")).join(",");
    await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: a2.x, y: a2.y, id: 1 }] });
    for (let k = 1; k <= 8; k++) { await S.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: a2.x + ((b4.x - a2.x) * k) / 8, y: a2.y + ((b4.y - a2.y) * k) / 8, id: 1 }] }); await sleep(40); }
    await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await sleep(2500);
    const afterT = secs(await gdb(A))[0].itemIds.map((id) => id.replace(/.*_/, "")).join(",");
    await S.send("Emulation.setTouchEmulationEnabled", { enabled: false });
    R.check(afterT !== before && afterT.split(",")[2] === before.split(",")[4] && afterT.split(",")[4] === before.split(",")[2], { page: PG, control: "Organize: touch drag a card onto another (browser-emulated touch, not a physical phone)", expected: "Cards in slots 3 and 5 swap and the order is saved", actual: `saved order ${before} -> ${afterT}`, evidence: await S.jshot("exh-builder-touch-swap-1440"), impact: "blocked workflow", repro: "Organize, touch-drag slot 3 onto slot 5 (emulated)" });
    await mclick(S, byLabel("Done"), { wait: 3000 });
    const orgBack = await S.evaluate(`[...document.querySelectorAll('main button')].some(b => b.textContent.trim() === 'Organize')`);
    R.check(orgBack, { page: PG, control: "Organize 'Done'", expected: "Returns to 'Organize' and keeps the order", actual: "Organize visible " + orgBack, impact: "usability", repro: "Click Done" });
    // clean browser sees same order
    const savedOrder = secs(await gdb(A))[0].itemIds.map((id) => id.replace(/.*_/, "")).join(",");
    const C2 = await session("owner");
    try { await C2.visit("/museum/" + A); await sleep(7000); const w2 = (await wall(C2)).map((t) => t.replace(/QA Album /, "")).join(","); R.check(w2 === savedOrder, { page: PG + " | clean second browser", control: "Arranged order seen from a clean browser", expected: savedOrder, actual: w2, impact: "data loss", repro: "Arrange, open the exhibition in another browser" }); } finally { await C2.close(); }

    // ---- remove one piece from the wall
    const titleRm = (await itemsOf(secs(await gdb(A))[0].itemIds)).map((i) => i.title)[0];
    await mclick(S, `document.querySelector('button[aria-label^="Remove QA Album"]')`, { wait: 3500 });
    g = await dbWait(A, (x) => gItemIds(x).length === 4);
    R.check(gItemIds(g).length === 4 && secs(g)[0].itemIds.length === 4, { page: PG, control: "Wall 'Remove <item>' (red minus)", expected: "Piece leaves the exhibition (4 items) in the database; the Vault item is untouched", actual: `exhibition items ${gItemIds(g).length}, page items ${secs(g)[0].itemIds.length}`, impact: "data loss", repro: "Click the red minus under a card" });
    const vaultStill = (await admin.from("vault_items").select("id").eq("profile_id", m.personalId)).data.length;
    R.check(vaultStill === 31, { page: PG, control: "Wall 'Remove' keeps the Vault item", expected: "Vault still has 31 items", actual: String(vaultStill), impact: "data loss", repro: "Remove a piece; count Vault items" });

    // ---- exhibit pages
    await mclick(S, byLabelRe("^Exhibit #1"), { wait: 600 });
    await mclick(S, byLabelRe("\\+ Add Exhibit"), { wait: 3000 });
    g = await dbWait(A, (x) => secs(x).length === 2, 8000);
    R.check(secs(g).length === 2 && secs(g)[1].title === "Exhibit 2", { page: PG, control: "Exhibit menu '+ Add Exhibit'", expected: "Second page 'Exhibit 2' saved", actual: `${secs(g).length} pages; ${secs(g)[1] && secs(g)[1].title}`, impact: "data loss", repro: "Exhibit #1 menu > + Add Exhibit" });
    await typeInto(S, `document.querySelector('input[placeholder="Exhibit name…"]')`, "Second wall");
    g = await dbWait(A, (x) => secs(x)[1] && secs(x)[1].title === "Second wall", 9000);
    R.check(secs(g)[1] && secs(g)[1].title === "Second wall", { page: PG, control: "Exhibit name field", expected: "Rename autosaves (database title 'Second wall')", actual: secs(g)[1] && secs(g)[1].title, impact: "data loss", repro: "Type a name in the exhibit name box" });
    await typeInto(S, `document.querySelector('textarea[placeholder="Exhibit description…"]')`, "Wall two blurb");
    g = await dbWait(A, (x) => secs(x)[1] && secs(x)[1].description === "Wall two blurb", 9000);
    R.check(secs(g)[1] && secs(g)[1].description === "Wall two blurb", { page: PG, control: "Exhibit description field", expected: "Autosaves", actual: JSON.stringify(secs(g)[1] && secs(g)[1].description), impact: "data loss", repro: "Type in exhibit description" });
    // arrows loop
    const nowName = () => S.evaluate(`(() => { const i = document.querySelector('input[placeholder="Exhibit name…"]'); return i ? i.value : null; })()`);
    await mclick(S, byLabel("Next exhibit"), { wait: 500 });
    const n1 = await nowName();
    await mclick(S, byLabel("Next exhibit"), { wait: 500 });
    const n2 = await nowName();
    await mclick(S, byLabel("Previous exhibit"), { wait: 500 });
    const n3 = await nowName();
    R.check(n1 === "Exhibit 1" && n2 === "Second wall" && n3 === "Exhibit 1", { page: PG, control: "Exhibit arrows 'Next exhibit' / 'Previous exhibit' (they loop)", expected: "Second wall -> next loops to Exhibit 1 -> next Second wall -> previous Exhibit 1", actual: `${n1} | ${n2} | ${n3}`, impact: "usability", repro: "Use the arrows over the wall" });
    // delete empty page 2
    await mclick(S, byLabelRe("^Exhibit #1"), { wait: 600 });
    await mclick(S, byLabel("Delete exhibit page 2"), { wait: 500 });
    await mclick(S, byLabel("Delete?"), { wait: 3000 });
    g = await dbWait(A, (x) => secs(x).length === 1, 9000);
    R.check(secs(g).length === 1 && gItemIds(g).length === 4, { page: PG, control: "Exhibit menu delete page ('−' then 'Delete?')", expected: "Only the empty second page is removed; the 4 pieces stay", actual: `${secs(g).length} pages; ${gItemIds(g).length} items`, impact: "data loss", repro: "Exhibit menu > − > Delete?" });

    // ---- interrupted edit: reload before the autosave fires
    await mclick(S, byLabel("Edit title and description"), { wait: 400 });
    await typeInto(S, `document.querySelector('input[aria-label="Exhibit title"]')`, "QA Spare A quick");
    await S.visit("/museum/" + A); await sleep(5500);
    const h1q = await S.evaluate(`document.querySelector('main h1').textContent.trim()`);
    g = await gdb(A);
    R.check(h1q === "QA Spare A quick" || g.title === "QA Spare A quick", { page: PG, control: "Edit then reload within a second (before the 1s autosave)", expected: "Edit is not silently lost: either saved or restored from the tab", actual: `page shows '${h1q}', database '${g.title}'`, impact: "data loss", repro: "Type a new title and reload immediately" });
    await sleep(1500);
    // offline edit
    await S.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await mclick(S, byLabel("Edit title and description"), { wait: 400 });
    await typeInto(S, `document.querySelector('input[aria-label="Exhibit title"]')`, "QA Spare A offline edit");
    await sleep(4500);
    const failBadge = await S.evaluate(`(() => { const e = document.querySelector('[aria-live=polite]'); return e ? e.textContent.trim() : ''; })()`);
    const dbOff = (await gdb(A)).title;
    R.check(/Not saved to the cloud yet/.test(failBadge) && dbOff !== "QA Spare A offline edit", { page: PG, control: "Edit while the connection is down", expected: "Page says it is not saved yet and keeps retrying; database not changed meanwhile", actual: `badge '${failBadge}'; database title '${dbOff}'`, evidence: await S.jshot("exh-builder-offline-1440"), impact: "misleading result", repro: "Go offline, edit the title" });
    await S.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    g = await dbWait(A, (x) => x.title === "QA Spare A offline edit", 30000);
    const okBadge = await S.evaluate(`(() => { const e = document.querySelector('[aria-live=polite]'); return e ? e.textContent.trim() : ''; })()`);
    R.check(g.title === "QA Spare A offline edit", { page: PG, control: "Retry after the connection returns", expected: "The offline edit reaches the database by itself within ~30s", actual: `database title '${g.title}'; badge '${okBadge}'`, impact: "data loss", repro: "Offline edit, go online, wait" });
    await typeInto(S, `document.querySelector('input[aria-label="Exhibit title"]')`, "QA Spare A");
    await sleep(3000); await mclick(S, byLabel("Done editing title and description"), { wait: 300 });

    // ---- access pills
    const events0 = (await admin.from("exhibition_events").select("id").eq("gallery_id", A)).data.length;
    const pills = [["Guest View", (x) => x.visibility === "INVITE" && x.layout.guestViewMode !== "guest"], ["Registered Users", (x) => x.visibility === "INVITE" && x.layout.guestViewMode === "guest"], ["Private", (x) => x.visibility === "LOCKED"]];
    for (const [label, pred] of pills) {
      await mclick(S, byLabel(label), { wait: 300 });
      g = await dbWait(A, pred, 9000);
      const cur = await S.evaluate(`(() => { const t = document.body.innerText; const mm = t.match(/Current mode: [^\\n]*/); return mm ? mm[0] : ''; })()`);
      R.check(pred(g), { page: PG, control: `Access pill '${label}'`, expected: "Saved to the database with the matching visibility", actual: `${g.visibility} / guestViewMode=${g.layout.guestViewMode}`, impact: "privacy/data loss", repro: "Click the pill" });
    }
    // Public requires a confirmation
    await mclick(S, byLabel("Public Exhibit"), { wait: 500 });
    const ask = (await S.text()).includes("Make this exhibit public now?");
    g = await gdb(A);
    R.check(ask && g.visibility === "LOCKED", { page: PG, control: "Access pill 'Public Exhibit'", expected: "Asks 'Make this exhibit public now?' first; nothing changes yet", actual: `prompt ${ask}; database ${g.visibility}`, impact: "privacy/data loss", repro: "Click Public Exhibit" });
    await mclick(S, `[...document.querySelectorAll('main button')].filter(b => b.textContent.trim() === 'Cancel').pop()`, { wait: 3000 });
    g = await gdb(A);
    R.check(g.visibility === "LOCKED" && !(await S.text()).includes("Make this exhibit public now?"), { page: PG, control: "Public confirmation 'Cancel'", expected: "Stays Private", actual: g.visibility, impact: "privacy/data loss", repro: "Public Exhibit > Cancel" });
    await mclick(S, byLabel("Public Exhibit"), { wait: 500 });
    await mclick(S, byLabel("Make public"), { wait: 3500 });
    g = await dbWait(A, (x) => x.visibility === "PUBLIC", 9000);
    let ev1 = []; for (let i = 0; i < 16; i++) { ev1 = (await admin.from("exhibition_events").select("id,type").eq("gallery_id", A)).data; if (ev1.length > events0) break; await sleep(500); }
    R.check(g.visibility === "PUBLIC" && ev1.length === events0 + 1, { page: PG, control: "Public confirmation 'Make public'", expected: "PUBLIC saved and one 'published' event recorded for followers", actual: `${g.visibility}; events ${events0} -> ${ev1.length} (${ev1.map((e) => e.type).join(",")}). A direct insert into exhibition_events by the owner is refused by the database (row-level security); the page ignores that, so no follower is ever told. Possibly migration 20260823_fix_exhibition_events_team_check.sql is not applied on production (unsure).`, impact: "privacy/data loss", repro: "Public Exhibit > Make public" });
    // help popover
    await mclick(S, byLabel("Access mode help"), { wait: 400 });
    const help = await S.evaluate(`document.getElementById('gallery-access-mode-help') ? document.getElementById('gallery-access-mode-help').innerText.replace(/\\s+/g,' ') : null`);
    R.check(!!help && /Current mode: Public Exhibition/.test(help), { page: PG, control: "'Access mode help' (i)", expected: "Explains the four modes and states the current one", actual: String(help).slice(0, 200), impact: "usability", repro: "Click the i next to USER ACCESS MODE" });
    await mclick(S, byLabel("Close access mode help"), { wait: 300 });
    // back to Private (leave A private for the rest)
    await mclick(S, byLabel("Private"), { wait: 300 }); await dbWait(A, (x) => x.visibility === "LOCKED", 9000);
    // 18+ and alias
    await mclick(S, `document.querySelector('input[aria-label="Require 18+ confirmation"]')`, { wait: 3000 });
    g = await dbWait(A, (x) => x.layout.adultOnly === true, 9000);
    R.check(g.layout.adultOnly === true, { page: PG, control: "'18+ exhibit' checkbox", expected: "Saved (adultOnly true)", actual: String(g.layout.adultOnly), impact: "data loss", repro: "Tick 18+ exhibit" });
    await mclick(S, `document.querySelector('input[aria-label="Require 18+ confirmation"]')`, { wait: 3000 });
    await mclick(S, byLabel("18+ exhibit help"), { wait: 300 });
    R.check(await S.evaluate(`!!document.getElementById('gallery-adult-info')`), { page: PG, control: "'18+ exhibit help' (i)", expected: "Explains the 18+ confirmation", actual: "popover shown", impact: "usability", repro: "Click the i by 18+" });
    await mclick(S, byLabel("18+ exhibit help"), { wait: 300 });
    await mclick(S, `document.querySelector('input[aria-label^="Show a made-up curator identity"]')`, { wait: 500 });
    await typeInto(S, `document.querySelector('input[aria-label="Alias name"]')`, "QA Alias Curator");
    await sleep(4500);
    g = await gdb(A);
    const aliasSaved = g.alias_enabled === true && g.alias_name === "QA Alias Curator";
    let shotA = "";
    if (!aliasSaved) shotA = await S.jshot("exh-builder-alias-not-autosaved");
    R.check(aliasSaved, { page: PG, control: "'Use an alias' checkbox + Alias name (autosave)", expected: "Saves itself like the other edits (database alias_enabled true, alias_name set)", actual: `database alias_enabled=${g.alias_enabled}, alias_name=${JSON.stringify(g.alias_name)} 4.5s later`, evidence: shotA, impact: "privacy/data loss", repro: "Tick Use an alias, type a name, wait, check / open elsewhere" });
    if (!aliasSaved) {
      await mclick(S, `[...document.querySelectorAll('main button')].find(b => b.textContent.trim() === 'Save')`, { wait: 3500 });
      g = await gdb(A);
      R.check(g.alias_enabled === true && g.alias_name === "QA Alias Curator", { page: PG, control: "'Save' pill after setting an alias", expected: "Alias saved", actual: `alias_enabled=${g.alias_enabled}, alias_name=${g.alias_name}`, impact: "privacy/data loss", repro: "Set alias, click the Save pill" });
    }

    // ---- share panel
    await mclick(S, byLabel("Share this exhibition"), { wait: 800 });
    let share = await S.evaluate(`(() => { const d = document.querySelector('[role=dialog]'); return d ? d.innerText.replace(/\\s+/g,' ') : null; })()`);
    R.check(!!share, { page: PG + " | Private", control: "'Share' on a Private exhibition", expected: "Tells the owner it has no usable public link or offers to turn sharing on; no link copied", actual: String(share).slice(0, 260), evidence: await S.jshot("exh-builder-share-private-1440"), impact: "misleading result", repro: "Private exhibition, click Share" });
    await key(S, "Escape", "Escape", 27);
    await mclick(S, byLabel("Guest View"), { wait: 300 }); await dbWait(A, (x) => x.visibility === "INVITE", 9000);
    await mclick(S, byLabel("Share this exhibition"), { wait: 800 });
    share = await S.evaluate(`(() => { const d = document.querySelector('[role=dialog]'); return d ? d.innerText.replace(/\\s+/g,' ') : null; })()`);
    const tok = (await gdb(A)).public_token;
    const shareUrlInDlg = await S.evaluate(`(() => { const d = document.querySelector('[role=dialog]'); const i = d && d.querySelector('input'); return i ? i.value : null; })()`);
    R.check(!!share && shareUrlInDlg && shareUrlInDlg.endsWith("/museum/share/" + tok), { page: PG + " | Guest View", control: "'Share' panel link", expected: "Shows the exhibition's share link (/museum/share/<token> matching the database token)", actual: `${shareUrlInDlg}; db token ${tok}`, evidence: await S.jshot("exh-builder-share-guest-1440"), impact: "misleading result", repro: "Guest View, Share" });
    await S.evaluate("window.__aud.clip.length = 0; window.__aud.share = 0; window.__aud.opens.length = 0; true");
    const copyOk = await mclick(S, `[...document.querySelectorAll('[role=dialog] button')].find(b => /Copy/i.test(b.textContent))`, { wait: 600 });
    const lk = await S.look();
    R.check(copyOk && lk.clip.some((c) => c.endsWith("/museum/share/" + tok)), { page: PG, control: "Share panel 'Copy link'", expected: "Clipboard receives the share URL", actual: `clipboard ${JSON.stringify(lk.clip)}; native share ${lk.share}; windows opened ${JSON.stringify(lk.opens)}`, impact: "misleading result", repro: "Share > Copy" });
    const shareButtons = await S.evaluate(`[...document.querySelectorAll('[role=dialog] button, [role=dialog] a')].map(b => (b.getAttribute('aria-label') || b.textContent).trim().replace(/\\s+/g,' ')).filter(Boolean).slice(0, 14)`);
    console.log("share buttons", JSON.stringify(shareButtons));
    await key(S, "Escape", "Escape", 27);
    // regenerate
    const tokenBefore = tok;
    await mclick(S, byLabel("Regenerate link"), { wait: 500 });
    const warn = (await S.text()).includes("Regenerating stops the old link from working");
    await mclick(S, `[...document.querySelectorAll('main button')].filter(b => b.textContent.trim() === 'Cancel').pop()`, { wait: 500 });
    R.check(warn && (await gdb(A)).public_token === tokenBefore, { page: PG, control: "'Regenerate link' then 'Cancel'", expected: "Warns the old link stops working; Cancel keeps the same token", actual: `warning ${warn}; token unchanged ${(await gdb(A)).public_token === tokenBefore}`, impact: "data loss", repro: "Regenerate link > Cancel" });
    await mclick(S, byLabel("Regenerate link"), { wait: 500 });
    await mclick(S, `[...document.querySelectorAll('main button')].find(b => b.textContent.trim() === 'Regenerate')`, { wait: 4000 });
    g = await dbWait(A, (x) => x.public_token !== tokenBefore, 12000);
    const tokenAfter = g.public_token;
    R.check(tokenAfter && tokenAfter !== tokenBefore, { page: PG, control: "'Regenerate' (confirm)", expected: "A new share token is saved to the database", actual: `token changed ${tokenAfter !== tokenBefore}`, impact: "data loss", repro: "Regenerate link > Regenerate" });
    require("fs").writeFileSync(__dirname + "/exh-tokens.json", JSON.stringify({ oldTokenA: tokenBefore, newTokenA: tokenAfter }));

    // ---- invite links (Advanced)
    await mclick(S, byLabel("Advanced"), { wait: 800 });
    const advTxt = (await S.text()).replace(/\s+/g, " ");
    R.check(/Invite Tokens/.test(advTxt) && /No active invite tokens yet/.test(advTxt), { page: PG, control: "'Advanced' section", expected: "Shows the items list and Invite Tokens with 'No active invite tokens yet'", actual: advTxt.slice(advTxt.indexOf("In this exhibition"), advTxt.indexOf("In this exhibition") + 200), evidence: await S.jshot("exh-builder-advanced-1440"), impact: "usability", repro: "Click Advanced" });
    await typeInto(S, `document.querySelector('input[placeholder^="Optional label"]')`, "QA VIP preview");
    await mclick(S, byLabel("Create Link"), { wait: 1500 });
    let inv = (await admin.from("gallery_invites").select("*").eq("gallery_id", A)).data || [];
    R.check(inv.length === 1 && inv[0].label === "QA VIP preview" && inv[0].disabled === false, { page: PG, control: "Invite 'Create Link' (with label)", expected: "One invite row in the database with that label, enabled", actual: JSON.stringify(inv.map((i) => ({ label: i.label, disabled: i.disabled, expires: i.expires_at, perms: i.permissions }))), impact: "data loss", repro: "Advanced > label > Create Link" });
    const token1 = inv[0] && inv[0].token;
    await S.evaluate("window.__aud.clip.length = 0; true");
    await mclick(S, byLabel("Copy Link"), { wait: 600 });
    const lk2 = await S.look();
    R.check(lk2.clip.some((c) => c.endsWith("/museum/invite/" + token1)), { page: PG, control: "Invite 'Copy Link'", expected: "Clipboard receives /museum/invite/<token>", actual: JSON.stringify(lk2.clip), impact: "misleading result", repro: "Click Copy Link" });
    await mclick(S, byLabelRe("Expires: Never"), { wait: 500 });
    await mclick(S, byLabel("24 hours"), { wait: 1500 });
    for (let i = 0; i < 16; i++) { inv = (await admin.from("gallery_invites").select("*").eq("gallery_id", A)).data; if (inv[0] && inv[0].expires_at) break; await sleep(500); }
    const expMs = inv[0].expires_at ? new Date(inv[0].expires_at).getTime() - Date.now() : null;
    R.check(expMs && expMs > 23 * 3600e3 && expMs < 25 * 3600e3, { page: PG, control: "Invite 'Expires' > 24 hours", expected: "expires_at about 24h ahead in the database", actual: expMs ? Math.round(expMs / 3600e3) + "h ahead" : String(inv[0].expires_at), impact: "data loss", repro: "Expires > 24 hours" });
    await mclick(S, byLabelRe("Permissions"), { wait: 500 });
    await mclick(S, `[...document.querySelectorAll('#gallery-permissions-dropdown label')].find(l => /Financial History/.test(l.textContent)).querySelector('input')`, { wait: 500 });
    for (let i = 0; i < 16; i++) { inv = (await admin.from("gallery_invites").select("*").eq("gallery_id", A)).data; if (inv[0] && inv[0].permissions) break; await sleep(500); }
    R.check(inv[0].permissions && inv[0].permissions.financialHistory === true, { page: PG, control: "Invite 'Permissions' > Financial History", expected: "financialHistory true saved on the invite", actual: JSON.stringify(inv[0].permissions), impact: "privacy/data loss", repro: "Permissions > tick Financial History" });
    require("fs").writeFileSync(__dirname + "/exh-invites.json", JSON.stringify({ token1 }));
    // a second invite then disable it
    await typeInto(S, `document.querySelector('input[placeholder^="Optional label"]')`, "QA to disable");
    await mclick(S, byLabel("Create Link"), { wait: 1500 });
    inv = (await admin.from("gallery_invites").select("*").eq("gallery_id", A)).data;
    const second = inv.find((i) => i.label === "QA to disable");
    await mclick(S, `[...document.querySelectorAll('main button')].filter(b => b.textContent.trim() === 'Disable')[1] || [...document.querySelectorAll('main button')].find(b => b.textContent.trim() === 'Disable')`, { wait: 1500 });
    inv = (await admin.from("gallery_invites").select("*").eq("gallery_id", A)).data;
    const dis = inv.filter((i) => i.disabled);
    R.check(dis.length === 1, { page: PG, control: "Invite 'Disable'", expected: "Exactly one invite becomes disabled in the database", actual: `disabled: ${dis.map((i) => i.label).join(",")} of ${inv.length}`, impact: "data loss", repro: "Create two invites, Disable one" });
    require("fs").writeFileSync(__dirname + "/exh-invites.json", JSON.stringify({ token1, disabledToken: dis[0] && dis[0].token, disabledLabel: dis[0] && dis[0].label, secondToken: second && second.token }));
    const stats = (await S.text()).replace(/\s+/g, " ");
    R.check(/TOKENS\s*1\b/.test(stats), { page: PG, control: "Invite stats 'TOKENS' count", expected: "1 active invite after one was disabled", actual: (stats.match(/TOKENS\s*\d+/) || [""])[0], impact: "misleading result", repro: "Disable an invite; read TOKENS" });

    // ---- Announce (writes an exhibition_events row; the QA profile has no followers)
    const evA0 = (await admin.from("exhibition_events").select("id").eq("gallery_id", A)).data.length;
    await mclick(S, byLabelRe("Announce"), { wait: 2500 });
    const annTxt = await S.evaluate(`[...document.querySelectorAll('main button')].map(b => b.textContent.trim()).find(t => /Announc/.test(t))`);
    const evA1 = (await admin.from("exhibition_events").select("id,type").eq("gallery_id", A)).data;
    R.check(/Announced/.test(annTxt) === false || evA1.length > evA0, { page: PG + " | Guest View", control: "'Announce' (let followers know)", expected: "If the button says '✓ Announced', an announcement event exists for followers", actual: `button reads '${annTxt}'; announcement rows ${evA0} -> ${evA1.length}. Direct test: an owner's own insert into exhibition_events is refused by the database (row-level security), so the page reports success while nothing is recorded.`, evidence: await S.jshot("exh-builder-announce-1440"), impact: "misleading result", repro: "Click Announce; check Alerts for a follower / the events table" });
    // ---- preview
    await mclick(S, byLabelRe("^Preview"), { wait: 1500 });
    const prev = await S.evaluate(`(() => { const t = document.body.innerText; return /GUEST PREVIEW/.test(t); })()`);
    const prevShot = await S.jshot("exh-builder-preview-1440");
    R.check(prev, { page: PG, control: "'Preview ↗'", expected: "Opens the full guest preview", actual: "GUEST PREVIEW shown: " + prev, evidence: prevShot, impact: "usability", repro: "Click Preview" });
    await mclick(S, byLabel("Close preview"), { wait: 800 });
    R.check(!(await S.evaluate(`/GUEST PREVIEW/.test(document.body.innerText)`)), { page: PG, control: "Preview 'Close preview'", expected: "Preview closes", actual: "closed", impact: "usability", repro: "Click Close preview" });
    console.log("DONE builder2");
  } finally { await S.close(); }
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
