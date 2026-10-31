// Lists the visible inputs, textareas, selects and buttons of a live page (phone emulation) and saves a screenshot.
//   AUDIT_MANIFEST=... TUT_WORK=... node explore-page.cjs <path> <outPrefix> [width]
const GUIDE = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/walkthrough/add-item-guide/_build";
const { start, T } = require(GUIDE + "/lib.cjs");
const sharp = require("C:/Users/EK/VLTD/node_modules/sharp");
const fs = require("fs");
const [p, out, width] = [process.argv[2], process.argv[3], Number(process.argv[4] || 390)];
(async () => {
  const R = await start({ scene: "explore", phone: true, camera: false });
  const { S } = R;
  try {
    await S.send("Emulation.setDeviceMetricsOverride", { width, height: Math.round(width * 2.165), deviceScaleFactor: 2, mobile: true });
    const target = p === "@first-gallery" ? "/museum/" + (await T.admin.from("galleries").select("id").eq("profile_id", R.m.personalId).limit(1)).data[0].id : p;
    await R.goto(target); await T.sleep(3000);
    const list = await S.evaluate(`[...document.querySelectorAll('input, textarea, select, button, a[href]')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; }).map((e) => { const r = e.getBoundingClientRect(); return [e.tagName, e.type || '', ((e.innerText || e.getAttribute('aria-label') || e.getAttribute('placeholder') || '') + '').trim().replace(/\\s+/g, ' ').slice(0, 40), Math.round(r.top + scrollY), Math.round(r.height)].join(' | '); })`);
    console.log("path:", await S.path()); console.log(list.join("\n"));
    const png = await S.send("Page.captureScreenshot", { format: "png" }); await sharp(Buffer.from(png.data, "base64")).jpeg({ quality: 80 }).toFile(out + ".jpg");
  } catch (e) { console.log("SCRIPT ERROR:", e.message); }
  await R.close(); process.exit(0);
})();
