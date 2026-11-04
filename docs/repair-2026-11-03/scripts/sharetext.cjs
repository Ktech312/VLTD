// node sharetext.cjs <path> <aria-label of Share button>: owner opens the page and prints the Share panel text.
const L = require("./shr-lib.cjs");
(async () => {
  const [p, label, shot] = process.argv.slice(2);
  const O = await L.session("owner", { height: 1200 });
  try {
    await O.visit(p);
    await O.waitFor(`document.querySelector('[aria-label="${label}"]')`, 180000, "share button");
    await O.mclick(O.byLabel(label), 1800);
    console.log((await O.evaluate(`(document.querySelector('[role=dialog]')||{}).innerText`)).replace(/\n+/g, " | "));
    console.log("warning element present:", await O.evaluate(`!!document.querySelector('[data-testid=share-profile-private]')`));
    if (shot) await O.shotTo(shot);
  } finally { await O.close(); }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
