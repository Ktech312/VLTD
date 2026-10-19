// EXH suite 6: the Guest View page controls (1440 + browser-emulated phone): exhibit arrows and swipe, item detail, Share/Save/Report, 18+ gate, Back link.
const X = require("./audit-s-exh-lib.cjs");
const { session, admin, sleep, man, rows, mclick, byLabel, byLabelRe, key, gdb, gItemIds } = X;
const R = rows();
const m = man();
const ex = JSON.parse(require("fs").readFileSync(__dirname + "/exh-created.json", "utf8"));
const D = ex.D, B = ex.B;
const id = (n) => `qa_vz_${m.stamp}_${n}`;
const PG = "/museum/[galleryId]/guest | exhibition 'QA Spare D' PUBLIC, 2 exhibit pages (2 + 2 items)";
const present = (t) => ({ one: [12, 13].filter((n) => t.includes(`QA Album ${n} - `)).length, two: [14, 15].filter((n) => t.includes(`QA Album ${n} - `)).length });

(async () => {
  // ---- shape D: two exhibit pages with their own pieces, public record (snapshots) only
  const items = (await admin.from("vault_items").select("id,title,image_front_url").in("id", [12, 13, 14, 15].map(id))).data;
  const snaps = items.map((r) => ({ id: r.id, title: r.title, imageFrontUrl: r.image_front_url || undefined }));
  const gd = await gdb(D);
  const sections = [
    { id: "gd_s1", title: "QA Wall One", description: "first wall", itemIds: [id(12), id(13)] },
    { id: "gd_s2", title: "QA Wall Two", description: "second wall", itemIds: [id(14), id(15)] },
  ];
  const layout = { ...gd.layout, itemIds: [12, 13, 14, 15].map(id), sections, publicItemSnapshots: snaps, displayMode: "grid" };
  await admin.from("galleries").update({ visibility: "PUBLIC", state: "ACTIVE", layout, exhibition_layout: { ...(gd.exhibition_layout || {}), itemIds: layout.itemIds, sections }, description: "audit multi-exhibit room" }).eq("id", D);

  const wallState = async (S) => present((await S.text()).replace(/\s+/g, " "));
  // ---- desktop arrows (visitor)
  let S = await session("visitor");
  try {
    await S.visit(`/museum/${D}/guest`); await sleep(7000);
    let w = await wallState(S);
    R.check(w.one === 2 && w.two === 0, { page: PG + " | visitor 1440", control: "First exhibit on opening", expected: "Wall One's two pieces only", actual: JSON.stringify(w), evidence: await S.jshot("exh-guest-multi-1440"), impact: "misleading result", repro: "Open the guest page" });
    await mclick(S, byLabel("Next exhibit"), { wait: 700 });
    w = await wallState(S);
    R.check(w.one === 0 && w.two === 2, { page: PG + " | visitor 1440", control: "'Next exhibit' arrow", expected: "Wall Two's pieces replace Wall One's", actual: JSON.stringify(w), impact: "blocked workflow", repro: "Click the right arrow" });
    await mclick(S, byLabel("Next exhibit"), { wait: 700 });
    w = await wallState(S);
    R.check(w.one === 2 && w.two === 0, { page: PG + " | visitor 1440", control: "'Next exhibit' after the last (loops)", expected: "Back to Wall One", actual: JSON.stringify(w), impact: "usability", repro: "Click right arrow twice" });
    await mclick(S, byLabel("Previous exhibit"), { wait: 700 });
    w = await wallState(S);
    R.check(w.two === 2 && w.one === 0, { page: PG + " | visitor 1440", control: "'Previous exhibit' from the first (loops)", expected: "Wall Two", actual: JSON.stringify(w), impact: "usability", repro: "Click left arrow once from the start" });
    // keyboard
    await S.evaluate(`document.querySelector('[aria-label="Next exhibit"]').focus(); true`);
    await key(S, "Enter", "Enter", 13);
    w = await wallState(S);
    R.check(w.one === 2, { page: PG, control: "Exhibit arrow with the keyboard (Enter)", expected: "Moves to the next exhibit", actual: JSON.stringify(w), impact: "usability", repro: "Tab to the arrow, press Enter" });
    // a real mouse drag across the wall: does anything happen? (the guest page has arrows and touch swipe only)
    const wallBox = await S.evaluate(`(() => { const b = document.querySelector('[aria-label="Next exhibit"]').parentElement.getBoundingClientRect(); return { x: b.x, y: b.y + b.height / 2, w: b.width }; })()`);
    const before = await wallState(S);
    await X.drag(S, wallBox.x + wallBox.w * 0.8, wallBox.y, wallBox.x + wallBox.w * 0.2, wallBox.y, 10);
    const afterDrag = await wallState(S);
    R.nt({ page: PG + " | visitor 1440", control: "Mouse drag across the wall to change exhibit", expected: "Product decision: the exhibit pager has arrows and touch-swipe but no mouse drag", actual: `before ${JSON.stringify(before)} after real-mouse drag ${JSON.stringify(afterDrag)}`, impact: "improvement" });
    // item detail
    await mclick(S, `[...document.querySelectorAll('main button')].find(b => /QA Album 1[2-5] - /.test(b.getAttribute('aria-label') || b.textContent))`, { wait: 1200 });
    let modal = await S.evaluate(`(() => { const d = document.querySelector('[role=dialog]'); return d ? d.innerText.replace(/\\s+/g,' ') : null; })()`);
    const leak = /7,?777|\bPaid\b/i.test(String(modal));
    R.check(!!modal && /QA Album 1[2-5]/.test(modal) && !leak, { page: PG, control: "Piece detail (click a piece)", expected: "Opens that piece's details without any purchase cost", actual: String(modal).slice(0, 200), evidence: await S.jshot("exh-guest-item-modal-1440"), impact: "privacy/data loss", repro: "Click a piece on the wall" });
    const shareRestr = await (async () => { await mclick(S, `[...document.querySelectorAll('[role=dialog] button')].find(b => /Share this item/.test(b.getAttribute('aria-label') || ''))`, { wait: 800 }); return S.evaluate(`[...document.querySelectorAll('[role=dialog]')].map(d => d.innerText.replace(/\\s+/g,' ')).join(' || ').slice(0, 400)`); })();
    R.check(/not public on its own/.test(shareRestr), { page: PG, control: "Piece detail > Share (item that is not public on its own)", expected: "Says the piece has no link of its own and to share the exhibition instead", actual: shareRestr.slice(0, 220), impact: "misleading result", repro: "Open a piece, click Share" });
    await key(S, "Escape", "Escape", 27); await key(S, "Escape", "Escape", 27);
    const closed = !(await S.evaluate(`!!document.querySelector('[role=dialog]')`));
    R.check(closed, { page: PG, control: "Piece detail closes with Escape", expected: "Dialogs close", actual: closed ? "closed" : "still open", impact: "usability", repro: "Open a piece, press Escape (twice if Share is open)" });
    // exhibition Share
    await S.evaluate("window.__aud.clip.length = 0; true");
    await mclick(S, `document.querySelector('[role=toolbar] [aria-label="Share this exhibition"]') || document.querySelector('main [aria-label="Share this exhibition"]')`, { wait: 900 });
    const shTxt = await S.evaluate(`(() => { const d = document.querySelector('[role=dialog]'); return d ? d.innerText.replace(/\\s+/g,' ') : null; })()`);
    const shUrl = await S.evaluate(`(() => { const d = document.querySelector('[role=dialog]'); const i = d && d.querySelector('input'); return i ? i.value : null; })()`);
    await mclick(S, `[...document.querySelectorAll('[role=dialog] button')].find(b => /Copy/i.test(b.textContent))`, { wait: 600 });
    const look = await S.look();
    R.check(!!shUrl && /\/museum\/(share\/[^/]+|[0-9a-f-]{36}\/guest)$/.test(shUrl) && look.clip.includes(shUrl), { page: PG + " | visitor", control: "Guest page 'Share' > Copy link", expected: "The exhibition's own link is shown and the same text is copied", actual: `link ${shUrl}; clipboard ${JSON.stringify(look.clip)}; panel: ${String(shTxt).slice(0, 120)}`, evidence: await S.jshot("exh-guest-share-1440"), impact: "misleading result", repro: "Guest page > Share > Copy" });
    await key(S, "Escape", "Escape", 27);
    // Save as a signed-out visitor: guests may save (stored against a random guest id)
    const favCount = async () => (await admin.from("public_favorites").select("id,user_id,anonymous_id").eq("content_type", "gallery").eq("content_id", D)).data || [];
    const f0 = await favCount();
    const saveBtn = `[...document.querySelectorAll('main button, [role=toolbar] button')].find(b => /^(Save|Save to your saved list)$/.test((b.getAttribute('aria-label') || b.textContent).trim()))`;
    await mclick(S, saveBtn, { wait: 2500 });
    const f1 = await favCount();
    const lab = await S.evaluate(`[...document.querySelectorAll('main button, [role=toolbar] button')].map(b => (b.getAttribute('aria-label') || b.textContent).trim()).filter(t => /Save/i.test(t))`);
    R.check(f1.length === f0.length + 1 && f1.some((r) => r.anonymous_id && !r.user_id), { page: PG + " | signed-out visitor", control: "'Save' as a guest", expected: "A guest save is stored and the button changes to show it is saved", actual: `saves ${f0.length} -> ${f1.length}; button labels now ${JSON.stringify(lab)}`, evidence: await S.jshot("exh-guest-save-signedout-1440"), impact: "misleading result", repro: "Signed out, click Save" });
    // More actions > Report dialog
    await S.visit(`/museum/${D}/guest`); await sleep(6000);
    await mclick(S, byLabel("More actions"), { wait: 600 });
    await mclick(S, byLabelRe("Report this exhibition"), { wait: 900 });
    const rep = await S.evaluate(`(() => { const d = document.querySelector('[role=dialog]'); return d ? d.innerText.replace(/\\s+/g,' ') : null; })()`);
    R.check(!!rep && /report/i.test(rep), { page: PG + " | visitor", control: "More actions > 'Report this exhibition'", expected: "Opens the report form (reason, details, submit)", actual: String(rep).slice(0, 220), evidence: await S.jshot("exh-guest-report-1440"), impact: "usability", repro: "••• > Report this exhibition" });
    await key(S, "Escape", "Escape", 27);
    R.blocked({ page: PG, control: "Report dialog 'Submit'", expected: "Report recorded", actual: "BLOCKED: submitting writes into the real moderation queue that admins read; only opening and closing the form was exercised", impact: "usability" });
    // comments / appreciations: is there anything to try on the guest page itself?
    const cmt = await S.evaluate(`({ inputs: document.querySelectorAll('main textarea, main input[placeholder*="omment" i]').length, words: /comment|appreciat|vibe|like this exhibit/i.test(document.querySelector('main').innerText) })`);
    R.nt({ page: PG + " | visitor", control: "Comments / appreciations on an exhibition", expected: "If present, post/remove works", actual: `NOT TESTED: the exhibition page has no comment box (comment inputs ${cmt.inputs}) and no exhibition-level appreciation control; Vibes exist only on individual public items (item pages, not exercised here)`, impact: "usability" });
    // back link
    await mclick(S, byLabelRe("Back to Discover"), { wait: 3500 });
    R.check((await S.path()) === "/discover", { page: PG, control: "'Back to Discover'", expected: "Opens /discover", actual: await S.path(), impact: "usability", repro: "Click Back to Discover" });
  } finally { await S.close(); }

  // ---- Save as an unrelated signed-in viewer
  S = await session("viewer");
  try {
    await S.visit(`/museum/${D}/guest`); await sleep(7000);
    const favCountV = async () => (await admin.from("public_favorites").select("id,user_id").eq("content_type", "gallery").eq("content_id", D).eq("user_id", m.userId === undefined ? m.k.userId : m.k.userId)).data || [];
    const favs0 = await favCountV();
    await mclick(S, `[...document.querySelectorAll('main button, [role=toolbar] button')].find(b => /^(Save|Save to your saved list)$/.test((b.getAttribute('aria-label') || b.textContent).trim()))`, { wait: 2500 });
    const favs1 = await favCountV();
    R.check(favs1.length === favs0.length + 1, { page: PG + " | unrelated signed-in viewer", control: "'Save' on a public exhibition", expected: "One save is stored against the viewer's account", actual: `saves ${favs0.length} -> ${favs1.length}`, evidence: await S.jshot("exh-guest-save-viewer-1440"), impact: "data loss", repro: "Signed in as another user, click Save" });
    await mclick(S, `[...document.querySelectorAll('main button, [role=toolbar] button')].find(b => /Saved|Remove from saved|Unsave/i.test((b.getAttribute('aria-label') || b.textContent).trim()))`, { wait: 2500 });
    const favs2 = await favCountV();
    R.check(favs2.length === favs0.length, { page: PG + " | unrelated signed-in viewer", control: "'Saved' toggled off", expected: "Save removed again", actual: `saves ${favs1.length} -> ${favs2.length}`, impact: "data loss", repro: "Save, then click again" });
  } finally { await S.close(); }

  // ---- phone (browser-emulated)
  S = await session("visitor", { width: 390, height: 844, mobile: true });
  try {
    await S.visit(`/museum/${D}/guest`); await sleep(7000);
    const ov = await S.evaluate("document.documentElement.scrollWidth > innerWidth + 1");
    R.check(!ov, { page: PG + " | visitor 390 (browser-emulated)", control: "Phone width: sideways scroll", expected: "None", actual: String(ov), evidence: await S.jshot("exh-guest-multi-390"), impact: "cosmetic", repro: "Open the guest page at 390px" });
    await S.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    const box = await S.evaluate(`(() => { const b = document.querySelector('[aria-label="Next exhibit"]').parentElement; b.scrollIntoView({block:'center'}); const r = b.getBoundingClientRect(); return { x: r.x, y: r.y + r.height / 2, w: r.width }; })()`);
    const swipe = async (x0, x1) => { await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y: box.y, id: 1 }] }); for (let k = 1; k <= 8; k++) { await S.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + ((x1 - x0) * k) / 8, y: box.y, id: 1 }] }); await sleep(30); } await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await sleep(700); };
    const s0 = await wallState(S);
    await swipe(box.x + box.w * 0.85, box.x + box.w * 0.15);
    const s1 = await wallState(S);
    await swipe(box.x + box.w * 0.85, box.x + box.w * 0.15);
    const s2 = await wallState(S);
    R.check(s0.one === 2 && s1.two === 2 && s2.one === 2, { page: PG + " | visitor 390 (browser-emulated touch, not a physical phone)", control: "Swipe left across the wall (twice)", expected: "First swipe -> Wall Two; second swipe loops back to Wall One", actual: `${JSON.stringify(s0)} -> ${JSON.stringify(s1)} -> ${JSON.stringify(s2)}`, impact: "blocked workflow", repro: "Swipe left on the wall (emulated touch)" });
    await swipe(box.x + box.w * 0.15, box.x + box.w * 0.85);
    const pathAfter = await S.path();
    if (!pathAfter.includes("/guest")) {
      R.nt({ page: PG + " | visitor 390 (browser-emulated touch)", control: "Swipe right across the wall", expected: "Goes back one exhibit", actual: "INCONCLUSIVE: in the emulated browser the right swipe was taken by Chrome's own back-navigation gesture and the page left to " + pathAfter + "; the page's own handler could not be observed. The 'Previous exhibit' arrow was verified by click instead.", impact: "usability" });
      await S.visit("/museum/" + D + "/guest"); await sleep(5000);
    } else {
      const s3 = await wallState(S);
      R.check(s3.two === 2, { page: PG + " | visitor 390 (browser-emulated touch)", control: "Swipe right across the wall", expected: "Goes back to Wall Two", actual: JSON.stringify(s3), impact: "blocked workflow", repro: "Swipe right on the wall (emulated)" });
    }
    await S.send("Emulation.setTouchEmulationEnabled", { enabled: false });
    // tap target size of the arrows and Share on phone
    const sizes = await S.evaluate(`['Next exhibit','Previous exhibit','Share this exhibition'].map(l => { const e = document.querySelector('[aria-label="' + l + '"]'); if (!e) return [l, null]; const r = e.getBoundingClientRect(); return [l, Math.round(r.width) + 'x' + Math.round(r.height)]; })`);
    console.log("phone sizes", JSON.stringify(sizes));
  } finally { await S.close(); }

  // ---- 18+ gate on the share link
  await admin.from("galleries").update({ visibility: "INVITE", state: "ACTIVE" }).eq("id", B);
  const gB = await gdb(B);
  S = await session("visitor");
  try {
    await S.visit(`/museum/share/${gB.public_token}`); await sleep(6500);
    const t1 = (await S.text()).replace(/\s+/g, " ");
    R.check(/Adult content warning/.test(t1) && !t1.includes(gB.title), { page: "/museum/share/[token] | visitor | 18+ exhibition", control: "18+ gate before entering", expected: "Gate shows; the exhibition title is not shown behind it", actual: t1.slice(t1.indexOf("18+ CONTENT"), t1.indexOf("18+ CONTENT") + 160), evidence: await S.jshot("exh-guest-adult-gate-1440"), impact: "privacy/data loss", repro: "Open an 18+ exhibition's share link" });
    await mclick(S, byLabelRe("I am 18"), { wait: 2000 });
    const t2 = (await S.text()).replace(/\s+/g, " ");
    R.check(t2.includes(gB.title) && !/Adult content warning/.test(t2), { page: "/museum/share/[token] | visitor | 18+ exhibition", control: "'I am 18+ — Continue'", expected: "Shows the exhibition", actual: t2.includes(gB.title) ? "shows" : t2.slice(0, 100), impact: "blocked workflow", repro: "Click the confirm button" });
  } finally { await S.close(); }
  S = await session("visitor");
  try {
    await S.visit(`/museum/share/${gB.public_token}`); await sleep(6000);
    await mclick(S, byLabel("Leave"), { wait: 3000 });
    R.check((await S.path()) === "/", { page: "/museum/share/[token] | visitor | 18+ exhibition", control: "'Leave'", expected: "Goes to the home page without entering", actual: await S.path(), impact: "usability", repro: "Click Leave" });
  } finally { await S.close(); }
  await admin.from("galleries").update({ visibility: "LOCKED" }).eq("id", B);
  await admin.from("public_favorites").delete().eq("content_type", "gallery").eq("content_id", D);
  console.log("DONE guest");
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
