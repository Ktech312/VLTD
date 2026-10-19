// Smoke-probe: really clicks (mouse events at the control's position) every safe control on each page and records what happens.
// It shows whether a control RESPONDS (navigates / opens something / changes the page / calls the network / print-share-download stubs).
// It does not judge whether the outcome is the right one: that is what the behaviour suites are for. Destructive/paid/outbound controls are skipped here.
//   node audit-probe.cjs <state> <width> [--only=/a,/b] [--max=60]
const { session, controls, AUD, sleep, fs, man } = require("./audit-lib.cjs");
const STATE = process.argv[2] || "owner"; const WIDTH = Number(process.argv[3] || 1440);
const only = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean);
const MAX = Number((process.argv.find((a) => a.startsWith("--max=")) || "--max=70").slice(6));
const mobile = WIDTH < 700;
const crawl = fs.readFileSync(`${AUD}/crawl-${STATE}-${WIDTH}.jsonl`, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const OUTF = `${AUD}/probe-${STATE}-${WIDTH}.jsonl`;
const donePages = new Set(fs.existsSync(OUTF) ? fs.readFileSync(OUTF, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).page) : []);
// skipped here, on purpose: would delete, publish, send, spend, sign out, or change credentials/billing
const DANGER = /delete|remove|sign out|log ?out|publish|\bpost\b|\bsend\b|\bbuy\b|purchase|checkout|upgrade|subscribe|submit|report|invite|reset|erase|clear (all|vault|data)|discard|leave|cancel (plan|subscription)|disconnect|unlist|archive|mark (as )?sold|list (on|for)|import|scan|analy[sz]e|generate|\bai\b|save|create|add (item|goal)|confirm|apply|bulk|upload|replace|restore|unlock|lock|transfer|merge|rename|set as|make (public|private)|change (email|password)|resend|delete account/i;
const dedupe = new Set();

async function clickAt(S, id) {
  const pos = await S.evaluate(`(() => { const el = document.querySelector('[data-aud="${id}"]'); if (!el) return null; el.scrollIntoView({ block: 'center', inline: 'center' }); const r = el.getBoundingClientRect(); if (r.width < 1) return null; const x = Math.round(r.x + r.width / 2), y = Math.round(r.y + r.height / 2); const top = document.elementFromPoint(x, y); return { x, y, covered: !!top && top !== el && !el.contains(top) && !top.contains(el) ? (top.tagName + '.' + String(top.className).slice(0, 40)) : '' }; })()`);
  if (!pos) return null;
  await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: pos.x, y: pos.y, button: "none" });
  await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x: pos.x, y: pos.y, button: "left", clickCount: 1, buttons: 1 });
  await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: pos.x, y: pos.y, button: "left", clickCount: 1, buttons: 0 });
  return pos;
}
const SNAP = `(() => ({ path: location.pathname + location.search, hash: location.hash, dlg: document.querySelectorAll('dialog[open],[role=dialog],[aria-modal=true],[role=menu],[role=listbox],[data-state=open]').length, len: document.body.innerText.length, sig: document.body.innerText.slice(0, 4000).split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7), exp: [...document.querySelectorAll('[aria-expanded],[aria-pressed],[aria-selected],[aria-current],[aria-checked]')].map((e) => e.getAttribute('aria-expanded') || e.getAttribute('aria-pressed') || e.getAttribute('aria-selected') || e.getAttribute('aria-current') || e.getAttribute('aria-checked')).join(''), cls: document.body.className + '|' + document.documentElement.className + '|' + (document.documentElement.getAttribute('data-theme') || ''), aud: window.__aud ? JSON.stringify([window.__aud.print, window.__aud.opens.length, window.__aud.share, window.__aud.clip.length, window.__aud.downloads.length, window.__aud.blobs.length]) : '', scrollY: Math.round(scrollY), focus: document.activeElement ? document.activeElement.tagName + (document.activeElement.getAttribute('data-aud') || '') : '' }))()`;

