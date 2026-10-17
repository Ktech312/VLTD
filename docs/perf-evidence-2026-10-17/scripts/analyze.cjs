// Where does a visit spend its blocking time? Self time by function (with a snippet of the production code at that position) inside the
// longest busy stretches, and inclusive time of the biggest callers.   node analyze.cjs prof-r1-v4.json [prof-r1-v5.json ...]
const fs = require("fs"), https = require("https");
const http = require("http");
const get = (u) => new Promise((res, rej) => (u.startsWith("https") ? https : http).get(u, (r) => { let b = ""; r.on("data", (d) => (b += d)); r.on("end", () => res(b)); }).on("error", rej));
const cache = new Map();
async function src(url) { const k = url.split("?")[0]; if (!cache.has(k)) cache.set(k, (await get(k)).split("\n")); return cache.get(k); }
async function snippet(cf) {
  if (!/_next\/static/.test(cf.url) || cf.lineNumber < 0) return "";
  try { const lines = await src(cf.url); const l = lines[cf.lineNumber] || ""; return l.slice(Math.max(0, cf.columnNumber - 10), cf.columnNumber + 150).replace(/\s+/g, " "); } catch { return ""; }
}
(async () => {
  for (const file of process.argv.slice(2)) {
    const p = JSON.parse(fs.readFileSync(file, "utf8"));
    const nodes = new Map(p.nodes.map((n) => [n.id, n])); const parent = new Map();
    for (const n of p.nodes) for (const c of n.children || []) parent.set(c, n.id);
    // busy stretches
    const runs = []; let cur = null; let t = 0;
    for (let i = 0; i < p.samples.length; i++) {
      t += p.timeDeltas[i] || 0;
      const idle = nodes.get(p.samples[i]).callFrame.functionName === "(idle)";
      if (!idle) { if (!cur) cur = { from: i, dur: 0 }; cur.dur += p.timeDeltas[i] || 0; cur.to = i; } else if (cur) { runs.push(cur); cur = null; }
    }
    if (cur) runs.push(cur);
    runs.sort((a, b) => b.dur - a.dur);
    console.log(`\n===== ${file}: busy stretches ${runs.slice(0, 5).map((r) => (r.dur / 1000).toFixed(0) + " ms").join(", ")}`);
    const run = runs[0];
    const self = new Map(); const inc = new Map();
    for (let i = run.from; i <= run.to; i++) {
      const id = p.samples[i]; const us = p.timeDeltas[i] || 0;
      const cf = nodes.get(id).callFrame; const key = `${cf.functionName || "(anon)"} ${(cf.url || "").split("/").pop().split("?")[0]}:${cf.lineNumber + 1}:${cf.columnNumber}`;
      self.set(key, { us: (self.get(key)?.us || 0) + us, cf });
      const seen = new Set(); let cur2 = id;
      while (cur2 !== undefined) { const c2 = nodes.get(cur2).callFrame; const k2 = `${c2.functionName || "(anon)"} ${(c2.url || "").split("/").pop().split("?")[0]}:${c2.lineNumber + 1}:${c2.columnNumber}`; if (!seen.has(k2)) { seen.add(k2); inc.set(k2, { us: (inc.get(k2)?.us || 0) + us, cf: c2 }); } cur2 = parent.get(cur2); }
    }
    console.log(`-- longest stretch ${(run.dur / 1000).toFixed(0)} ms: SELF`);
    for (const [k, v] of [...self.entries()].sort((a, b) => b[1].us - a[1].us).slice(0, 9)) console.log(String((v.us / 1000).toFixed(0)).padStart(6), "ms", k, "|", await snippet(v.cf));
    console.log(`-- INCLUSIVE (app code only)`);
    for (const [k, v] of [...inc.entries()].filter(([k, v]) => /_next/.test(v.cf.url) || false).sort((a, b) => b[1].us - a[1].us).slice(0, 12)) console.log(String((v.us / 1000).toFixed(0)).padStart(6), "ms", k, "|", (await snippet(v.cf)).slice(0, 110));
  }
  process.exit(0);
})();
