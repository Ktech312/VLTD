const fs = require("fs"), path = require("path"), readline = require("readline");
const ROOT = "C:/Users/EK/.claude/projects"; const files = [];
for (const d of fs.readdirSync(ROOT)) { if (!d.startsWith("C--Users-EK")) continue; const p = path.join(ROOT, d); for (const f of fs.readdirSync(p)) if (f.endsWith(".jsonl")) files.push(path.join(p, f)); }
(async () => {
  const out = [];
  for (const f of files) {
    const rl = readline.createInterface({ input: fs.createReadStream(f), crlfDelay: Infinity });
    for await (const line of rl) {
      if (line.length > 3e6 || !/ebay/i.test(line) || !/(delet|remov|duplicate|cleanup|clean up)/i.test(line)) continue;
      let o; try { o = JSON.parse(line); } catch { continue; }
      const ts = o.timestamp || ""; if (ts < "2026-10-05T22:00" || ts > "2026-10-09") continue;
      const msg = o.message; if (!msg) continue;
      const texts = typeof msg.content === "string" ? [msg.content] : (msg.content || []).filter((c) => c.type === "text").map((c) => c.text);
      for (const t of texts) { const m = /.{0,160}(delet|remov|duplicate).{0,200}/is.exec(t); if (m && /ebay/i.test(t)) out.push({ ts, role: o.type, file: path.basename(f).slice(0, 8), t: t.replace(/\s+/g, " ").slice(0, 380) }); }
    }
  }
  out.sort((a, b) => a.ts.localeCompare(b.ts));
  console.log(out.length); for (const x of out.slice(0, 40)) console.log(x.ts.slice(0, 19), x.role, x.file, "|", x.t);
})();
