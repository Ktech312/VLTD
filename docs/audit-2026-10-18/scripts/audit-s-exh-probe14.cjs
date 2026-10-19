const X = require("./audit-s-exh-lib.cjs");
const { session, sleep, mclick, byLabel, admin, gdb } = X; const ex = JSON.parse(require("fs").readFileSync(__dirname + "/exh-created.json", "utf8"));
(async () => {
  await admin.from("galleries").update({ visibility: "LOCKED" }).eq("id", ex.A);
  const S = await session("owner");
  try {
    await S.visit("/museum/" + ex.A); await sleep(7000);
    await mclick(S, byLabel("Share this exhibition"), { wait: 900 });
    console.log(await S.evaluate(`(() => { const d = document.querySelector('[role=dialog]'); return d ? d.innerText.replace(/\s+/g,' ') : null; })()`));
    console.log(JSON.stringify(await S.evaluate(`[...document.querySelectorAll('[role=dialog] button, [role=dialog] a')].map(b => (b.getAttribute('aria-label') || b.textContent).trim().replace(/\s+/g,' ').slice(0,50))`)));
  } finally { await S.close(); }
})();
