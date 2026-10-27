// Revised Quick Add walkthrough (v3): an EDIT of v2, not a new production.
// Same screenshots (v2's verified capture set, "work-merged"), same caption bar and ring styling; the changes are the Home-first opening,
// shorter holds, shorter captions, ONE highlight at a time (ring slides from control to control), and no audio track.
//   node build-v3.cjs <outDir>
// Screenshot-based video made from real captures of the deployed app with synthetic data. Not a screen recording of a person using the app.
const fs = require("fs");
const path = require("path");
const sharp = require("C:/Users/EK/VLTD/node_modules/sharp");
const SCRATCH = "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/tut";
const HME = require(SCRATCH + "/enc/node_modules/h264-mp4-encoder");
const WORK = SCRATCH + "/work-merged";
const OUT = process.argv[2];
if (!OUT) { console.error("usage: node build-v3.cjs <outDir>"); process.exit(2); }

const W = 1920, H = 1080, FPS = 12, IMG_H = 760, BAR_H = H - IMG_H;
const FONT = "Segoe UI, Arial, Helvetica, sans-serif";
const RING = "#22d3ee";
const LABEL = "Quick Add";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
function wrap(text, maxChars) { const words = String(text).split(/\s+/); const lines = []; let cur = ""; for (const w of words) { if ((cur + " " + w).trim().length > maxChars) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim(); } if (cur) lines.push(cur); return lines; }
const ts = (ms, sep = ".") => { const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, x = Math.floor(ms) % 1000; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}${sep}${String(x).padStart(3, "0")}`; };
const rectOf = (m) => ({ x: m[0], y: m[1], w: m[2], h: m[3] });

// ---- v2's verified captures
const manifests = {};
for (const dir of fs.readdirSync(WORK)) { const f = path.join(WORK, dir, "manifest.json"); if (!fs.existsSync(f)) continue; const m = JSON.parse(fs.readFileSync(f, "utf8")); for (const s of m.steps) manifests[`${m.scene}/${s.id}`] = { ...s, scene: m.scene, phone: m.phone, W: m.W, H: m.H, DSF: m.DSF, dir: path.join(WORK, dir) }; }

// Save button on the Verify sheet (desktop). Measured from the live app's DOM in a one-off capture (rect [466,563,508,44], same position as in v2's verify-cost shot, where the button is visible).
const SAVE_DESKTOP = rectOf([466, 563, 508, 44]);
// The three new items as one row in the Vault (union of the three marked cards in v2's vault-new-items).
const VAULT_ROW = rectOf([44, 535, 574, 281]);

// ---- the edit: beats, in order. ring = index into v2's marked controls, or an explicit rect; num = the number shown on the ring (camera set-up order only)
const Q = "q-desktop/", P = "q-phone/";
const beats = [
  { card: { kicker: "Tutorial 1", title: "Quick Add", lines: ["Add several items fast: take photos, review, name, save.", "About 5 minutes. You type the details yourself.", "Made from screenshots of the live app, with sample items and a test camera."] }, dur: 6, section: "Start" },

  { img: Q + "home-entry-points", ring: 0, section: "Open Quick Add", title: "Start on Home", caption: "Quick Add is in the top card on Home." },
  { img: Q + "home-entry-points", ring: 0, fx: "press", section: "Open Quick Add", title: "Select Quick Add", caption: "Select it. The camera opens.", dur: 3.2 },
  { card: { kicker: "First time only", title: "Allow the camera", lines: ["Your browser asks to use the camera. Choose Allow.", "On a phone it may say While using the app."] }, dur: 5, section: "Open Quick Add" },
  { img: "x-denied/camera-blocked", ring: 0, section: "Open Quick Add", title: "If you chose Block", caption: "Quick Add says so. Allow the camera in your browser's site settings, then reopen it." },
  { img: Q + "quick-add-open", ring: null, section: "Set up, then shoot", title: "Quick Add is a camera", caption: "Set up first, then shoot." },

  { img: Q + "quick-add-open", ring: 2, num: 1, section: "Set up, then shoot", title: "Universe", caption: "Choose the type of collectible." },
  { img: Q + "quick-add-universe-menu", ring: 1, section: "Set up, then shoot", title: "Pick one, such as Sports", caption: "This is optional. You can change it later." },
  { img: Q + "quick-add-open", ring: 3, num: 2, section: "Set up, then shoot", title: "Category", caption: "Narrow it down if you want." },
  { img: Q + "quick-add-category-menu", ring: 0, section: "Set up, then shoot", title: "Pick a category", caption: "Also optional. You can still shoot without one.", dur: 4 },
  { img: Q + "quick-add-open", ring: 0, num: 3, section: "Set up, then shoot", title: "Take the photo", caption: "Tap the round button to photograph your item." },
  { img: Q + "photo-1-taken", ring: 1, section: "Set up, then shoot", title: "Your photo is saved", caption: "The counter goes up. The photo appears bottom left." },
  { img: Q + "photo-4-taken", ring: 0, num: 4, section: "Set up, then shoot", title: "One photo per item", caption: "Repeat for each item. When you are done, select Finished." },

  { img: Q + "review-your-drop", ring: 0, section: "Review", title: "Check your photos", caption: "Every photo is listed. Remove the accidental one." },
  { img: Q + "review-after-remove", ring: 0, section: "Review", title: "Three items remain", caption: "Undo is there if you change your mind." },
  { img: Q + "review-correct-category", ring: 1, section: "Review", title: "Fix a category", caption: "Item 3 is a toy. Change its Category to Toys and Figures." },

  { img: Q + "verify-names", ring: 1, section: "Name and save", title: "Name each item", caption: "Type a name for each item." },
  { img: Q + "verify-names", ring: 2, section: "Name and save", title: "Name each item", caption: "An item with no name is saved as Untitled Item." },
  { img: Q + "verify-cost", ring: 0, section: "Name and save", title: "Add what you know", caption: "Cost is what you paid. Leave it empty if unknown. Empty is not zero." },
  { card: { kicker: "Optional", title: "Identify with AI", lines: ["Some accounts have an Identify with AI button on this sheet.", "It never runs unless you press it, and it counts against your allowance.", "No button on your screen? Your account does not have AI. Type the details yourself."] }, dur: 8, section: "Name and save" },
  { img: Q + "verify-cost", ring: SAVE_DESKTOP, section: "Name and save", title: "Save", caption: "Select Save 3 items to Vault." },
  { img: Q + "saved-in-vault", ring: null, section: "Find your items", title: "Saved", caption: "A message confirms the save, and you land in your Vault." },
  { img: Q + "vault-new-items", ring: VAULT_ROW, section: "Find your items", title: "Your new items", caption: "All three are in the Vault, each with its photo." },
  { img: Q + "vault-search", ring: 0, section: "Find your items", title: "Find an item later", caption: "Type part of its name in the search box." },
  { img: Q + "item-opened", ring: 1, section: "Find your items", title: "Open it to check", caption: "The photo and details are exactly as you saved them." },

  { card: { kicker: "On a phone", title: "Same steps, new layout", lines: ["Quick Add sits in a bar near the bottom of Home.", "Recorded in a phone-sized test browser."] }, dur: 4.5, section: "On a phone" },
  { img: P + "home-bar", ring: 0, section: "On a phone", title: "Quick Add on a phone", caption: "Find Quick Add in the bar at the bottom of Home." },
  { img: P + "quick-open", ring: 1, section: "On a phone", title: "The camera fills the screen", caption: "Finished is at the top right." },
  { img: P + "four-taken", ring: 0, section: "On a phone", title: "Review your photos", caption: "Tap Finished, or the small picture at the bottom left." },
  { img: P + "verify", ring: 1, section: "On a phone", title: "Name, then save", caption: "Type a name for each item, then tap Save." },
  { img: P + "vault", ring: null, section: "On a phone", title: "Back in your Vault", caption: "Scroll down to see your new items." },

  { card: { kicker: "Recap", title: "You used Quick Add", lines: ["Open Quick Add from Home.", "One photo per item, then Finished.", "Remove bad photos, fix categories, name your items.", "Save, then find them in your Vault."] }, dur: 8, section: "Recap" },
];

// hold times: reading time for the caption plus a short pause; cards a little longer
const words = (s) => String(s).trim().split(/\s+/).filter(Boolean).length;
for (const b of beats) {
  if (b.card) { b.dur = b.dur || 6; continue; }
  const s = manifests[b.img]; if (!s) throw new Error("no capture " + b.img);
  b.s = s;
  b.dur = b.dur || Math.max(3.8, 2.0 + words(b.caption) / 3.2);
  const m = b.ring === null ? null : (typeof b.ring === "number" ? s.marks[b.ring] : b.ring);
  if (b.ring !== null && !m) throw new Error("no mark " + b.ring + " on " + b.img);
  b.rect = m ? { x: m.x, y: m.y, w: m.w, h: m.h } : null;
}
// crop for each image covers every ring used on it, so the picture does not jump while the ring moves
// framing per image: the whole camera column / the whole dialog is kept in view (so nothing is clipped), and Home and Vault pages are shown as whole screens
const CAMERA = rectOf([450, 0, 540, 900]), REVIEW = rectOf([450, 8, 540, 520]), VERIFY = rectOf([450, 8, 540, 620]);
const EXTRA = { [Q + "quick-add-open"]: CAMERA, [Q + "quick-add-universe-menu"]: CAMERA, [Q + "quick-add-category-menu"]: CAMERA, [Q + "photo-1-taken"]: CAMERA, [Q + "photo-4-taken"]: CAMERA, [Q + "review-your-drop"]: REVIEW, [Q + "review-after-remove"]: REVIEW, [Q + "review-correct-category"]: REVIEW, [Q + "verify-names"]: VERIFY, [Q + "verify-cost"]: VERIFY };
const FULL = new Set([Q + "item-opened"]);
// Home: the nav tabs and the whole top card in one view, so it reads as the Home page
const CROPS = { [Q + "home-entry-points"]: { x: 185, y: 0, w: 1070, h: 1070 / (W / IMG_H) } };
const rectsByImg = {};
for (const b of beats) if (b.img && b.rect) (rectsByImg[b.img] = rectsByImg[b.img] || []).push(b.rect);

// ---- drawing (v2's layouts)
function desktopCrop(s, marks) {
  const aspect = W / IMG_H; const vw = s.W, vh = s.H;
  if (!marks.length) return null;
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const m of marks) { x0 = Math.min(x0, m.x); y0 = Math.min(y0, m.y); x1 = Math.max(x1, m.x + m.w); y1 = Math.max(y1, m.y + m.h); }
  const bw = x1 - x0, bh = y1 - y0; const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let w = Math.max(bw + 320, (bh + 220) * aspect, 1000); w = Math.min(w, vw);
  if ((bh + 160) > Math.min(vh, w / aspect) || bw + 120 > w) return bw > 900 ? null : { tall: true, x0, y0, x1, y1 };
  let h = w / aspect; if (h > vh) { h = vh; w = h * aspect; }
  w = Math.min(w, vw); h = Math.min(h, vh);
  return { x: Math.max(0, Math.min(vw - w, cx - w / 2)), y: Math.max(0, Math.min(vh - h, cy - h / 2)), w, h };
}
const imCache = {};
async function imageFor(key, s) {
  if (imCache[key]) return imCache[key];
  const f = path.join(s.dir, s.file); const meta = await sharp(f).metadata(); const dsf = s.DSF;
  let im;
  if (s.phone) {
    const ph = H - 40, pw = Math.round(ph * (s.W / s.H));
    im = { kind: "phone", img: await sharp(f).resize(pw, ph).toBuffer(), pw, ph, top: 20, map: { x: (v) => 60 + v * (pw / s.W), y: (v) => 20 + v * (ph / s.H), s: pw / s.W }, region: { x: 60, y: 20, w: pw, h: ph } };
  } else {
    const crop = CROPS[key] ? CROPS[key] : FULL.has(key) ? null : desktopCrop(s, (rectsByImg[key] || []).concat(EXTRA[key] ? [EXTRA[key]] : []));
    if (crop && crop.tall) {
      const mx = 90, my = 70; const cx0 = Math.max(0, crop.x0 - mx), cy0 = Math.max(0, crop.y0 - my), cx1 = Math.min(s.W, crop.x1 + mx), cy1 = Math.min(s.H, crop.y1 + my);
      const cw = cx1 - cx0, ch = cy1 - cy0; const sc = Math.min(1000 / ch, 1080 / cw); const pw = Math.round(cw * sc), ph = Math.round(ch * sc);
      const img = await sharp(f).extract({ left: Math.round(cx0 * dsf), top: Math.round(cy0 * dsf), width: Math.round((cx1 - cx0) * dsf), height: Math.round((cy1 - cy0) * dsf) }).resize(pw, ph).toBuffer();
      const top = Math.max(28, Math.round((H - ph) / 2));
      im = { kind: "panel", img, pw, ph, top, map: { x: (v) => 60 + (v - cx0) * sc, y: (v) => top + (v - cy0) * sc, s: sc }, region: { x: 60, y: top, w: pw, h: ph } };
    } else if (!crop) {
      const ih = IMG_H, iw = Math.round(ih * (s.W / s.H)); const ox = Math.round((W - iw) / 2);
      im = { kind: "full", img: await sharp(f).resize(iw, ih).toBuffer(), ox, iw, ih, map: { x: (v) => ox + v * (iw / s.W), y: (v) => v * (ih / s.H), s: iw / s.W }, region: { x: ox, y: 0, w: iw, h: ih } };
    } else {
      const left = Math.max(0, Math.min(meta.width - 2, Math.round(crop.x * dsf))), top = Math.max(0, Math.min(meta.height - 2, Math.round(crop.y * dsf)));
      const img = await sharp(f).extract({ left, top, width: Math.max(2, Math.min(meta.width - left, Math.round(crop.w * dsf))), height: Math.max(2, Math.min(meta.height - top, Math.round(crop.h * dsf))) }).resize(W, IMG_H, { fit: "fill" }).toBuffer();
      const sc = W / crop.w;
      im = { kind: "zoom", img, map: { x: (v) => (v - crop.x) * sc, y: (v) => (v - crop.y) * sc, s: sc }, region: { x: 0, y: 0, w: W, h: IMG_H } };
    }
  }
  if (im.kind === "phone" || im.kind === "panel") {
    const rx = im.kind === "phone" ? 34 : 8;
    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${im.pw}" height="${im.ph}"><rect width="${im.pw}" height="${im.ph}" rx="${rx}" fill="#fff"/></svg>`);
    im.rounded = await sharp(im.img).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
    im.frame = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="${im.region.x - 14}" y="${im.top - 14}" width="${im.pw + 28}" height="${im.ph + 28}" rx="${im.kind === "phone" ? 46 : 18}" fill="#111a22" stroke="#33485a" stroke-width="3"/></svg>`);
  }
  return (imCache[key] = im);
}

// one ring, a dim over everything else (so only one control is lit), optional number badge, optional press ripple
function ringSvg(im, rect, alpha, num, ripple) {
  if (!rect || alpha <= 0) return "";
  const map = im.map; const x = map.x(rect.x) - 10, y = map.y(rect.y) - 10, rw = rect.w * map.s + 20, rh = rect.h * map.s + 20;
  const R = im.region; let out = "";
  const hole = `M${x.toFixed(1)} ${(y + 14).toFixed(1)}a14 14 0 0 1 14-14h${(rw - 28).toFixed(1)}a14 14 0 0 1 14 14v${(rh - 28).toFixed(1)}a14 14 0 0 1-14 14h${(-(rw - 28)).toFixed(1)}a14 14 0 0 1-14-14z`;
  out += `<path fill="#000" fill-opacity="${(0.32 * alpha).toFixed(2)}" fill-rule="evenodd" d="M${R.x} ${R.y}h${R.w}v${R.h}h${-R.w}z ${hole}"/>`;
  out += `<g opacity="${alpha.toFixed(2)}"><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" rx="14" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="11"/><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" rx="14" fill="${ripple ? RING : "none"}" fill-opacity="${ripple ? (0.28 * (1 - ripple)).toFixed(2) : 0}" stroke="${RING}" stroke-width="6"/>`;
  if (num) out += `<circle cx="${(x - 4).toFixed(1)}" cy="${(y - 4).toFixed(1)}" r="23" fill="${RING}" stroke="#000" stroke-opacity=".5" stroke-width="3"/><text x="${(x - 4).toFixed(1)}" y="${(y + 5).toFixed(1)}" font-family="${FONT}" font-size="28" font-weight="700" fill="#06222b" text-anchor="middle">${num}</text>`;
  if (ripple) { const cx = x + rw / 2, cy = y + rh / 2; for (const d of [0, 0.3]) { const t = Math.max(0, Math.min(1, ripple - d)); if (t > 0) out += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(18 + 90 * t).toFixed(1)}" fill="none" stroke="${RING}" stroke-width="5" stroke-opacity="${(0.9 * (1 - t)).toFixed(2)}"/>`; } }
  out += "</g>";
  return out;
}
function tag(text, x, y, anchor = "start") { const w = text.length * 13 + 28; const rx = anchor === "end" ? x - w : x; return `<rect x="${rx}" y="${y}" width="${w}" height="38" rx="19" fill="#06121a" fill-opacity=".82" stroke="#2b3a48"/><text x="${rx + w / 2}" y="${y + 26}" font-family="${FONT}" font-size="21" font-weight="600" fill="#cfe3f1" text-anchor="middle">${esc(text)}</text>`; }
const footer = `Screenshots of the live app with sample items · ${LABEL}`;

