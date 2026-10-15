// Generates the cleaned Help guide HTML and the review index in docs/walkthrough/media-ready
const fs = require("fs");
const path = require("path");
const C = require("./content.cjs");
const L = JSON.parse(fs.readFileSync(path.join(__dirname, "package-listing.json"), "utf8"));
const OUT = "C:/Users/EK/VLTD/docs/walkthrough/media-ready";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const mm = (s) => { s = Math.round(s); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

const CSS = `:root{--bg:#0f1115;--card:#171a20;--fg:#eceef2;--muted:#a3a9b5;--accent:#52D6F4;--line:#2a2f38}
@media (prefers-color-scheme: light){:root{--bg:#f4f5f7;--card:#fff;--fg:#14171c;--muted:#515966;--accent:#0b6e86;--line:#d9dde3}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,Segoe UI,Arial,sans-serif}
main{max-width:860px;margin:0 auto;padding:24px 16px 72px}h1{font-size:30px;margin:8px 0 6px}
h2{font-size:22px;margin:42px 0 8px;padding-top:14px;border-top:1px solid var(--line)}h3{font-size:18px;margin:0 0 4px}
.lead{color:var(--muted);margin:0 0 18px}.pill{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:3px 12px;margin:0 8px 8px 0;color:var(--fg);text-decoration:none;font-size:14px}
.box{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin:0 0 16px}
.step{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin:0 0 16px}
.num{display:inline-flex;width:30px;height:30px;border-radius:50%;background:var(--accent);color:#0a0c10;align-items:center;justify-content:center;font-weight:700;float:left;margin-right:12px}
.txt{overflow:hidden}.txt p{margin:0 0 8px;color:var(--muted)}img{display:block;width:100%;height:auto;border-radius:10px;border:1px solid var(--line);margin-top:10px}
video{width:100%;border-radius:12px;background:#000}.result{border-left:4px solid var(--accent)}a{color:var(--accent)}.meta{color:var(--muted);font-size:14px}`;

const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${CSS}</style></head><body><main>${body}</main></body></html>`;

// ---- help guide ----
let body = `<h1>Your first collection in VLTD</h1><p class="lead">Four short tutorials: add an item, build and share an exhibition, import a spreadsheet, and use Personal and Business profiles. Each has a video with captions, numbered steps and a next action.</p><nav aria-label="Tutorials">${C.tutorials.map((T) => `<a class="pill" href="#${T.file}">${esc(T.title)}</a>`).join("")}<a class="pill" href="delete-an-item-or-exhibition.html">Help topic: deleting</a><a class="pill" href="reset-your-password.html">Help topic: reset your password</a></nav>`;
C.tutorials.forEach((T) => {
  const l = L.listing.find((x) => x.id === T.id);
  body += `<h2 id="${T.file}">${esc(T.title)}</h2><p class="lead">${esc(T.short)}</p>`;
  body += `<video controls playsinline preload="metadata" poster="../${T.id}/thumbnail.jpg" aria-label="${esc(T.title)} video, ${mm(l.duration)}"><source src="../${T.id}/${T.file}.mp4" type="video/mp4"><track kind="captions" src="../${T.id}/${T.file}.vtt" srclang="en" label="English" default>Your browser cannot play this video. Follow the written steps below.</video>`;
  body += `<p class="meta">Video, ${mm(l.duration)}, captions on screen. <a href="../${T.id}/${T.file}.vtt">Caption file</a></p>`;
  body += `<div class="box"><h3>Before you start</h3><ul>${T.needs.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></div>`;
  l.shots.forEach((s) => {
    body += `<div class="step"><span class="num" aria-hidden="true">${s.n}</span><div class="txt"><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p><img src="../${T.id}/${s.file}" alt="${esc(s.title)}: ${esc(s.text)}" loading="lazy"></div></div>`;
  });
  body += `<div class="box result"><h3>Done</h3><p>${esc(T.result.text)}</p><p><b>${esc(T.next)}</b></p></div>`;
});
fs.writeFileSync(path.join(OUT, "help-guide", "index.html"), page("Your first collection in VLTD (review copy)", body));

// ---- separate Help topics (text only; verified earlier on 2026-10-14) ----
fs.writeFileSync(path.join(OUT, "help-guide", "delete-an-item-or-exhibition.html"), page("Delete an item or an exhibition", `<p><a href="index.html">← Back to the tutorials</a></p><h1>Delete an item or an exhibition</h1>
<p class="lead">Deleting is permanent. VLTD always asks you to confirm first.</p>
<h2>Delete an item</h2><ol><li>Open the item from your Vault.</li><li>Choose the trash icon (<b>Delete item</b>).</li><li>Read the warning, then choose <b>Delete Forever</b>, or <b>Cancel</b> to keep it.</li></ol>
<h2>Delete an exhibition</h2><ol><li>Open <b>Exhibitions</b>.</li><li>On the exhibition's card, choose the trash icon (<b>Delete exhibition</b>).</li><li>Choose <b>Yes Delete FOREVER</b>, or <b>Cancel, keep My Exhibition</b>.</li></ol>
<div class="box"><b>If your account cannot be reached</b> VLTD says so and keeps the item. Nothing is shown as deleted unless it was.</div>`));
fs.writeFileSync(path.join(OUT, "help-guide", "reset-your-password.html"), page("Reset your password", `<p><a href="index.html">← Back to the tutorials</a></p><h1>Reset your password</h1>
<p class="lead">You can set a new password from the email we send you.</p>
<ol><li>On the log-in page choose <b>Forgot password?</b>.</li><li>Enter your email and choose <b>Send reset link</b>. The message is the same whether or not an account exists.</li><li>Open the email "Reset your VLTD password" and choose <b>Reset my password</b>.</li><li>Type your new password twice and choose <b>Update password</b>.</li><li>Log in with the new password. Your old password stops working, and other devices are signed out.</li></ol>
<div class="box"><b>"This link has expired"</b> Reset links work once and only for a short time. Choose <b>Send me a new link</b> to get another.</div>`));

// ---- review index ----
let idx = `<h1>VLTD tutorial videos: review package</h1><p class="lead">Prepared 2026-10-14 for review. <b>Nothing is published.</b> All videos are caption-led and built from screenshots of the live site (tested desktop browser, synthetic data). They are <b>screenshot-based videos, not screen recordings</b>, and have no voice-over.</p>
<div class="box"><b>Which file is for what</b><ul>
<li><b>YouTube / landscape 16:9 (1920×1080):</b> the four tutorial MP4s below, with matching .vtt/.srt caption files.</li>
<li><b>Vertical social (1080×1920):</b> the two MP4s under "Social cuts".</li>
<li><b>Help material:</b> <a href="help-guide/index.html">help-guide/index.html</a> (numbered screenshots, alt text, links to the videos) plus two separate topics: <a href="help-guide/delete-an-item-or-exhibition.html">deleting</a> and <a href="help-guide/reset-your-password.html">password reset</a>. Not connected to any Help route yet.</li></ul></div>
<h2>Tutorials (landscape)</h2>`;
C.tutorials.forEach((T) => {
  const l = L.listing.find((x) => x.id === T.id);
  idx += `<div class="step"><h3>${esc(T.title)} <span class="meta">· ${mm(l.duration)}</span></h3><p class="meta">${esc(T.short)}</p>
  <video controls preload="metadata" poster="${T.id}/thumbnail.jpg" aria-label="${esc(T.title)}"><source src="${T.id}/${T.file}.mp4" type="video/mp4"><track kind="captions" src="${T.id}/${T.file}.vtt" srclang="en" label="English" default></video>
  <p class="meta">Files: <a href="${T.id}/${T.file}.mp4">MP4</a> · <a href="${T.id}/${T.file}.vtt">VTT</a> · <a href="${T.id}/${T.file}.srt">SRT</a> · <a href="${T.id}/narration-script.md">narration script</a> · <a href="${T.id}/title-and-description.txt">title and description</a> · <a href="${T.id}/thumbnail.jpg">thumbnail</a> · <a href="help-guide/index.html#${T.file}">numbered screenshots (Help guide)</a></p></div>`;
});
idx += `<h2>Social cuts (vertical)</h2>`;
C.social.forEach((S) => {
  const l = L.socialList.find((x) => x.S.id === S.id);
  idx += `<div class="step"><h3>${esc(S.title)} <span class="meta">· ${mm(l.duration)}</span></h3>
  <video controls preload="metadata" style="max-width:360px" poster="social-vertical/${S.file}-thumbnail.jpg"><source src="social-vertical/${S.file}.mp4" type="video/mp4"><track kind="captions" src="social-vertical/${S.file}.vtt" srclang="en" label="English" default></video>
  <p class="meta">Files: <a href="social-vertical/${S.file}.mp4">MP4</a> · <a href="social-vertical/${S.file}.vtt">VTT</a> · <a href="social-vertical/${S.file}.srt">SRT</a> · <a href="social-vertical/${S.file}-script.md">script</a> · <a href="social-vertical/${S.file}-title-and-description.txt">title and post text</a> · <a href="social-vertical/${S.file}-thumbnail.jpg">thumbnail</a></p></div>`;
});
idx += `<h2>Limitations</h2><ul><li>Screenshot-based videos with captions and zooms; no live screen recording, no voice-over, no music.</li><li>Photos are uploaded through the upload option; camera capture and arranging by dragging are not shown (not verified with a real device or pointer).</li><li>Tested in a desktop browser only. Phone layouts were not recorded.</li><li>The synthetic data and QA account were removed after capture.</li></ul>`;
fs.writeFileSync(path.join(OUT, "index.html"), page("VLTD tutorial videos: review package", idx));
console.log("guide + index written");
