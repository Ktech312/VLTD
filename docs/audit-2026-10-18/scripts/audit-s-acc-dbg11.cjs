const A = require("./audit-s-acc-lib.cjs");
(async () => {
  const S = await A.session("owner", { width: 390, height: 844, mobile: true });
  try {
    await S.visit("/account?section=data"); await A.sleep(2000);
    console.log(await S.evaluate("[...document.querySelectorAll('a[href=\"/account\"]')].map((a) => JSON.stringify({ t: a.innerText.trim(), w: Math.round(a.getBoundingClientRect().width), vis: getComputedStyle(a).display }))"));
    await A.clickSel(S, 'button[aria-label="Switch profile"]', { touch: true }); await A.sleep(800);
    console.log(await S.evaluate("(() => { const b = document.querySelector('button[aria-label=\"Switch profile\"]'); const r = b.getAttribute('aria-expanded'); const menus = [...document.querySelectorAll('[role=listbox],[role=menu],ul')].filter((e) => e.getBoundingClientRect().width > 1 && /QA Journey/.test(e.innerText)).map((e) => e.tagName + '|' + e.getAttribute('role') + '|' + e.innerText.replace(/\\s+/g, ' ').slice(0, 80)); const items = [...document.querySelectorAll('*')].filter((e) => e.children.length < 3 && /QA Journey Business/.test(e.innerText || '') && e.getBoundingClientRect().width > 1).map((e) => e.tagName + '|' + (e.getAttribute('role') || '') + '|' + e.className.toString().slice(0, 40)); return JSON.stringify({ expanded: r, menus, items }); })()"));
    await S.jshot("acc-dbg11-switch-open");
  } finally { await S.close(); }
})();
