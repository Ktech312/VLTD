// Account menu on a phone: every row's box, whether it is inside the screen and tappable, at 390, 360 and 320 wide.
const fs = require("fs"), path = require("path");
const GUIDE = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/walkthrough/add-item-guide/_build";
const { start, T } = require(GUIDE + "/lib.cjs");
const sharp = require("C:/Users/EK/VLTD/node_modules/sharp");
const sleep = T.sleep;
const OUT = process.argv[2];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const R = await start({ scene: "account-menu", phone: true, camera: false });
  const { S } = R; const res = [];
  try {
    for (const w of [390, 360, 320]) {
      await S.send("Emulation.setDeviceMetricsOverride", { width: w, height: Math.round(w * 2.165), deviceScaleFactor: 2, mobile: true });
      await R.goto("/dashboard"); await sleep(2200);
      await S.evaluate(`document.querySelector('button[aria-label="Account menu"]').click()`); await sleep(900);
      const rows = await S.evaluate(`(() => { const out = []; for (const e of document.querySelectorAll('[role=menuitem], [role=menu] a, [role=menu] button')) { const r = e.getBoundingClientRect(); if (r.width < 4) continue; const cx = r.left + r.width / 2, cy = r.top + r.height / 2; const t = document.elementFromPoint(cx, cy); out.push({ label: (e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\\s+/g, ' ').slice(0, 26), top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), onScreen: r.top >= 0 && r.bottom <= innerHeight, tappable: !!t && (t === e || e.contains(t)) }); } return { vh: innerHeight, rows: out }; })()`);
      const png = await S.send("Page.captureScreenshot", { format: "png" }); await sharp(Buffer.from(png.data, "base64")).jpeg({ quality: 80 }).toFile(path.join(OUT, `account-menu-${w}.jpg`));
      res.push({ w, ...rows });
      console.log(w, "vh", rows.vh, JSON.stringify(rows.rows.filter((r) => !r.onScreen || !r.tappable)), "rows:", rows.rows.length, "support:", JSON.stringify(rows.rows.find((r) => /^Support/.test(r.label))));
    }
  } catch (e) { console.log("SCRIPT ERROR:", e.message); }
  fs.writeFileSync(path.join(OUT, "account-menu.json"), JSON.stringify(res, null, 1));
  await R.close(); process.exit(0);
})();
