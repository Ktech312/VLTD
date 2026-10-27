// Assembles the Quick Add package from the rendered cuts: re-encodes each (libx264, keyframe every 2 s, no audio), copies the approved combined video unchanged,
// writes clearly named files into how-to/ and promo/, and builds the one local preview page + README + durations.
//   node build-package.cjs <renderDir> <packageDir>
const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const crypto = require("crypto");
const [RENDER, PKG] = process.argv.slice(2);
const SCRATCH = "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/tut";
const FF = require(SCRATCH + "/ff/node_modules/ffmpeg-static");
const APPROVED = path.join(__dirname, "..", "quick-add");
const mmss = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const sha = (f) => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
for (const d of ["how-to", "promo"]) fs.mkdirSync(path.join(PKG, d), { recursive: true });

// name in package -> source
const CUTS = [
  { id: "combined", dir: "how-to", base: "quick-add-howto-combined-landscape", kind: "Combined how-to", orient: "landscape 16:9", approved: true },
  { id: "desktop", dir: "how-to", base: "quick-add-howto-desktop-landscape", kind: "Desktop how-to", orient: "landscape 16:9", src: "desktop" },
  { id: "phone", dir: "how-to", base: "quick-add-howto-phone-portrait", kind: "Phone how-to", orient: "portrait 9:16", src: "phone" },
  { id: "promo", dir: "promo", base: "quick-add-promo-portrait", kind: "Promotional cut", orient: "portrait 9:16", src: "promo" },
];
const info = {};
for (const c of CUTS) {
  const out = path.join(PKG, c.dir, c.base);
  let tl;
  if (c.approved) {
    fs.copyFileSync(path.join(APPROVED, "quick-add-v3.mp4"), out + ".mp4");
    fs.copyFileSync(path.join(APPROVED, "quick-add-v3.srt"), out + ".srt");
    fs.copyFileSync(path.join(APPROVED, "quick-add-v3.vtt"), out + ".vtt");
    fs.copyFileSync(path.join(APPROVED, "quick-add-v3-thumbnail.jpg"), out + "-thumbnail.jpg");
    tl = JSON.parse(fs.readFileSync(path.join(APPROVED, "quick-add-v3.timeline.json"), "utf8"));
    if (sha(out + ".mp4") !== sha(path.join(APPROVED, "quick-add-v3.mp4"))) throw new Error("combined copy differs from the approved file");
  } else {
    const r = path.join(RENDER, c.src, `quick-add-${c.src}`);
    cp.execFileSync(FF, ["-y", "-loglevel", "error", "-i", r + ".raw.mp4", "-an", "-c:v", "libx264", "-crf", "21", "-g", "24", "-keyint_min", "24", "-sc_threshold", "0", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out + ".mp4"]);
    fs.copyFileSync(r + ".srt", out + ".srt"); fs.copyFileSync(r + ".vtt", out + ".vtt"); fs.copyFileSync(r + "-thumbnail.jpg", out + "-thumbnail.jpg");
    tl = JSON.parse(fs.readFileSync(r + ".timeline.json", "utf8"));
  }
  const total = tl[tl.length - 1].endMs;
  const probe = (() => { try { cp.execFileSync(FF, ["-i", out + ".mp4"], { encoding: "utf8", stdio: "pipe" }); } catch (e) { return String(e.stderr); } return ""; })();
  const dim = /(\d{3,4})x(\d{3,4})/.exec(probe.split("Video:")[1] || "");
  info[c.id] = { ...c, tl, total, bytes: fs.statSync(out + ".mp4").size, audio: /Audio:/.test(probe), w: dim && +dim[1], h: dim && +dim[2], sha: sha(out + ".mp4") };
  console.log(c.id, mmss(total), info[c.id].w + "x" + info[c.id].h, "audio:", info[c.id].audio, (info[c.id].bytes / 1e6).toFixed(1) + " MB");
}
fs.writeFileSync(path.join(PKG, "package-manifest.json"), JSON.stringify(Object.fromEntries(Object.entries(info).map(([k, v]) => [k, { file: `${v.dir}/${v.base}.mp4`, orientation: v.orient, duration: mmss(v.total), seconds: +(v.total / 1000).toFixed(1), width: v.w, height: v.h, audio: v.audio, mb: +(v.bytes / 1e6).toFixed(2), sha256: v.sha }])), null, 1));

