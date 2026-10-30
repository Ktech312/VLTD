// Prints the box, classes and parent of every control on a live page whose label matches a pattern (to identify what a touch-target measurement refers to).
//   AUDIT_MANIFEST=<qa manifest> TUT_WORK=<dir> node find-element.cjs <path> <regex> [width]
const GUIDE = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/walkthrough/add-item-guide/_build";
const { start, T } = require(GUIDE + "/lib.cjs");
const [pagePath, pattern, width] = [process.argv[2], process.argv[3], Number(process.argv[4] || 390)];
(async () => {
  const R = await start({ scene: "find-element", phone: true, camera: false });
  const { S } = R;
  try {
    await S.send("Emulation.setDeviceMetricsOverride", { width, height: Math.round(width * 2.165), deviceScaleFactor: 2, mobile: true });
    await R.goto(pagePath); await T.sleep(2500);
    const out = await S.evaluate(`(() => [...document.querySelectorAll('button, a, [role=button]')].filter((e) => new RegExp(${JSON.stringify(pattern)}).test(((e.innerText || e.getAttribute('aria-label') || '') + '').trim().replace(/\\s+/g, ' '))).slice(0, 6).map((e) => { const r = e.getBoundingClientRect(); return { label: ((e.innerText || e.getAttribute('aria-label') || '') + '').trim().replace(/\\s+/g, ' ').slice(0, 30), tag: e.tagName, box: [Math.round(r.left), Math.round(r.top + scrollY), Math.round(r.width), Math.round(r.height)], cls: String(e.className).slice(0, 150), parent: e.parentElement ? e.parentElement.tagName + '.' + String(e.parentElement.className).slice(0, 80) : '' }; }))()`);
    console.log(JSON.stringify(out, null, 1));
  } catch (e) { console.log("SCRIPT ERROR:", e.message); }
  await R.close(); process.exit(0);
})();
