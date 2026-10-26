// Writes the review package around the built videos: index.html (private preview), narration-script.md, VERIFICATION.md.
//   node build-preview.cjs <outRoot>
const fs = require("fs");
const path = require("path");
const SCRATCH = "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/tut";
const { cards, narration, sequence } = require("./content.cjs");
const OUT = process.argv[2];
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const manifests = {};
for (const dir of fs.readdirSync(SCRATCH + "/work")) { const f = path.join(SCRATCH, "work", dir, "manifest.json"); if (fs.existsSync(f)) { const m = JSON.parse(fs.readFileSync(f, "utf8")); for (const s of m.steps) manifests[`${m.scene}/${s.id}`] = { ...s, scene: m.scene, phone: m.phone }; } }
const chapters = [{ n: 1, base: "chapter-1-quick-add", title: "Chapter 1 — Quick Add" }, { n: 2, base: "chapter-2-add-item", title: "Chapter 2 — Add Item" }];
const fmt = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
const timelines = {}; for (const c of chapters) timelines[c.n] = JSON.parse(fs.readFileSync(path.join(OUT, c.base, c.base + ".timeline.json"), "utf8"));

// ---- narration script
let md = `# Narration script: Tutorial 1 (redo), Quick Add and Add Item\n\nSilent, captioned videos. This is the complete script for a voice-over to be recorded later by a person or a voice service the owner chooses. **No voice was generated.** Read at an unhurried pace. Times are where each part starts in the video.\n\n`;
for (const c of chapters) {
  md += `## ${c.title}\n\nVideo length ${fmt(timelines[c.n].slice(-1)[0].endMs)}.\n\n`;
  for (const t of timelines[c.n]) {
    if (t.type === "card") { const k = t.key; const card = cards[k]; md += `**[${fmt(t.startMs)}] ${card.kicker}: ${card.title}**\n\n${card.narration}\n\n`; }
    else { const s = manifests[t.key]; md += `**[${fmt(t.startMs)}] Step ${t.n}${t.section ? " · " + t.section : ""} — ${s.title}**${s.simulated ? "  _(simulated: " + s.simulated + ")_" : ""}\n\n${narration[t.key] || ""}\n\n`; }
  }
}
fs.writeFileSync(path.join(OUT, "narration-script.md"), md);

// ---- verification
let v = `# Verification record: every demonstrated instruction\n\nEach step below was performed on the deployed app (https://vltd.app) as an isolated synthetic collector, and a check ran at that moment. "Verified" means the check passed; the evidence column is what was read (page text, a link target, a form value or the saved database row). "Simulated" marks anything that is not a real recording of the app doing that thing.\n\n`;
let fails = 0, total = 0;
for (const c of chapters) {
  v += `## ${c.title}\n\n| # | Step | Scene | Verified | Evidence | Simulated |\n|---|---|---|---|---|---|\n`;
  for (const t of timelines[c.n]) {
    if (t.type !== "step") continue; const s = manifests[t.key]; total++; if (s.verified === false) fails++;
    v += `| ${c.n}.${t.n} | ${s.title.replace(/\|/g, "/")} | ${s.scene} | ${s.verified === null ? "n/a" : s.verified ? "yes" : "NO"} | ${String(s.evidence || "").replace(/\|/g, "/").replace(/\n/g, " ").slice(0, 170)} | ${s.simulated ? s.simulated.replace(/\|/g, "/") : ""} |\n`;
  }
  v += "\n";
}
v += `**Result: ${total - fails} of ${total} demonstrated steps verified.${fails ? " " + fails + " did not; see rows marked NO." : ""}**\n`;
fs.writeFileSync(path.join(OUT, "VERIFICATION.md"), v);

