// Phone coverage beyond the five landing pages, on the live app (vltd.app), as an isolated synthetic collector, in Chrome phone emulation (not a physical phone).
// Pages: every Vault tab (Items, For Sale, Sold, Insights, Goals, Insurance), the exhibition builder (new exhibition, build-from-search, and an open exhibition when the account has one),
// Add Item, Quick Add and both upload paths (single item, batch). Run once with a populated account and once with an empty one (STATE label).
// Per page and width: sideways overflow, controls cut at the right edge, the last content against the bottom bar, every control's real tap area (elementFromPoint, scrolled end to end),
// plus a screenshot of the top and of the end. Then "keyboard and Save access" on Add Item and Bulk upload: the keyboard is EMULATED by shrinking the screen height (a real keyboard can differ).
//   AUDIT_MANIFEST=<qa manifest> TUT_WORK=<dir> STATE=populated|empty node audit-pages.cjs <outDir>
const fs = require("fs"), path = require("path");
const GUIDE = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/walkthrough/add-item-guide/_build";
const { start, T } = require(GUIDE + "/lib.cjs");
const sharp = require("C:/Users/EK/VLTD/node_modules/sharp");
const sleep = T.sleep;
const OUT = process.argv[2], STATE = process.env.STATE || "populated";
const WIDTHS = (process.env.WIDTHS || "390,320").split(",").map(Number);
const ASSETS = "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/tut/assets";
const PAGES = [
  ["vault-items", "/vault"], ["vault-for-sale", "/vault/for-sale"], ["vault-sold", "/vault/sold"], ["vault-insights", "/portfolio"], ["vault-goals", "/goals"], ["vault-insurance", "/insurance"],
  ["exhibition-new", "/museum/new"], ["exhibition-from-search", "/vault/halls"],
  ["add-item", "/capture"], ["quick-add", "/vault/quick"], ["upload-single", "/capture?openUpload=1"], ["upload-bulk", "/vault/bulk"],
];

