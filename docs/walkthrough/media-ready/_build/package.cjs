// Packages built videos, subtitles, scripts, thumbnails and numbered screenshots into docs/walkthrough/media-ready
const fs = require("fs");
const path = require("path");
const sharp = require("C:/Users/EK/VLTD/node_modules/sharp");
const C = require("./content.cjs");
const { loadShot, SRC_W, SRC_H, autoRoi, rectFor, cropFor, panelFrame, withMarks } = require("./build.cjs");

const OUT = process.env.PKG_OUT || path.join(__dirname, "stage");
const BUILT = path.join(__dirname, "out");
const SHOTS = path.join(__dirname, "shots");
const LOGO = "C:/Users/EK/VLTD/marketing/logos/vltd-logo-platinum.png";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const mm = (s) => { s = Math.round(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

const TITLES = {
  "01-add-your-first-item": { yt: "How to add your first item to your VLTD Vault", desc: "Upload a photo, name your item, choose its category, add optional details, save it and open it again. A 2-minute start to your collection on VLTD." },
  "02-build-and-share-an-exhibition": { yt: "How to build and share an exhibition on VLTD", desc: "Create an exhibition, choose items from your Vault, save it, preview it as a visitor, choose who can see it and share the link." },
  "03-import-your-collection": { yt: "How to import your collection from a spreadsheet into VLTD", desc: "Choose a CSV or Excel file, check the summary, mapping and warnings, handle duplicates, confirm the import and see your items in your Vault." },
  "04-switch-personal-and-business": { yt: "Personal and Business profiles on VLTD: create one and switch", desc: "Create a Business profile, switch between Personal and Business, and see that each profile keeps its own separate collection." },
};

async function helpShot(step) {
  const PW = 1506, PH = 800, aspect = 1354 / 719;
  if (step.strip) {
    const s = await loadShot(step.shot); const [x, y, w, h] = step.strip;
    return sharp(s.raw, { raw: { width: s.w, height: s.h, channels: 3 } }).extract({ left: x, top: y, width: w, height: h }).resize(PW, Math.round(PW * h / w), { kernel: "lanczos3" }).jpeg({ quality: 92 }).toBuffer();
  }
  const sh = await loadShot(step.shot, aspect); const ar = autoRoi(step, sh);
  const roi = ar ? [ar[0], ar[1] + sh.oy, ar[2], ar[3]] : null;
  const r = roi ? rectFor(roi, aspect, sh.w, sh.h, 1, 0.5) : cropFor(null, aspect, sh.w, sh.h);
  let panel = await panelFrame(sh, r, PW, PH);
  panel = await withMarks(panel, PW, PH, step.marks, r, sh.oy, 10, 0);
  return sharp(panel, { raw: { width: PW, height: PH, channels: 3 } }).jpeg({ quality: 92 }).toBuffer();
}

async function thumb(title, shotName, dest, roi) {
  let s = await loadShot(shotName);
  if (roi) { const [x, y, w, h] = roi; const cw = Math.min(w, s.w - x), ch = Math.min(h, s.h - y); s = { raw: await sharp(s.raw, { raw: { width: s.w, height: s.h, channels: 3 } }).extract({ left: x, top: y, width: cw, height: ch }).raw().toBuffer(), w: cw, h: ch }; }
  const logo = await sharp(LOGO).resize({ height: 46 }).png().toBuffer();
  const img = await sharp(s.raw, { raw: { width: s.w, height: s.h, channels: 3 } }).resize(820, Math.round(820 * s.h / s.w)).png().toBuffer();
  const svg = `<svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0c0f14"/><stop offset="1" stop-color="#18202a"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="1220" y="80" font-size="22" letter-spacing="5" text-anchor="end" fill="#52D6F4" font-family="Segoe UI, Arial, sans-serif" font-weight="600">VLTD HELP</text>
    <text x="640" y="170" font-size="60" font-weight="700" fill="#eceef2" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif">${esc(title)}</text>
    <rect x="218" y="238" width="844" height="${Math.round(820 * s.h / s.w) + 24}" rx="10" fill="none" stroke="#2f3744" stroke-width="3"/>
  </svg>`;
  await sharp(Buffer.from(svg)).composite([{ input: logo, left: 60, top: 50 }, { input: img, left: 230, top: 250 }]).jpeg({ quality: 90 }).toFile(dest);
}

async function socialThumb(title, shotName, roi, dest) {
  const s = await loadShot(shotName);
  const [x, y, w0, h0] = roi || [0, 0, s.w, s.h]; const w = Math.min(w0, s.w - x), h = Math.min(h0, s.h - y);
  const ch = Math.round(900 * h / w);
  const crop = await sharp(s.raw, { raw: { width: s.w, height: s.h, channels: 3 } }).extract({ left: Math.round(x), top: Math.round(y), width: Math.round(w), height: Math.round(h) }).resize(900, ch).png().toBuffer();
  const logo = await sharp(LOGO).resize({ height: 70 }).png().toBuffer();
  const lines = []; let cur = "";
  for (const wd of title.split(/\s+/)) { if ((cur + " " + wd).trim().length > 18) { lines.push(cur); cur = wd; } else cur = (cur + " " + wd).trim(); }
  if (cur) lines.push(cur);
  const svg = `<svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#0c0f14"/>
    ${lines.map((l, i) => `<text x="540" y="${1380 + i * 100}" font-size="84" font-weight="700" fill="#eceef2" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif">${esc(l)}</text>`).join("")}</svg>`;
  await sharp(Buffer.from(svg)).composite([{ input: logo, left: 60, top: 100 }, { input: crop, left: 90, top: 300 + Math.round((900 - ch) / 2) }]).jpeg({ quality: 90 }).toFile(dest);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const meta = {};
  for (const f of fs.readdirSync(BUILT)) if (f.startsWith(".build-meta-")) Object.assign(meta, JSON.parse(fs.readFileSync(path.join(BUILT, f), "utf8")));

  const listing = [];
  for (const T of C.tutorials) {
    const dir = path.join(OUT, T.id);
    fs.mkdirSync(path.join(dir, "screenshots"), { recursive: true });
    for (const ext of ["mp4", "vtt", "srt"]) fs.copyFileSync(path.join(BUILT, T.id, `${T.file}.${ext}`), path.join(dir, `${T.file}.${ext}`));
    await thumb(T.title, T.thumb.shot, path.join(dir, "thumbnail.jpg"), T.thumb.roi);
    // numbered screenshots (unique, in step order)
    const seen = []; const shots = [];
    T.steps.forEach((s, i) => { shots.push({ n: i + 1, shot: s.shot, title: s.title, text: s.text, step: s }); });
    for (const sh of shots) {
      const name = `${String(sh.n).padStart(2, "0")}-${sh.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.jpg`;
      fs.writeFileSync(path.join(dir, "screenshots", name), await helpShot(sh.step));
      sh.file = `screenshots/${name}`;
    }
    const m = meta[T.id] || { cues: [], duration: 0 };
    // narration script
    let script = `# Narration script: ${T.title}\n\nLandscape tutorial · ${mm(m.duration)} · caption-led (no voice-over recorded). Read at an unhurried pace.\n\n**What you need:** ${T.needs.join("; ")}.\n\n`;
    script += `**[0:00] Intro** — ${T.title}. ${T.short}\n\n`;
    const stepCues = m.cues.filter((c, i) => i > 0 && i <= T.steps.length);
    T.steps.forEach((s, i) => { script += `**[${mm(stepCues[i] ? stepCues[i].s : 0)}] ${i + 1}. ${s.title}** — ${s.say}\n\n`; });
    script += `**[${mm(m.duration - 7)}] Wrap-up** — ${T.result.text} ${T.next}\n`;
    fs.writeFileSync(path.join(dir, "narration-script.md"), script);
    // title and description
    const chap = ["0:00 Introduction"].concat(T.steps.map((s, i) => `${mm(stepCues[i] ? stepCues[i].s - 0.6 : 0)} ${s.title}`));
    const td = `Suggested title (YouTube / Help):\n${TITLES[T.id].yt}\n\nShort title (Help section):\n${T.title}\n\nDescription:\n${TITLES[T.id].desc}\n\nWhat you need:\n${T.needs.map((n) => "- " + n).join("\n")}\n\nChapters:\n${chap.join("\n")}\n\nNotes:\n- Made from tested screenshots with step captions; there is no voice-over.\n- Captions are burned in; ${T.file}.vtt / .srt carry the same text.\n`;
    fs.writeFileSync(path.join(dir, "title-and-description.txt"), td);
    listing.push({ T, shots, duration: m.duration, dir });
  }

  // social
  const sdir = path.join(OUT, "social-vertical"); fs.mkdirSync(sdir, { recursive: true });
  const socialList = [];
  for (const S of C.social) {
    for (const ext of ["mp4", "vtt", "srt"]) fs.copyFileSync(path.join(BUILT, "social-vertical", `${S.file}.${ext}`), path.join(sdir, `${S.file}.${ext}`));
    await socialThumb(S.title, S.thumb.shot, S.thumb.roi, path.join(sdir, `${S.file}-thumbnail.jpg`));
    const m = meta[S.id] || { duration: 0 };
    const script = `# On-screen script: ${S.title}\n\nVertical 1080x1920 · ${mm(m.duration)} · captions only (no voice-over).\n\n- Hook: ${S.hook}\n${S.steps.map((s) => "- " + s.text.replace(/\s+/, ": ")).join("\n")}\n- End card: ${S.end}\n`;
    fs.writeFileSync(path.join(sdir, `${S.file}-script.md`), script);
    const caption = S.id === "add-it-to-your-vault"
      ? "Add it to your Vault: photo, details, save. Your collection, on the record. #VLTD #collectors"
      : "Turn your collection into an exhibition: select your items, preview it, share it. #VLTD #collectors";
    fs.writeFileSync(path.join(sdir, `${S.file}-title-and-description.txt`), `Title:\n${S.title}\n\nSuggested post text:\n${caption}\n\nNotes:\n- Built from tested screenshots, caption-led, no sound.\n- Ready to upload; nothing has been posted.\n`);
    socialList.push({ S, duration: m.duration });
  }
  fs.writeFileSync(path.join(__dirname, "package-listing.json"), JSON.stringify({ listing: listing.map((l) => ({ id: l.T.id, shots: l.shots, duration: l.duration })), socialList }, null, 1));
  console.log("packaged");
})();
