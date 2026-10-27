// Review page for the revised Quick Add walkthrough: the video, the exact list of changes from v2, the scene timing table and the disclosures.
//   node build-page.cjs <outDir> <artifactDir>      (outDir/index.html is the repo copy; artifactDir gets the page body + media for Artifact publishing)
const fs = require("fs");
const path = require("path");
const [OUT, ART] = process.argv.slice(2);
const tl = JSON.parse(fs.readFileSync(path.join(OUT, "quick-add-v3.timeline.json"), "utf8"));
const total = tl[tl.length - 1].endMs;
const mmss = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const rows = tl.map((b) => `<tr><td class="t">${mmss(b.startMs)}</td><td>${esc(b.section || "")}</td><td>${esc(b.title)}</td><td>${esc(b.caption)}</td><td class="n">${b.type === "card" ? "card" : b.fx === "press" ? "press" : b.ring ? (b.num ? "ring " + b.num : "ring") : "none"}</td></tr>`).join("\n");

const css = `
:root{color-scheme:dark;--bg:#0b1117;--card:#111a22;--ink:#e8eef5;--mute:#93a4b4;--line:#223140;--accent:#22d3ee}
@media (prefers-color-scheme: light){:root:not([data-theme="dark"]){color-scheme:light;--bg:#f4f7fa;--card:#ffffff;--ink:#14202b;--mute:#53667a;--line:#d5dee7;--accent:#0b7f95}}
:root[data-theme="light"]{color-scheme:light;--bg:#f4f7fa;--card:#ffffff;--ink:#14202b;--mute:#53667a;--line:#d5dee7;--accent:#0b7f95}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 system-ui,"Segoe UI",Arial,sans-serif}
main{max-width:980px;margin:0 auto;padding-block:24px 72px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
h1{font-size:28px;margin:0 0 6px;text-wrap:balance}h2{font-size:20px;margin:30px 0 8px}
p{max-width:70ch}.mute{color:var(--mute);font-size:14px}
video{width:100%;max-width:100%;aspect-ratio:16/9;border-radius:12px;background:#000;display:block}
.box{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:14px 0}
.pill{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:1px 12px;font-size:13px;color:var(--mute);margin:0 6px 6px 0}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;vertical-align:top;padding:6px 8px;border-top:1px solid var(--line)}th{color:var(--mute);font-weight:600;font-size:12px}
td.t{color:var(--accent);font-weight:700;white-space:nowrap}td.n{color:var(--mute);white-space:nowrap}
.tw{overflow-x:auto}
ul,ol{padding-left:1.2em;max-width:72ch}li{margin:5px 0}
`;
const body = `<main>
<h1>Quick Add walkthrough, corrected (v3)</h1>
<p><span class="pill">Corrected after review</span><span class="pill">Edit of v2, not a restart</span><span class="pill">${mmss(total)} (v2 was 8:40)</span><span class="pill">Captions only, no audio</span><span class="pill">Nothing published</span></p>
<video controls preload="metadata" poster="quick-add-v3-thumbnail.jpg"><source src="quick-add-v3.mp4" type="video/mp4">Your browser cannot play this video. The scene table is below.</video>
<p class="mute">Disclosure: screenshots of the live app with sample items, plus a test camera that shows fictional cards. It is not a recording of a person using the app, and the browser's camera-permission prompt cannot be captured, so that is shown as a card. The phone part was recorded in a phone-sized test browser. These notes are kept here and in the verification record, not inside the video frames.</p>

<h2>Five corrections after your review</h2>
<ol>
<li><strong>Home at 0:00.</strong> The six-second title card is gone. The video opens on Home, with "Tutorial 1: Quick Add" shown briefly over the page (about 3 seconds, then it fades and the Quick Add highlight comes in).</li>
<li><strong>Phone "Name, then save" corrected.</strong> Only that picture was replaced, with a new capture where item 3 (the toy) reads Pop Culture / Toys &amp; Figures, as in the category-fix lesson. It was captured from the live app with a synthetic collector; nothing was saved to the Vault, and the collector was removed afterwards.</li>
<li><strong>"Your photo is saved" is now "Photo captured."</strong> The photo is not saved to the Vault at that point. "Save" now only means the final save.</li>
<li><strong>AI card removed.</strong> The 8-second Identify with AI card is gone from this walkthrough. The account-specific AI explanation stays in the written guide (it is not in the video).</li>
<li><strong>Production labels removed from the frames.</strong> No "phone-size test browser" tag and no screenshot footer. Frames carry only a simple DESKTOP or PHONE label. The disclosure is on this page and in VERIFICATION.md. The phone intro card no longer says "recorded in a phone-sized test browser" either.</li>
</ol>
<p class="mute">Everything else is as in the version you reviewed: same order, same captures, same moving highlight, captions only. Nothing in the app changed; Add Item is still paused.</p>

<h2>Journey, in order</h2>
<p>Home (with the title shown briefly), the Quick Add button (highlighted, then pressed), the camera, Universe, Category, the round button, Finished, review and remove, fix a category, name the items, Save, the saved items in the Vault, open one. Then 28 seconds on what is different on a phone.</p>

<h2>Exactly what changed from v2</h2>
<ol>
<li><strong>Starts on Home.</strong> The video opens on Home with the Quick Add button highlighted (nav tabs in view so it reads as Home), with the tutorial title shown briefly over it. The button is then pressed with a ripple, and the camera follows. v2 showed the same Home screenshot but with both buttons ringed at once, and it came after a long intro.</li>
<li><strong>One highlight at a time.</strong> v2 drew every ring on a screen together with numbers. Now only the control being taught is lit, the rest of the screen is dimmed, and the ring slides to the next control on the same screen. The numbers 1 to 4 are used only for the camera set-up order (Universe 1, Category 2, shutter 3, Finished 4). Each is followed by the screen it produces. This is the camera sample's highlight style.</li>
<li><strong>Holds shortened.</strong> v2 held each screen 8 to 26 seconds. Now a screen is held for the time to read its caption plus about 2 seconds: 3.2 to 6.7 seconds per screen (the shortest is the button press), and 4 to 8 seconds for the three cards. The video went from 8:40 to ${mmss(total)}.</li>
<li><strong>Captions simplified.</strong> One short sentence per screen, 15 words or fewer (26 of 27 are 14 or fewer); the step counter and the long second line are gone.</li>
<li><strong>Save is now highlighted.</strong> Same Verify screenshot as v2 (the button is visible there); the ring position was measured from the live app's page layout.</li>
<li><strong>Screens left out of this video (still in v2):</strong> Vault entry points, the four empty-Vault starting points, Upload from device, Add manually, and the phone review screen. They are not part of the Home to saved-item path.</li>
<li><strong>Kept from v2 and shortened:</strong> camera permission (one card), the blocked-camera message, review and remove, category fix, names, cost, Vault search, open item, phone differences (5 screens), recap.</li>
<li><strong>Framing:</strong> camera and dialog screens now show the whole camera column or the whole dialog, so nothing is cut off. Home is cropped to the nav tabs plus the top card.</li>
<li><strong>No audio.</strong> This file has no audio track. The yellow production notes (the "Simulated" lines and the "Explanation card" label) are removed from the picture; the disclosure is on this page and in the verification record, not in the frames.</li>
<li><strong>Smoother ring movement:</strong> 12 frames per second instead of 8.</li>
<li><strong>New screens captured: none.</strong> Every picture is one of v2's verified screenshots.</li>
</ol>

<h2>Voice</h2>
<p>There is no voice in this version. I cannot listen to audio, so I cannot check a computer voice for clicks or popping myself, and I will not ship one I could not check. Captions carry the explanation. If you want a voice later, it would need a way to verify it that does not rely on my ears (for example a measured check for sudden jumps in the waveform), and your approval first.</p>

<h2>Scene by scene</h2>
<div class="box tw"><table>
<tr><th>Time</th><th>Section</th><th>Title</th><th>Caption</th><th>Highlight</th></tr>
${rows}
</table></div>

<h2>What I need from you</h2>
<ul>
<li>Is the pace, the single moving highlight and the caption-only format right for Quick Add?</li>
<li>Approve, or tell me what to change, before I apply the same edits to Add Item. I will not touch other tutorials or the live Help.</li>
</ul>
</main>`;
const pageDoc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Quick Add walkthrough, revised</title><style>${css}</style></head><body>${body}</body></html>`;
fs.writeFileSync(path.join(OUT, "index.html"), pageDoc);
fs.mkdirSync(ART, { recursive: true });
fs.writeFileSync(path.join(ART, "quick-add-walkthrough.html"), `<title>Quick Add Walkthrough</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>${css}</style>\n${body}\n`);
for (const f of ["quick-add-v3.mp4", "quick-add-v3-thumbnail.jpg"]) fs.copyFileSync(path.join(OUT, f), path.join(ART, f));
console.log("page written", mmss(total));
