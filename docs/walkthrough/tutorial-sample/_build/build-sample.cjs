// Builds the ~30 second sample: one action at a time on the Quick Add camera screen, narration (free local Windows voice, no online service) timed to each highlight, burned-in captions,
// the result screen after each action, restrained crossfades, no production notes on screen. Output: MP4 (H.264 + AAC), SRT/VTT, thumbnail, narration text, claims.
//   node build-sample.cjs <outDir>
const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const SCR = "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/tut";
const sharp = require("C:/Users/EK/VLTD/node_modules/sharp");
const FFMPEG = require(SCR + "/ff/node_modules/ffmpeg-static");
const WORK = SCR + "/sample-work/sample";
const OUT = process.argv[2]; if (!OUT) { console.error("usage: node build-sample.cjs <outDir>"); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const W = 1920, H = 1080, FPS = 30, DSF = 3, SR = 44100;
const FONT = "Segoe UI, Arial, Helvetica, sans-serif";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ───────── the narration (matches the app; each claim is checked in capture-sample.cjs)
const LINES = [
  { id: "vo0", text: "Quick Add opens your camera. Set up first, then shoot." },
  { id: "vo1", text: "Choose the type of collectible you're adding." },
  { id: "vo2", text: "Choose a category if you want to narrow it further." },
  { id: "vo3", text: "Tap here to photograph your item. Repeat for each additional item." },
  { id: "vo4", text: "When you're done taking photos, select Finished to review them." },
  { id: "vo5", text: "Here you can check your photos, and the choices you made." },
];
const AUDIO = path.join(OUT, "_audio"); fs.mkdirSync(AUDIO, { recursive: true });
const linesJson = path.join(AUDIO, "lines.json"); fs.writeFileSync(linesJson, JSON.stringify(LINES));
const tts = cp.execFileSync("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(__dirname, "tts.ps1"), linesJson, AUDIO], { encoding: "utf8" });
console.log(tts.trim());
function readWav(file) {
  const b = fs.readFileSync(file); let p = 12, fmt = null, data = null;
  while (p + 8 <= b.length) { const id = b.toString("ascii", p, p + 4); const size = b.readUInt32LE(p + 4); if (id === "fmt ") fmt = { ch: b.readUInt16LE(p + 10), rate: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) }; if (id === "data") { data = b.subarray(p + 8, Math.min(b.length, p + 8 + size)); break; } p += 8 + size + (size % 2); }
  if (!fmt || !data || fmt.ch !== 1 || fmt.bits !== 16 || fmt.rate !== SR) throw new Error("unexpected wav format " + JSON.stringify(fmt));
  // trim the silence the voice leaves at both ends (keep a short natural margin) so scenes are timed to the speech itself
  const s16 = new Int16Array(data.buffer, data.byteOffset, Math.floor(data.length / 2)); let a = 0, z = s16.length - 1;
  while (a < z && Math.abs(s16[a]) < 250) a++; while (z > a && Math.abs(s16[z]) < 250) z--;
  const m = Math.round(0.05 * SR); a = Math.max(0, a - m); z = Math.min(s16.length - 1, z + m);
  const trimmed = Buffer.from(s16.buffer, s16.byteOffset + a * 2, (z - a + 1) * 2);
  return { pcm: trimmed, seconds: trimmed.length / 2 / SR };
}
const vo = Object.fromEntries(LINES.map((l) => [l.id, { ...l, ...readWav(path.join(AUDIO, l.id + ".wav")) }]));

// ───────── the scenes (A = highlight with narration, B = the action under way, C = the screen after the action)
const man = JSON.parse(fs.readFileSync(path.join(WORK, "manifest.json"), "utf8"));
const shotOf = (name) => { const s = man.steps.find((x) => x.file.replace(/^\d+-/, "").replace(/\.png$/, "") === name); if (!s) throw new Error("no shot " + name); return s; };
const TOP = [400, 0], BOTTOM = [400, 540]; const TOP_PAD = 64; // the top of the screen sits 64 px lower so a highlight on the toolbar is never against the frame edge
const SCENES = [
  { k: "intro", shot: "idle", crop: TOP, vo: "vo0" },
  { k: "1A", shot: "idle", crop: TOP, ring: [0], badge: 1, vo: "vo1" },
  { k: "1B", shot: "menu-universe", crop: TOP, ring: [0], badge: 1, dur: 1.5 },
  { k: "2A", shot: "after-universe", crop: TOP, ring: [0], badge: 2, vo: "vo2" },
  { k: "2B", shot: "menu-category", crop: TOP, ring: [0], badge: 2, dur: 1.5 },
  { k: "3A", shot: "after-category", crop: BOTTOM, ring: [0], badge: 3, vo: "vo3", capTop: true },
  { k: "3C", shot: "after-photo", crop: BOTTOM, ring: [0], badge: 3, dur: 2.0 },
  { k: "4A", shot: "after-photo", crop: TOP, ring: [1], badge: 4, vo: "vo4" },
  { k: "4C", shot: "review", crop: TOP, ring: [0, 1], badge: null, vo: "vo5" },
];
const PAD_AFTER = 0.45, LEAD = 0.15;
let t = 0;
for (const s of SCENES) { s.t0 = t; s.dur = s.vo ? vo[s.vo].seconds + LEAD + PAD_AFTER : s.dur; t += s.dur; s.t1 = t; if (s.vo) { s.voAt = s.t0 + LEAD; s.capFrom = s.t0 + 0.08; s.capTo = s.voAt + vo[s.vo].seconds + 0.3; } }
const TOTAL = t;
console.log("scenes:", SCENES.map((s) => `${s.k} ${s.dur.toFixed(1)}s`).join(" | "), "| total", TOTAL.toFixed(1), "s");

// ───────── drawing
const CY = "#22d3ee";
function wrap(text, n) { const w = text.split(/\s+/); const lines = []; let c = ""; for (const x of w) { if ((c + " " + x).trim().length > n) { lines.push(c); c = x; } else c = (c + " " + x).trim(); } if (c) lines.push(c); return lines; }
function overlaySvg(scene, step, withCaption) {
  const [x0, y0] = scene.crop || [0, 0]; const dy = scene.crop === TOP ? TOP_PAD : 0;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
  if (scene.ring) {
    const rs = scene.ring.map((i) => step.marks[i]);
    const ux0 = Math.min(...rs.map((r) => r.x)), uy0 = Math.min(...rs.map((r) => r.y)), ux1 = Math.max(...rs.map((r) => r.x + r.w)), uy1 = Math.max(...rs.map((r) => r.y + r.h));
    const pad = 8, rx = (ux0 - pad - x0) * DSF, ry = (uy0 - pad - y0) * DSF + dy, rw = (ux1 - ux0 + 2 * pad) * DSF, rh = (uy1 - uy0 + 2 * pad) * DSF;
    svg += `<defs><mask id="m"><rect width="${W}" height="${H}" fill="#fff"/><rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="22" fill="#000"/></mask></defs>`;
    svg += `<rect width="${W}" height="${H}" fill="#000" fill-opacity=".48" mask="url(#m)"/>`;
    svg += `<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="22" fill="none" stroke="#000" stroke-opacity=".5" stroke-width="14"/><rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" rx="22" fill="none" stroke="${CY}" stroke-width="8"/>`;
    if (scene.badge) svg += `<circle cx="${rx - 6}" cy="${ry - 6}" r="40" fill="${CY}" stroke="#000" stroke-opacity=".45" stroke-width="5"/><text x="${rx - 6}" y="${ry + 12}" font-family="${FONT}" font-size="50" font-weight="800" fill="#06222b" text-anchor="middle">${scene.badge}</text>`;
  }
  if (withCaption && scene.vo) {
    const lines = wrap(vo[scene.vo].text, 52); const fs = 56; const lh = 70; const bh = lines.length * lh + 44; const by = scene.capTop ? 56 : H - bh - 64;
    const bw = Math.max(...lines.map((l) => l.length)) * fs * 0.5 + 150 + (scene.badge ? 70 : 0); const bx = (W - bw) / 2;
    svg += `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="26" fill="#05090d" fill-opacity=".86"/>`;
    const tx = bx + 50 + (scene.badge ? 70 : 0);
    if (scene.badge) svg += `<circle cx="${bx + 58}" cy="${by + bh / 2}" r="28" fill="${CY}"/><text x="${bx + 58}" y="${by + bh / 2 + 12}" font-family="${FONT}" font-size="34" font-weight="800" fill="#06222b" text-anchor="middle">${scene.badge}</text>`;
    lines.forEach((l, i) => { svg += `<text x="${tx}" y="${by + 22 + lh * (i + 1) - 14}" font-family="${FONT}" font-size="${fs}" font-weight="600" fill="#f4f8fb">${esc(l)}</text>`; });
  }
  return svg + "</svg>";
}
async function baseImage(scene, step) {
  const png = path.join(WORK, step.file);
  if (scene.mode === "column") { // the whole camera screen, centred
    const col = await sharp(png).extract({ left: 450 * DSF, top: 0, width: 540 * DSF, height: 900 * DSF }).resize({ height: H }).toBuffer();
    const meta = await sharp(col).metadata();
    return sharp({ create: { width: W, height: H, channels: 4, background: "#0b0f14" } }).composite([{ input: col, left: Math.round((W - meta.width) / 2), top: 0 }]).png().toBuffer();
  }
  const [x0, y0] = scene.crop;
  if (scene.crop === TOP) { // content shifted down by TOP_PAD over the dark page colour
    const part = await sharp(png).extract({ left: x0 * DSF, top: 0, width: W, height: H - TOP_PAD }).png().toBuffer();
    return sharp({ create: { width: W, height: H, channels: 4, background: "#0b0f14" } }).composite([{ input: part, left: 0, top: TOP_PAD }]).png().toBuffer();
  }
  return sharp(png).extract({ left: x0 * DSF, top: y0 * DSF, width: W, height: H }).png().toBuffer();
}
const raw = async (pipeline) => new Uint8Array(await pipeline.ensureAlpha().raw().toBuffer());
async function render(scene, withCaption) {
  const step = shotOf(scene.shot); const base = await baseImage(scene, step);
  const comp = sharp(base).composite([{ input: Buffer.from(overlaySvg(scene, step, withCaption)) }]);
  return raw(comp);
}
const blend = (a, b, k) => { const o = new Uint8Array(a.length); for (let i = 0; i < a.length; i++) o[i] = (a[i] * (1 - k) + b[i] * k) | 0; return o; };

// ───────── audio track (the narration placed at each scene, silence elsewhere)
const total = Math.ceil(TOTAL * SR); const pcm = Buffer.alloc((total + SR) * 2);
for (const s of SCENES) if (s.vo) vo[s.vo].pcm.copy(pcm, Math.round(s.voAt * SR) * 2);
const hdr = Buffer.alloc(44); hdr.write("RIFF", 0); hdr.writeUInt32LE(36 + pcm.length, 4); hdr.write("WAVEfmt ", 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(1, 22); hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 2, 28); hdr.writeUInt16LE(2, 32); hdr.writeUInt16LE(16, 34); hdr.write("data", 36); hdr.writeUInt32LE(pcm.length, 40);
const wavPath = path.join(AUDIO, "narration-track.wav"); fs.writeFileSync(wavPath, Buffer.concat([hdr, pcm]));

(async () => {
  const mp4 = path.join(OUT, "sample-quick-add-camera.mp4");
  const ff = cp.spawn(FFMPEG, ["-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-r", String(FPS), "-i", "pipe:0", "-i", wavPath, "-t", String(TOTAL),
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-af", "loudnorm=I=-18:TP=-2:LRA=11", "-movflags", "+faststart", mp4], { stdio: ["pipe", "ignore", "pipe"] });
  let ffErr = ""; ff.stderr.on("data", (d) => { ffErr += d.toString(); });
  const done = new Promise((res, rej) => ff.on("close", (c) => (c === 0 ? res() : rej(new Error("ffmpeg " + c + ": " + ffErr.slice(-600))))));
  const write = (buf) => new Promise((res) => { if (ff.stdin.write(Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength))) res(); else ff.stdin.once("drain", res); });
  let prev = null; let frames = 0; const FADE = 8;
  for (const s of SCENES) {
    const noCap = await render(s, false); const cap = s.vo ? await render(s, true) : noCap;
    const n = Math.round(s.dur * FPS); const capFrom = s.vo ? Math.round((s.capFrom - s.t0) * FPS) : n; const capTo = s.vo ? Math.round((s.capTo - s.t0) * FPS) : n;
    for (let i = 0; i < n; i++) {
      let f = i >= capFrom && i < capTo ? cap : noCap;
      if (prev && i < FADE) f = blend(prev, f, (i + 1) / (FADE + 1));
      await write(f); frames++;
    }
    prev = noCap;
  }
  ff.stdin.end(); await done;
  // captions and the narration text
  const ts = (x, sep) => { const ms = Math.round(x * 1000); const p = (n, l = 2) => String(n).padStart(l, "0"); return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)}${sep}${p(ms % 1000, 3)}`; };
  const cues = SCENES.filter((s) => s.vo).map((s) => ({ a: s.voAt - 0.05, b: s.voAt + vo[s.vo].seconds + 0.25, text: vo[s.vo].text }));
  fs.writeFileSync(path.join(OUT, "sample-quick-add-camera.vtt"), "WEBVTT\n\n" + cues.map((c) => `${ts(c.a, ".")} --> ${ts(c.b, ".")}\n${c.text}\n`).join("\n"));
  fs.writeFileSync(path.join(OUT, "sample-quick-add-camera.srt"), cues.map((c, i) => `${i + 1}\n${ts(c.a, ",")} --> ${ts(c.b, ",")}\n${c.text}\n`).join("\n"));
  fs.writeFileSync(path.join(OUT, "narration.txt"), SCENES.filter((s) => s.vo).map((s) => `[${s.t0.toFixed(1)}s]${s.badge ? " (control " + s.badge + ")" : ""} ${vo[s.vo].text}`).join("\n") + "\n");
  const th = await render(SCENES[1], false); await sharp(Buffer.from(th.buffer), { raw: { width: W, height: H, channels: 4 } }).jpeg({ quality: 88 }).toFile(path.join(OUT, "sample-thumbnail.jpg"));
  fs.writeFileSync(path.join(OUT, "timeline.json"), JSON.stringify({ total: TOTAL, scenes: SCENES.map((s) => ({ k: s.k, shot: s.shot, t0: +s.t0.toFixed(2), t1: +s.t1.toFixed(2), vo: s.vo ? vo[s.vo].text : null, voSeconds: s.vo ? +vo[s.vo].seconds.toFixed(2) : null, badge: s.badge || null })) }, null, 1));
  console.log(`built ${mp4}: ${frames} frames, ${TOTAL.toFixed(1)} s, ${(fs.statSync(mp4).size / 1e6).toFixed(1)} MB`);
})().catch((e) => { console.error(e); process.exit(1); });
