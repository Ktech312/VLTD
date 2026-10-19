// Second look at the generic probe's NO VISIBLE EFFECT candidates (owner, desktop): load the page, click the control with the mouse, wait longer,
// and compare screenshots as well as DOM/text/URL. Writes docs/audit-2026-10-18/noeffect-verified.json (kept next to the first-run probe data).
const { session, controls, AUD, sleep, fs } = require("./audit-lib.cjs");
const probe = fs.readFileSync(AUD + "/probe-owner-1440.jsonl", "utf8").split("\n").filter(Boolean).map(JSON.parse);
const SKIP_LABEL = /^(Dismiss|Install)$/;
const cand = [];
for (const pg of probe) for (const p of pg.probes || []) if (p.effect === "NO VISIBLE EFFECT" && p.kind !== "select" && !SKIP_LABEL.test(p.label)) cand.push({ page: pg.page, kind: p.kind, label: p.label });
console.log("candidates", cand.length);
(async () => {
  const S = await session("owner", { width: 1440, height: 900 });
  const out = [];
  let lastPage = "";
  for (const c of cand) {
    try {
      if (c.page !== lastPage) { await S.visit(c.page); lastPage = c.page; await sleep(1500); } else { await S.visit(c.page); await sleep(1200); }
      const cs = await controls(S);
      const el = cs.find((x) => x.label === c.label && x.kind === c.kind && x.visible);
      if (!el) { out.push({ ...c, result: "control not found on reload" }); continue; }
      const pos = await S.evaluate(`(() => { const e = document.querySelector('[data-aud="${el.id}"]'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); const x = Math.round(r.x + r.width / 2), y = Math.round(r.y + r.height / 2); const t = document.elementFromPoint(x, y); return { x, y, topTag: t ? t.tagName + '.' + String(t.className).slice(0, 30) : '', same: t === e || e.contains(t) || (t && t.contains(e)), disabled: !!e.disabled }; })()`);
      await sleep(400);
      const a = (await S.send("Page.captureScreenshot", { format: "jpeg", quality: 40 })).data;
      const t0 = await S.evaluate("document.body.innerText.length + '|' + location.href");
      const reqs0 = S.reqs.length; await S.evaluate("window.__m = 0; new MutationObserver((l) => { window.__m += l.length; }).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }); true");
      await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: pos.x, y: pos.y, button: "none" });
      await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x: pos.x, y: pos.y, button: "left", clickCount: 1, buttons: 1 });
      await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: pos.x, y: pos.y, button: "left", clickCount: 1, buttons: 0 });
      await sleep(2200);
      const b = (await S.send("Page.captureScreenshot", { format: "jpeg", quality: 40 })).data;
      const t1 = await S.evaluate("document.body.innerText.length + '|' + location.href").catch(() => "navigated");
      const m = await S.evaluate("window.__m || 0").catch(() => -1);
      const aud = await S.look();
      const changed = a !== b;
      out.push({ ...c, clickable: pos.same, coveredBy: pos.same ? undefined : pos.topTag, pixelsChanged: changed, textOrUrlChanged: t0 !== t1, mutations: m, newRequests: S.reqs.length - reqs0, stubs: aud ? JSON.stringify([aud.print, aud.opens.length, aud.share, aud.clip.length, aud.downloads.length]) : "", result: changed || t0 !== t1 || m > 0 || S.reqs.length > reqs0 || (aud && (aud.print || aud.share || aud.clip.length || aud.downloads.length || aud.opens.length)) ? "responds" : "NO EFFECT CONFIRMED" });
      console.log(out[out.length - 1].result.padEnd(20), c.page, "|", c.kind, c.label.slice(0, 50), pos.same ? "" : "[covered by " + pos.topTag + "]");
    } catch (e) { out.push({ ...c, result: "error " + String(e.message).slice(0, 60) }); try { await S.close(); } catch {} lastPage = ""; return process.exit(1); }
  }
  fs.writeFileSync(AUD + "/noeffect-verified.json", JSON.stringify(out, null, 1));
  await S.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