(async () => {
  let S = await session(STATE, { width: WIDTH, height: mobile ? 800 : 900, mobile });
  try {
    for (const pg of crawl) {
     try {
      if (pg.error || !pg.controls || pg.redirected && /^\/(login|onboarding)/.test(pg.finalPath) && STATE !== "visitor" && false) continue;
      if (only.length && !only.includes(pg.requested)) continue;
      if (donePages.has(pg.requested)) continue;
      const res = { page: pg.requested, state: STATE, width: WIDTH, finalPath: pg.finalPath, probes: [], skipped: [] };
      await S.visit(pg.requested);
      // dedupe shell controls already probed on an earlier page (same kind, label and target)
      let cs = await controls(S);
      let n = 0;
      for (const c of cs) {
        if (!c.visible) { continue; }
        if (c.kind === "link") { res.probes.push({ id: c.id, kind: "link", label: c.label, href: c.href, target: c.target }); continue; }   // links are checked for where they lead, not clicked
        if (["input", "search", "upload", "select", "focusable"].includes(c.kind) && c.kind !== "select") { res.probes.push({ kind: c.kind, label: c.label, type: c.type, note: "form field: exercised in the behaviour suites" }); continue; }
        const key = [STATE, WIDTH, c.kind, c.label, c.region, c.tag].join("|");
        if (["nav", "header", "footer", "menu"].includes(c.region) && dedupe.has(key)) { res.skipped.push({ label: c.label, why: "shell control already probed on an earlier page" }); continue; }
        if (c.disabled) { res.probes.push({ kind: c.kind, label: c.label, disabled: true, effect: "disabled (state explanation not checked here)" }); continue; }
        if (DANGER.test(c.label)) { res.skipped.push({ label: c.label, why: "destructive / paid / outbound / form-submitting: covered only by a targeted test on QA records, or NOT TESTED" }); continue; }
        if (n >= MAX) { res.skipped.push({ label: c.label, why: "per-page probe cap" }); continue; }
        n++; dedupe.add(key);
        const before = await S.evaluate(SNAP); const reqBefore = S.reqs.length; const intBefore = S.intercepted.length; S.dialogs.length = 0;
        let mut = 0;
        await S.evaluate(`(() => { window.__mut = 0; if (window.__mo) window.__mo.disconnect(); window.__mo = new MutationObserver((l) => { window.__mut += l.length; }); window.__mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }); return true; })()`).catch(() => {});
        let pos = null;
        try { pos = await clickAt(S, c.id); } catch (e) { res.probes.push({ kind: c.kind, label: c.label, error: String(e.message).slice(0, 80) }); continue; }
        if (!pos) { res.probes.push({ kind: c.kind, label: c.label, effect: "could not be clicked (not in layout)" }); continue; }
        await sleep(c.kind === "card-clickable" ? 1100 : 800);
        let after = null; try { after = await S.evaluate(SNAP); mut = await S.evaluate("window.__mut || 0"); } catch { after = null; }
        const effects = [];
        if (!after) effects.push("page navigated/reloaded");
        else {
          if (after.path !== before.path) effects.push("navigated to " + after.path);
          if (after.hash !== before.hash) effects.push("hash " + after.hash);
          if (after.dlg !== before.dlg) effects.push(after.dlg > before.dlg ? "opened a dialog/menu" : "closed a dialog/menu");
          if (after.exp !== before.exp) effects.push("state attribute changed");
          if (after.sig !== before.sig || after.len !== before.len) effects.push("page text changed");
          if (after.cls !== before.cls) effects.push("theme/body class changed");
          if (after.aud !== before.aud) effects.push("print/share/copy/download/open stub called");
          if (mut > 0 && !effects.length) effects.push("DOM changed (" + mut + " mutations)");
        }
        if (S.reqs.length > reqBefore) { const newR = S.reqs.slice(reqBefore).filter((r) => !/\.(png|jpe?g|webp|svg|css|woff2?)(\?|$)/.test(r.url)); if (newR.length) effects.push(newR.length + " request(s): " + [...new Set(newR.map((r) => r.method + " " + r.url.split("?")[0].slice(0, 50)))].slice(0, 3).join(", ")); }
        if (S.intercepted.length > intBefore) effects.push("INTERCEPTED by audit: " + S.intercepted.slice(intBefore).map((x) => x.method + " " + x.url).slice(0, 2).join(", "));
        if (S.dialogs.length) effects.push("browser dialog: " + S.dialogs[0].type + ' "' + S.dialogs[0].message.slice(0, 50) + '"');
        res.probes.push({ kind: c.kind, label: c.label, region: c.region, effect: effects.length ? effects.join("; ") : "NO VISIBLE EFFECT", covered: pos.covered || undefined });
        // restore: leave pages we navigated to, close what we opened
        if (!after || after.path !== before.path) { await S.visit(pg.requested); cs = await controls(S); }
        else if (after.dlg > before.dlg) { await S.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await sleep(300); const d2 = await S.evaluate(SNAP).catch(() => null); if (!d2 || d2.dlg > before.dlg) { await S.visit(pg.requested); cs = await controls(S); } }
      }
      fs.appendFileSync(OUTF, JSON.stringify(res) + "\n");
      console.log(STATE, WIDTH, pg.requested, "probed", res.probes.filter((p) => p.effect).length, "no-effect", res.probes.filter((p) => p.effect === "NO VISIBLE EFFECT").length, "skipped", res.skipped.length);
     } catch (e) { console.log("PAGE ERR", pg.requested, String(e.message).slice(0, 80)); fs.appendFileSync(OUTF, JSON.stringify({ page: pg.requested, state: STATE, width: WIDTH, error: String(e.message).slice(0, 120), probes: [], skipped: [] }) + "\n"); try { await S.close(); } catch {} await sleep(3000); S = await session(STATE, { width: WIDTH, height: mobile ? 800 : 900, mobile }); }
    }
  } finally { await S.close(); }
  console.log("probe finished", STATE, WIDTH); process.exit(0);
})().catch((e) => { console.error("PROBE ERR", e.message); process.exit(1); });
