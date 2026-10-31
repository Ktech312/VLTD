// Bulk review: computed colours of the "Add all N to Vault" button and its neighbours, with a contrast ratio. (No AI, nothing saved.)
const GUIDE = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/walkthrough/add-item-guide/_build";
const { start, btn, T } = require(GUIDE + "/lib.cjs");
const sharp = require("C:/Users/EK/VLTD/node_modules/sharp");
const ASSETS = "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/tut/assets";
const OUT = process.argv[2];
(async () => {
  const R = await start({ scene: "contrast", phone: true, camera: false });
  const { S } = R;
  try {
    await S.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await R.goto("/vault/bulk"); await T.sleep(2500);
    await S.evaluate(`(() => { const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; const sels = document.querySelectorAll('main select'); const o = [...sels[0].options].find((x) => x.value); set.call(sels[0], o.value); sels[0].dispatchEvent(new Event('change', { bubbles: true })); return true; })()`); await T.sleep(600);
    await S.evaluate(`(() => { const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; const s = document.querySelectorAll('main select')[1]; const o = [...s.options].find((x) => x.value); set.call(s, o.value); s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`); await T.sleep(600);
    await S.send("DOM.enable", {}); const doc = await S.send("DOM.getDocument", { depth: 1 }); const q = await S.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "input[type=file]" });
    await S.send("DOM.setFileInputFiles", { nodeId: q.nodeId, files: [ASSETS + "/comic-cover.jpg"] }); await T.sleep(2500);
    await R.clickExpr(btn("Fill in by hand"), 2200);
    const info = await S.evaluate(`(() => {
      const lum = (c) => { const m = c.match(/[\\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
      const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100; };
      const out = {};
      for (const [k, re] of [['addAll', /^Add all \\d+ to Vault$/], ['back', /^← Back$/], ['scan', /^Scan with AI$/]]) {
        const b = [...document.querySelectorAll('button')].find((x) => re.test(x.innerText.trim())); if (!b) { out[k] = null; continue; }
        const cs = getComputedStyle(b); const sp = b.querySelector('*');
        out[k] = { color: cs.color, bgImage: cs.backgroundImage.slice(0, 120), bgColor: cs.backgroundColor, opacity: cs.opacity, disabled: b.disabled, cls: String(b.className).slice(0, 140), keep: /vltd-keep-color/.test(b.className) };
      }
      return out; })()`);
    console.log(JSON.stringify(info, null, 1));
    await S.evaluate(`document.querySelector('button[class*="min-h-12"]').scrollIntoView({ block: 'center' })`); await T.sleep(500);
    const png0 = await S.send("Page.captureScreenshot", { format: "png" }); await sharp(Buffer.from(png0.data, "base64")).jpeg({ quality: 85 }).toFile(OUT + "/contrast-after-add-all.jpg");
    const ratioFn = `(c1, c2) => { const p = (c) => c.match(/[\\d.]+/g).map(Number); const L = (c) => { const m = p(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; }; const a = L(c1), b = L(c2); return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100; }`;
    const silver = "rgb(200, 205, 210)";
    console.log("contrast (text vs a mid silver rgb(200,205,210)): addAll", await S.evaluate(`(${ratioFn})(${JSON.stringify(info.addAll && info.addAll.color)}, ${JSON.stringify(silver)})`));
    await R.goto("/capture"); await T.sleep(2500);
    const tp = await S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /^Take photo$/.test(x.innerText.trim())); return b ? getComputedStyle(b).color : null; })()`);
    console.log("Take photo text colour:", tp, "contrast vs silver:", tp ? await S.evaluate(`(${ratioFn})(${JSON.stringify(tp)}, ${JSON.stringify(silver)})`) : null);
    await R.goto("/vault/bulk"); await T.sleep(2000);
    const png = await S.send("Page.captureScreenshot", { format: "png" }); await sharp(Buffer.from(png.data, "base64")).jpeg({ quality: 85 }).toFile(OUT + "/contrast-bulk-review.jpg");
    await S.evaluate(`document.querySelector('button[class*="min-h-12"]').scrollIntoView({ block: 'center' })`);
    await T.sleep(500);
    const png2 = await S.send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: 390, height: 844, scale: 1 } });
    await sharp(Buffer.from(png2.data, "base64")).jpeg({ quality: 85 }).toFile(OUT + "/contrast-bulk-review-2.jpg");
  } catch (e) { console.log("SCRIPT ERROR:", e.message); }
  await R.close(); process.exit(0);
})();
