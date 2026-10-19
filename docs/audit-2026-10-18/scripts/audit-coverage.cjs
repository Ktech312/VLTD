// COVERAGE.md + coverage-by-route.csv: what was actually exercised, by status, depth, area and route; plus the operations log (load, failures, retries).
const { AUD, fs } = require("./audit-lib.cjs");
const all = JSON.parse(fs.readFileSync(AUD + "/results.json", "utf8"));
const stat = JSON.parse(fs.readFileSync(AUD + "/routes-static.json", "utf8"));
const tally = (arr) => arr.reduce((a, r) => { a[r.result] = (a[r.result] || 0) + 1; return a; }, {});
const fmt = (t) => ["PASS", "FAIL", "BLOCKED", "NOT TESTED", "SUPERSEDED"].map((k) => `${t[k] || 0}`).join(" | ");
const live = all.filter((r) => r.result !== "SUPERSEDED");
const beh = all.filter((r) => r.depth === "behaviour-asserted");
const behLive = beh.filter((r) => r.result !== "SUPERSEDED");
const smoke = all.filter((r) => r.depth === "smoke-responds-only");
const skipped = all.filter((r) => r.depth === "skipped-by-generic-probe");
const links = all.filter((r) => r.depth === "link-resolves-only");
const distinct = (arr) => new Set(arr.map((r) => r.page + "||" + r.control)).size;

let md = `# Coverage and operations log (consolidated)\n\n## What was actually exercised\n\n| Depth | Rows | Distinct controls/workflows | PASS | FAIL | BLOCKED | NOT TESTED | SUPERSEDED |\n|---|---|---|---|---|---|---|---|\n`;
for (const [name, arr] of [["Behaviour-asserted (a test checked the outcome)", beh], ["Smoke probe rows (a real click was attempted; PASS = the control responded, the outcome is NOT judged; NOT TESTED = could not be clicked, disabled, or a form field)", smoke], ["Smoke: skipped on purpose (destructive / paid / outbound / form)", skipped], ["Link resolves (existence only)", links]]) {
  const t = tally(arr); md += `| ${name} | ${arr.length} | ${distinct(arr)} | ${fmt(t).split(" | ").join(" | ")} |\n`;
}
const t = tally(all); md += `| **All** | ${all.length} | ${distinct(all)} | ${fmt(t).split(" | ").join(" | ")} |\n\n`;
md += `Behaviour-asserted rows that count (superseded first-run rows excluded): ${behLive.length} rows, ${distinct(behLive)} distinct controls/workflows: ${fmt(tally(behLive))} (PASS | FAIL | BLOCKED | NOT TESTED | SUPERSEDED=0). Of the behaviour FAIL rows, only those listed under a root cause in SUMMARY.md are confirmed defects.\n\n`;
md += `Row results that depended on a request the audit intercepted (AI, billing, email, sign-out, external lookups) are tagged INTERCEPTED/SIMULATED/POSSIBLY INTERCEPTED in their Actual text: ${all.filter((r) => /^\[(INTERCEPTED|SIMULATED|POSSIBLY INTERCEPTED)/.test(r.actual)).length} rows. They test how the app handles a refusal, never an end-to-end result. **Intercepted sign-out does not verify session termination**; the real sign-out of a synthetic QA session was verified separately (CRW-025, CRW-026).\n\n`;
md += `Original Discover failures (5 rows, KNO-001..005) are kept as HISTORICAL failures, separate from the later re-verification PASS rows (KNO-006..014) and from the independent Discover auditor's rows (DIS-*).\n\n`;

