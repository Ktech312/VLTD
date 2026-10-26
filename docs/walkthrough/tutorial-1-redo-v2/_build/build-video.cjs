// Builds the two chapter videos (silent, burned-in captions, 1920x1080 H.264 MP4), WebVTT/SRT captions, annotated numbered screenshots and a thumbnail from the capture manifests.
//   node build-video.cjs <outRoot> [1|2]        (needs `h264-mp4-encoder` installed next to the scratchpad assets; see ENC_DIR)
// These are SCREENSHOT-BASED videos made from real captures of the deployed app with synthetic data. They are not screen recordings of a person using the app.
const fs = require("fs");
const path = require("path");
const sharp = require("C:/Users/EK/VLTD/node_modules/sharp");
const SCRATCH = "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/tut";
const HME = require(SCRATCH + "/enc/node_modules/h264-mp4-encoder");
const { cards, narration, sequence } = require("./content.cjs");
const WORK = process.env.TUT_WORK || SCRATCH + "/work";
const OUT_ROOT = process.argv[2]; const ONLY = process.argv[3] ? Number(process.argv[3]) : null;
if (!OUT_ROOT) { console.error("usage: node build-video.cjs <outRoot> [chapter]"); process.exit(2); }

const W = 1920, H = 1080, FPS = 8, IMG_H = 760, BAR_H = H - IMG_H;
const FONT = "Segoe UI, Arial, Helvetica, sans-serif";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
function wrap(text, maxChars) { const words = String(text).split(/\s+/); const lines = []; let cur = ""; for (const w of words) { if ((cur + " " + w).trim().length > maxChars) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim(); } if (cur) lines.push(cur); return lines; }
const ts = (ms, sep = ".") => { const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, x = Math.floor(ms) % 1000; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}${sep}${String(x).padStart(3, "0")}`; };

// ---- load manifests
const manifests = {};
for (const dir of fs.readdirSync(WORK)) { const f = path.join(WORK, dir, "manifest.json"); if (fs.existsSync(f)) { const m = JSON.parse(fs.readFileSync(f, "utf8")); for (const s of m.steps) if (s.id !== "zz-error") manifests[`${m.scene}/${s.id}`] = { ...s, scene: m.scene, phone: m.phone, W: m.W, H: m.H, DSF: m.DSF, dir: path.join(WORK, dir) }; } }

// ---- slide graph
function expand() {
  const slides = []; let chapter = 0, section = "", n = 0;
  for (const el of sequence) {
    if (el.chapter) { chapter = el.chapter; section = ""; n = 0; continue; }
    if (el.section) { section = el.section; continue; }
    if (el.card) { const c = cards[el.card]; if (!c) throw new Error("no card " + el.card); slides.push({ type: "card", chapter, section, key: el.card, card: c, narration: c.narration }); continue; }
    if (el.step) { const s = manifests[el.step]; if (!s) throw new Error("no capture for " + el.step); n += 1; slides.push({ type: "step", chapter, section, n, key: el.step, s, narration: narration[el.step] || "" }); }
  }
  return slides;
}

// ---- drawing
const RING = "#22d3ee";
function ringsSvg(marks, map, w, h, numbered) {
  let out = "";
  marks.forEach((m, i) => {
    const x = map.x(m.x) - 10, y = map.y(m.y) - 10, rw = m.w * map.s + 20, rh = m.h * map.s + 20;
    if (x > w || y > h || x + rw < 0 || y + rh < 0) return;
    out += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" rx="14" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="11"/><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" rx="14" fill="none" stroke="${RING}" stroke-width="6"/>`;
    if (numbered && marks.length > 1) out += `<circle cx="${(x - 4).toFixed(1)}" cy="${(y - 4).toFixed(1)}" r="21" fill="${RING}" stroke="#000" stroke-opacity=".5" stroke-width="3"/><text x="${(x - 4).toFixed(1)}" y="${(y + 4).toFixed(1)}" font-family="${FONT}" font-size="26" font-weight="700" fill="#06222b" text-anchor="middle">${i + 1}</text>`;
  });
  return out;
}
function tag(text, x, y, anchor = "start") { const w = text.length * 13 + 28; const rx = anchor === "end" ? x - w : x; return `<rect x="${rx}" y="${y}" width="${w}" height="38" rx="19" fill="#06121a" fill-opacity=".82" stroke="#2b3a48"/><text x="${rx + w / 2}" y="${y + 26}" font-family="${FONT}" font-size="21" font-weight="600" fill="#cfe3f1" text-anchor="middle">${esc(text)}</text>`; }

