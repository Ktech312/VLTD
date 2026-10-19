// Every internal link seen anywhere in the crawl: does it lead to a page that exists? (anonymous GET, no cookies; pages are client-rendered so only a missing route is a 404)
const { AUD, BASE, fs, sleep } = require("./audit-lib.cjs");
const files = fs.readdirSync(AUD).filter((f) => /^crawl-.*\.jsonl$/.test(f));
const links = new Map(); // path -> {from:Set, labels:Set}
const ext = new Map();
for (const f of files) for (const l of fs.readFileSync(AUD + "/" + f, "utf8").split("\n").filter(Boolean)) {
  const p = JSON.parse(l); if (!p.controls) continue;
  for (const c of p.controls) {
    if (c.kind !== "link" || !c.href) continue;
    const h = c.href;
    if (/^(mailto:|tel:|javascript:)/.test(h)) continue;
    if (/^https?:\/\//.test(h) && !h.startsWith(BASE)) { const k = h.split("#")[0]; if (!ext.has(k)) ext.set(k, { from: new Set(), labels: new Set(), target: c.target }); ext.get(k).from.add(p.requested); ext.get(k).labels.add(c.label); continue; }
    if (h.startsWith("#")) continue;
    const path = h.replace(BASE, "").split("#")[0].split("?")[0];
    if (!path.startsWith("/") || path.startsWith("//")) continue;
    if (!links.has(path)) links.set(path, { from: new Set(), labels: new Set() });
    links.get(path).from.add(p.requested); links.get(path).labels.add(c.label);
  }
}
(async () => {
  const out = [];
  for (const [path, info] of links) {
    let status = 0, loc = "";
    try { const r = await fetch(BASE + path, { redirect: "manual" }); status = r.status; loc = r.headers.get("location") || ""; } catch (e) { status = -1; }
    out.push({ path, status, redirect: loc, linkedFromPages: info.from.size, example: [...info.from][0], label: [...info.labels][0] });
    await sleep(60);
  }
  out.sort((a, b) => b.status - a.status);
  fs.writeFileSync(AUD + "/links-internal.json", JSON.stringify(out, null, 1));
  fs.writeFileSync(AUD + "/links-external.json", JSON.stringify([...ext].map(([u, v]) => ({ url: u, labels: [...v.labels].slice(0, 2), from: [...v.from].slice(0, 3), target: v.target })), null, 1));
  const bad = out.filter((o) => o.status >= 400 || o.status < 0);
  console.log("internal links checked:", out.length, "| not OK:", bad.length, "| external:", ext.size);
  for (const b of bad) console.log(b.status, b.path, "| from", b.example, "| label:", b.label);
  const red = out.filter((o) => o.status >= 300 && o.status < 400);
  console.log("redirecting internal links:", red.length); for (const r of red.slice(0, 40)) console.log(r.status, r.path, "->", r.redirect, "| from", r.example);
})();
