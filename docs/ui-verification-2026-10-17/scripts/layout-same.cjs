// Do the Vault chip / A-Z rows sit in exactly the same place as before the hit-area padding? (390 px phone, synthetic account)
const { session, sleep } = require("./ui-lib.cjs");
(async () => {
  const S = await session("http://localhost:3000", { width: 390, height: 844, mobile: true });
  try {
    await S.go("/vault"); await S.waitFor("document.body.innerText.length > 300", 60000); await sleep(4500);
    const measure = `(() => {
      const t = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.top * 10) / 10, Math.round(r.left * 10) / 10, Math.round(r.height * 10) / 10]; };
      const chip = [...document.querySelectorAll('button')].find((b) => /^All \\(/.test(b.textContent.trim()));
      const letter = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'A');
      const adv = [...document.querySelectorAll('button')].find((b) => /^Advanced/.test(b.textContent.trim()));
      const card = document.querySelector('a[href^="/vault/item/"]');
      const header = chip.closest('.sticky');
      return { chip: t(chip), letter: t(letter), advanced: t(adv), firstCard: card ? t(card) : null, stickyHeader: t(header) };
    })()`;
    const withPad = await S.evaluate(measure);
    // revert the two scrollers to their ORIGINAL box model (before the hit-area padding) and measure again
    await S.evaluate(`(() => {
      const chip = [...document.querySelectorAll('button')].find((b) => /^All \\(/.test(b.textContent.trim()));
      const row2 = chip.parentElement; row2.style.cssText += ';margin-top:8px;margin-bottom:0;padding-top:0;padding-bottom:2px';
      const letter = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'A');
      const row3 = letter.parentElement; row3.style.cssText += ';margin-top:0;margin-bottom:0;padding-top:0;padding-bottom:2px';
      return true; })()`);
    await sleep(500);
    const original = await S.evaluate(measure);
    console.log("with the hit-area padding:", JSON.stringify(withPad));
    console.log("original box model       :", JSON.stringify(original));
    console.log("identical positions      :", JSON.stringify(withPad) === JSON.stringify(original));
  } finally { await S.close(); }
})();