function captionBarSvg(slide, chapterLabel) {
  const s = slide.s; const stepNo = `STEP ${slide.n}`; const sec = slide.section ? slide.section.toUpperCase() : "";
  const titleLines = wrap(s.title, 70); const capLines = wrap(s.caption, 102).slice(0, 3);
  let y = 54;
  let svg = `<rect x="0" y="0" width="${W}" height="${BAR_H}" fill="#0c131a"/><rect x="0" y="0" width="${W}" height="3" fill="${RING}" fill-opacity=".7"/>`;
  svg += `<text x="60" y="${y}" font-family="${FONT}" font-size="24" font-weight="700" fill="${RING}" letter-spacing="2">${stepNo}${sec ? "  ·  " + esc(sec) : ""}</text>`; y += 54;
  titleLines.forEach((l) => { svg += `<text x="60" y="${y}" font-family="${FONT}" font-size="46" font-weight="700" fill="#f1f6fa">${esc(l)}</text>`; y += 54; });
  capLines.forEach((l) => { svg += `<text x="60" y="${y}" font-family="${FONT}" font-size="33" fill="#d3dee8">${esc(l)}</text>`; y += 42; });
  if (s.simulated) { y += 4; const sl = wrap("Simulated: " + s.simulated, 150).slice(0, 2); sl.forEach((l) => { svg += `<text x="60" y="${y}" font-family="${FONT}" font-size="22" fill="#f6b84e">${esc(l)}</text>`; y += 28; }); }
  svg += `<text x="${W - 40}" y="54" font-family="${FONT}" font-size="19" fill="#6f8294" text-anchor="end">Screenshots of the live app with synthetic data · ${esc(chapterLabel)}</text>`;
  return svg;
}

const cache = {};
async function loadPng(s) { const f = path.join(s.dir, s.file); if (!cache[f]) { const meta = await sharp(f).metadata(); cache[f] = { f, w: meta.width, h: meta.height }; } return cache[f]; }

// crop rectangle (CSS px) for a desktop step: zoom to the marked controls, keep the screen's aspect
function desktopCrop(s, k = 1) {
  const aspect = W / IMG_H; const vw = s.W, vh = s.H;
  if (!s.marks.length) return null;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const m of s.marks) { x0 = Math.min(x0, m.x); y0 = Math.min(y0, m.y); x1 = Math.max(x1, m.x + m.w); y1 = Math.max(y1, m.y + m.h); }
  const bw = x1 - x0, bh = y1 - y0; const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let w = Math.max(bw + 320, (bh + 220) * aspect, 1000); w = Math.min(w, vw);
  if ((bh + 160) > Math.min(vh, w / aspect) || bw + 120 > w) return bw > 900 ? null : { tall: true, x0, y0, x1, y1 };
  let h = w / aspect; if (h > vh) { h = vh; w = h * aspect; }
  w *= k; h *= k; w = Math.min(w, vw); h = Math.min(h, vh);
  let x = Math.max(0, Math.min(vw - w, cx - w / 2)); let y = Math.max(0, Math.min(vh - h, cy - h / 2));
  return { x, y, w, h };
}

