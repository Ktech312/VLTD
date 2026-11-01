// Prints the theme variables as seen by a given element and by the root, on a live page.
const GUIDE = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/walkthrough/add-item-guide/_build";
const { start, T } = require(GUIDE + "/lib.cjs");
(async () => {
  const R = await start({ scene: "theme-vars", phone: true, camera: false });
  const { S } = R;
  try {
    await R.goto("/guide/walkthrough"); await T.sleep(2500);
    const out = await S.evaluate(`(() => { const e = [...document.querySelectorAll('a')].find((a) => /^Add an item$/.test(a.innerText.trim())); const g = (el, v) => getComputedStyle(el).getPropertyValue(v).trim(); const rootCls = document.documentElement.className; return { rootClass: rootCls, dataTheme: document.documentElement.getAttribute('data-vltd-theme'), bodyClass: document.body.className.slice(0, 80), elem: { bg: g(e, '--bg').slice(0, 30), fg: g(e, '--fg'), surface: g(e, '--surface'), surfaceStrong: g(e, '--surface-strong'), pillActiveBg: g(e, '--pill-active-bg').slice(0, 80), pillActiveFg: g(e, '--pill-active-fg'), input: g(e, '--input'), themeBg: g(e, '--theme-bg').slice(0, 40), themeCard: g(e, '--theme-card').slice(0, 40), themeTextPrimary: g(e, '--theme-text-primary') }, root: { bg: g(document.documentElement, '--bg'), fg: g(document.documentElement, '--fg') }, inline: e.getAttribute('style'), parentChain: (() => { const a = []; for (let p = e.parentElement; p && a.length < 6; p = p.parentElement) a.push(p.tagName + '.' + String(p.className).slice(0, 50) + ' bg=' + g(p, '--bg')); return a; })() }; })()`);
    console.log(JSON.stringify(out, null, 1));
  } catch (e) { console.log("SCRIPT ERROR:", e.message); }
  await R.close(); process.exit(0);
})();