// ---- preview page
let html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tutorial 1 Preview</title>
<style>
:root{--bg:#0b1117;--card:#111a22;--ink:#e8eef5;--mute:#93a4b4;--line:#223140;--accent:#22d3ee;--warn:#f6b84e;--ok:#4ade80;--bad:#f87171}
@media (prefers-color-scheme: light){:root:not([data-theme="dark"]){--bg:#f4f7fa;--card:#fff;--ink:#14202b;--mute:#53667a;--line:#d5dee7;--accent:#0b7f95;--warn:#9a5b00;--ok:#15803d;--bad:#b91c1c}}
:root[data-theme="light"]{--bg:#f4f7fa;--card:#fff;--ink:#14202b;--mute:#53667a;--line:#d5dee7;--accent:#0b7f95;--warn:#9a5b00;--ok:#15803d;--bad:#b91c1c}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,Segoe UI,Arial,sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px 80px}h1{font-size:30px;margin:0 0 4px}h2{font-size:24px;margin:40px 0 8px}h3{margin:0}
.pill{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:2px 12px;font-size:13px;color:var(--mute);margin-right:6px}
.box{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin:16px 0}
.box.warn{border-color:var(--warn)}video{width:100%;border-radius:12px;background:#000;aspect-ratio:16/9}
.step{display:grid;grid-template-columns:minmax(0,420px) minmax(0,1fr);gap:18px;border-top:1px solid var(--line);padding:18px 0}
.step img{width:100%;border-radius:10px;border:1px solid var(--line)}.step .n{color:var(--accent);font-weight:700;font-size:13px;letter-spacing:.08em;text-transform:uppercase}
.sim{color:var(--warn);font-size:14px}.ok{color:var(--ok);font-weight:600}.bad{color:var(--bad);font-weight:700}.mute{color:var(--mute);font-size:14px}
details{margin-top:6px}summary{cursor:pointer;color:var(--accent)}
@media (max-width:760px){.step{grid-template-columns:1fr}}
a{color:var(--accent)}
</style></head><body><main>
<h1>Tutorial 1, redone: Quick Add and Add Item</h1>
<p><span class="pill">Private review preview</span><span class="pill">Not published</span><span class="pill">Silent, captioned</span></p>
<div class="box warn"><strong>How to read this honestly.</strong>
<ul><li>These videos are <strong>screenshots of the deployed app</strong> (captured with a synthetic collector), assembled with captions and highlights. They are not screen recordings of a person using the app.</li>
<li>The camera is a <strong>test camera</strong> that plays fictional pictures (a sports card, a trading card, a boxed toy, a comic cover). No real camera or real item was recorded. The browser's own camera-permission prompt cannot be captured, so an explanation card stands in for it.</li>
<li><strong>Nothing was identified by AI.</strong> The one AI screen shows the live server's real answer to an account without AI access (&ldquo;AI scans are not available on this account&rdquo;). No paid request was made.</li>
<li>Phone screens come from a phone-size test browser, not a physical phone.</li>
<li>The previous version of this tutorial is untouched at <code>docs/walkthrough/media-ready/01-add-your-first-item/</code>. Nothing here replaces the live Help tutorial.</li></ul></div>
<p>Files: <a href="narration-script.md">narration script</a> · <a href="VERIFICATION.md">verification record</a> · <a href="FINDINGS.md">defects and observations found while recording</a></p>`;
for (const c of chapters) {
  const tl = timelines[c.n]; const dur = fmt(tl.slice(-1)[0].endMs);
  html += `<h2>${esc(c.title)} <span class="mute">(${dur})</span></h2>
<video controls preload="metadata" poster="${c.base}/${c.base}-thumbnail.jpg"><source src="${c.base}/${c.base}.mp4" type="video/mp4"><track kind="captions" src="${c.base}/${c.base}.vtt" srcLang="en" label="English" default></video>
<p class="mute">Captions are burned into the picture and also provided as a caption track (VTT). Step list below: numbered screenshots with the same highlights.</p>`;
  for (const t of tl) {
    if (t.type === "card") { const cd = cards[t.key]; html += `<div class="step"><div><div class="n">${esc(cd.kicker)}</div><h3>${esc(cd.title)}</h3><ul>${cd.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul><div class="sim">Explanation card, not a screen capture</div></div><div><details><summary>Narration</summary><p>${esc(cd.narration)}</p></details><div class="mute">Starts at ${fmt(t.startMs)}</div></div></div>`; continue; }
    const s = manifests[t.key];
    html += `<div class="step"><div><img loading="lazy" src="${c.base}/screenshots/${t.shot}" alt="${esc(s.title)}"></div><div><div class="n">${c.n}.${t.n}${t.section ? " · " + esc(t.section) : ""} · ${s.phone ? "Phone" : "Desktop"}</div><h3>${esc(s.title)}</h3><p>${esc(s.caption)}</p>${s.simulated ? `<div class="sim">Simulated: ${esc(s.simulated)}</div>` : ""}<div class="${s.verified === false ? "bad" : "ok"}">${s.verified === false ? "Check failed" : "Verified on the deployed app"}</div><details><summary>Narration and evidence</summary><p>${esc(narration[t.key] || "")}</p><p class="mute">Evidence: ${esc(String(s.evidence || "").slice(0, 260))}</p></details><div class="mute">Starts at ${fmt(t.startMs)}</div></div></div>`;
  }
}
html += `<h2>What needs your decision</h2><div class="box"><p>Approve, or tell me what to change. I have not published anything, replaced the live Help tutorial, or started any other tutorial. Findings from recording are listed separately in <a href="FINDINGS.md">FINDINGS.md</a>; none were fixed in this pass.</p></div></main></body></html>`;
fs.writeFileSync(path.join(OUT, "index.html"), html);
console.log("written:", ["index.html", "narration-script.md", "VERIFICATION.md"].join(", "), `| verified ${total - fails}/${total}`);

// ---- the same preview as a publishable page body (the Artifact tool wraps it in its own document skeleton; links to the .md files become in-page sections)
const mdToHtml = (md) => {
  const lines = md.split(/\r?\n/); let out = ""; let inList = false, inTable = false, tableHead = true;
  const inline = (t) => esc(t).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  const closeList = () => { if (inList) { out += "</ul>"; inList = false; } }; const closeTable = () => { if (inTable) { out += "</tbody></table></div>"; inTable = false; } };
  for (const line of lines) {
    if (/^\|/.test(line)) { closeList(); const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()); if (/^[-: |]+$/.test(line)) { tableHead = false; out += "</thead><tbody>"; continue; } if (!inTable) { out += '<div class="tw"><table class="cmp"><thead>'; inTable = true; tableHead = true; } out += `<tr>${cells.map((c) => (tableHead ? `<th>${inline(c)}</th>` : `<td>${inline(c)}</td>`)).join("")}</tr>`; continue; }
    closeTable();
    if (/^## /.test(line)) { closeList(); out += `<h3>${inline(line.slice(3))}</h3>`; } else if (/^# /.test(line)) { closeList(); continue; } else if (/^- /.test(line)) { if (!inList) { out += "<ul>"; inList = true; } out += `<li>${inline(line.slice(2))}</li>`; } else if (line.trim() === "") { closeList(); } else { closeList(); out += `<p>${inline(line)}</p>`; }
  }
  closeList(); closeTable(); return out;
};
let art = html;
const styleMatch = art.match(/<style>([\s\S]*?)<\/style>/)[1]
  .replace(":root{--bg:#0b1117;", ":root{color-scheme:dark;--bg:#0b1117;")
  .replace(/(:root:not\(\[data-theme="dark"\]\)\{)--bg/, "$1color-scheme:light;--bg").replace(/(:root\[data-theme="light"\]\{)--bg/, "$1color-scheme:light;--bg")
  .replace("main{max-width:1100px;margin:0 auto;padding:24px 16px 80px}", "main{max-width:1100px;margin:0 auto;padding-block:24px 80px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}.tw{overflow-x:auto}")
  .replace("*{box-sizing:border-box}body{margin:0;", "*{box-sizing:border-box}body{margin:0;");
const mainMatch = art.match(/<main>([\s\S]*)<\/main>/)[1]
  .replace(/<p>Files: [\s\S]*?<\/p>/, "<p class=\"mute\">Narration, checks and findings are on this page (expand any step), and listed at the end.</p>")
  .replace(/<div class="box"><p>Approve, or tell me what to change\.[\s\S]*?<\/div>/, "")
  .replace(/<h2>What needs your decision<\/h2>/, "");
const findings = mdToHtml(fs.readFileSync(path.join(OUT, "FINDINGS.md"), "utf8"));
const ver = fs.readFileSync(path.join(OUT, "VERIFICATION.md"), "utf8").match(/\*\*Result: ([^*]+)\*\*/);
const pageBody = `<title>Tutorial 1 Preview</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>${styleMatch}table.cmp{width:100%;border-collapse:collapse;font-size:14px;margin:8px 0}table.cmp th,table.cmp td{border-top:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top;min-width:120px}table.cmp th{color:var(--mute);font-weight:600}h3{margin:22px 0 6px}</style>\n<main>${mainMatch}\n<h2>Verification</h2><div class="box"><p>${esc(ver ? ver[1] : "")} Each step's check and evidence is under its Narration and evidence control above.</p></div>\n<h2>Findings while recording</h2><div class="box warn"><p>None of these were fixed in this pass. They are recorded separately so you can decide.</p></div>${findings}\n<h2>What needs your decision</h2><div class="box"><p>Approve, or tell me what to change. Nothing has been published, the live Help tutorial is untouched, and no other tutorial was started.</p></div></main>`;
fs.writeFileSync(path.join(OUT, "_artifact-page.html"), pageBody);
console.log("artifact page written:", (pageBody.length / 1024).toFixed(0), "KB");
