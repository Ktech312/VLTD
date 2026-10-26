// Capture helper for the Tutorial 1 redo (Quick Add + Add Item). Drives the DEPLOYED app (vltd.app) as an isolated synthetic collector, records numbered screenshots with the exact
// on-screen rectangles of the controls being taught, and a verification result for every instruction.
// The camera is a TEST camera: Chrome is started with a fake video device that plays a looping file of synthetic, fictional collectible pictures (scratchpad assets).
// Nothing a viewer sees as "camera" is a real recording of a real item. Paid AI is never called: /api/ai/* is answered locally by the harness, except in the one place where the
// real server's refusal for a non-owner account is captured (only after a probe proves the server refuses before any provider call).
const fs = require("fs");
const path = require("path");
const SD = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/audit-2026-10-18/scripts";
const L = require(SD + "/audit-lib.cjs");
const T = require(SD + "/audit-s-add-lib.cjs");
const J = require(SD + "/journey-lib.cjs");
const ASSETS = "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/tut/assets";
const WORK = "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/tut/work";
const SIGS = JSON.parse(fs.readFileSync(path.join(ASSETS, "feed-means.json"), "utf8"));
const NO_AI_INTERCEPT = ["*/api/billing/*", "*/api/auth/*", "*/api/newsletter*", "*/api/waitlist*", "*/api/push/*", "*/api/clubs/notify*", "*/api/launch-access*", "*/api/admin/*", "*/api/card-lookup*", "*/api/psa-lookup*", "*/api/upc-lookup*", "*/api/comic-lookup*", "*/api/vinyl-lookup*", "*supabase.co/auth/v1/*", "*supabase.co/functions/v1/*"];
const sleep = T.sleep;

