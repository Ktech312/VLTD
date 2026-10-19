const V = require("./audit-s-vlt-lib.cjs");
const { sleep, squash } = V;
(async () => {
  const S = await V.session("owner");
  try {
    for (const p of process.argv.slice(2)) {
      await S.visit(p);
      console.log("=====", p, "->", await S.path());
      console.log(squash(await S.text()).slice(0, 1500));
      const c = await V.controls(S);
      for (const x of c) if (x.visible && !(x.region === "nav" && /^(Home|Vault|Exhibitions|Lounge|Discover)$/.test(x.label))) console.log("  ", x.kind, "|", x.label, "|", x.href, "|", x.region, x.disabled ? "DIS" : "", x.pressed ? "pressed=" + x.pressed : "");
    }
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });
