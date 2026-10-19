const A = require("./audit-s-acc-lib.cjs");
(async () => {
  const S = await A.session("owner", { width: 1440, height: 900 });
  try {
    await S.visit("/account"); await A.sleep(1500);
    console.log(await S.evaluate(`JSON.stringify([...document.querySelectorAll('main input,main textarea')].map((e) => ({ tag: e.tagName, type: e.getAttribute('type'), ph: e.placeholder, name: e.name, id: e.id, max: e.maxLength, v: e.value.slice(0, 30) })))`));
    console.log(await S.evaluate(`JSON.stringify([...document.querySelectorAll('main button')].filter((b) => /Music|Sports|Pop Culture/.test(b.innerText)).map((b) => ({ t: b.innerText.trim(), cls: b.className.slice(0, 160), ap: b.getAttribute('aria-pressed'), ac: b.getAttribute('aria-checked'), da: b.getAttributeNames().join(',') })))`));
    await A.clickText(S, "^Music$", "main button", {}); await A.sleep(400);
    console.log(await S.evaluate(`JSON.stringify([...document.querySelectorAll('main button')].filter((b) => /Music|Sports/.test(b.innerText)).map((b) => ({ t: b.innerText.trim(), cls: b.className.slice(0, 160), ap: b.getAttribute('aria-pressed'), bg: getComputedStyle(b).backgroundColor, cc: b.getAttribute('data-active') })))`));
    await S.visit("/account?section=preferences"); await A.sleep(1500);
    console.log(await S.evaluate(`JSON.stringify([...document.querySelectorAll('main button')].map((b) => ({ t: (b.getAttribute('aria-label')||b.innerText).trim().slice(0,24), ap: b.getAttribute('aria-pressed'), ac: b.getAttribute('aria-checked'), role: b.getAttribute('role') })))`));
  } finally { await S.close(); }
})();
