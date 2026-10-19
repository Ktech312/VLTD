// Probe: access requirements and first look of the existing 3D / Museum routes for each audience.
const X = require("./audit-s-exh-lib.cjs");
const { session, sleep, man, controls } = X;
(async () => {
  const routes = ["/museum/vltd", "/museum/builder", "/museum/campus-prototype", "/museum/virtual-room", "/museum/virtual-room/guest", "/museum/alpha", "/admin/museum-campus"];
  for (const kind of ["visitor", "owner"]) {
    const S = await session(kind);
    try {
      for (const r of routes) {
        await S.visit(r); await sleep(3500);
        const t = (await S.text()).replace(/\s+/g, " ");
        const webgl = await S.evaluate(`(() => { const c = document.createElement('canvas'); const g = c.getContext('webgl2') || c.getContext('webgl'); return !!g; })()`);
        console.log(kind.padEnd(8), r.padEnd(30), "->", (await S.path()).padEnd(28), "| webgl", webgl, "|", t.slice(t.indexOf("⌘K") + 3, t.indexOf("⌘K") + 160));
      }
    } finally { await S.close(); }
  }
})();
