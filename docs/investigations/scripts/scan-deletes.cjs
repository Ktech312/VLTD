// READ-ONLY: scan session transcripts for tool calls that could delete vault items (by .delete() on vault_items, SQL DELETE, or the delete helpers),
// with the transcript timestamp, between 2026-10-05 and now. Prints time, session file, and a short snippet of the tool input (never results).
const fs = require("fs"), path = require("path"), readline = require("readline");
const ROOT = "C:/Users/EK/.claude/projects";
const dirs = fs.readdirSync(ROOT).filter((d) => d.startsWith("C--Users-EK"));
const files = [];
for (const d of dirs) { const p = path.join(ROOT, d); for (const f of fs.readdirSync(p)) { if (f.endsWith(".jsonl")) files.push(path.join(p, f)); const sub = path.join(p, f); try { if (fs.statSync(sub).isDirectory()) for (const g of fs.readdirSync(sub)) if (g.endsWith(".jsonl")) files.push(path.join(sub, g)); } catch { /* */ } } }
const PAT = /(from\(["'\\]*vault_items["'\\]*\)\s*\.delete|\.delete\(\)\s*\.(eq|in|like|match|neq|filter)|delete\s+from\s+(public\.)?vault_items|truncate\s+(table\s+)?(public\.)?vault_items|deleteVaultItemEverywhere|deleteVaultItemsEverywhere|force_clear_vault)/i;
(async () => {
  const hits = [];
  for (const f of files) {
    const rl = readline.createInterface({ input: fs.createReadStream(f), crlfDelay: Infinity });
    for await (const line of rl) {
      if (line.length > 3_000_000) continue;
      if (!PAT.test(line)) continue;
      let o; try { o = JSON.parse(line); } catch { continue; }
      if (o.type !== "assistant" || !o.message || !Array.isArray(o.message.content)) continue;
      const ts = o.timestamp || "";
      if (ts < "2026-10-05") continue;
      for (const c of o.message.content) {
        if (c.type !== "tool_use") continue;
        const inp = JSON.stringify(c.input || {});
        const m = PAT.exec(inp); if (!m) continue;
        const i = Math.max(0, m.index - 160);
        hits.push({ ts, file: path.basename(f).slice(0, 8), tool: c.name, snip: inp.slice(i, i + 420).replace(/\\n/g, " ") });
      }
    }
  }
  hits.sort((a, b) => a.ts.localeCompare(b.ts));
  fs.writeFileSync(__dirname + "/scan-deletes.json", JSON.stringify(hits, null, 1));
  console.log("files scanned", files.length, "hits", hits.length);
  for (const h of hits) console.log(h.ts.slice(0, 19), h.file, h.tool, "|", h.snip.slice(0, 300));
})();
