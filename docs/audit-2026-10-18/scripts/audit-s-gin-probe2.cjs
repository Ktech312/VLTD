process.env.AUDIT_MANIFEST = process.env.AUDIT_MANIFEST || __dirname + "/qa_audit_gin.json";
const X = require("./audit-s-vlt-lib.cjs");
(async () => {
  const S = await X.session("owner");
  try {
    await S.visit("/goals");
    console.log((await S.text()).replace(/\s+/g, " ").slice(0, 1800));
    console.log(JSON.stringify(await S.evaluate(`[...document.querySelectorAll('[aria-label="Sort goals"]')].map(e=>e.outerHTML.slice(0,300))`)));
    await X.clickEl(S, '[aria-label="Sort goals"]');
    await X.sleep(500);
    console.log(JSON.stringify(await S.evaluate(`[...document.querySelectorAll('[role=option],[role=menuitem],[role=listbox] *')].slice(0,10).map(e=>e.tagName+':'+e.textContent.trim().slice(0,30))`)));
    console.log(await S.jshot("gin-probe-goals"));
    const c = await X.L.controls(S); console.log(c.filter(x=>x.visible).map(x=>x.kind+":"+x.label).join(" | ").slice(0,1500));
  } finally { await S.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
