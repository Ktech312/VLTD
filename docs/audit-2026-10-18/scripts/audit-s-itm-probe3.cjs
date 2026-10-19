const X = require("./audit-s-itm-lib.cjs");
(async () => {
  const S = await X.S_("owner");
  try {
    const id = await X.mkItem("probe3", { title: "QA ITM probe3" });
    await X.openItem(S, id);
    const sel = `(() => { const sec=[...document.querySelectorAll('section')].find(s=>/^TAGS/.test(s.innerText)); return [...sec.querySelectorAll('button')].find(x=>/^\\+ /.test(x.innerText.trim())); })()`;
    const r = await X.rect(S, sel);
    console.log("rect", r);
    console.log("hit", await S.evaluate(`(() => { const r = (${sel}).getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2); return e ? e.tagName + ' ' + (e.innerText||'').slice(0,30) + ' | ' + e.outerHTML.slice(0,160) : null; })()`));
    await X.mclick(S, sel); await X.sleep(2500);
    console.log("tags in db:", JSON.stringify((await X.dbItem(id)).tags));
    console.log("section text:", (await S.evaluate(`[...document.querySelectorAll('section')].find(s=>/^TAGS/.test(s.innerText)).innerText`)).replace(/\s+/g, " "));
    // second click via DOM click
    await S.evaluate(`(${sel}).click(); true`); await X.sleep(2500);
    console.log("after el.click():", JSON.stringify((await X.dbItem(id)).tags));
    console.log(S.consoleErrors);
  } finally { await S.close(); process.exit(0); }
})().catch((e) => { console.error(e); process.exit(1); });
