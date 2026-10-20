// The new batch-3 screens on a phone-sized viewport and in the light theme: goals sheet error, goals waiting notice, Undo prompt, import banner, Capture draft banner.
//   AUDIT_MANIFEST=<manifest> node rb7-screens.cjs <label> [widths=390,1440] [themes=deep-vault,pearl-light]
const L = require("./rb6-lib.cjs");
const { r, admin, sleep, man, session, body, click, typeInto, poll, btn, blockTables, save, T, fs, AUD } = L;
const LABEL = process.argv[2] || "run";
const WIDTHS = (process.argv[3] || "390,1440").split(",").map(Number);
const THEMES = (process.argv[4] || "deep-vault,pearl-light").split(",");
const DIR = AUD + "/repair-batch-3/screens"; fs.mkdirSync(DIR, { recursive: true });
const out = { label: LABEL, shots: [] };
const DLG = `document.querySelector('[role=dialog][aria-label="Goal"]')`;

// facts about a visible element: inside the viewport, tap size, text contrast against its nearest solid background (rough)
const FACT = (sel) => `JSON.stringify((() => {
  const el = ${sel}; if (!el) return { found: false };
  const rect = el.getBoundingClientRect(); const rgb = (s) => (s.match(/[\\d.]+/g) || []).map(Number);
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const bgOf = (e) => { for (let x = e; x; x = x.parentElement) { const c = rgb(getComputedStyle(x).backgroundColor); if (c.length >= 3 && (c.length < 4 || c[3] > 0.6)) return c; } return null; };
  const fg = rgb(getComputedStyle(el).color), bg = bgOf(el);
  const ratio = bg ? (Math.max(lum(fg), lum(bg)) + 0.05) / (Math.min(lum(fg), lum(bg)) + 0.05) : null;
  const buttons = [...el.querySelectorAll('button')].map((b) => { const q = b.getBoundingClientRect(); return { t: (b.textContent || '').trim().slice(0, 24), w: Math.round(q.width), h: Math.round(q.height), inView: q.left >= 0 && q.right <= innerWidth && q.top >= 0 && q.bottom <= innerHeight }; });
  return { found: true, inViewportX: rect.left >= -1 && rect.right <= innerWidth + 1, top: Math.round(rect.top), bottom: Math.round(rect.bottom), vh: innerHeight, contrast: ratio ? Number(ratio.toFixed(2)) : null, overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth), buttons };
})())`;

