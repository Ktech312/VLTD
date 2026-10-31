// Why does an injected admin-style button keep light text even with an inline colour? Tries variants on a live page.
const GUIDE = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/walkthrough/add-item-guide/_build";
const { start, T } = require(GUIDE + "/lib.cjs");
(async () => {
  const R = await start({ scene: "debug-repro", phone: true, camera: false });
  const { S } = R;
  try {
    await R.goto("/dashboard"); await T.sleep(3000);
    const out = await S.evaluate(`(() => {
      const host = document.querySelector('main') || document.body; const res = {};
      const mk = (label, cls, styleAttr, viaProp) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = 'Save';
        if (styleAttr) b.setAttribute('style', styleAttr); if (viaProp) b.style.color = '#0B0B0B';
        host.appendChild(b); const cs = getComputedStyle(b);
        res[label] = { color: cs.color, inlineStyle: b.getAttribute('style'), fill: cs.webkitTextFillColor };
        b.remove();
      };
      const base = 'inline-flex h-9 items-center rounded-full px-4 text-xs font-black text-[#0B0B0B] transition hover:brightness-105 disabled:opacity-50';
      mk('A attr with color', base, 'background: var(--theme-gold-gradient); box-shadow: var(--theme-gold-glow); color: #0B0B0B');
      mk('B property color', base, 'background: var(--theme-gold-gradient)', true);
      mk('C no classes, attr color', '', 'color: #0B0B0B');
      mk('D classes only (control)', base, '');
      mk('E real-page style, take-photo classes', 'vltd-tap-y inline-flex items-center gap-1.5 rounded-[8px] px-4 py-2 text-xs font-bold text-[#0B0B0B]', 'background: var(--theme-gold-gradient); color: rgb(11, 11, 11)');
      return res; })()`);
    console.log(JSON.stringify(out, null, 1));
  } catch (e) { console.log("SCRIPT ERROR:", e.message); }
  await R.close(); process.exit(0);
})();
