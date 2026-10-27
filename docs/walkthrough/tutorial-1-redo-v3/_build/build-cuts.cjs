// Quick Add package: three extra cuts made from the approved v3 footage (same verified captures, ring style and caption bar).
//   node build-cuts.cjs <desktop|phone|promo> <outDir>
//   desktop: the approved landscape video without the phone section (1920x1080)
//   phone:   a complete phone-only how-to, portrait (1080x1920), from the phone captures
//   promo:   15-25 s portrait cut: photograph, review, save, see the organized result, call to action (1080x1920)
// Screenshot-based video from real captures of the deployed app with synthetic data. No audio, no AI claims.
const fs = require("fs");
const path = require("path");
const sharp = require("C:/Users/EK/VLTD/node_modules/sharp");
const SCRATCH = "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/tut";
const HME = require(SCRATCH + "/enc/node_modules/h264-mp4-encoder");
const WORK = SCRATCH + "/work-merged";
const LOGO = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/public/brand/logo/vltd-logo-platinum.png";
const MODE = process.argv[2], OUT = process.argv[3];
if (!["desktop", "phone", "promo", "addsample"].includes(MODE) || !OUT) { console.error("usage: node build-cuts.cjs <desktop|phone|promo> <outDir>"); process.exit(2); }
const PORTRAIT = MODE === "phone" || MODE === "promo";
const W = PORTRAIT ? 1080 : 1920, H = PORTRAIT ? 1920 : 1080, FPS = 12, IMG_H = 760, BAR_H = 1080 - IMG_H;
const FONT = "Segoe UI, Arial, Helvetica, sans-serif";
const RING = "#22d3ee";
const LABEL = "Quick Add";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
function wrap(text, maxChars) { const words = String(text).split(/\s+/); const lines = []; let cur = ""; for (const w of words) { if ((cur + " " + w).trim().length > maxChars) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim(); } if (cur) lines.push(cur); return lines; }
const ts = (ms, sep = ".") => { const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, x = Math.floor(ms) % 1000; return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}${sep}${String(x).padStart(3, "0")}`; };
const rectOf = (m) => ({ x: m[0], y: m[1], w: m[2], h: m[3] });

// ---- v2's verified captures (+ the one corrected phone Verify capture, same override as the approved video)
const manifests = {};
for (const dir of fs.readdirSync(WORK)) { const f = path.join(WORK, dir, "manifest.json"); if (!fs.existsSync(f)) continue; const m = JSON.parse(fs.readFileSync(f, "utf8")); for (const s of m.steps) manifests[`${m.scene}/${s.id}`] = { ...s, scene: m.scene, phone: m.phone, W: m.W, H: m.H, DSF: m.DSF, dir: path.join(WORK, dir) }; }
const FIXDIR = SCRATCH + "/work-fix/q-phone-fix";
{
  const fm = JSON.parse(fs.readFileSync(path.join(FIXDIR, "manifest.json"), "utf8")); const st = fm.steps.find((x) => x.id === "verify");
  if (!st || st.verified === false || st.marks.length !== 2) throw new Error("replacement phone verify capture missing or unverified");
  manifests["q-phone/verify"] = { ...st, scene: "q-phone", phone: fm.phone, W: fm.W, H: fm.H, DSF: fm.DSF, dir: FIXDIR };
}
const SAVE_DESKTOP = rectOf([466, 563, 508, 44]);
const VAULT_ROW = rectOf([44, 535, 574, 281]);
// Rectangles read from the same screenshots (css px): the camera toolbar buttons and the item-3 fields on the phone Verify sheet, and the Items card on the phone Vault.
const PH_UNIVERSE = rectOf([11, 9, 95, 33]), PH_CATEGORY = rectOf([111, 9, 96, 33]), PH_SHUTTER = rectOf([161, 674, 68, 68]);
const PH_REV_HEAD = rectOf([20, 24, 296, 40]), PH_REV_U3 = rectOf([86, 410, 192, 46]), PH_REV_REMOVE1 = rectOf([288, 137, 69, 34]);
const PH_NAME3 = rectOf([86, 289, 272, 44]), PH_CATS3 = rectOf([86, 338, 272, 44]), PH_ITEMS = rectOf([165, 440, 138, 266]);

const Q = "q-desktop/", P = "q-phone/";
// ---- storyboards
const DESKTOP_ALL = [
  { img: Q + "home-entry-points", ring: 0, intro: { kicker: "Tutorial 1", title: "Quick Add", sub: "Take photos, review, name, save." }, section: "Open Quick Add", title: "Start on Home", caption: "Quick Add is in the top card on Home.", dur: 6 },
  { img: Q + "home-entry-points", ring: 0, fx: "press", section: "Open Quick Add", title: "Select Quick Add", caption: "Select it. The camera opens.", dur: 3.2 },
  { card: { kicker: "First time only", title: "Allow the camera", lines: ["Your browser asks to use the camera. Choose Allow.", "On a phone it may say While using the app."] }, dur: 5, section: "Open Quick Add" },
  { img: "x-denied/camera-blocked", ring: 0, section: "Open Quick Add", title: "If you chose Block", caption: "Quick Add says so. Allow the camera in your browser's site settings, then reopen it." },
  { img: Q + "quick-add-open", ring: null, section: "Set up, then shoot", title: "Quick Add is a camera", caption: "Set up first, then shoot." },
  { img: Q + "quick-add-open", ring: 2, num: 1, section: "Set up, then shoot", title: "Universe", caption: "Choose the type of collectible." },
  { img: Q + "quick-add-universe-menu", ring: 1, section: "Set up, then shoot", title: "Pick one, such as Sports", caption: "This is optional. You can change it later." },
  { img: Q + "quick-add-open", ring: 3, num: 2, section: "Set up, then shoot", title: "Category", caption: "Narrow it down if you want." },
  { img: Q + "quick-add-category-menu", ring: 0, section: "Set up, then shoot", title: "Pick a category", caption: "Also optional. You can still shoot without one.", dur: 4 },
  { img: Q + "quick-add-open", ring: 0, num: 3, section: "Set up, then shoot", title: "Take the photo", caption: "Tap the round button to photograph your item." },
  { img: Q + "photo-1-taken", ring: 1, section: "Set up, then shoot", title: "Photo captured", caption: "The counter goes up. The photo appears bottom left." },
  { img: Q + "photo-4-taken", ring: 0, num: 4, section: "Set up, then shoot", title: "One photo per item", caption: "Repeat for each item. When you are done, select Finished." },
  { img: Q + "review-your-drop", ring: 0, section: "Review", title: "Check your photos", caption: "Every photo is listed. Remove the accidental one." },
  { img: Q + "review-after-remove", ring: 0, section: "Review", title: "Three items remain", caption: "Undo is there if you change your mind." },
  { img: Q + "review-correct-category", ring: 1, section: "Review", title: "Fix a category", caption: "Item 3 is a toy. Change its Category to Toys and Figures." },
  { img: Q + "verify-names", ring: 1, section: "Name and save", title: "Name each item", caption: "Type a name for each item." },
  { img: Q + "verify-names", ring: 2, section: "Name and save", title: "Name each item", caption: "An item with no name is saved as Untitled Item." },
  { img: Q + "verify-cost", ring: 0, section: "Name and save", title: "Add what you know", caption: "Cost is what you paid. Leave it empty if unknown. Empty is not zero." },
  { img: Q + "verify-cost", ring: SAVE_DESKTOP, section: "Name and save", title: "Save", caption: "Select Save 3 items to Vault." },
  { img: Q + "saved-in-vault", ring: null, section: "Find your items", title: "Saved", caption: "A message confirms the save, and you land in your Vault." },
  { img: Q + "vault-new-items", ring: VAULT_ROW, section: "Find your items", title: "Your new items", caption: "All three are in the Vault, each with its photo." },
  { img: Q + "vault-search", ring: 0, section: "Find your items", title: "Find an item later", caption: "Type part of its name in the search box." },
  { img: Q + "item-opened", ring: 1, section: "Find your items", title: "Open it to check", caption: "The photo and details are exactly as you saved them." },
  { card: { kicker: "Recap", title: "You used Quick Add", lines: ["Open Quick Add from Home.", "One photo per item, then Finished.", "Remove bad photos, fix categories, name your items.", "Save, then find them in your Vault."] }, dur: 8, section: "Recap" },
];
const PHONE_HOWTO = [
  { img: P + "home-bar", ring: 0, intro: { kicker: "Tutorial 1", title: "Quick Add", sub: "on a phone" }, section: "Open Quick Add", title: "Start on Home", caption: "Quick Add is in the bar near the bottom of Home.", dur: 6 },
  { img: P + "home-bar", ring: 0, fx: "press", section: "Open Quick Add", title: "Tap Quick Add", caption: "Tap it. The camera opens.", dur: 3.4 },
  { card: { kicker: "First time only", title: "Allow the camera", lines: ["Your phone asks to use the camera. Choose Allow.", "It may say While using the app.", "If you chose Block, allow the camera in your browser's site settings, then reopen Quick Add."] }, dur: 8, section: "Open Quick Add" },
  { img: P + "quick-open", ring: PH_UNIVERSE, section: "Set up, then shoot", title: "Universe", caption: "Choose the type of collectible. This is optional." },
  { img: P + "quick-open", ring: PH_CATEGORY, section: "Set up, then shoot", title: "Category", caption: "Narrow it down if you want. Also optional." },
  { img: P + "quick-open", ring: PH_SHUTTER, section: "Set up, then shoot", title: "Take the photo", caption: "Tap the round button to photograph an item." },
  { img: P + "four-taken", ring: 0, section: "Set up, then shoot", title: "One photo per item", caption: "Repeat for each item. When you are done, tap Finished." },
  { img: P + "four-taken", ring: 1, section: "Set up, then shoot", title: "Or use the small picture", caption: "The small picture at the bottom left opens the review too." },
  { img: P + "review", ring: PH_REV_HEAD, section: "Review", title: "Check your photos", caption: "Every photo is listed. Scroll to find a bad shot and tap Remove." },
  { img: P + "review", ring: PH_REV_U3, section: "Review", title: "Fix a category", caption: "Item 3 is a toy, but it says TCG. Change its Universe and Category here." },
  { img: P + "verify", ring: PH_CATS3, section: "Name and save", title: "Check the category", caption: "Each item has its own Universe and Category. Fix any that are wrong." },
  { img: P + "verify", ring: PH_NAME3, section: "Name and save", title: "Name each item", caption: "Type a name for each item. An item with no name is saved as Untitled Item." },
  { img: P + "verify", ring: 1, section: "Name and save", title: "Save", caption: "Tap Save 3 items to Vault." },
  { img: P + "vault", ring: PH_ITEMS, section: "Find your items", title: "Saved", caption: "You land in your Vault. Items now shows 3. Scroll down to see them." },
  { card: { kicker: "Recap", title: "You used Quick Add", lines: ["Open Quick Add from Home.", "One photo per item, then Finished.", "Remove bad photos, fix categories, name your items.", "Save, then find them in your Vault."] }, dur: 8, section: "Recap" },
];
const PROMO = [
  { img: P + "home-bar", ring: 0, title: "Photograph your collectibles", caption: "Start from Home with Quick Add.", dur: 3.4 },
  { img: P + "four-taken", ring: PH_SHUTTER, title: "One photo per item", caption: "Tap the round button.", dur: 2.4 },
  { img: P + "four-taken", ring: 0, title: "Done? Tap Finished", caption: "Your photos are ready to review.", dur: 2.2 },
  { img: P + "review", ring: PH_REV_REMOVE1, title: "Review before you save", caption: "Remove any bad shot.", dur: 2.6 },
  { img: P + "verify", ring: PH_CATS3, title: "Name and categorize", caption: "Each item gets its own details.", dur: 3 },
  { img: P + "verify", ring: 1, title: "Save to your Vault", caption: "One tap saves them all.", dur: 2.4 },
  { img: Q + "vault-new-items", ring: null, title: "Organized in your Vault", caption: "Every item, with its photo.", dur: 3.6 },
  { end: { line1: "Quick Add", line2: "Photograph. Review. Save.", cta: "vltd.app" }, title: "Try Quick Add", caption: "vltd.app", dur: 3.2 },
];
// Add Item voice-sample footage (16 s, existing v2 captures): Home -> Add Item -> form; timed so both voice options fit the same cuts
const ADD_SAMPLE = [
  { img: "a-desktop/home-add-item", ring: 0, section: "Open Add Item", title: "Start on Home", caption: "Add Item is in the top card on Home.", dur: 3.6 },
  { img: "a-desktop/home-add-item", ring: 0, fx: "press", section: "Open Add Item", title: "Select Add Item", caption: "Select it. The form opens.", dur: 2.0 },
  { img: "a-desktop/form-overview", ring: 0, section: "The Add Item form", title: "Item name is required", caption: "It is the only required field.", dur: 3.2 },
  { img: "a-desktop/form-overview", ring: 1, section: "The Add Item form", title: "Add a photo and details", caption: "Add a photo, then fill in what you know.", dur: 3.2 },
  { img: "a-desktop/vault-after-save", ring: null, section: "Save", title: "Saved to your Vault", caption: "After you save, you land in your Vault.", dur: 4.0 },
];
const beats = MODE === "addsample" ? ADD_SAMPLE : MODE === "desktop" ? DESKTOP_ALL : MODE === "phone" ? PHONE_HOWTO : PROMO;

const words = (s) => String(s).trim().split(/\s+/).filter(Boolean).length;
for (const b of beats) {
  if (b.card || b.end) { b.dur = b.dur || 6; continue; }
  const s = manifests[b.img]; if (!s) throw new Error("no capture " + b.img);
  b.s = s;
  b.dur = b.dur || Math.max(3.8, 2.0 + words(b.caption) / 3.2);
  const m = b.ring === null ? null : (typeof b.ring === "number" ? s.marks[b.ring] : b.ring);
  if (b.ring !== null && !m) throw new Error("no mark " + b.ring + " on " + b.img);
  b.rect = m ? { x: m.x, y: m.y, w: m.w, h: m.h } : null;
}
// ---- desktop framing (identical to the approved video)
const CAMERA = rectOf([450, 0, 540, 900]), REVIEW = rectOf([450, 8, 540, 520]), VERIFY = rectOf([450, 8, 540, 620]);
const EXTRA = { [Q + "quick-add-open"]: CAMERA, [Q + "quick-add-universe-menu"]: CAMERA, [Q + "quick-add-category-menu"]: CAMERA, [Q + "photo-1-taken"]: CAMERA, [Q + "photo-4-taken"]: CAMERA, [Q + "review-your-drop"]: REVIEW, [Q + "review-after-remove"]: REVIEW, [Q + "review-correct-category"]: REVIEW, [Q + "verify-names"]: VERIFY, [Q + "verify-cost"]: VERIFY };
const FULL = new Set([Q + "item-opened"]);
const CROPS = { [Q + "home-entry-points"]: { x: 185, y: 0, w: 1070, h: 1070 / (1920 / IMG_H) }, "a-desktop/home-add-item": { x: 185, y: 0, w: 1070, h: 1070 / (1920 / IMG_H) } };
const rectsByImg = {};
for (const b of beats) if (b.img && b.rect) (rectsByImg[b.img] = rectsByImg[b.img] || []).push(b.rect);

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
// ---- portrait framing: a phone screenshot at full height, or a landscape crop of the desktop Vault result as a panel
const LAYOUT = MODE === "phone" ? { PH: 1240, top: 30 } : { PH: 1480, top: 380 };
const RESULT_CROP = { x: 30, y: 450, w: 700, h: 380 }; // css px of vault-new-items: filter chips + the three new items
const imCache = {};
async function imageFor(key, s) {
  if (imCache[key]) return imCache[key];
  const f = path.join(s.dir, s.file); const meta = await sharp(f).metadata(); const dsf = s.DSF;
  let im;
  if (PORTRAIT && s.phone) {
    const ph = LAYOUT.PH, pw = Math.round(ph * (s.W / s.H)); const x = Math.round((W - pw) / 2), top = LAYOUT.top;
    im = { kind: "phone", img: await sharp(f).resize(pw, ph).toBuffer(), pw, ph, x, top, map: { x: (v) => x + v * (pw / s.W), y: (v) => top + v * (ph / s.H), s: pw / s.W }, region: { x, y: top, w: pw, h: ph } };
  } else if (PORTRAIT) {
    const pw = 1000, ph = Math.round(pw * RESULT_CROP.h / RESULT_CROP.w); const x = Math.round((W - pw) / 2), top = Math.round(LAYOUT.top + (LAYOUT.PH - ph) / 2 - 120);
    const img = await sharp(f).extract({ left: Math.round(RESULT_CROP.x * dsf), top: Math.round(RESULT_CROP.y * dsf), width: Math.round(RESULT_CROP.w * dsf), height: Math.round(RESULT_CROP.h * dsf) }).resize(pw, ph).toBuffer();
    im = { kind: "panel", img, pw, ph, x, top, map: { x: (v) => x + (v - RESULT_CROP.x) * (pw / RESULT_CROP.w), y: (v) => top + (v - RESULT_CROP.y) * (pw / RESULT_CROP.w), s: pw / RESULT_CROP.w }, region: { x, y: top, w: pw, h: ph } };
  } else {
    const crop = CROPS[key] ? CROPS[key] : FULL.has(key) ? null : desktopCrop(s, (rectsByImg[key] || []).concat(EXTRA[key] ? [EXTRA[key]] : []));
    if (crop && crop.tall) {
      const mx = 90, my = 70; const cx0 = Math.max(0, crop.x0 - mx), cy0 = Math.max(0, crop.y0 - my), cx1 = Math.min(s.W, crop.x1 + mx), cy1 = Math.min(s.H, crop.y1 + my);
      const cw = cx1 - cx0, ch = cy1 - cy0; const sc = Math.min(1000 / ch, 1080 / cw); const pw = Math.round(cw * sc), ph = Math.round(ch * sc);
      const img = await sharp(f).extract({ left: Math.round(cx0 * dsf), top: Math.round(cy0 * dsf), width: Math.round((cx1 - cx0) * dsf), height: Math.round((cy1 - cy0) * dsf) }).resize(pw, ph).toBuffer();
      const top = Math.max(28, Math.round((H - ph) / 2));
      im = { kind: "dpanel", img, pw, ph, top, map: { x: (v) => 60 + (v - cx0) * sc, y: (v) => top + (v - cy0) * sc, s: sc }, region: { x: 60, y: top, w: pw, h: ph } };
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
  if (im.kind === "phone" || im.kind === "panel" || im.kind === "dpanel") {
    const rx = im.kind === "phone" ? 34 : 8;
    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${im.pw}" height="${im.ph}"><rect width="${im.pw}" height="${im.ph}" rx="${rx}" fill="#fff"/></svg>`);
    im.rounded = await sharp(im.img).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
    const fx = im.x !== undefined ? im.x : im.region.x;
    im.frame = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="${fx - 14}" y="${im.top - 14}" width="${im.pw + 28}" height="${im.ph + 28}" rx="${im.kind === "phone" ? 46 : 18}" fill="#111a22" stroke="#33485a" stroke-width="3"/></svg>`);
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

// opening title over the Home screen (fades out); a = 0..1
let CUR_INTRO = null;
function introSvg(a, im) {
  if (!a || a <= 0 || !CUR_INTRO) return "";
  const c = CUR_INTRO;
  if (PORTRAIT) {
    const w = im.pw - 44, h = 192, cx = im.x + im.pw / 2, y0 = Math.round(im.map.y(74));
    return `<g opacity="${a.toFixed(2)}"><rect x="${cx - w / 2}" y="${y0}" width="${w}" height="${h}" rx="24" fill="#06121a" fill-opacity=".92" stroke="#2b3a48" stroke-width="2"/><rect x="${cx - w / 2}" y="${y0}" width="${w}" height="6" rx="3" fill="${RING}"/>` +
      `<text x="${cx}" y="${y0 + 48}" font-family="${FONT}" font-size="28" font-weight="700" fill="${RING}" letter-spacing="3" text-anchor="middle">${esc(c.kicker.toUpperCase())}</text>` +
      `<text x="${cx}" y="${y0 + 120}" font-family="${FONT}" font-size="78" font-weight="800" fill="#f4f8fb" text-anchor="middle">${esc(c.title)}</text>` +
      `<text x="${cx}" y="${y0 + 170}" font-family="${FONT}" font-size="38" fill="#d3dee8" text-anchor="middle">${esc(c.sub)}</text></g>`;
  }
  const cx = W / 2, y0 = 128, w = 880, h = 214;
  return `<g opacity="${a.toFixed(2)}"><rect x="${cx - w / 2}" y="${y0}" width="${w}" height="${h}" rx="26" fill="#06121a" fill-opacity=".9" stroke="#2b3a48" stroke-width="2"/><rect x="${cx - w / 2}" y="${y0}" width="${w}" height="6" rx="3" fill="${RING}"/>` +
    `<text x="${cx}" y="${y0 + 56}" font-family="${FONT}" font-size="26" font-weight="700" fill="${RING}" letter-spacing="3" text-anchor="middle">${esc(c.kicker.toUpperCase())}</text>` +
    `<text x="${cx}" y="${y0 + 134}" font-family="${FONT}" font-size="80" font-weight="800" fill="#f4f8fb" text-anchor="middle">${esc(c.title)}</text>` +
    `<text x="${cx}" y="${y0 + 184}" font-family="${FONT}" font-size="34" fill="#d3dee8" text-anchor="middle">${esc(c.sub)}</text></g>`;
}

async function composeShot(b, st) {
  const s = b.s; CUR_INTRO = b.intro || null; const im = await imageFor(b.img, s); const layers = [];
  const sec = b.section ? b.section.toUpperCase() : "";
  if (PORTRAIT) {
    layers.push({ input: im.frame }); layers.push({ input: im.rounded, left: im.x, top: im.top });
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${ringSvg(im, st.rect, st.alpha, st.num, st.ripple)}${introSvg(st.intro, im)}`;
    if (MODE === "phone") {
      // caption area under the phone: section, title, caption (sized to read on a phone-width screen)
      const ty = im.top + im.ph + 62;
      svg += `<text x="60" y="${ty}" font-family="${FONT}" font-size="34" font-weight="700" fill="${RING}" letter-spacing="3">${esc(sec)}</text>`;
      let y = ty + 40; wrap(b.title, 24).forEach((l) => { svg += `<text x="60" y="${y + 42}" font-family="${FONT}" font-size="68" font-weight="700" fill="#f1f6fa">${esc(l)}</text>`; y += 78; });
      y += 10; wrap(b.caption, 34).slice(0, 4).forEach((l) => { svg += `<text x="60" y="${y + 34}" font-family="${FONT}" font-size="52" fill="#d3dee8">${esc(l)}</text>`; y += 64; });
    } else {
      // promo: big headline above the phone
      let y = 70; wrap(b.title, 19).slice(0, 2).forEach((l) => { svg += `<text x="${W / 2}" y="${y + 74}" font-family="${FONT}" font-size="92" font-weight="800" fill="#f4f8fb" text-anchor="middle">${esc(l)}</text>`; y += 100; });
      svg += `<text x="${W / 2}" y="${y + 56}" font-family="${FONT}" font-size="50" fill="${RING}" text-anchor="middle" font-weight="600">${esc(b.caption)}</text>`;
    }
    svg += "</svg>"; layers.push({ input: Buffer.from(svg) });
  } else if (im.kind === "dpanel") {
    layers.push({ input: im.frame }); layers.push({ input: im.rounded, left: im.region.x, top: im.top });
    const textX = Math.max(700, 60 + im.pw + 90); const maxChars = Math.floor((W - textX - 60) / 21);
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${ringSvg(im, st.rect, st.alpha, st.num, st.ripple)}`;
    svg += `<text x="${textX}" y="110" font-family="${FONT}" font-size="28" font-weight="700" fill="${RING}" letter-spacing="2">${esc(sec)}</text>`;
    let y = 150;
    wrap(b.title, Math.max(18, Math.floor((W - textX - 60) / 30))).forEach((l) => { svg += `<text x="${textX}" y="${y + 40}" font-family="${FONT}" font-size="62" font-weight="700" fill="#f1f6fa">${esc(l)}</text>`; y += 74; });
    y += 20; wrap(b.caption, maxChars).slice(0, 8).forEach((l) => { svg += `<text x="${textX}" y="${y + 30}" font-family="${FONT}" font-size="40" fill="#d3dee8">${esc(l)}</text>`; y += 54; });
    svg += tag("DESKTOP", W - 40, 40, "end") + introSvg(st.intro, im) + "</svg>";
    layers.push({ input: Buffer.from(svg) });
  } else {
    layers.push({ input: im.img, left: im.kind === "full" ? im.ox : 0, top: 0 });
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><g clip-path="inset(0 0 ${BAR_H}px 0)">${ringSvg(im, st.rect, st.alpha, st.num, st.ripple)}</g>${tag("DESKTOP", W - 30, 24, "end")}`;
    svg += `<g transform="translate(0 ${IMG_H})"><rect x="0" y="0" width="${W}" height="${BAR_H}" fill="#0c131a"/><rect x="0" y="0" width="${W}" height="3" fill="${RING}" fill-opacity=".7"/>`;
    let y = 54; svg += `<text x="60" y="${y}" font-family="${FONT}" font-size="24" font-weight="700" fill="${RING}" letter-spacing="2">${esc(sec)}</text>`; y += 64;
    wrap(b.title, 70).forEach((l) => { svg += `<text x="60" y="${y}" font-family="${FONT}" font-size="50" font-weight="700" fill="#f1f6fa">${esc(l)}</text>`; y += 58; });
    wrap(b.caption, 100).slice(0, 3).forEach((l) => { svg += `<text x="60" y="${y}" font-family="${FONT}" font-size="36" fill="#d3dee8">${esc(l)}</text>`; y += 46; });
    svg += `</g>${introSvg(st.intro, im)}</svg>`;
    layers.push({ input: Buffer.from(svg) });
  }
  return sharp({ create: { width: W, height: H, channels: 4, background: "#080c10" } }).composite(layers);
}
function cardSvg(b) {
  const c = b.card;
  if (PORTRAIT) {
    let y = 430;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#0a1017"/><rect x="0" y="0" width="${W}" height="8" fill="${RING}"/>`;
    svg += `<text x="70" y="${y - 80}" font-family="${FONT}" font-size="36" font-weight="700" fill="${RING}" letter-spacing="3">${esc(c.kicker.toUpperCase())}</text>`;
    wrap(c.title, 17).forEach((l) => { svg += `<text x="70" y="${y + 40}" font-family="${FONT}" font-size="92" font-weight="800" fill="#f4f8fb">${esc(l)}</text>`; y += 104; });
    y += 40;
    c.lines.forEach((l) => { wrap(l, 31).forEach((ln, i) => { svg += `${i === 0 ? `<circle cx="84" cy="${y - 14}" r="9" fill="${RING}"/>` : ""}<text x="120" y="${y}" font-family="${FONT}" font-size="50" fill="#d6e1ea">${esc(ln)}</text>`; y += 66; }); y += 22; });
    svg += `<text x="${W - 60}" y="${H - 70}" font-family="${FONT}" font-size="28" fill="#6f8294" text-anchor="end">${esc(LABEL)}</text></svg>`;
    return svg;
  }
  let y = 250;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#0a1017"/><rect x="0" y="0" width="${W}" height="6" fill="${RING}"/>`;
  svg += `<text x="140" y="170" font-family="${FONT}" font-size="34" font-weight="700" fill="${RING}" letter-spacing="3">${esc(c.kicker.toUpperCase())}</text>`;
  svg += `<text x="140" y="${y + 20}" font-family="${FONT}" font-size="104" font-weight="800" fill="#f4f8fb">${esc(c.title)}</text>`; y += 130;
  c.lines.forEach((l) => { wrap(l, 74).forEach((ln, i) => { svg += `${i === 0 ? `<circle cx="150" cy="${y - 11}" r="7" fill="${RING}"/>` : ""}<text x="180" y="${y}" font-family="${FONT}" font-size="42" fill="#d6e1ea">${esc(ln)}</text>`; y += 56; }); y += 14; });
  svg += `<text x="${W - 60}" y="${H - 60}" font-family="${FONT}" font-size="22" fill="#6f8294" text-anchor="end">${esc(LABEL)}</text></svg>`;
  return svg;
}
// promo end card: approved platinum VLTD logo, product line, simple call to action
async function endCardRaw(b) {
  const e = b.end; const logo = await sharp(LOGO).resize({ width: 760 }).png().toBuffer(); const lm = await sharp(logo).metadata();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><radialGradient id="g" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#16303d"/><stop offset="1" stop-color="#080c10"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/><rect x="0" y="0" width="${W}" height="8" fill="${RING}"/>` +
    `<text x="${W / 2}" y="${760 + lm.height}" font-family="${FONT}" font-size="104" font-weight="800" fill="#f4f8fb" text-anchor="middle">${esc(e.line1)}</text>` +
    `<text x="${W / 2}" y="${850 + lm.height}" font-family="${FONT}" font-size="56" fill="#d3dee8" text-anchor="middle">${esc(e.line2)}</text>` +
    `<rect x="${W / 2 - 330}" y="${980 + lm.height}" width="660" height="150" rx="75" fill="${RING}"/><text x="${W / 2}" y="${1076 + lm.height}" font-family="${FONT}" font-size="84" font-weight="800" fill="#06222b" text-anchor="middle">${esc(e.cta)}</text></svg>`;
  return sharp({ create: { width: W, height: H, channels: 4, background: "#080c10" } }).composite([{ input: Buffer.from(svg) }, { input: logo, left: Math.round((W - lm.width) / 2), top: 560 }]);
}
const rawOf = async (pipeline) => new Uint8Array(await pipeline.ensureAlpha().raw().toBuffer());
function blend(a, b, t) { const o = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) o[i] = (a[i] * (1 - t) + b[i] * t) | 0; return o; }
const lerpRect = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t });

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const enc = await HME.createH264MP4Encoder(); enc.width = W; enc.height = H; enc.frameRate = FPS; enc.quantizationParameter = 26; enc.groupOfPictures = 240; enc.initialize();
  let prev = null, prevB = null, tMs = 0, frames = 0; const index = []; const cues = [];
  for (let bi = 0; bi < beats.length; bi++) {
    const b = beats[bi]; const target = Math.round(b.dur * FPS); let count = 0;
    const emit = (f) => { enc.addFrameRgba(f); count++; frames++; };
    let last;
    if (b.card || b.end) {
      last = await rawOf(b.card ? sharp(Buffer.from(cardSvg(b))) : await endCardRaw(b));
      if (prev) for (let i = 1; i <= 4; i++) emit(blend(prev, last, i / 5));
      emit(last);
    } else {
      const sameImg = prevB && prevB.img === b.img && prevB.rect && b.rect;
      const base = { num: b.num, ripple: 0 };
      if (b.intro) {
        let lastKey = null, f = null;
        for (let i = 0; i < target; i++) {
          const t = i / FPS; const fade = smooth((t - 2.5) / 0.5);
          const ia = +(1 - fade).toFixed(2), ra = +fade.toFixed(2); const key = ia + "/" + ra;
          if (key !== lastKey) { f = await rawOf(await composeShot(b, { num: b.num, ripple: 0, rect: b.rect, alpha: ra, intro: ia })); lastKey = key; }
          emit(f);
        }
        last = await rawOf(await composeShot(b, { num: b.num, ripple: 0, rect: b.rect, alpha: 1 }));
      } else if (sameImg && b.fx === "press") {
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
    }
    while (count < target) emit(last);
    const startMs = tMs; tMs += Math.round(count / FPS * 1000);
    prev = last; prevB = (b.card || b.end) ? null : b;
    const text = b.card ? `${b.card.kicker}: ${b.card.title}. ${b.card.lines.join(" ")}` : b.end ? `${b.end.line1}. ${b.end.line2} ${b.end.cta}` : `${b.intro ? b.intro.kicker + ": " + b.intro.title + (MODE === "phone" ? " " + b.intro.sub : "") + ". " : ""}${b.title}. ${b.caption}`;
    cues.push({ startMs, endMs: tMs, text });
    index.push({ n: bi + 1, section: b.section || null, type: b.card ? "card" : b.end ? "end" : "shot", image: b.img || null, title: b.card ? b.card.title : b.end ? b.end.line1 : b.title, caption: b.card ? b.card.lines.join(" ") : b.end ? b.end.line2 + " " + b.end.cta : b.caption, startMs, endMs: tMs, ring: b.rect || null, fx: b.fx || null });
    process.stdout.write(`\r${MODE} ${bi + 1}/${beats.length} beats, ${(tMs / 1000).toFixed(0)} s   `);
  }
  enc.finalize();
  const base = `quick-add-${MODE}`;
  fs.writeFileSync(path.join(OUT, base + ".raw.mp4"), Buffer.from(enc.FS.readFile(enc.outputFilename))); enc.delete();
  const vtt = "WEBVTT\n\n" + cues.map((c) => `${ts(c.startMs)} --> ${ts(c.endMs)}\n${wrap(c.text, 60).join("\n")}\n`).join("\n");
  const srt = cues.map((c, i) => `${i + 1}\n${ts(c.startMs, ",")} --> ${ts(c.endMs, ",")}\n${wrap(c.text, 60).join("\n")}\n`).join("\n");
  fs.writeFileSync(path.join(OUT, base + ".vtt"), vtt); fs.writeFileSync(path.join(OUT, base + ".srt"), srt);
  fs.writeFileSync(path.join(OUT, base + ".timeline.json"), JSON.stringify(index, null, 1));
  const tb = beats[0]; const th = await rawOf(await composeShot(tb, { rect: tb.rect, alpha: 1, ripple: 0, intro: tb.intro ? 1 : 0 }));
  await sharp(Buffer.from(th.buffer), { raw: { width: W, height: H, channels: 4 } }).jpeg({ quality: 88 }).toFile(path.join(OUT, base + "-thumbnail.jpg"));
  console.log(`\n${MODE}: ${frames} frames at ${FPS} fps, ${(tMs / 1000).toFixed(1)} s`);
})().catch((e) => { console.error(e); process.exit(1); });
