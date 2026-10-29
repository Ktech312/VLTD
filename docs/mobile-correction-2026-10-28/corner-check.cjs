// Reads the computed corner radius of the dropdown buttons and the compact pills on the live app (vltd.app) at a phone width and a desktop width.
//   AUDIT_MANIFEST=<qa manifest> TUT_WORK=<dir> node corner-check.cjs
const GUIDE = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/walkthrough/add-item-guide/_build";
const { start, T } = require(GUIDE + "/lib.cjs");
const sleep = T.sleep;
const read = `(() => [...document.querySelectorAll('button[aria-haspopup="menu"], select, a[data-local-tab]')].filter((e) => e.getBoundingClientRect().width > 2).map((e) => ({ label: ((e.getAttribute('aria-label') || e.innerText || e.tagName) + '').trim().replace(/\\s+/g, ' ').slice(0, 26), radius: getComputedStyle(e).borderTopLeftRadius })))()`;
(async () => {
  const R = await start({ scene: "corner-check", phone: true, camera: false });
  const { S } = R;
  try {
    for (const [w, h, mobile] of [[390, 844, true], [1280, 900, false]]) {
      await S.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile });
      for (const url of ["/museum", "/discover", "/vault"]) {
        await R.goto(url); await sleep(2200);
        const rows = await S.evaluate(read);
        console.log(w, url, rows.map((r) => `${r.label}=${r.radius}`).join("  "));
      }
    }
  } catch (e) { console.log("SCRIPT ERROR:", e.message); }
  await R.close(); process.exit(0);
})();