const measure = `(() => {
  const vw = innerWidth, vh = innerHeight;
  const bar = document.querySelector('nav[aria-label="Main navigation"]');
  const barBox = bar && bar.firstElementChild; const barTop = barBox ? barBox.getBoundingClientRect().top : vh;
  const header = document.querySelector('header'); const headTop = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
  const sc = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 20 && /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.clientHeight > 300).sort((a, b) => b.clientHeight - a.clientHeight)[0] || document.scrollingElement;
  const rows = [];
  for (const e of document.querySelectorAll('button, a[href], select, input:not([type=hidden]), textarea, [role=button], [role=menuitem], [role=tab], summary, label')) {
    const cs = getComputedStyle(e), r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || cs.visibility === 'hidden' || cs.display === 'none' || (barBox && barBox.contains(e))) continue;
    if (e.tagName === "LABEL") continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 1 || cy < 1 || cx > vw - 1 || cy > vh - 1) continue;
    if (cy + 24 > barTop || cy - 24 < headTop) continue; // too close to the fixed bar or header to measure (covered by them, not by a neighbour)
    const hit = (x, y) => { const t = document.elementFromPoint(x, y); return !!t && (t === e || e.contains(t)); };
    if (!hit(cx, cy)) continue;
    let up = 0, down = 0, left = 0, right = 0; const M = 24;
    while (up < M && hit(cx, cy - up - 1)) up++; while (down < M && hit(cx, cy + down + 1)) down++;
    if (r.width < 60) { while (left < M && hit(cx - left - 1, cy)) left++; while (right < M && hit(cx + right + 1, cy)) right++; } else { left = right = Math.round(r.width / 2); }
    const label = ((e.innerText || e.getAttribute('aria-label') || e.getAttribute('placeholder') || e.getAttribute('title') || e.tagName) + '').trim().replace(/\\s+/g, ' ').slice(0, 34);
    rows.push({ label, tag: e.tagName, type: e.type || '', visual: [Math.round(r.width), Math.round(r.height)], hit: [left + right + 1, up + down + 1], cutRight: r.right > vw + 1 || r.left < -1, absTop: Math.round(r.top + (sc ? sc.scrollTop : 0)), x: Math.round(r.left) });
  }
  return { rows, vw, barTop: Math.round(barTop), docOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - vw, scrollTop: sc ? sc.scrollTop : 0, max: sc ? sc.scrollHeight - sc.clientHeight : 0, ch: sc ? sc.clientHeight : vh };
})()`;
const scrollTo = (y) => `(() => { const sc = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 20 && /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.clientHeight > 300).sort((a, b) => b.clientHeight - a.clientHeight)[0] || document.scrollingElement; sc.scrollTop = ${y}; return sc.scrollTop; })()`;
const lastClear = `(() => { const bar = document.querySelector('nav[aria-label="Main navigation"]'); const top = bar ? bar.firstElementChild.getBoundingClientRect().top : innerHeight; let low = 0; for (const e of document.querySelectorAll('main *, [class*=page] *')) { if (bar && bar.contains(e)) continue; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); if (r.width < 4 || r.height < 4 || cs.position === 'fixed' || cs.visibility === 'hidden') continue; if (r.top < innerHeight && r.bottom > low && r.bottom <= innerHeight + 2) low = r.bottom; } return { lowestContentBottom: Math.round(low), barTop: Math.round(top), clear: low <= top + 1 }; })()`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const R = await start({ scene: "audit-pages-" + STATE, phone: true, camera: true });
  const { S } = R; const report = [];
  const shot = async (name) => { const png = await S.send("Page.captureScreenshot", { format: "png" }); const f = path.join(OUT, `${STATE}-${name}.jpg`); await sharp(Buffer.from(png.data, "base64")).jpeg({ quality: 80 }).toFile(f); return path.basename(f); };
  const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
  const pages = PAGES.filter((p) => !ONLY || ONLY.includes(p[0]));
  try {
    // The exhibition builder itself: an existing exhibition (populated account) or a new, empty one created through the form (empty account).
    let builderPath = null;
    if (STATE === "populated") {
      const g = await T.admin.from("galleries").select("id").eq("profile_id", R.m.personalId).limit(1);
      if (g.data && g.data[0]) builderPath = "/museum/" + g.data[0].id;
    } else {
      await R.goto("/museum/new"); await sleep(2500);
      await T.typeInto(S, `document.querySelector("input[placeholder='e.g. Hall of Grails']")`, "Phone check exhibit"); await sleep(500);
      await R.clickExpr(`[...document.querySelectorAll('button')].filter((b) => /^Create Exhibition$/.test(b.innerText.trim())).pop()`, 6000);
      const p = await S.path(); if (/^\/museum\/[^/]+$/.test(p) && p !== "/museum/new") builderPath = p;
      console.log("created empty exhibition ->", p);
    }
    if (builderPath) pages.push(["exhibition-builder", builderPath]); else console.log("NO exhibition builder path found for", STATE);
    for (const w of WIDTHS) {
      await S.send("Emulation.setDeviceMetricsOverride", { width: w, height: Math.round(w * 2.165), deviceScaleFactor: 2, mobile: true });
      const list = [...pages];
      for (const [name, url] of list) {
        await R.goto(url); await sleep(2000);
        const seen = new Map(); let y = 0, guard = 0, docOverflow = 0, barTop = 0;
        await S.evaluate(scrollTo(0)); await sleep(300);
        const top = await shot(`${name}-top-${w}`);
        for (;;) {
          await S.evaluate(scrollTo(y)); await sleep(250);
          const m = await S.evaluate(measure); docOverflow = Math.max(docOverflow, m.docOverflow); barTop = m.barTop;
          for (const c of m.rows) { const k = [c.label, c.tag, c.absTop, c.x].join("|"); if (!seen.has(k)) seen.set(k, c); }
          if (y >= m.max || ++guard > 30) break;
          y = Math.min(m.max, y + Math.round(m.ch * 0.75));
        }
        await S.evaluate(scrollTo(1e6)); await sleep(500);
        const clear = await S.evaluate(lastClear); const end = await shot(`${name}-end-${w}`);
        const path_ = await S.path(); const rows = [...seen.values()];
        const small = rows.filter((c) => c.tag !== "INPUT" && c.tag !== "TEXTAREA" && (c.hit[1] < 43 || c.hit[0] < 43) && !/^(Search|Messages|Alerts|VLTD Home)/.test(c.label));
        const cut = rows.filter((c) => c.cutRight).map((c) => c.label);
        report.push({ state: STATE, w, page: name, path: path_, top, end, docOverflow, barTop, clear, controls: rows.length, small: small.map((c) => `${c.label} ${c.hit[0]}x${c.hit[1]}`), cut, inputs: rows.filter((c) => c.tag === "INPUT" || c.tag === "TEXTAREA").map((c) => `${c.label} ${c.visual[0]}x${c.visual[1]}`) });
        console.log(`${STATE} ${w} ${name.padEnd(22)} path=${path_} overflow=${docOverflow} controls=${rows.length} cut=${cut.length} under44=${small.length} endClear=${clear.clear}${small.length ? " :: " + small.slice(0, 6).map((c) => `${c.label} ${c.hit[0]}x${c.hit[1]}`).join("; ") : ""}`);
      }
    }
    // keyboard and Save access (emulated keyboard: the screen is shortened by 336 px)
    const kb = [];
    for (const w of [390, 320]) {
      const H = Math.round(w * 2.165), KH = 336;
      await S.send("Emulation.setDeviceMetricsOverride", { width: w, height: H, deviceScaleFactor: 2, mobile: true });
      await R.goto("/capture"); await sleep(2500);
      const focus = await S.evaluate(`(() => { const i = document.querySelector("input[placeholder='Item name']"); if (!i) return null; i.focus(); i.scrollIntoView({ block: 'center' }); return true; })()`);
      await S.send("Emulation.setDeviceMetricsOverride", { width: w, height: H - KH, deviceScaleFactor: 2, mobile: true }); await sleep(600);
      await T.typeInto(S, `document.querySelector("input[placeholder='Item name']")`, "Keyboard test item").catch(() => {});
      const field = await S.evaluate(`(() => { const i = document.querySelector("input[placeholder='Item name']"); if (!i) return null; i.scrollIntoView({ block: 'center' }); const r = i.getBoundingClientRect(); const bar = document.querySelector('nav[aria-label="Main navigation"]'); const bt = bar ? bar.firstElementChild.getBoundingClientRect().top : innerHeight; const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { top: Math.round(r.top), bottom: Math.round(r.bottom), barTop: Math.round(bt), visible: r.top >= 0 && r.bottom <= bt, reachable: !!t && (t === i || i.contains(t)), vh: innerHeight }; })()`);
      const save = await S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /^Save to Vault$/.test(x.innerText.trim())); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); const bar = document.querySelector('nav[aria-label="Main navigation"]'); const bt = bar ? bar.firstElementChild.getBoundingClientRect().top : innerHeight; const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { top: Math.round(r.top), bottom: Math.round(r.bottom), barTop: Math.round(bt), height: Math.round(r.height), reachable: !!t && (t === b || b.contains(t)), clearOfBar: r.bottom <= bt, vh: innerHeight }; })()`);
      const img = await shot(`keyboard-add-item-${w}`);
      kb.push({ page: "add-item", w, keyboardHeight: KH, field, saveButton: save, img });
      console.log(`${STATE} keyboard add-item ${w}: field=${JSON.stringify(field)} save=${JSON.stringify(save)}`);
      // bulk upload: pick two pictures, then find the main action
      await S.send("Emulation.setDeviceMetricsOverride", { width: w, height: H - KH, deviceScaleFactor: 2, mobile: true });
      await R.goto("/vault/bulk"); await sleep(2500);
      try {
        await S.send("DOM.enable", {}); const doc = await S.send("DOM.getDocument", {}); const q = await S.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "input[type=file]" });
        if (q.nodeId) { await S.send("DOM.setFileInputFiles", { nodeId: q.nodeId, files: [ASSETS + "/toy-figure.jpg", ASSETS + "/sports-card.jpg"] }); await sleep(2500); }
      } catch (e) { console.log("bulk file pick failed:", e.message); }
      const bulk = await S.evaluate(`(() => { const bar = document.querySelector('nav[aria-label="Main navigation"]'); const bt = bar ? bar.firstElementChild.getBoundingClientRect().top : innerHeight; const b = [...document.querySelectorAll('button')].filter((x) => /add (all|\\d+)|fill in|save|upload|create|add items?/i.test(x.innerText.trim()) && x.getBoundingClientRect().width > 0).map((x) => { x.scrollIntoView({ block: 'center' }); const r = x.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { label: x.innerText.trim().slice(0, 28), reachable: !!t && (t === x || x.contains(t)), clearOfBar: r.bottom <= bt, h: Math.round(r.height) }; }); return b.slice(0, 6); })()`);
      const img2 = await shot(`keyboard-bulk-${w}`);
      kb.push({ page: "upload-bulk", w, keyboardHeight: KH, buttons: bulk, img: img2 });
      console.log(`${STATE} keyboard bulk ${w}: ${JSON.stringify(bulk)}`);
      // new exhibition form: title field focused with the keyboard up, then the Create Exhibition button
      await R.goto("/museum/new"); await sleep(2200);
      await S.evaluate(`(() => { const i = document.querySelector("input[placeholder='e.g. Hall of Grails']"); if (i) { i.focus(); i.scrollIntoView({ block: 'center' }); } return !!i; })()`);
      const ex = await S.evaluate(`(() => { const bar = document.querySelector('nav[aria-label="Main navigation"]'); const bt = bar ? bar.firstElementChild.getBoundingClientRect().top : innerHeight; const i = document.querySelector("input[placeholder='e.g. Hall of Grails']"); const ir = i ? i.getBoundingClientRect() : null; const b = [...document.querySelectorAll('button')].filter((x) => /^(Create Exhibition|Checking your exhibitions…)$/.test(x.innerText.trim())).pop(); if (!b) return { titleField: ir ? { top: Math.round(ir.top), bottom: Math.round(ir.bottom), visible: ir.top >= 0 && ir.bottom <= bt } : null, button: null }; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { titleField: ir ? { top: Math.round(ir.top), visible: ir.top >= 0 } : null, button: { label: b.innerText.trim(), h: Math.round(r.height), reachable: !!t && (t === b || b.contains(t)), clearOfBar: r.bottom <= bt, disabled: b.disabled } }; })()`);
      const img3 = await shot(`keyboard-exhibition-new-${w}`);
      kb.push({ page: "exhibition-new", w, keyboardHeight: KH, ...ex, img: img3 });
      console.log(`${STATE} keyboard exhibition-new ${w}: ${JSON.stringify(ex)}`);
    }
    fs.writeFileSync(path.join(OUT, `${STATE}-keyboard.json`), JSON.stringify(kb, null, 1));
  } catch (e) { console.log("SCRIPT ERROR:", e.message); }
  fs.writeFileSync(path.join(OUT, `${STATE}-report.json`), JSON.stringify(report, null, 1));
  await R.close();
  process.exit(0);
})();