async function composeShot(b, st) {
  const s = b.s; const im = await imageFor(b.img, s); const layers = [];
  const sec = b.section ? b.section.toUpperCase() : "";
  if (im.kind === "phone" || im.kind === "panel") {
    layers.push({ input: im.frame }); layers.push({ input: im.rounded, left: im.region.x, top: im.top });
    const textX = Math.max(700, 60 + im.pw + 90); const maxChars = Math.floor((W - textX - 60) / 21);
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${ringSvg(im, st.rect, st.alpha, st.num, st.ripple)}`;
    svg += `<text x="${textX}" y="110" font-family="${FONT}" font-size="28" font-weight="700" fill="${RING}" letter-spacing="2">${esc(sec)}</text>`;
    let y = 150;
    wrap(b.title, Math.max(18, Math.floor((W - textX - 60) / 30))).forEach((l) => { svg += `<text x="${textX}" y="${y + 40}" font-family="${FONT}" font-size="62" font-weight="700" fill="#f1f6fa">${esc(l)}</text>`; y += 74; });
    y += 20; wrap(b.caption, maxChars).slice(0, 8).forEach((l) => { svg += `<text x="${textX}" y="${y + 30}" font-family="${FONT}" font-size="40" fill="#d3dee8">${esc(l)}</text>`; y += 54; });
    svg += tag(s.phone ? "PHONE VIEW (phone-size test browser)" : "DESKTOP", W - 40, 40, "end");
    svg += `<text x="${W - 40}" y="${H - 22}" font-family="${FONT}" font-size="19" fill="#6f8294" text-anchor="end">${esc(footer)}</text></svg>`;
    layers.push({ input: Buffer.from(svg) });
  } else {
    layers.push({ input: im.img, left: im.kind === "full" ? im.ox : 0, top: 0 });
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><g clip-path="inset(0 0 ${BAR_H}px 0)">${ringSvg(im, st.rect, st.alpha, st.num, st.ripple)}</g>${tag("DESKTOP", W - 30, 24, "end")}`;
    svg += `<g transform="translate(0 ${IMG_H})"><rect x="0" y="0" width="${W}" height="${BAR_H}" fill="#0c131a"/><rect x="0" y="0" width="${W}" height="3" fill="${RING}" fill-opacity=".7"/>`;
    let y = 54; svg += `<text x="60" y="${y}" font-family="${FONT}" font-size="24" font-weight="700" fill="${RING}" letter-spacing="2">${esc(sec)}</text>`; y += 64;
    wrap(b.title, 70).forEach((l) => { svg += `<text x="60" y="${y}" font-family="${FONT}" font-size="50" font-weight="700" fill="#f1f6fa">${esc(l)}</text>`; y += 58; });
    wrap(b.caption, 100).slice(0, 3).forEach((l) => { svg += `<text x="60" y="${y}" font-family="${FONT}" font-size="36" fill="#d3dee8">${esc(l)}</text>`; y += 46; });
    svg += `<text x="${W - 40}" y="54" font-family="${FONT}" font-size="19" fill="#6f8294" text-anchor="end">${esc(footer)}</text></g></svg>`;
    layers.push({ input: Buffer.from(svg) });
  }
  return sharp({ create: { width: W, height: H, channels: 4, background: "#080c10" } }).composite(layers);
}
function cardSvg(b) {
  const c = b.card; let y = 250;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#0a1017"/><rect x="0" y="0" width="${W}" height="6" fill="${RING}"/>`;
  svg += `<text x="140" y="170" font-family="${FONT}" font-size="34" font-weight="700" fill="${RING}" letter-spacing="3">${esc(c.kicker.toUpperCase())}</text>`;
  svg += `<text x="140" y="${y + 20}" font-family="${FONT}" font-size="104" font-weight="800" fill="#f4f8fb">${esc(c.title)}</text>`; y += 130;
  c.lines.forEach((l) => { wrap(l, 74).forEach((ln, i) => { svg += `${i === 0 ? `<circle cx="150" cy="${y - 11}" r="7" fill="${RING}"/>` : ""}<text x="180" y="${y}" font-family="${FONT}" font-size="42" fill="#d6e1ea">${esc(ln)}</text>`; y += 56; }); y += 14; });
  svg += `<text x="${W - 60}" y="${H - 60}" font-family="${FONT}" font-size="22" fill="#6f8294" text-anchor="end">${esc(LABEL)}</text></svg>`;
  return svg;
}
const rawOf = async (pipeline) => new Uint8Array(await pipeline.ensureAlpha().raw().toBuffer());
function blend(a, b, t) { const o = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) o[i] = (a[i] * (1 - t) + b[i] * t) | 0; return o; }
const lerpRect = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t });

