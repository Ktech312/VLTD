// Journey part 2 (LIVE): create exhibition -> add items -> arrange -> share -> open as a visitor (clean browser, no session).
//   node journey-2.cjs [--base=https://vltd.app]
const { browser, admin, sleep, man } = require("./journey-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=https://vltd.app").slice(7);
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 600)); };
const info = (n, d) => console.log("INFO", n, JSON.stringify(d ?? "").slice(0, 500));
const TITLE = "QA Journey Exhibition";
const ids = async (m) => Object.fromEntries(((await admin.from("vault_items").select("id,title").eq("profile_id", m.personalId).like("title", "QA Journey %")).data || []).map((r) => [r.title, r.id]));
const layoutOrder = async (gid) => { const g = (await admin.from("galleries").select("layout,exhibition_layout,visibility,state,public_token,title,cover_image").eq("id", gid).maybeSingle()).data; const sec = g?.layout?.sections?.[0]; return { g, order: (sec?.slotLayout || sec?.itemIds || g?.layout?.itemIds || []).filter(Boolean) }; };

(async () => {
  const m = man(); const I = await ids(m);
  // start from a clean exhibition list for this synthetic profile only
  for (const g of (await admin.from("galleries").select("id").eq("profile_id", m.personalId)).data || []) { await admin.from("gallery_items").delete().eq("gallery_id", g.id); await admin.from("galleries").delete().eq("id", g.id); }
  const S = await browser(BASE);
  let gid = null;
  try {
    // 5. CREATE
    await S.go("/museum/new"); await S.waitFor("document.querySelector('input[placeholder*=\"Hall of Grails\"]')", 90000); await sleep(1500);
    await S.setVal('input[placeholder*="Hall of Grails"]', TITLE); await sleep(400);
    await S.clickText("Create Exhibition");
    await S.waitFor("/^\\/museum\\/[0-9a-f-]{36}/.test(location.pathname)", 60000, "lands on the new exhibition");
    gid = (await S.path()).split("/")[2];
    await sleep(4000);
    let row = (await admin.from("galleries").select("title,visibility,state,profile_id").eq("id", gid).maybeSingle()).data;
    check("[5 create] the exhibition exists in the database under the Personal profile, titled as typed, Private (locked) by default", row?.title === TITLE && row?.profile_id === m.personalId && row?.visibility === "LOCKED", row);

    // 6. ADD ITEMS through the picker
    await S.waitFor("document.body.innerText.includes('Edit/Add')", 90000);
    await S.clickText("Edit/Add"); await sleep(2000);
    await S.waitFor("document.querySelector('[role=dialog] [aria-label=\"QA Journey Slab\"]')", 30000, "picker tiles");
    for (const t of ["QA Journey Slab", "QA Journey Vinyl", "QA Journey Poster"]) { await S.clickSel(`[role=dialog] [aria-label="${t}"]`); await sleep(500); }
    const pickerBtn = await S.evaluate("[...document.querySelectorAll('[role=dialog] button')].map((b) => b.textContent.trim().replace(/\\s+/g,' ')).filter((x) => /^Add to Exhibit/i.test(x))");
    info("picker add button", pickerBtn);
    await S.clickText("Add to Exhibit \\(3\\)"); await sleep(4000);
    await S.waitFor("!document.querySelector('[role=dialog]')", 20000, "picker closed");
    await sleep(5000);
    let lo = await layoutOrder(gid);
    check("[6 add] the three chosen items are saved in the exhibition", lo.order.length === 3 && [I["QA Journey Slab"], I["QA Journey Vinyl"], I["QA Journey Poster"]].every((x) => lo.order.includes(x)), lo.order);
    const tx = await S.text();
    check("[6 add] the editor shows 3 items and a curated cost that counts only recorded costs (125 + 30 = $155; the blank cost is not added as 0)", /3\s*ITEMS/i.test(tx) && /CURATED COST\s*\n?\s*\$155\b/i.test(tx), tx.match(/CURATED COST[\s\S]{0,30}/i)?.[0]);

    // 7. ARRANGE: Organize, drag the first slot onto the third (real mouse drag via the browser's input channel)
    const before = lo.order.slice();
    await S.clickText("Organize"); await sleep(1500);
    const notice = await S.evaluate("document.body.innerText.includes('Organize needs an exhibit page')");
    check("[7 arrange] Organize on an exhibition with no exhibit page yet explains why and offers 'Create first exhibit' (never silent)", notice === true);
    await S.clickText("Create first exhibit"); await sleep(5000);
    check("[7 arrange] after 'Create first exhibit' Organize is on (the button now reads Done) and the items are on Exhibit 1", await S.evaluate("[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Done')"));
    lo = await layoutOrder(gid); before.splice(0, before.length, ...lo.order);
    const geo = await S.evaluate("(() => { const s = [...document.querySelectorAll('[data-slot-idx]')]; const r = (i) => { const b = s[i]?.getBoundingClientRect(); return b ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null; }; s[0]?.scrollIntoView({ block: 'center' }); return { n: s.length, a: r(0), c: r(2), draggable: s.slice(0, 3).map((e) => e.getAttribute('draggable')) }; })()");
    info("slot geometry", geo);
    const g2 = await S.evaluate("(() => { const s = [...document.querySelectorAll('[data-slot-idx]')]; const r = (i) => { const b = s[i].getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }; return { a: r(0), c: r(2) }; })()");
    await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: g2.a.x, y: g2.a.y });
    await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x: g2.a.x, y: g2.a.y, button: "left", buttons: 1, clickCount: 1 });
    for (let k = 1; k <= 12; k++) { await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: g2.a.x + (g2.c.x - g2.a.x) * k / 12, y: g2.a.y + (g2.c.y - g2.a.y) * k / 12, button: "left", buttons: 1 }); await sleep(60); }
    await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: g2.c.x, y: g2.c.y, button: "left", buttons: 0, clickCount: 1 });
    await sleep(4000);
    lo = await layoutOrder(gid);
    let swapped = lo.order.length === 3 && lo.order[0] === before[2] && lo.order[2] === before[0];
    info("order before/after real drag", { before: before.map((x) => x.slice(-6)), after: lo.order.map((x) => x.slice(-6)) });
    let how = "real mouse drag";
    if (!swapped) {
      // fall back: the same drop, sent as drag events to the same handlers (labelled as such)
      await S.evaluate("(() => { const s = [...document.querySelectorAll('[data-slot-idx]')]; const dt = new DataTransfer(); const f = (t, el) => el.dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt })); f('dragstart', s[0]); f('dragover', s[2]); f('drop', s[2]); f('dragend', s[0]); return true; })()");
      await sleep(4000); lo = await layoutOrder(gid); swapped = lo.order.length === 3 && lo.order[0] === before[2] && lo.order[2] === before[0]; how = "synthetic drag events (real mouse drag did not register in headless)";
    }
    check(`[7 arrange] dragging the first item onto the third swaps them and the new order is saved (${how})`, swapped, { before, after: lo.order });
    const arranged = lo.order.slice();
    await S.go("/museum/" + gid); await S.waitFor("document.body.innerText.includes('Edit/Add')", 90000); await sleep(5000);
    lo = await layoutOrder(gid);
    check("[7 arrange] after reloading the page the arranged order is unchanged", JSON.stringify(lo.order) === JSON.stringify(arranged), lo.order);

    // 8. SHARE: Guest View = anyone with the link; Share shows the link
    await S.clickText("Guest View"); await sleep(4000);
    lo = await layoutOrder(gid);
    check("[8 share] choosing Guest View makes it a link-only (Invite) exhibition, still active", lo.g.visibility === "INVITE" && lo.g.state === "ACTIVE", lo.g);
    await S.clickText("Share"); await sleep(2500);
    const dlg = await S.evaluate("[...document.querySelectorAll('[role=dialog]')].map((d) => d.innerText).join(' || ').slice(0, 800)");
    info("share dialog", dlg);
    const url = `${BASE}/museum/share/${lo.g.public_token}`;
    check("[8 share] the exhibition has a share token (the link is /museum/share/<token>)", !!lo.g.public_token, lo.g);

    // 9. VISITOR: a clean browser with no session opens the link
    const V = await browser(BASE, { withSession: false });
    try {
      await V.go(url.replace(BASE, "")); await V.waitFor(`document.body.innerText.includes(${JSON.stringify(TITLE)})`, 90000, "visitor sees the exhibition title"); await sleep(6000);
      const vt = await V.text();
      info("visitor path", await V.path());
      check("[9 visitor] a signed-out visitor sees the exhibition title through the link", vt.includes(TITLE), vt.slice(0, 200));
      check("[9 visitor] the visitor sees the public items (Slab, Vinyl)", /QA Journey Slab/.test(vt) && /QA Journey Vinyl/.test(vt), vt.slice(0, 400));
      // By the locked design (hidden-items rule) an item the owner placed in an exhibition shows to visitors unless the owner explicitly hides it;
      // whether a private (red) item should hide directly is an open question for EK. Recorded, not asserted.
      info("[9 visitor] the placed-but-private Poster is shown to the visitor (by design; open question for EK)", /QA Journey Poster/.test(vt));
      check("[9 visitor] the visitor page carries no price or value for any item", !/\$\s?\d/.test(vt), vt.match(/\$\s?\d+/));
      check("[9 visitor] none of the owner's private details leak (cost 125, source, location, storage shelf)", !/\$125|QA Show|QA City|QA Shelf/.test(vt), vt.match(/\$125|QA Show|QA City|QA Shelf/));
      await V.shot("jr-visitor.png");
    } finally { await V.close(); }
    // the visitor's request carried no account session
    // a bad token gives the not-found state, not someone else's exhibition
    const W = await browser(BASE, { withSession: false });
    try { await W.go("/museum/share/not-a-real-token-" + Date.now()); await sleep(9000); const wt = await W.text(); check("[9 visitor] a wrong link shows a not-available page, not an exhibition", !wt.includes(TITLE), wt.slice(0, 200)); } finally { await W.close(); }
    console.log("GALLERY_ID", gid);
  } catch (e) { console.log("STOPPED", e.message); try { await S.shot("jr2-stop.png"); await S.c.captureDiag(String(e.message), "journey2-diag"); } catch { /* ignore */ } fail++; }
  finally { await S.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
