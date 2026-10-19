const X = require("./audit-s-exh-lib.cjs");
const { session, sleep, man, controls } = X;
(async () => {
  const m = man(); const pub = m.audit.publicGalleryId; const tok = m.audit.publicToken;
  const S = await session("visitor");
  try {
    for (const p of [`/museum/${pub}/guest`, `/museum/share/${tok}`]) {
      await S.visit(p); await sleep(6000);
      console.log("PATH", p, "->", await S.path());
      console.log((await S.text()).replace(/\s+/g, " ").slice(0, 1400));
      const cs = await controls(S);
      console.log(cs.filter((c) => c.visible && c.region !== "nav").map((c) => c.kind + ":" + c.label.slice(0, 40)).join(" | "));
      await S.jshot("exh-probe9-" + (p.includes("share") ? "share" : "guest"));
    }
  } finally { await S.close(); }
})();
