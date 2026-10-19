// Probe 3: the item picker inside the builder (read-only look at its controls).
const X = require("./audit-s-exh-lib.cjs");
const { session, controls, sleep, man, admin, mclick, byLabel, byLabelRe } = X;
(async () => {
  const m = man();
  const ex = JSON.parse(require("fs").readFileSync(__dirname + "/exh-created.json", "utf8"));
  const S = await session("owner");
  try {
    await S.visit("/museum/" + ex.A); await sleep(7000);
    console.log((await S.text()).replace(/\s+/g, " ").slice(0, 1500));
    await mclick(S, byLabelRe("^Edit/Add"), { wait: 1500 });
    const dlg = await S.evaluate(`(() => { const d = document.querySelector('[role=dialog]'); return d ? d.innerText.replace(/\\s+/g,' ').slice(0,1800) : null; })()`);
    console.log("PICKER", dlg);
    const cs = await S.evaluate(`[...document.querySelectorAll('[role=dialog] button, [role=dialog] input, [role=dialog] [role=button]')].map(e => (e.tagName + ':' + (e.getAttribute('aria-label') || e.innerText || e.placeholder || '').replace(/\\s+/g,' ').slice(0,50))).slice(0,80)`);
    console.log(cs.join("\n"));
    await S.jshot("exh-probe3-picker");
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e); process.exit(1); });