async function stepImage(slide, k, forStill = false) {
  const s = slide.s; const png = await loadPng(s); const dsf = s.DSF;
  if (s.phone) {
    // phone: the whole screen at full height beside the text; rings drawn on it
    const ph = H - 40, pw = Math.round(ph * (s.W / s.H));
    const img = await sharp(png.f).resize(pw, ph).toBuffer();
    const map = { x: (v) => 60 + v * (pw / s.W), y: (v) => 20 + v * (ph / s.H), s: pw / s.W };
    return { kind: "phone", img, pw, ph, map };
  }
  const crop = desktopCrop(s, k);
  if (crop && crop.tall) { // the controls are spread over a tall area (a dialog or a long form): show that area tall, beside the caption, like a phone screen
    const mx = 90, my = 70; const cx0 = Math.max(0, crop.x0 - mx), cy0 = Math.max(0, crop.y0 - my), cx1 = Math.min(s.W, crop.x1 + mx), cy1 = Math.min(s.H, crop.y1 + my);
    const cw = cx1 - cx0, ch = cy1 - cy0; const sc = Math.min(1060 / ch, 1080 / cw); const pw = Math.round(cw * sc), ph = Math.round(ch * sc);
    const img = await sharp(png.f).extract({ left: Math.round(cx0 * dsf), top: Math.round(cy0 * dsf), width: Math.round((cx1 - cx0) * dsf), height: Math.round((cy1 - cy0) * dsf) }).resize(pw, ph).toBuffer();
    const top = Math.max(28, Math.round((H - ph) / 2)); return { kind: "panel", img, pw, ph, top, map: { x: (v) => 60 + (v - cx0) * sc, y: (v) => top + (v - cy0) * sc, s: sc } };
  }
  if (!crop) { // whole screen, letterboxed
    const ih = IMG_H, iw = Math.round(ih * (s.W / s.H));
    const img = await sharp(png.f).resize(iw, ih).toBuffer();
    const ox = Math.round((W - iw) / 2);
    return { kind: "desktop-full", img, ox, iw, ih, map: { x: (v) => ox + v * (iw / s.W), y: (v) => v * (ih / s.H), s: iw / s.W } };
  }
  const left = Math.max(0, Math.min(png.w - 2, Math.round(crop.x * dsf))), top = Math.max(0, Math.min(png.h - 2, Math.round(crop.y * dsf)));
  const img = await sharp(png.f).extract({ left, top, width: Math.max(2, Math.min(png.w - left, Math.round(crop.w * dsf))), height: Math.max(2, Math.min(png.h - top, Math.round(crop.h * dsf))) }).resize(W, IMG_H, { fit: "fill" }).toBuffer();
  const sc = W / crop.w;
  return { kind: "desktop-zoom", img, map: { x: (v) => (v - crop.x) * sc, y: (v) => (v - crop.y) * sc, s: sc } };
}

async function composeStep(slide, k, chapterLabel) {
  const s = slide.s; const im = await stepImage(slide, k);
  const layers = []; let bg = "#080c10";
  if (im.kind === "phone" || im.kind === "panel") {
    const x0 = 60; const topY = im.top ?? 20; const frame = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="${x0 - 14}" y="${topY - 14}" width="${im.pw + 28}" height="${im.ph + 28}" rx="${im.kind === "phone" ? 46 : 18}" fill="#111a22" stroke="#33485a" stroke-width="3"/></svg>`;
    layers.push({ input: Buffer.from(frame) });
    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${im.pw}" height="${im.ph}"><rect width="${im.pw}" height="${im.ph}" rx="${im.kind === "phone" ? 34 : 8}" fill="#fff"/></svg>`);
    const rounded = await sharp(im.img).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
    layers.push({ input: rounded, left: x0, top: topY });
    const textX = Math.max(700, 60 + im.pw + 90); const maxChars = Math.floor((W - textX - 60) / 21); let y = 150; let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
    svg += ringsSvg(s.marks, im.map, W, H, true);
    { const lab = `STEP ${slide.n}${slide.section ? "  ·  " + slide.section.toUpperCase() : ""}`; wrap(lab, Math.floor((W - textX - 60) / 21)).forEach((l, i) => { svg += `<text x="${textX}" y="${110 + i * 36}" font-family="${FONT}" font-size="28" font-weight="700" fill="${RING}" letter-spacing="2">${esc(l)}</text>`; }); y = 150 + (wrap(lab, Math.floor((W - textX - 60) / 21)).length - 1) * 36; }
    wrap(s.title, Math.max(18, Math.floor((W - textX - 60) / 30))).forEach((l) => { svg += `<text x="${textX}" y="${y + 40}" font-family="${FONT}" font-size="62" font-weight="700" fill="#f1f6fa">${esc(l)}</text>`; y += 74; });
    y += 20; wrap(s.caption, maxChars).slice(0, 8).forEach((l) => { svg += `<text x="${textX}" y="${y + 30}" font-family="${FONT}" font-size="40" fill="#d3dee8">${esc(l)}</text>`; y += 54; });
    if (s.simulated) { y += 14; wrap("Simulated: " + s.simulated, 80).slice(0, 4).forEach((l) => { svg += `<text x="${textX}" y="${y + 24}" font-family="${FONT}" font-size="27" fill="#f6b84e">${esc(l)}</text>`; y += 36; }); }
    svg += tag(s.phone ? "PHONE VIEW (phone-size test browser)" : "DESKTOP", W - 40, 40, "end");
    svg += `<text x="${W - 40}" y="${H - 22}" font-family="${FONT}" font-size="19" fill="#6f8294" text-anchor="end">Screenshots of the live app with synthetic data · ${esc(chapterLabel)}</text></svg>`;
    layers.push({ input: Buffer.from(svg) });
  } else {
    if (im.kind === "desktop-full") layers.push({ input: im.img, left: im.ox, top: 0 }); else layers.push({ input: im.img, left: 0, top: 0 });
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
    svg += `<g clip-path="inset(0 0 ${BAR_H}px 0)">${ringsSvg(s.marks, im.map, W, IMG_H, true)}</g>`;
    svg += tag("DESKTOP", W - 30, 24, "end");
    svg += `<g transform="translate(0 ${IMG_H})">${captionBarSvg(slide, chapterLabel)}</g></svg>`;
    layers.push({ input: Buffer.from(svg) });
  }
  const base = sharp({ create: { width: W, height: H, channels: 4, background: bg } });
  return base.composite(layers);
}