(async () => {
  const m = man(); const P = m.personalId; const st = m.stamp;
  const csvFile = (name, titles) => { fs.writeFileSync(T.tmp(name), "Name,Purchase Price,Notes\n" + titles.map((t, i) => `${t},${5 + i},rb7 note`).join("\n") + "\n"); return T.tmp(name); };
  const created = { goals: [], items: [] };
  for (const width of WIDTHS) {
    const phone = width < 600;
    for (const theme of THEMES) {
      const tag = `${theme}-${width}`;
      const S = await session("owner", { width, height: phone ? 844 : 900, mobile: phone });
      await S.evaluate(`localStorage.setItem('vltd-theme', ${JSON.stringify(theme)}); true`);
      const shotNow = async (name, sel) => {
        await sleep(900);
        const facts = sel ? JSON.parse(await S.evaluate(FACT(sel))) : {};
        const file = `${tag}-${name}`; const shot = await S.send("Page.captureScreenshot", { format: "png" });
        fs.writeFileSync(`${DIR}/${file}.png`, Buffer.from(shot.data, "base64"));
        out.shots.push({ file, tag, name, facts }); return facts;
      };
      // 1) goals sheet: refused target
      await S.visit("/goals"); await S.waitFor(`document.body.innerText.length > 300`, 60000, "goals").catch(() => {}); await sleep(3000);
      await click(S, btn(/\+ Create Goal/)); await S.waitFor(`!!${DLG}`, 8000).catch(() => {}); await sleep(600);
      await typeInto(S, `${DLG}.querySelector('input[type=text]')`, `QA RB7 screen goal ${tag}`); await typeInto(S, `${DLG}.querySelector('input[type=number]')`, "99999999999");
      await click(S, `[...${DLG}.querySelectorAll('button')].find((b) => /^Save Goal/.test(b.textContent.trim()))`); await sleep(1200);
      const f1 = await shotNow("goals-sheet-error", `document.querySelector('[data-testid=goal-error]')`);
      const sheetFacts = JSON.parse(await S.evaluate(FACT(DLG)));
      const f1ok = f1.found && f1.inViewportX && f1.bottom <= f1.vh && sheetFacts.overflowX === 0 && (f1.contrast === null || f1.contrast >= 3);
      r.check(f1ok, { page: "/goals", control: `goals sheet with a refused target, ${tag}`, expected: "Error visible inside the viewport, readable, no sideways overflow, form kept", actual: JSON.stringify({ err: f1, sheetBottomWithinView: sheetFacts.bottom <= sheetFacts.vh }), evidence: `repair-batch-3/screens/${tag}-goals-sheet-error.png`, impact: "D-05 screen" });
      await click(S, `${DLG}.querySelector('button[aria-label="Close"]')`); await sleep(500);
      // 2) goals: waiting notice
      await blockTables(S, ["collection_goals"], true);
      await click(S, btn(/\+ Create Goal/)); await S.waitFor(`!!${DLG}`, 8000).catch(() => {}); await sleep(600);
      const gname = `QA RB7 screen waiting ${tag}`;
      await typeInto(S, `${DLG}.querySelector('input[type=text]')`, gname); await typeInto(S, `${DLG}.querySelector('input[type=number]')`, "7");
      await click(S, `[...${DLG}.querySelectorAll('button')].find((b) => /^Save Goal/.test(b.textContent.trim()))`);
      await S.waitFor(`!!document.querySelector('[data-testid=goals-waiting]')`, 20000, "notice").catch(() => {}); await sleep(800);
      await S.evaluate(`(document.querySelector('[data-testid=goals-waiting]') || document.body).scrollIntoView({ block: 'center' }); true`);
      const f2 = await shotNow("goals-waiting-notice", `document.querySelector('[data-testid=goals-waiting]')`);
      const retry = (f2.buttons || []).find((b) => /Retry/.test(b.t));
      r.check(f2.found && f2.inViewportX && f2.overflowX === 0 && retry && retry.h >= 36 && (f2.contrast === null || f2.contrast >= 3), { page: "/goals", control: `goals 'waiting to upload' notice with Retry now, ${tag}`, expected: "Notice inside the viewport, readable, Retry now tappable (at least 36 px tall)", actual: JSON.stringify(f2), evidence: `repair-batch-3/screens/${tag}-goals-waiting-notice.png`, impact: "D-03 screen" });
      await blockTables(S, ["collection_goals"], false);
      await click(S, btn(/^Retry now$/)); await sleep(5000);
      for (const g of (await admin.from("collection_goals").select("id").eq("profile_id", P).like("name", "QA RB7 screen%")).data || []) await admin.from("collection_goals").delete().eq("id", g.id);
      // 3) import: banner (account unreachable)
      await blockTables(S, ["vault_items"], true);
      await S.visit("/vault/import"); await S.waitFor(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Upload Spreadsheet')`, 60000).catch(() => {});
      await S.waitFor(`!!document.querySelector('[data-testid=account-check-failed]')`, 90000, "banner").catch(() => {}); await sleep(600);
      await S.evaluate(`(document.querySelector('[data-testid=account-check-failed]') || document.body).scrollIntoView({ block: 'center' }); true`);
      const f3 = await shotNow("import-banner", `document.querySelector('[data-testid=account-check-failed]')`);
      r.check(f3.found && f3.inViewportX && f3.overflowX === 0 && (f3.contrast === null || f3.contrast >= 3), { page: "/vault/import", control: `import 'account could not be checked' banner, ${tag}`, expected: "Inside the viewport, readable, no sideways overflow", actual: JSON.stringify(f3), evidence: `repair-batch-3/screens/${tag}-import-banner.png`, impact: "D-07 screen" });
      await blockTables(S, ["vault_items"], false);
      // 4) import: Undo prompt (an edited item)
      const titles = [1, 2].map((i) => `QA RB7 undo ${tag} ${i} ${st}`);
      await S.visit("/vault/import"); await S.waitFor(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Upload Spreadsheet')`, 60000).catch(() => {}); await sleep(3000);
      await T.chooseViaButton(S, T.btnExpr("^Upload Spreadsheet$"), csvFile(`rb7-${tag}.csv`, titles)); await S.waitFor(`/Parsed 2 item/.test(document.body.innerText)`, 25000).catch(() => {}); await sleep(800);
      await click(S, `[...document.querySelectorAll('label')].find((l) => /Import all parsed rows/.test(l.textContent))`); await sleep(300);
      for (let k = 0; k < 2; k++) { await click(S, btn(/Confirm Import/)); await sleep(2200); }
      await poll(async () => (((await admin.from("vault_items").select("id").eq("profile_id", P).like("title", `QA RB7 undo ${tag}%`)).data || []).length >= 2 ? true : null), 90000, 3000); await sleep(3000);
      const rows = (await admin.from("vault_items").select("id,title").eq("profile_id", P).like("title", `QA RB7 undo ${tag}%`)).data || []; rows.forEach((x) => created.items.push(x.id));
      if (rows[0]) await admin.from("vault_items").update({ purchase_price: 777 }).eq("id", rows[0].id);
      await S.visit("/vault"); await S.waitFor(`document.querySelectorAll('a[href^="/vault/item/"]').length > 3`, 90000).catch(() => {}); await sleep(4500);
      await S.visit("/vault/import"); await S.waitFor(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Undo last')`, 60000).catch(() => {}); await sleep(3000);
      await click(S, btn(/^Undo last$/)); await S.waitFor(`!!document.querySelector('[data-testid=undo-prompt]')`, 15000).catch(() => {});
      await S.evaluate(`(document.querySelector('[data-testid=undo-prompt]') || document.body).scrollIntoView({ block: 'center' }); true`);
      const f4 = await shotNow("undo-prompt", `document.querySelector('[data-testid=undo-prompt]')`);
      const small = (f4.buttons || []).filter((b) => b.h < 36).map((b) => b.t);
      r.check(f4.found && f4.inViewportX && f4.overflowX === 0 && (f4.contrast === null || f4.contrast >= 3) && (f4.buttons || []).length >= 2, { page: "/vault/import", control: `Undo prompt naming an edited item, ${tag}`, expected: "Inside the viewport, readable, its buttons reachable, no sideways overflow", actual: JSON.stringify({ ...f4, buttonsUnder36px: small }), evidence: `repair-batch-3/screens/${tag}-undo-prompt.png`, impact: "D-06 screen" });
      // leave nothing behind: cancel, then remove these records
      await click(S, btn(/^Cancel$/)); await sleep(500);
      for (const id of created.items) await admin.from("vault_items").delete().eq("id", id).eq("profile_id", P);
      created.items.length = 0;
      // 5) capture: draft banner
      await S.visit("/capture"); await S.waitFor(`!!document.getElementById('capture-item-name')`, 60000).catch(() => {}); await sleep(3000);
      await typeInto(S, `document.getElementById('capture-item-name')`, `QA RB7 screen draft ${tag}`); await sleep(1800);
      await S.visit("/capture"); await S.waitFor(`!!document.querySelector('[data-testid=capture-draft-notice]')`, 30000).catch(() => {}); await sleep(800);
      const f5 = await shotNow("capture-draft-banner", `document.querySelector('[data-testid=capture-draft-notice]')`);
      const disc = (f5.buttons || []).find((b) => /Discard/.test(b.t));
      r.check(f5.found && f5.inViewportX && f5.overflowX === 0 && disc && disc.h >= 36 && (f5.contrast === null || f5.contrast >= 3), { page: "/capture", control: `Capture 'restored draft' banner with Discard draft, ${tag}`, expected: "Inside the viewport, readable, Discard draft tappable, no sideways overflow", actual: JSON.stringify(f5), evidence: `repair-batch-3/screens/${tag}-capture-draft-banner.png`, impact: "D-09 screen" });
      await click(S, `document.querySelector('[data-testid=capture-draft-discard]')`); await sleep(1000);
      await S.close();
    }
  }
  for (const x of (await admin.from("vault_items").select("id").eq("profile_id", P).like("title", "QA RB7%")).data || []) await admin.from("vault_items").delete().eq("id", x.id);
  save(`rb7-screens-${LABEL}`, out); console.log(JSON.stringify(out.shots.map((s) => ({ f: s.file, found: s.facts.found, overflow: s.facts.overflowX, contrast: s.facts.contrast })), null, 0));
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(2); });