async function start({ scene, phone = false, camera = true, deniedCamera = false }) {
  const dir = path.join(WORK, scene); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  process.env.CHROME_EXTRA = camera ? `--use-fake-device-for-media-stream ${deniedCamera ? "" : "--use-fake-ui-for-media-stream"} --use-file-for-fake-video-capture=${ASSETS}/feed-all.mjpeg`.replace(/\s+/g, " ") : "";
  const W = phone ? 390 : 1440, H = phone ? 844 : 900, DSF = phone ? 3 : 2;
  const S = await L.session("owner", { width: W, height: H, mobile: phone });
  await S.send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: DSF, mobile: phone });
  if (deniedCamera) await S.send("Browser.setPermission", { permission: { name: "camera" }, setting: "denied", origin: "https://vltd.app" }).catch(() => {});
  const m = JSON.parse(fs.readFileSync(process.env.AUDIT_MANIFEST, "utf8"));
  const R = { S, T, m, scene, dir, W, H, DSF, phone, steps: [], seq: 0 };
  const dismiss = `(() => { const b = [...document.querySelectorAll('button')].find((x) => /^Dismiss$/.test((x.innerText || x.getAttribute('aria-label') || '').trim())); if (b) b.click(); return !!b; })()`;
  R.goto = async (p) => { await S.visit(p); await sleep(2200); await S.evaluate(dismiss); await sleep(300); };
  R.text = async () => (await S.text()).replace(/\s+/g, " ");
  R.has = async (re) => new RegExp(re, "i").test(await R.text());
  const tap = async (expr) => { // a touch tap at the element's centre (what a finger does)
    const r = await S.evaluate(`(() => { const el = (${expr}); if (!el) return null; el.scrollIntoView({ block: 'center', inline: 'center' }); const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
    if (!r) return null; await sleep(300);
    const r2 = await S.evaluate(`(() => { const el = (${expr}); const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
    await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: r2.x, y: r2.y }] });
    await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    return r2;
  };
  R.tap = tap;
  const visBtn = (re) => `[...document.querySelectorAll('button,a,[role=button],label,summary')].filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 4 && r.height > 4 && cs.visibility !== 'hidden' && cs.display !== 'none'; }).find((e) => new RegExp(${JSON.stringify("^(?:" + re + ")$")}, 'i').test((e.innerText || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim()))`;
  R.click = async (re, after = 1500) => { const r = phone ? await tap(visBtn(re)) : await T.clickText(S, re); if (!r) throw new Error("no control: " + re); await sleep(after); return r; };
  R.clickExpr = async (expr, after = 1500) => { const r = phone ? await tap(expr) : await T.click(S, expr); if (!r) throw new Error("no element: " + expr.slice(0, 80)); await sleep(after); return r; };
  R.type = async (expr, text) => { const ok = await T.typeInto(S, expr, text); if (!ok) throw new Error("cannot type into " + expr.slice(0, 80)); };
  R.js = (code) => S.evaluate(code);
  // which synthetic picture is the test camera showing right now (compares a 4x4 colour grid of the live video frame to each picture's)
  R.feedNow = () => S.evaluate(`(() => { const v = document.querySelector('video'); if (!v || !v.videoWidth) return null; const c = document.createElement('canvas'); c.width = 4; c.height = 4; const x = c.getContext('2d'); x.drawImage(v, 0, 0, 4, 4); const d = x.getImageData(0, 0, 4, 4).data; const sig = []; for (let i = 0; i < 64; i += 4) sig.push(d[i], d[i + 1], d[i + 2]); const refs = ${JSON.stringify(SIGS)}; const nz = (v) => { const m = v.reduce((x, y) => x + y, 0) / v.length; const c = v.map((q) => q - m); const n = Math.sqrt(c.reduce((x, y) => x + y * y, 0)) || 1; return c.map((q) => q / n); }; const ns = nz(sig); const ds = Object.keys(refs).map((k) => { const nr = nz(refs[k]); return [k, ns.reduce((x, q, i) => x + q * nr[i], 0)]; }).sort((p, q) => q[1] - p[1]); return { best: ds[0][0], dist: ds[0][1], gap: ds[0][1] - ds[1][1], sig }; })()`);
  R.waitFeed = async (name, ms = 30000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const f = await R.feedNow(); if (f && f.best === name && f.gap > (name === "toy-figure" ? 0.01 : 0.06) && f.dist > 0.8) return f; await sleep(60); } throw new Error("camera feed never showed " + name); };
  R.allowRealAiRefusal = async () => { // only after proving the server refuses a non-owner before any provider call
    const c = J.createClient(J.env.NEXT_PUBLIC_SUPABASE_URL, J.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const si = await c.auth.signInWithPassword({ email: m.email, password: m.password }); if (si.error) throw si.error;
    const form = new FormData(); form.append("image", new File([new TextEncoder().encode("not a picture ".repeat(40))], "p.jpg", { type: "image/jpeg" })); form.append("profileId", m.personalId); form.append("requestId", require("crypto").randomUUID());
    const res = await fetch("https://vltd.app/api/ai/analyze-item", { method: "POST", body: form, headers: { authorization: `Bearer ${si.data.session.access_token}` } });
    const body = await res.json().catch(() => ({}));
    if (!(res.status === 403 && body.code === "owner_only")) throw new Error("the server did not refuse a non-owner (" + res.status + " " + body.code + "): AI is NOT being let through");
    await S.send("Fetch.enable", { patterns: NO_AI_INTERCEPT.map((urlPattern) => ({ urlPattern })) });
    R.aiPassThrough = true;
  };
  // rectangles (CSS px, in the current viewport) of the elements the expressions return
  R.rects = async (exprs) => {
    const out = [];
    for (const e of exprs || []) {
      const r = await S.evaluate(`(() => { const el = (${e}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
      out.push(r);
    }
    return out;
  };
  // one numbered screenshot + the controls to highlight + what was verified at this moment
  R.shot = async (id, spec = {}) => {
    await S.evaluate(dismiss); await sleep(spec.settle ?? 700);
    const marks = await R.rects(spec.marks);
    const missing = (spec.marks || []).filter((_, i) => !marks[i]).length;
    const png = await S.send("Page.captureScreenshot", { format: "png" });
    const n = String(++R.seq).padStart(2, "0");
    const file = `${n}-${id}.png`;
    fs.writeFileSync(path.join(dir, file), Buffer.from(png.data, "base64"));
    let verified = null, evidence = "";
    if (spec.verify) { try { const v = await spec.verify(); verified = v === true || (v && v.ok !== false); evidence = typeof v === "object" ? JSON.stringify(v).slice(0, 300) : String(v); } catch (e) { verified = false; evidence = String(e.message).slice(0, 300); } }
    const rec = { id, n, file, scene, phone, title: spec.title || id, caption: spec.caption || "", narration: spec.narration || "", marks: marks.filter(Boolean), missingMarks: missing, roi: spec.roi || null, simulated: spec.simulated || null, verified, evidence, hold: spec.hold || null };
    R.steps.push(rec);
    console.log(`${verified === false ? "FAIL" : "ok  "} ${file}${missing ? "  (missing marks: " + missing + ")" : ""}${verified === false ? "  <= " + evidence : ""}`);
    return rec;
  };
  R.save = () => fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ scene, phone, W, H, DSF, aiPassThrough: !!R.aiPassThrough, steps: R.steps }, null, 1));
  R.close = async () => { R.save(); await S.close().catch(() => {}); };
  return R;
}

// expression helpers (strings evaluated in the page)
const byText = (re, sel = "button,a,[role=button],label,summary,h1,h2,h3,p,span,div") => `[...document.querySelectorAll(${JSON.stringify(sel)})].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && new RegExp(${JSON.stringify(re)}, 'i').test((e.innerText || e.getAttribute('aria-label') || '').trim()); }).sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0]`;
const btn = (re) => `[...document.querySelectorAll('button,a,[role=button]')].find((e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && new RegExp(${JSON.stringify("^(?:" + re + ")$")}, 'i').test((e.innerText || e.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim()); })`;
const css = (sel) => `document.querySelector(${JSON.stringify(sel)})`;
module.exports = { start, byText, btn, css, ASSETS, WORK, T, L, J, sleep };
