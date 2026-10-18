const { admin } = require("./journey-lib.cjs");
const all = async (t, cols, f) => { let out = []; for (let from = 0; ; from += 1000) { let q = admin.from(t).select(cols).range(from, from + 999); if (f) q = f(q); const r = await q; if (r.error) throw new Error(t + ": " + r.error.message); out = out.concat(r.data); if (r.data.length < 1000) break; } return out; };
(async () => {
  const profs = await all("profiles", "id,account_code,next_item_seq,created_at,profile_type,onboarding_completed");
  const items = await all("vault_items", "id,profile_id,item_code,created_at,updated_at");
  console.log("profiles", profs.length, "items", items.length);
  const byP = new Map(); for (const i of items) { const k = String(i.profile_id); if (!byP.has(k)) byP.set(k, []); byP.get(k).push(i); }
  let totalGapNumbers = 0; const rows = [];
  for (const p of profs) {
    const its = byP.get(String(p.id)) || [];
    const nums = its.map((i) => { const m = /-(\d{6})$/.exec(i.item_code || ""); return m ? Number(m[1]) : null; });
    const withNum = nums.filter((n) => n !== null);
    const noCode = nums.length - withNum.length;
    const max = withNum.length ? Math.max(...withNum) : 0, nxt = Number(p.next_item_seq ?? 0);
    const present = new Set(withNum); const gaps = []; for (let n = 1; n <= Math.max(max, nxt - 1); n++) if (!present.has(n)) gaps.push(n);
    totalGapNumbers += gaps.length;
    rows.push({ acct: p.account_code, created: String(p.created_at).slice(0, 10), type: p.profile_type, items: its.length, noCode, max, next_seq: nxt, dupNums: withNum.length - present.size, gaps: gaps.length, gapList: gaps.slice(0, 12) });
  }
  rows.sort((a, b) => b.items - a.items);
  console.table(rows.filter((r) => r.items > 0 || r.gaps > 0).map((r) => ({ acct: r.acct, created: r.created, items: r.items, noCode: r.noCode, max: r.max, next_seq: r.next_seq, gaps: r.gaps, gapList: r.gapList.join(",") })));
  console.log("profiles with 0 items:", rows.filter((r) => r.items === 0).map((r) => r.acct + "(" + r.created + ", next_seq " + r.next_seq + ")").join(" | "));
  console.log("TOTAL missing item numbers across all collections (gaps below the highest issued number):", totalGapNumbers);
  require("fs").writeFileSync("cnt1.json", JSON.stringify({ profs, rows }, null, 0));
})().catch((e) => { console.error(e.message); process.exit(1); });
