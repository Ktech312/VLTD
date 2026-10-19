const X = require("./audit-s-exh-lib.cjs");
const { session, sleep, mclick, byLabel, byLabelRe, admin, gdb } = X; const ex = JSON.parse(require("fs").readFileSync(__dirname + "/exh-created.json", "utf8"));
const dlg = (S) => S.evaluate(`(() => { const d = document.querySelector('[role=dialog]'); return d ? [...d.querySelectorAll('button')].map(b => (b.getAttribute('aria-label') || b.textContent).trim()).join(' | ') + ' // ' + d.innerText.length : null; })()`);
(async () => {
  await admin.from("galleries").update({ visibility: "LOCKED" }).eq("id", ex.A);
  const S = await session("owner");
  try {
    await S.visit("/museum/" + ex.A); await sleep(7000);
    await mclick(S, byLabel("Share this exhibition"), { wait: 900 });
    console.log("first open:", await dlg(S));
    await mclick(S, byLabel("Not now"), { wait: 1200 });
    console.log("after Not now:", await dlg(S));
    await mclick(S, byLabel("Share this exhibition"), { wait: 1200 });
    console.log("reopen:", await dlg(S));
  } finally { await S.close(); }
})();