function cardSvg(slide, chapterLabel) {
  const c = slide.card; let y = 250;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#0a1017"/><rect x="0" y="0" width="${W}" height="6" fill="${RING}"/>`;
  svg += `<text x="140" y="170" font-family="${FONT}" font-size="34" font-weight="700" fill="${RING}" letter-spacing="3">${esc(c.kicker.toUpperCase())}</text>`;
  svg += `<text x="140" y="${y + 20}" font-family="${FONT}" font-size="104" font-weight="800" fill="#f4f8fb">${esc(c.title)}</text>`; y += 130;
  c.lines.forEach((l) => { wrap(l, 74).forEach((ln, i) => { svg += `${i === 0 ? `<circle cx="150" cy="${y - 11}" r="7" fill="${RING}"/>` : ""}<text x="180" y="${y}" font-family="${FONT}" font-size="42" fill="#d6e1ea">${esc(ln)}</text>`; y += 56; }); y += 14; });
  svg += `<text x="140" y="${H - 60}" font-family="${FONT}" font-size="24" fill="#f6b84e">Explanation card: not a screen capture</text><text x="${W - 60}" y="${H - 60}" font-family="${FONT}" font-size="22" fill="#6f8294" text-anchor="end">${esc(chapterLabel)}</text></svg>`;
  return svg;
}
async function composeCard(slide, chapterLabel) { return sharp(Buffer.from(cardSvg(slide, chapterLabel))).ensureAlpha(); }

const rawOf = async (pipeline) => new Uint8Array(await pipeline.ensureAlpha().raw().toBuffer());
function blend(a, b, t) { const o = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) o[i] = (a[i] * (1 - t) + b[i] * t) | 0; return o; }

const dwellFor = (slide) => { const chars = slide.type === "card" ? slide.card.lines.join(" ").length + slide.card.title.length : slide.s.caption.length + slide.s.title.length; return Math.max(slide.type === "card" ? 7 : 8, Math.min(26, 4 + chars / 13)); };

