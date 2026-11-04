// node visit.cjs <kind> <path> [shotname]
const L = require("./shr-lib.cjs");
(async () => {
  const [kind, p, shot] = process.argv.slice(2);
  const S = await L.session(kind);
  try {
    await S.visit(p);
    console.log("TEXT:", (await S.text()).replace(/\s+/g, " ").slice(0, 600));
    console.log("NET:", JSON.stringify(S.net.map((r) => ({ s: r.status, u: r.url, b: (r.body || "").slice(0, 200) })), null, 1));
    if (shot) await S.shotTo(shot);
  } finally { await S.close(); }
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
