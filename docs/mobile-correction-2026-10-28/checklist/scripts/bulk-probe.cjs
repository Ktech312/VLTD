// Bulk upload with two photos chosen: lists every button on the page, the main action, whether it is reachable with a shortened (emulated keyboard) screen.
const fs = require("fs"), path = require("path");
const GUIDE = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/walkthrough/add-item-guide/_build";
const { start, T } = require(GUIDE + "/lib.cjs");
const sharp = require("C:/Users/EK/VLTD/node_modules/sharp");
const sleep = T.sleep;
const OUT = process.argv[2];
const ASSETS = "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/tut/assets";
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const R = await start({ scene: "bulk-probe", phone: true, camera: true });
  const { S } = R; const res = [];
  try {
    for (const w of [390, 320]) {
      const H = Math.round(w * 2.165);
      await S.send("Emulation.setDeviceMetricsOverride", { width: w, height: H, deviceScaleFactor: 2, mobile: true });
      await R.goto("/vault/bulk"); await sleep(2500);
      await S.send("DOM.enable", {}); const doc = await S.send("DOM.getDocument", {}); const q = await S.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "input[type=file]" });
      await S.send("DOM.setFileInputFiles", { nodeId: q.nodeId, files: [ASSETS + "/toy-figure.jpg", ASSETS + "/sports-card.jpg"] }); await sleep(3000);
      const list = await S.evaluate(`[...document.querySelectorAll('button, a[href], input, select, textarea')].filter((x) => x.getBoundingClientRect().width > 0).map((x) => ({ t: x.tagName, label: ((x.innerText || x.getAttribute('aria-label') || x.getAttribute('placeholder') || '') + '').trim().replace(/\\s+/g, ' ').slice(0, 40), h: Math.round(x.getBoundingClientRect().height) }))`);
      // shortened screen (keyboard), focus first title field if any, then look for the main action at the end
      await S.send("Emulation.setDeviceMetricsOverride", { width: w, height: H - 336, deviceScaleFactor: 2, mobile: true }); await sleep(500);
      const focus = await S.evaluate(`(() => { const i = document.querySelector('input[type=text], input:not([type=file]):not([type=range]):not([type=hidden])'); if (i) { i.focus(); i.scrollIntoView({ block: 'center' }); } return i ? (i.placeholder || i.type) : null; })()`);
      const main = await S.evaluate(`(() => { const sc = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 20 && /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.clientHeight > 200).sort((a, b) => b.clientHeight - a.clientHeight)[0] || document.scrollingElement; sc.scrollTop = 1e6; const bar = document.querySelector('nav[aria-label="Main navigation"]'); const bt = bar ? bar.firstElementChild.getBoundingClientRect().top : innerHeight; return [...document.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().width > 0 && /add|create|save|finish|review|upload|start|go/i.test(b.innerText)).map((b) => { const r = b.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { label: b.innerText.trim().replace(/\\s+/g, ' ').slice(0, 36), top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), reachable: !!t && (t === b || b.contains(t)), clearOfBar: r.bottom <= bt, barTop: Math.round(bt) }; }); })()`);
      await sleep(400);
      const png = await S.send("Page.captureScreenshot", { format: "png" }); await sharp(Buffer.from(png.data, "base64")).jpeg({ quality: 80 }).toFile(path.join(OUT, `bulk-end-keyboard-${w}.jpg`));
      res.push({ w, buttons: list.filter((x) => x.t === "BUTTON" || x.t === "A").slice(0, 30), focus, main });
      console.log(w, "inputs:", JSON.stringify(list.filter((x) => x.t === "INPUT" || x.t === "TEXTAREA").slice(0, 6)), "\n focus:", focus, "\n main actions:", JSON.stringify(main));
    }
  } catch (e) { console.log("SCRIPT ERROR:", e.message); }
  fs.writeFileSync(path.join(OUT, "bulk-probe.json"), JSON.stringify(res, null, 1));
  await R.close(); process.exit(0);
})();