const css = `
:root{color-scheme:dark;--bg:#0b1117;--card:#111a22;--ink:#e8eef5;--mute:#93a4b4;--line:#223140;--accent:#22d3ee}
@media (prefers-color-scheme: light){:root:not([data-theme="dark"]){color-scheme:light;--bg:#f4f7fa;--card:#ffffff;--ink:#14202b;--mute:#53667a;--line:#d5dee7;--accent:#0b7f95}}
:root[data-theme="light"]{color-scheme:light;--bg:#f4f7fa;--card:#ffffff;--ink:#14202b;--mute:#53667a;--line:#d5dee7;--accent:#0b7f95}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,"Segoe UI",Arial,sans-serif}
main{max-width:1040px;margin:0 auto;padding-block:24px 72px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
h1{font-size:28px;margin:0 0 6px;text-wrap:balance}h2{font-size:21px;margin:34px 0 8px}h3{font-size:17px;margin:0 0 4px}
p{max-width:72ch}.mute{color:var(--mute);font-size:14px}
video{width:100%;max-width:100%;border-radius:12px;background:#000;display:block}
.land video{aspect-ratio:16/9}.port video{aspect-ratio:9/16;max-height:78vh;margin:0 auto}
.box{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:14px 0}
.pill{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:1px 12px;font-size:13px;color:var(--mute);margin:0 6px 6px 0}
.grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))}
.cut{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.files a{display:inline-block;margin:2px 10px 2px 0;color:var(--accent);word-break:break-all}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;vertical-align:top;padding:6px 8px;border-top:1px solid var(--line)}th{color:var(--mute);font-weight:600;font-size:12px}
td.t{color:var(--accent);font-weight:700;white-space:nowrap}
.tw{overflow-x:auto}
ul,ol{padding-left:1.2em;max-width:76ch}li{margin:5px 0}
details{margin-top:10px}summary{cursor:pointer;color:var(--accent);font-weight:600}
code{font-size:13px;word-break:break-all}
`;
const filesLine = (c) => `<div class="files mute">${["mp4", "-thumbnail.jpg", "srt", "vtt"].map((ext) => { const f = `${c.dir}/${c.base}${ext.startsWith("-") ? ext : "." + ext}`; return `<a href="${f}">${path.basename(f)}</a>`; }).join("")}</div>`;
const scenes = (c) => `<details><summary>Scene by scene (${c.tl.length})</summary><div class="tw"><table><tr><th>Time</th><th>Title</th><th>Caption</th></tr>${c.tl.map((b) => `<tr><td class="t">${mmss(b.startMs)}</td><td>${esc(b.title)}</td><td>${esc(b.caption)}</td></tr>`).join("")}</table></div></details>`;
const card = (c, blurb, cls) => `<div class="cut ${cls}"><h3>${esc(c.kind)} <span class="mute">· ${esc(c.orient)} · ${mmss(c.total)}</span></h3><video controls preload="metadata" poster="${c.dir}/${c.base}-thumbnail.jpg"><source src="${c.dir}/${c.base}.mp4" type="video/mp4">Your browser cannot play this video.</video><p class="mute" style="margin:8px 0 4px">${blurb}</p>${filesLine(c)}${scenes(c)}</div>`;
const I = info;
const body = `<main>
<h1>Quick Add package: how-to cuts and promo</h1>
<p><span class="pill">Local preview, not published</span><span class="pill">Captions burned in, plus .srt and .vtt</span><span class="pill">No audio, no voice</span><span class="pill">Add Item still paused</span></p>
<p>Four Quick Add videos, all from the approved v3 footage. How-to and promotional files are kept in separate folders: <code>how-to/</code> and <code>promo/</code>. Open this page from the folder (<code>quick-add-package/index.html</code>); every link is relative.</p>

<h2>How-to videos</h2>
<div class="grid">
${card(I.combined, `The approved video, <strong>byte-for-byte unchanged</strong> (same file as <code>quick-add/quick-add-v3.mp4</code>, checked by hash). Desktop journey plus a 28-second phone section.`, "land")}
${card(I.desktop, `Desktop only. Home, Quick Add, capture, review, name, save, item in the Vault. The phone section is removed; nothing else in it changed from the approved video.`, "land")}
</div>
<div class="grid" style="margin-top:16px">
${card(I.phone, `Phone only, built for a portrait screen. Home, tap Quick Add, camera permission (including what to do if you chose Block), Universe, Category, photographing, Finished, review, fixing a category, naming, Save, back in the Vault. It stands alone: it does not point to the desktop video.`, "port")}
</div>

<h2>Promotional cut</h2>
<div class="grid">
${card(I.promo, `Portrait, ${mmss(I.promo.total)}. Photograph, review, save, then the organized result, ending on the VLTD logo and vltd.app. It shows only what Quick Add does today: no AI, no automatic identification, no pricing or plan claims.`, "port")}
<div class="cut"><h3>What the promo uses</h3><ul>
<li>Phone captures (Home, camera, review, Verify sheet) with the same highlights as the how-to.</li>
<li>One landscape crop of the verified desktop Vault screen (the three new items under their filter chips) as the "organized result". The phone Vault capture does not show the item cards.</li>
<li>The platinum VLTD logo from the site's brand folder on the end card, and a plain call to action. No new footage was captured.</li>
</ul></div>
</div>

<h2>What is new, and what is reused</h2>
<ul>
<li><strong>Reused unchanged:</strong> every screenshot, the caption wording, the highlight style (one highlight at a time, sliding between controls) and the dark caption styling. The desktop how-to is the approved video with the phone section cut out.</li>
<li><strong>Phone how-to, new layout only:</strong> portrait frame, the phone screen at full height, large caption text underneath. Five extra highlight positions (Universe and Category buttons, the Items count, and fields on the review and Verify sheets) were read from the same phone screenshots; the ring was checked against the picture in every case. No screen was recaptured for this package.</li>
<li><strong>Phone review step:</strong> the phone review screenshot lists items 1 to 3; the accidental fourth photo is scrolled out of view, so the caption says "scroll to find a bad shot". The review shows item 3 (the toy) as TCG, and the next step fixes it, matching the Verify sheet where it reads Pop Culture / Toys and Figures.</li>
<li><strong>Phone ending:</strong> the phone Vault screenshot shows Items 3 at the top, not the item cards, so the video ends there and says to scroll down.</li>
<li><strong>Length:</strong> the phone how-to is ${mmss(I.phone.total)}, shorter than the desktop how-to (${mmss(I.desktop.total)}) because the phone capture set has fewer screens (no Universe or Category menus, no saved message, no opened item). I did not recapture to pad it.</li>
</ul>

<h2>Honesty and checks</h2>
<ul>
<li>Made from screenshots of the live app with sample items and a test camera that shows fictional cards. They are not recordings of a person using the app. The browser's camera-permission prompt cannot be captured, so it is a card. The phone screens come from a phone-sized test browser.</li>
<li>No voice and no audio track in any file.</li>
<li>No AI is shown or implied anywhere in the promo or the how-to cuts. The words "scan", "identify" and "instantly" do not appear.</li>
<li><strong>Phone readability:</strong> the portrait videos are 1080 px wide. Shown full width on a 390-point phone, captions are about 19 pt (how-to) and 33 pt (promo headlines), titles about 25 pt, and the small section label about 12 pt. The landscape videos are meant for a computer screen.</li>
<li>Nothing was published. No app change, no paid service, no live Help change.</li>
</ul>

<h2>Files</h2>
<div class="box tw"><table>
<tr><th>Folder</th><th>File</th><th>Size</th><th>Length</th><th>Format</th></tr>
${CUTS.map((c) => `<tr><td>${c.dir}/</td><td>${c.base}.mp4</td><td>${(I[c.id].bytes / 1e6).toFixed(1)} MB</td><td>${mmss(I[c.id].total)}</td><td>${I[c.id].w}x${I[c.id].h}, ${esc(c.orient)}</td></tr>`).join("")}
</table></div>
<p class="mute">Each video also has a thumbnail (.jpg) and captions (.srt, .vtt) next to it. <code>package-manifest.json</code> lists exact durations, sizes and file hashes.</p>

<h2>What I need from you</h2>
<ul><li>Review the four videos. Approve them, or tell me what to change. Add Item stays paused until you say to proceed.</li></ul>
</main>`;
fs.writeFileSync(path.join(PKG, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Quick Add package</title><style>${css}</style></head><body>${body}</body></html>`);
console.log("page written");