(async () => {
  fs.mkdirSync(path.join(OUT, "screenshots"), { recursive: true });
  const enc = await HME.createH264MP4Encoder(); enc.width = W; enc.height = H; enc.frameRate = FPS; enc.quantizationParameter = 26; enc.groupOfPictures = 240; enc.initialize();
  let prev = null, prevB = null, tMs = 0, frames = 0, shotNo = 0; const index = []; const cues = [];
  for (let bi = 0; bi < beats.length; bi++) {
    const b = beats[bi]; const target = Math.round(b.dur * FPS); let count = 0;
    const emit = (f) => { enc.addFrameRgba(f); count++; frames++; };
    let last;
    if (b.card) {
      last = await rawOf(sharp(Buffer.from(cardSvg(b))));
      if (prev) for (let i = 1; i <= 4; i++) emit(blend(prev, last, i / 5));
      emit(last);
    } else {
      const sameImg = prevB && prevB.img === b.img && prevB.rect && b.rect && !b.card;
      const base = { num: b.num, ripple: 0 };
      if (sameImg && b.fx === "press") {
        for (let i = 0; i <= 8; i++) emit(await rawOf(await composeShot(b, { ...base, rect: b.rect, alpha: 1, ripple: Math.max(0.02, i / 8) })));
        last = await rawOf(await composeShot(b, { ...base, rect: b.rect, alpha: 1 }));
      } else if (sameImg) {
        // the ring slides from the last control to this one: only one control is lit at any moment
        for (let i = 1; i <= 6; i++) emit(await rawOf(await composeShot(b, { ...base, rect: lerpRect(prevB.rect, b.rect, smooth(i / 6)), alpha: 1 })));
        last = await rawOf(await composeShot(b, { ...base, rect: b.rect, alpha: 1 }));
      } else {
        const first = await rawOf(await composeShot(b, { ...base, rect: b.rect, alpha: 0 }));
        if (prev) for (let i = 1; i <= 4; i++) emit(blend(prev, first, i / 5));
        emit(first);
        if (b.rect) for (let i = 1; i <= 5; i++) emit(await rawOf(await composeShot(b, { ...base, rect: b.rect, alpha: smooth(i / 5) })));
        last = await rawOf(await composeShot(b, { ...base, rect: b.rect, alpha: 1 }));
      }
      // numbered still of the final frame
      shotNo += 1; const name = `${String(shotNo).padStart(2, "0")}-${b.img.split("/")[1]}${b.num ? "-ring" + b.num : ""}${b.fx ? "-press" : ""}.jpg`;
      fs.writeFileSync(path.join(OUT, "screenshots", name), await sharp(Buffer.from(last.buffer), { raw: { width: W, height: H, channels: 4 } }).jpeg({ quality: 86 }).toBuffer());
      b.shot = name;
    }
    while (count < target) emit(last);
    const startMs = tMs; tMs += Math.round(count / FPS * 1000);
    prev = last; prevB = b.card ? null : b;
    const text = b.card ? `${b.card.kicker}: ${b.card.title}. ${b.card.lines.join(" ")}` : `${b.title}. ${b.caption}`;
    cues.push({ startMs, endMs: tMs, text });
    index.push({ n: bi + 1, section: b.section, type: b.card ? "card" : "shot", image: b.img || null, title: b.card ? b.card.title : b.title, caption: b.card ? b.card.lines.join(" ") : b.caption, startMs, endMs: tMs, still: b.shot || null, ring: b.rect ? b.rect : null, num: b.num || null, fx: b.fx || null });
    process.stdout.write(`\r${bi + 1}/${beats.length} beats, ${(tMs / 1000).toFixed(0)} s   `);
  }
  enc.finalize();
  fs.writeFileSync(path.join(OUT, "quick-add-v3.mp4"), Buffer.from(enc.FS.readFile(enc.outputFilename))); enc.delete();
  const vtt = "WEBVTT\n\n" + cues.map((c) => `${ts(c.startMs)} --> ${ts(c.endMs)}\n${wrap(c.text, 80).join("\n")}\n`).join("\n");
  const srt = cues.map((c, i) => `${i + 1}\n${ts(c.startMs, ",")} --> ${ts(c.endMs, ",")}\n${wrap(c.text, 80).join("\n")}\n`).join("\n");
  fs.writeFileSync(path.join(OUT, "quick-add-v3.vtt"), vtt); fs.writeFileSync(path.join(OUT, "quick-add-v3.srt"), srt);
  fs.writeFileSync(path.join(OUT, "quick-add-v3.timeline.json"), JSON.stringify(index, null, 1));
  const thumbBeat = beats.find((x) => x.img === Q + "home-entry-points");
  const th = await rawOf(await composeShot(thumbBeat, { rect: thumbBeat.rect, alpha: 1, ripple: 0 }));
  await sharp(Buffer.from(th.buffer), { raw: { width: W, height: H, channels: 4 } }).jpeg({ quality: 88 }).toFile(path.join(OUT, "quick-add-v3-thumbnail.jpg"));
  console.log(`\n${frames} frames at ${FPS} fps, ${(tMs / 1000).toFixed(1)} s (${Math.floor(tMs / 60000)}:${String(Math.round(tMs / 1000) % 60).padStart(2, "0")})`);
})().catch((e) => { console.error(e); process.exit(1); });