md += `## By area\n\n| Area | What it covers | Rows | Distinct controls | PASS | FAIL | BLOCKED | NOT TESTED | SUPERSEDED |\n|---|---|---|---|---|---|---|---|---|\n`;
const AREA = { VLT: "Home, Vault list, Insights, Activity", ADD: "Quick Add, Add Item, uploads, batch, imports", ITM: "Item details, selling, For Sale, Sold, share, auctions", EXH: "Exhibitions, builder, visibility, visitor views, 3D (DOM only)", DIS: "Discover, Saved, Watchlist, Market, Upcoming, Events, Lounge, Learn", ACC: "Landing, auth pages, onboarding, nav, Settings, account/admin access", GIN: "Goals, Insurance, packet, reports", KNO: "Known Discover failures (historical + re-verification)", CRW: "Coordinator follow-ups (access, links, sign-out, legacy API)", SMK: "Generic control probe (smoke)", LNK: "Link existence" };
for (const a of Object.keys(AREA)) { const arr = all.filter((r) => r.area === a); if (!arr.length) continue; md += `| ${a} | ${AREA[a]} | ${arr.length} | ${distinct(arr)} | ${fmt(tally(arr)).split(" | ").join(" | ")} |\n`; }

// per-route coverage
const rx = (route) => new RegExp("(^|[\\s(`'])" + route.replace(/[.*+?^${}()|\\]/g, (c) => (c === "[" || c === "]" ? c : "\\" + c)).replace(/\\\[\\\[\.\.\.[^\]]+\]\]/g, ".*").replace(/\[\[?\.{0,3}[^\]]+\]?\]/g, "[^/\\s|?#)]+") + "(?=[\\s|?#)`']|$)");
const rows = [];
for (const p of stat.pages) {
  const re = p.route === "/" ? /(^|\s)\/(?=\s|\||$)/ : rx(p.route);
  const mine = all.filter((r) => re.test(r.page));
  const b = mine.filter((r) => r.depth === "behaviour-asserted" && r.result !== "SUPERSEDED");
  const s = mine.filter((r) => r.depth === "smoke-responds-only");
  const status = b.length >= 3 ? "behaviour-tested" : b.length ? "thin behaviour coverage" : s.length ? "smoke only" : "inventoried only";
  rows.push({ route: p.route, behaviourRows: b.length, bPass: b.filter((r) => r.result === "PASS").length, bFail: b.filter((r) => r.result === "FAIL").length, bBlocked: b.filter((r) => r.result === "BLOCKED").length, bNotTested: b.filter((r) => r.result === "NOT TESTED").length, smokeRows: s.length, coverage: status });
}
fs.writeFileSync(AUD + "/coverage-by-route.csv", ["route,behaviourRows,pass,fail,blocked,notTested,smokeRows,coverage", ...rows.map((r) => [r.route, r.behaviourRows, r.bPass, r.bFail, r.bBlocked, r.bNotTested, r.smokeRows, r.coverage].map((x) => '"' + x + '"').join(","))].join("\n"));
const cnt = rows.reduce((a, r) => { a[r.coverage] = (a[r.coverage] || 0) + 1; return a; }, {});
md += `\n## Coverage by route (${rows.length} pages; matched by the route text in each row, so approximate: a route referred to as "<exhibition id>" rather than its pattern can be undercounted; full list in coverage-by-route.csv)\n\n${Object.entries(cnt).map(([k, v]) => `- ${k}: ${v}`).join("\n")}\n\nRoutes with no behaviour row (smoke only or inventoried only):\n\n${rows.filter((r) => r.behaviourRows === 0).map((r) => "- `" + r.route + "` (" + r.coverage + ")").join("\n")}\n`;

// operations log
const crawls = fs.readdirSync(AUD).filter((f) => /^crawl-.*\.jsonl$/.test(f));
let timeouts = 0, st = {}, unsettled = 0, visits = 0;
for (const f of crawls) for (const l of fs.readFileSync(AUD + "/" + f, "utf8").split("\n").filter(Boolean)) { const p = JSON.parse(l); visits++; if (p.error) timeouts++; if (p.settled === false) unsettled++; for (const b of p.badResponses || []) st[b.status] = (st[b.status] || 0) + 1; }
md += `\n## Operations log: background tasks, load and failures\n\n`;
md += `**Throttling check.** Across all ${visits} recorded crawl visits the pages' own failed requests were: ${Object.entries(st).map(([k, v]) => k + " x" + v).join(", ") || "none"} (503s are the audit's own interceptions of /api/admin, /api/ai and similar). **No HTTP 429 and no 5xx from the app or the database were recorded.** The only failures from load were ${timeouts} crawl visits that ended in a browser-control timeout ("CDP timeout: Page.navigate"), all in the owner crawls while seven auditors plus four crawls were driving about eleven headless browsers from one machine, plus one abort of the visitor click-probe. Evidence that this was audit-generated load and not an app defect: the same pages loaded normally when retried once the load dropped (same account, same app), an idle-page check showed one background request in 20 s, and no server error was seen. The first-attempt records are kept in the crawl files (error field); the report shows "first attempt failed ..., retried OK". ${unsettled} visits did not reach the strict "settled" rule within 30 s (flag kept): under load that is expected and is not treated as a defect.\n\n`;
md += `**Background tasks (each with one purpose; nothing is running now: no node or headless Chrome process, no live agents, scratch profiles deleted, \`C:\\qa-chrome\` untouched).**\n\n| Task | Purpose | Outcome / effect on coverage |\n|---|---|---|\n`;
md += [
  ["crawl visitor 1440 and 390", "page inventory signed out", "complete (108 pages each)"],
  ["crawl owner 1440 and 390", "page inventory signed in (Personal)", "first pass: 17 pages ended in CDP timeouts under load (kept as first failures); ONE retry run re-visited only those pages and all loaded; complete"],
  ["crawl business / viewer / onboard 1440", "role and state spot-crawls", "complete (14 / 17 / 8 pages); phone width not crawled for these states (gap)"],
  ["crawl --only (4 runs)", "re-visit two routes first recorded with a literal placeholder in the address", "complete; the placeholder visits are ignored in the report"],
  ["probe visitor 1440", "click every safe control, signed out", "first run aborted by a CDP timeout; resumed once with a timeout-tolerant version (skips finished pages); complete; mostly the login page repeated"],
  ["probe owner 1440 and 390", "click every safe control, signed in", "complete; 1,110 and 1,413 controls clicked"],
  ["verify-noeffect", "re-check the probe's no-effect candidates with screenshot comparison", "complete: 45 of 46 confirmed to respond; 1 not found on reload"],
  ["links, extlinks, api inventory/probe", "link existence and API access", "complete; admin APIs answer 403 to anonymous callers"],
  ["seven auditors (VLT, ADD, ITM, EXH, DIS, ACC, GIN)", "behaviour suites per area on private fixtures", "all returned; each fixture dropped and recounted; their own first-run test mistakes are kept and marked"],
  ["follow-ups (coordinator)", "admin exposure, club/confirmation pages, exhibition-wipe confirmation, real sign-out, legacy API probe", "complete"],
].map((r) => `| ${r.join(" | ")} |`).join("\n");
md += `\n\n**Failed or orphaned commands and their effect.** (1) Two watch commands (b1gyqt1l7, b6mnqmxqj) expired when the session restarted; they only watched, no coverage effect. (2) One monitor (bfwb73n28) reported "failed" because \`grep -c\` returned 0 matches (exit code 1), not because anything failed. (3) A repository-wide grep (bj8owyak2) timed out and was replaced by a targeted search; no effect. (4) The visitor probe abort and the 17 owner-crawl timeouts above, handled by the retries listed. (5) The Add-flows auditor ran a broad kill of headless Chrome around 22:55 on 10/18; other auditors' browsers may have died then and those suites were re-run by their auditors, but the exact set is not recorded. (6) The Discover auditor's early rows DIS-001..008 and a few more were removed by its own relabelling pass. No duplicate crawl of the same purpose ran in parallel, and no new crawl was started after the data collection finished.\n`;
fs.writeFileSync(AUD + "/COVERAGE.md", md);
console.log(md.split("\n").slice(0, 40).join("\n"));