async function buildChapter(ch, slides, outDir) {
  const label = ch === 1 ? "Chapter 1 · Quick Add" : "Chapter 2 · Add Item";
  fs.mkdirSync(outDir, { recursive: true }); fs.mkdirSync(path.join(outDir, "screenshots"), { recursive: true });
  const enc = await HME.createH264MP4Encoder(); enc.width = W; enc.height = H; enc.frameRate = FPS; enc.quantizationParameter = 28; enc.groupOfPictures = 240; enc.initialize();
  let prev = null; let tMs = 0; const cues = []; const index = []; let frames = 0;
  for (const slide of slides) {
    const dwell = dwellFor(slide); const holdFrames = Math.round(dwell * FPS);
    let anim = [];
    if (slide.type === "card") anim = [await rawOf(await composeCard(slide, label))];
    else { const ks = [1.14, 1.09, 1.05, 1.025, 1]; for (const k of ks) anim.push(await rawOf(await composeStep(slide, k, label))); }
    // a still of the final frame for the screenshots folder (annotated, numbered)
    const last = anim[anim.length - 1];
    if (slide.type === "step") {
      const png = await sharp(Buffer.from(last.buffer), { raw: { width: W, height: H, channels: 4 } }).jpeg({ quality: 88 }).toBuffer();
      const name = `${ch}.${String(slide.n).padStart(2, "0")}-${slide.s.id}.jpg`;
      fs.writeFileSync(path.join(outDir, "screenshots", name), png);
      slide.shot = name;
    }
    // frames: crossfade from the previous slide over 3 frames, then the animation, then hold
    let count = 0;
    const emit = (f) => { enc.addFrameRgba(f); count++; frames++; };
    if (prev) for (let i = 1; i <= 3; i++) emit(blend(prev, anim[0], i / 4));
    for (const f of anim) emit(f);
    while (count < holdFrames) emit(last);
    const startMs = tMs; const durMs = Math.round(count / FPS * 1000); tMs += durMs;
    prev = last;
    const text = slide.type === "card" ? `${slide.card.kicker}: ${slide.card.title}. ${slide.card.lines.join(" ")}` : `Step ${slide.n}. ${slide.s.title}. ${slide.s.caption}${slide.s.simulated ? " (Simulated: " + slide.s.simulated + ")" : ""}`;
    cues.push({ startMs, endMs: tMs, text }); index.push({ ...slide, startMs, endMs: tMs });
    process.stdout.write(`\r${label}: ${index.length}/${slides.length} slides, ${(tMs / 1000).toFixed(0)} s   `);
  }
  enc.finalize();
  const base = ch === 1 ? "chapter-1-quick-add" : "chapter-2-add-item";
  fs.writeFileSync(path.join(outDir, base + ".mp4"), Buffer.from(enc.FS.readFile(enc.outputFilename))); enc.delete();
  const vtt = "WEBVTT\n\n" + cues.map((c, i) => `${ts(c.startMs)} --> ${ts(c.endMs)}\n${wrap(c.text, 80).join("\n")}\n`).join("\n");
  const srt = cues.map((c, i) => `${i + 1}\n${ts(c.startMs, ",")} --> ${ts(c.endMs, ",")}\n${wrap(c.text, 80).join("\n")}\n`).join("\n");
  fs.writeFileSync(path.join(outDir, base + ".vtt"), vtt); fs.writeFileSync(path.join(outDir, base + ".srt"), srt);
  const first = index.find((x) => x.type === "step");
  const thumb = await rawOf(await composeStep(first, 1, label)); await sharp(Buffer.from(thumb.buffer), { raw: { width: W, height: H, channels: 4 } }).jpeg({ quality: 88 }).toFile(path.join(outDir, base + "-thumbnail.jpg"));
  console.log(`\n${label}: ${frames} frames, ${(tMs / 1000).toFixed(1)} s`);
  fs.writeFileSync(path.join(outDir, base + ".timeline.json"), JSON.stringify(index.map((x) => ({ type: x.type, n: x.n || null, key: x.key, section: x.section, startMs: x.startMs, endMs: x.endMs, shot: x.shot || null })), null, 1));
  return { base, durationMs: tMs, index };
}

(async () => {
  const all = expand();
  const results = {};
  for (const ch of [1, 2]) {
    if (ONLY && ONLY !== ch) continue;
    const slides = all.filter((s) => s.chapter === ch);
    results[ch] = await buildChapter(ch, slides, path.join(OUT_ROOT, ch === 1 ? "chapter-1-quick-add" : "chapter-2-add-item"));
  }
  fs.writeFileSync(path.join(OUT_ROOT, "build-result.json"), JSON.stringify(Object.fromEntries(Object.entries(results).map(([k, v]) => [k, { base: v.base, durationMs: v.durationMs, slides: v.index.length }])), null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
