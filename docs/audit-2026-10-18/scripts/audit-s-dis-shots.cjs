// settled screenshots for a few FAIL rows that had none, then attach evidence paths to those rows
const C = require("./audit-s-dis-common.cjs");
const { sleep, fs } = C;
const F = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/audit-2026-10-18/rows.jsonl";
(async () => {
  const map = {};
  const E = await C.session("visitor");
  await E.visit("/events"); await sleep(3500);
  await C.scrollTo(E, 0); await sleep(300);
  await C.click(E, `document.querySelector('button[aria-label="Filter by universe"]')`); await sleep(500);
  map["DIS-276"] = await E.jshot("dis-events-universe-menu-offscreen");
  await E.close();
  const O = await C.session("owner");
  await O.send("Emulation.setTimezoneOverride", { timezoneId: "America/Los_Angeles" });
  await O.visit("/community-board"); await sleep(4000);
  await O.evaluate("(() => { const a = [...document.querySelectorAll('main a')].find((x) => /events$/.test(x.getAttribute('href') || '') && /Card Show/.test(x.textContent)); if (a) a.scrollIntoView({ block: 'center' }); return true; })()"); await sleep(600);
  map["DIS-345"] = await O.jshot("dis-lounge-drops-pacific");
  await O.close();
  const M = await C.session("visitor", { width: 390, height: 844, mobile: true });
  await M.visit("/upcoming"); await sleep(3500);
  map["DIS-271"] = await M.jshot("dis-upcoming-visitor-390");
  await M.close();
  // existing screenshots for the rest
  Object.assign(map, { "DIS-085": "shots/dis-itemfacts-read-failed.jpg", "DIS-115": "shots/dis-search-nomatch.jpg", "DIS-198": "shots/dis-saved-owner.jpg", "DIS-203": "shots/dis-saved-cleared.jpg", "DIS-226": "shots/dis-favorites-empty-owner.jpg", "DIS-240": "shots/dis-market-visitor.jpg", "DIS-241": "shots/dis-market-visitor.jpg", "DIS-242": "shots/dis-market-visitor.jpg", "DIS-302": "shots/dis-events-390.jpg", "DIS-341": "shots/dis-lounge-leaderboard-link.jpg", "DIS-360": "shots/dis-clubs-unknown.jpg", "DIS-363": "shots/dis-lounge-preview.jpg", "DIS-369": "shots/dis-bulkscan-vault-bulk.jpg", "DIS-421": "shots/dis-styles-noir.jpg" });
  const base = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/audit-2026-10-18/";
  const lines = fs.readFileSync(F, "utf8").split("\n").filter(Boolean).map((l) => { const o = JSON.parse(l); if (o.area === "DIS" && map[o.id] && map[o.id] && fs.existsSync(base + map[o.id])) { o.evidence = map[o.id]; return JSON.stringify(o); } return l; });
  fs.writeFileSync(F, lines.join("\n") + "\n");
  console.log("attached", Object.keys(map).length, JSON.stringify(map).slice(0, 200));
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
