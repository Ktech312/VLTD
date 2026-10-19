// Exploration only: visit each ADD-area route as owner and print title/text/controls.
const { session, controls, sleep } = require("./audit-lib.cjs");
(async () => {
  const kind = process.argv[2] || "owner";
  const S = await session(kind, { width: 1440, height: 900 });
  try {
    for (const p of ["/vault/quick", "/vault/add", "/capture", "/vault/bulk", "/vault/import", "/ingest", "/ai/drafts", "/ai/review", "/vault/sync"]) {
      const ok = await S.visit(p);
      const cs = await controls(S);
      console.log("=====", p, "->", await S.path(), "settled", ok);
      console.log((await S.text()).replace(/\s+/g, " ").slice(0, 900));
      console.log(JSON.stringify(cs.filter((c) => c.visible && !/^(Home|Vault|Exhibitions|Lounge|Discover|Messages|Alerts|Search|Help|Account menu|Report a bug|Install|Dismiss|VLTD Home|Reload this page)$/.test(c.label)).map((c) => `${c.kind}:${c.label}${c.disabled ? "(disabled)" : ""}${c.href ? "->" + c.href : ""}`)));
      await S.jshot("explore-" + p.replace(/\W+/g, "_"));
    }
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e); process.exit(2); });
