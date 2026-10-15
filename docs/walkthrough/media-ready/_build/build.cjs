// Screenshot-based tutorial video builder (captions, zooms, crossfades) -> H.264 MP4 via h264-mp4-encoder.
// usage: node build.cjs <outRoot> [onlyId]
const fs = require("fs");
const path = require("path");
const sharp = require("C:/Users/EK/VLTD/node_modules/sharp");
const HME = require("h264-mp4-encoder");
const C = require("./content.cjs");

const SHOTS = path.join(__dirname, "shots");
const LOGO = "C:/Users/EK/VLTD/marketing/logos/vltd-logo-platinum.png";
const FPS = 15;
const SRC_W = 1354, SRC_H = 719;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

// word-wrap for SVG text
function wrap(text, maxChars) {
  const words = String(text).split(/\s+/); const lines = []; let cur = "";
  for (const w of words) { if ((cur + " " + w).trim().length > maxChars) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }
  if (cur) lines.push(cur); return lines;
}

const shotCache = {};
async function loadShot(name) {
  if (shotCache[name]) return shotCache[name];
  let img = sharp(path.join(SHOTS, name + ".jpg"));
  let buf = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  // redact the account email line in the account-menu screenshot
  if (name === "t4-07-account-menu") {
    const rx = 1040, ry = 96, rw = 215, rh = 18;
    const out = Buffer.from(buf.data); const sp = ((ry + 1) * buf.info.width + (rx - 6)) * 3; const col = [out[sp], out[sp + 1], out[sp + 2]];
    for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) for (let c = 0; c < 3; c++) out[((ry + y) * buf.info.width + rx + x) * 3 + c] = col[c];
    buf = { data: out, info: buf.info };
  }
  shotCache[name] = { raw: buf.data, w: buf.info.width, h: buf.info.height };
  return shotCache[name];
}

// crop rect with the panel's aspect ratio, clamped to the source
function cropFor(roi, aspect, w, h, minFrac = 0.5) {
  let [x, y, rw, rh] = roi || [0, 0, w, h];
  const cx = x + rw / 2, cy = y + rh / 2;
  if (rw / rh > aspect) rh = rw / aspect; else rw = rh * aspect;
  if (roi) { // never zoom in more than 2x so text stays crisp
    rw = Math.max(rw, w * minFrac); rh = rw / aspect;
  }
  rw = Math.min(rw, w); rh = Math.min(rh, h);
  rw = Math.min(rw, rh * aspect); rh = rw / aspect;
  x = Math.max(0, Math.min(w - rw, cx - rw / 2)); y = Math.max(0, Math.min(h - rh, cy - rh / 2));
  return { x, y, w: rw, h: rh };
}
const lerp = (a, b, t) => a + (b - a) * t;

async function panelFrame(shot, roi, aspect, PW, PH, t, minFrac = 0.5) {
  // t in 0..1: 0 = full view (slightly framed), 1 = zoomed to roi
  const full = cropFor(null, aspect, shot.w, shot.h);
  const zoom = cropFor(roi, aspect, shot.w, shot.h, minFrac);
  const k = smooth(t);
  const r = { x: lerp(full.x, zoom.x, k), y: lerp(full.y, zoom.y, k), w: lerp(full.w, zoom.w, k), h: lerp(full.h, zoom.h, k) };
  const left = Math.round(r.x), top = Math.round(r.y), width = Math.max(8, Math.round(r.w)), height = Math.max(8, Math.round(r.h));
  return sharp(shot.raw, { raw: { width: shot.w, height: shot.h, channels: 3 } })
    .extract({ left: Math.min(left, shot.w - width), top: Math.min(top, shot.h - height), width, height })
    .resize(PW, PH, { kernel: "lanczos3", fit: "fill" }).raw().toBuffer();
}

function blendRaw(a, b, alpha) { // both RGBA same size; returns new buffer
  const out = Buffer.allocUnsafe(a.length);
  const ia = 1 - alpha;
  for (let i = 0; i < a.length; i++) out[i] = (a[i] * ia + b[i] * alpha) | 0;
  return out;
}

async function logoBuf(height) {
  return sharp(LOGO).resize({ height }).png().toBuffer();
}

// ---------- landscape tutorial ----------
async function buildTutorial(T, outDir) {
  const W = 1920, H = 1080;
  const PH = 800, PW = Math.round(PH * (SRC_W / SRC_H)); // 1506
  const panelLeft = Math.round((W - PW) / 2), panelTop = 92;
  const logo = await logoBuf(46);
  const bgSvg = (extra = "") => `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0c0f14"/><stop offset="1" stop-color="#171c24"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>${extra}</svg>`;
  const baseBg = await sharp(Buffer.from(bgSvg())).png().toBuffer();

  const segs = []; // {kind, dur, ...}
  segs.push({ kind: "intro", dur: 5.5 });
  T.steps.forEach((s, i) => segs.push({ kind: "step", idx: i, dur: 10.5, step: s }));
  segs.push({ kind: "outro", dur: 7 });

  const total = segs.reduce((a, s) => a + s.dur, 0);
  const enc = await HME.createH264MP4Encoder();
  enc.width = W; enc.height = H; enc.frameRate = FPS; enc.quantizationParameter = 22; enc.initialize();

  // per-segment static layers
  const layers = [];
  for (const seg of segs) {
    if (seg.kind === "intro") {
      const lines = wrap(T.title, 26);
      const descLines = wrap(T.short, 80);
      const descY = 410 + lines.length * 100;
      const needsY = descY + descLines.length * 48 + 70;
      const needs = T.needs.map((n, i) => `<text x="160" y="${needsY + 56 + i * 52}" font-size="34" fill="#c8cdd2" font-family="Segoe UI, Arial, sans-serif">•  ${esc(n)}</text>`).join("");
      const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
        <text x="160" y="290" font-size="30" letter-spacing="6" fill="#52D6F4" font-family="Segoe UI, Arial, sans-serif" font-weight="600">VLTD HELP · TUTORIAL</text>
        ${lines.map((l, i) => `<text x="160" y="${390 + i * 100}" font-size="88" font-weight="700" fill="#eceef2" font-family="Segoe UI, Arial, sans-serif">${esc(l)}</text>`).join("")}
        ${descLines.map((l, i) => `<text x="160" y="${descY + i * 48}" font-size="36" fill="#a3a9b5" font-family="Segoe UI, Arial, sans-serif">${esc(l)}</text>`).join("")}
        <text x="160" y="${needsY}" font-size="30" letter-spacing="3" fill="#8b93a1" font-family="Segoe UI, Arial, sans-serif" font-weight="600">WHAT YOU NEED</text>${needs}</svg>`;
      seg.layer = await sharp(baseBg).composite([{ input: Buffer.from(svg) }, { input: logo, left: 160, top: 120 }]).raw().ensureAlpha().toBuffer();
    } else if (seg.kind === "outro") {
      const shot = await loadShot(T.result.shot);
      const thumb = await sharp(shot.raw, { raw: { width: shot.w, height: shot.h, channels: 3 } }).resize(840, Math.round(840 * SRC_H / SRC_W)).png().toBuffer();
      const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
        <text x="120" y="400" font-size="30" letter-spacing="6" fill="#52D6F4" font-family="Segoe UI, Arial, sans-serif" font-weight="600">DONE</text>
        ${wrap(T.result.text, 24).map((l, i) => `<text x="120" y="${480 + i * 84}" font-size="68" font-weight="700" fill="#eceef2" font-family="Segoe UI, Arial, sans-serif">${esc(l)}</text>`).join("")}
        ${wrap(T.next, 36).map((l, i) => `<text x="120" y="${740 + i * 50}" font-size="38" fill="#c8cdd2" font-family="Segoe UI, Arial, sans-serif">${esc(l)}</text>`).join("")}
        <text x="120" y="900" font-size="30" fill="#8b93a1" font-family="Segoe UI, Arial, sans-serif">vltd.app · Help</text></svg>`;
      seg.layer = await sharp(baseBg).composite([{ input: thumb, left: 990, top: 300 }, { input: Buffer.from(svg) }, { input: logo, left: 120, top: 120 }]).raw().ensureAlpha().toBuffer();
    } else {
      const s = seg.step; const n = T.steps.length;
      const capLines = wrap(s.text, 88);
      const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
        <rect x="${panelLeft - 3}" y="${panelTop - 3}" width="${PW + 6}" height="${PH + 6}" fill="none" stroke="#2f3744" stroke-width="3" rx="6"/>
        <rect x="0" y="${panelTop + PH + 24}" width="${W}" height="${H - (panelTop + PH + 24)}" fill="#0a0c10"/>
        <rect x="${panelLeft}" y="${panelTop + PH + 24}" width="6" height="150" fill="#52D6F4"/>
        <text x="${panelLeft + 28}" y="${panelTop + PH + 78}" font-size="46" font-weight="700" fill="#ffffff" font-family="Segoe UI, Arial, sans-serif">${esc(s.title)}</text>
        ${capLines.map((l, i) => `<text x="${panelLeft + 28}" y="${panelTop + PH + 130 + i * 42}" font-size="32" fill="#c8cdd2" font-family="Segoe UI, Arial, sans-serif">${esc(l)}</text>`).join("")}
        <rect x="${W - panelLeft - 210}" y="30" width="210" height="44" rx="22" fill="#1b212b" stroke="#2f3744"/>
        <text x="${W - panelLeft - 105}" y="60" font-size="24" fill="#eceef2" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="600">Step ${seg.idx + 1} of ${n}</text>
      </svg>`;
      seg.overlay = await sharp(baseBg).composite([{ input: Buffer.from(svg) }, { input: logo, left: panelLeft, top: 24 }]).raw().ensureAlpha().toBuffer();
      seg.shot = await loadShot(s.shot);
    }
  }

  const cues = []; let t0 = 0; let prevLast = null; const timeline = [];
  for (const seg of segs) { timeline.push({ seg, start: t0, end: t0 + seg.dur }); t0 += seg.dur; }

  const nFrames = Math.round(total * FPS);
  let lastFrame = null;
  for (let f = 0; f < nFrames; f++) {
    const t = f / FPS;
    const tl = timeline.find((x) => t >= x.start && t < x.end) || timeline[timeline.length - 1];
    const lt = t - tl.start; const seg = tl.seg;
    let frame;
    if (seg.kind === "step") {
      const zoomT = smooth((lt - 1.4) / 3.0);
      const panel = await panelFrame(seg.shot, seg.step.roi, SRC_W / SRC_H, PW, PH, zoomT);
      const rgbaPanel = Buffer.allocUnsafe(PW * PH * 4);
      for (let i = 0, j = 0; i < panel.length; i += 3, j += 4) { rgbaPanel[j] = panel[i]; rgbaPanel[j + 1] = panel[i + 1]; rgbaPanel[j + 2] = panel[i + 2]; rgbaPanel[j + 3] = 255; }
      frame = await sharp(seg.overlay, { raw: { width: W, height: H, channels: 4 } })
        .composite([{ input: rgbaPanel, raw: { width: PW, height: PH, channels: 4 }, left: panelLeft, top: panelTop }]).raw().toBuffer();
    } else {
      frame = seg.layer;
    }
    // crossfade from previous segment's last frame
    if (lt < 0.6 && lastFrame && tl.start > 0) frame = blendRaw(lastFrame, frame, smooth(lt / 0.6));
    enc.addFrameRgba(frame);
    if (lt > seg.dur - 0.1) lastFrame = frame;
    if (f % 150 === 0) process.stdout.write(`\r${T.file} ${f}/${nFrames}`);
  }
  enc.finalize();
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, T.file + ".mp4");
  fs.writeFileSync(outPath, Buffer.from(enc.FS.readFile(enc.outputFilename)));
  enc.delete();

  // cues for subtitle files: intro, each step, outro
  const cueList = [];
  timeline.forEach((x) => {
    if (x.seg.kind === "intro") cueList.push({ s: x.start + 0.6, e: x.end - 0.3, text: `${T.title}. ${T.needs.join(". ")}.` });
    else if (x.seg.kind === "step") cueList.push({ s: x.start + 0.6, e: x.end - 0.4, text: `${x.seg.step.title}. ${x.seg.step.text}`, say: x.seg.step.say });
    else cueList.push({ s: x.start + 0.6, e: x.end - 0.5, text: `${T.result.text} ${T.next}` });
  });
  return { outPath, total, cueList };
}

// ---------- vertical social ----------
async function buildSocial(S, outDir) {
  const W = 1080, H = 1920;
  const PW = 1000, PH = 1080, panelLeft = 40, panelTop = 250; // near-square panel
  const logo = await logoBuf(60);
  const bg = (extra) => `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c0f14"/><stop offset="1" stop-color="#182029"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>${extra || ""}</svg>`;
  const base = await sharp(Buffer.from(bg())).png().toBuffer();
  const segs = [{ kind: "hook", dur: 4 }];
  S.steps.forEach((s, i) => segs.push({ kind: "step", step: s, idx: i, dur: 7.5 }));
  segs.push({ kind: "end", dur: 4.5 });
  const total = segs.reduce((a, s) => a + s.dur, 0);
  const enc = await HME.createH264MP4Encoder();
  enc.width = W; enc.height = H; enc.frameRate = FPS; enc.quantizationParameter = 22; enc.initialize();
  const tl = []; let t0 = 0;
  for (const seg of segs) {
    if (seg.kind === "hook") {
      const lines = wrap(S.hook, 16);
      const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${lines.map((l, i) => `<text x="${W / 2}" y="${760 + i * 130}" font-size="112" font-weight="700" fill="#eceef2" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif">${esc(l)}</text>`).join("")}
        <text x="${W / 2}" y="${760 + lines.length * 130 + 20}" font-size="44" fill="#52D6F4" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="600">in under a minute</text></svg>`;
      seg.layer = await sharp(base).composite([{ input: Buffer.from(svg) }, { input: logo, left: Math.round((W - (await sharp(logo).metadata()).width) / 2), top: 420 }]).raw().ensureAlpha().toBuffer();
    } else if (seg.kind === "end") {
      const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
        ${wrap(S.end, 18).map((l, i) => `<text x="${W / 2}" y="${900 + i * 100}" font-size="84" font-weight="700" fill="#eceef2" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif">${esc(l)}</text>`).join("")}
        <text x="${W / 2}" y="1220" font-size="46" fill="#52D6F4" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="600">vltd.app</text></svg>`;
      seg.layer = await sharp(base).composite([{ input: Buffer.from(svg) }, { input: logo, left: Math.round((W - (await sharp(logo).metadata()).width) / 2), top: 640 }]).raw().ensureAlpha().toBuffer();
    } else {
      const lines = wrap(seg.step.text.replace(/^\d+\s+/, ""), 20);
      const num = seg.step.text.match(/^(\d+)/)[1];
      const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
        <rect x="${panelLeft - 4}" y="${panelTop - 4}" width="${PW + 8}" height="${PH + 8}" fill="none" stroke="#2f3744" stroke-width="4" rx="8"/>
        <circle cx="${panelLeft + 56}" cy="1520" r="52" fill="#52D6F4"/>
        <text x="${panelLeft + 56}" y="1538" font-size="56" font-weight="800" fill="#0a0c10" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif">${num}</text>
        ${lines.map((l, i) => `<text x="${panelLeft + 140}" y="${1532 + i * 92}" font-size="78" font-weight="700" fill="#ffffff" font-family="Segoe UI, Arial, sans-serif">${esc(l)}</text>`).join("")}
      </svg>`;
      seg.overlay = await sharp(base).composite([{ input: Buffer.from(svg) }, { input: logo, left: panelLeft, top: 110 }]).raw().ensureAlpha().toBuffer();
      seg.shot = await loadShot(seg.step.shot);
    }
    tl.push({ seg, start: t0, end: t0 + seg.dur }); t0 += seg.dur;
  }
  const nFrames = Math.round(total * FPS); let lastFrame = null;
  for (let f = 0; f < nFrames; f++) {
    const t = f / FPS; const x = tl.find((q) => t >= q.start && t < q.end) || tl[tl.length - 1]; const lt = t - x.start; const seg = x.seg;
    let frame;
    if (seg.kind === "step") {
      const panel = await panelFrame(seg.shot, seg.step.roi, PW / PH, PW, PH, smooth((lt - 0.8) / 2.5), 0.25);
      const rgba = Buffer.allocUnsafe(PW * PH * 4);
      for (let i = 0, j = 0; i < panel.length; i += 3, j += 4) { rgba[j] = panel[i]; rgba[j + 1] = panel[i + 1]; rgba[j + 2] = panel[i + 2]; rgba[j + 3] = 255; }
      frame = await sharp(seg.overlay, { raw: { width: W, height: H, channels: 4 } }).composite([{ input: rgba, raw: { width: PW, height: PH, channels: 4 }, left: panelLeft, top: panelTop }]).raw().toBuffer();
    } else frame = seg.layer;
    if (lt < 0.5 && lastFrame && x.start > 0) frame = blendRaw(lastFrame, frame, smooth(lt / 0.5));
    enc.addFrameRgba(frame);
    if (lt > seg.dur - 0.08) lastFrame = frame;
    if (f % 150 === 0) process.stdout.write(`\r${S.file} ${f}/${nFrames}`);
  }
  enc.finalize();
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, S.file + ".mp4");
  fs.writeFileSync(outPath, Buffer.from(enc.FS.readFile(enc.outputFilename)));
  enc.delete();
  const cueList = [];
  tl.forEach((x) => {
    if (x.seg.kind === "hook") cueList.push({ s: x.start + 0.4, e: x.end - 0.3, text: S.hook });
    else if (x.seg.kind === "end") cueList.push({ s: x.start + 0.4, e: x.end - 0.3, text: S.end });
    else cueList.push({ s: x.start + 0.4, e: x.end - 0.3, text: x.seg.step.text.replace(/\s+/, ": ") });
  });
  return { outPath, total, cueList };
}

function tc(sec, comma) { const ms = Math.round(sec * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, r = ms % 1000; const p = (n, w = 2) => String(n).padStart(w, "0"); return `${p(h)}:${p(m)}:${p(s)}${comma ? "," : "."}${p(r, 3)}`; }
function writeSubs(dir, base, cues) {
  fs.writeFileSync(path.join(dir, base + ".vtt"), "WEBVTT\n\n" + cues.map((c) => `${tc(c.s)} --> ${tc(c.e)}\n${c.text}\n`).join("\n"));
  fs.writeFileSync(path.join(dir, base + ".srt"), cues.map((c, i) => `${i + 1}\n${tc(c.s, true)} --> ${tc(c.e, true)}\n${c.text}\n`).join("\n"));
}

module.exports = { buildTutorial, buildSocial, writeSubs, loadShot, SRC_W, SRC_H };

if (require.main === module) {
  (async () => {
    const outRoot = process.argv[2]; const only = process.argv[3];
    const meta = {};
    for (const T of C.tutorials) {
      if (only && only !== T.id && only !== "all") continue;
      const dir = path.join(outRoot, T.id);
      const r = await buildTutorial(T, dir);
      writeSubs(dir, T.file, r.cueList);
      meta[T.id] = { duration: r.total, cues: r.cueList };
      console.log("\nbuilt", r.outPath, r.total + "s");
    }
    for (const S of C.social) {
      if (only && only !== S.id && only !== "all") continue;
      const dir = path.join(outRoot, "social-vertical");
      const r = await buildSocial(S, dir);
      writeSubs(dir, S.file, r.cueList);
      meta[S.id] = { duration: r.total, cues: r.cueList };
      console.log("\nbuilt", r.outPath, r.total + "s");
    }
    fs.writeFileSync(path.join(outRoot, ".build-meta-" + (only || "all") + ".json"), JSON.stringify(meta, null, 1));
  })();
}
