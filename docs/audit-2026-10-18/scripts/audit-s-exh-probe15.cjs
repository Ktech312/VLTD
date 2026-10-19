const X = require("./audit-s-exh-lib.cjs");
const { session, sleep, mclick, byLabel, byLabelRe, admin, gdb } = X; const ex = JSON.parse(require("fs").readFileSync(__dirname + "/exh-created.json", "utf8"));
(async () => {
  await admin.from("galleries").update({ visibility: "LOCKED" }).eq("id", ex.A);
  const S = await session("owner");
  try {
    await S.visit("/museum/" + ex.A); await sleep(7000);
    await mclick(S, byLabel("Share this exhibition"), { wait: 900 });
    const el = await S.evaluate(`(() => { const e = ${byLabelRe("^Yes")}; return e ? e.tagName + ':' + e.textContent.trim() + ':' + e.disabled : null; })()`);
    console.log("found", el);
    console.log("click", await mclick(S, byLabelRe("^Yes"), { wait: 1500 }));
    for (let i = 0; i < 6; i++) { console.log(i, (await S.evaluate(`(() => { const d = document.querySelector('[role=dialog]'); return d ? d.innerText.replace(/\s+/g, ' ').slice(0, 300) : null; })()`)), (await gdb(ex.A)).visibility); await sleep(1500); }
  } finally { await S.close(); }
})();
