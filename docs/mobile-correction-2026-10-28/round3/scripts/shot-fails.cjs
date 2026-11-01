// Screenshots the flagged controls on the live pages (clip around each) and prints their computed colours and the declared colour rules, to see whether the failures are real.
const fs = require("fs"), path = require("path");
const GUIDE = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/walkthrough/add-item-guide/_build";
const { start, T } = require(GUIDE + "/lib.cjs");
const sharp = require("C:/Users/EK/VLTD/node_modules/sharp");
const OUT = process.argv[2]; fs.mkdirSync(OUT, { recursive: true });
const targets = [
  ["halls-autotag", "/vault/halls", `[...document.querySelectorAll('button')].find((b) => /Auto-tag my collection/.test(b.innerText))`],
  ["frames-onetouch", "/vault/frames", `[...document.querySelectorAll('button')].find((b) => /^One-Touch$/.test(b.innerText.trim()))`],
  ["capture-save", "/capture", `[...document.querySelectorAll('button')].find((b) => /^Save to Vault$/.test(b.innerText.trim()))`],
  ["guide-link", "/guide", `[...document.querySelectorAll('a')].find((a) => /Getting started: item and exhibition/.test(a.innerText))`],
  ["walkthrough-link", "/guide/walkthrough", `[...document.querySelectorAll('a')].find((a) => /^Add an item$/.test(a.innerText.trim()))`],
];
(async () => {
  const R = await start({ scene: "shot-fails", phone: true, camera: false });
  const { S } = R;
  try {
    await S.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    for (const [name, url, expr] of targets) {
      await R.goto(url); await T.sleep(2500);
      const info = await S.evaluate(`(() => { const e = ${expr}; if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { color: cs.color, fill: cs.webkitTextFillColor, bg: cs.backgroundColor, bgImage: cs.backgroundImage.slice(0, 80), inline: e.getAttribute('style'), cls: String(e.className).slice(0, 160), rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] }; })()`);
      console.log(name, JSON.stringify(info));
      if (info) { await T.sleep(400); const [x, y, w, h] = info.rect; const png = await S.send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: Math.max(0, y - 60), width: 390, height: Math.min(300, h + 120), scale: 2 } }); await sharp(Buffer.from(png.data, "base64")).jpeg({ quality: 85 }).toFile(path.join(OUT, name + ".jpg")); }
    }
  } catch (e) { console.log("SCRIPT ERROR:", e.message); }
  await R.close(); process.exit(0);
})();
