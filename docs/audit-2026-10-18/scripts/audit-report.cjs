// Assembles the audit outputs: results.csv, inventory-pages.csv, inventory-controls.csv, report.html (browsable, filterable).
const { AUD, fs } = require("./audit-lib.cjs");
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(AUD + "/" + f, "utf8")); } catch { return d; } };
const lines = (f) => { try { return fs.readFileSync(AUD + "/" + f, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch { return []; } };
const files = fs.readdirSync(AUD);
const esc = (v) => '"' + String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ") + '"';
const csv = (cols, rows) => [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");

// ---- behaviour rows (agents + coordinator): depth = behaviour
const behaviour = lines("rows.jsonl").map((r) => ({ ...r, depth: "behaviour-asserted" }));
{ const byId = new Map(behaviour.map((r) => [r.id, r]));
  const expand = (txt) => { const ids = new Set(); const t = String(txt || "");
    for (const m of t.matchAll(/([A-Z]{3})-(\d{3})\s*(?:\.\.|to|–|-)\s*(?:[A-Z]{3}-)?(\d{3})/g)) { for (let i = Number(m[2]); i <= Number(m[3]); i++) ids.add(m[1] + "-" + String(i).padStart(3, "0")); }
    for (const m of t.matchAll(/([A-Z]{3})-(\d{3})/g)) ids.add(m[0]);
    for (const m of t.matchAll(/(?:^|[,\/ ]\s*)((?:[A-Z]{3}-)?\d{3})(?=\s*(?:,|\/|$|\.\.|superseded))/g)) { /* bare numbers after a prefixed id are covered by the prefixed pattern */ }
    return [...ids]; };
  const isNote = (r) => /^(CORRECTION|TEST NOTE|\(test note\)|RE-EVALUATION)/i.test(r.control || "") || (/^TEST MISTAKE/i.test(r.actual || "") && /^[A-Z]{3}-\d{3}/.test(r.control || ""));
  for (const r of behaviour) if (isNote(r)) for (const id of expand(r.control)) { const t = byId.get(id); if (t && t !== r && !isNote(t) && !t.supersededBy) t.supersededBy = r.id; }
  for (const r of behaviour) if (r.supersededBy) { r.originalResult = r.result; r.result = "SUPERSEDED"; r.actual = "[first-run " + r.originalResult + ", superseded by " + r.supersededBy + " (test mistake or corrected expectation: see that row)] " + r.actual; } }
// ---- crawl: page inventory
const pages = []; const controlsOut = [];
const dedupe = (arr) => { const m = new Map(); for (const p of arr) { if (/\[[^\]]+\]/.test(p.requested || "")) continue; const k = p.state + "|" + p.width + "|" + p.requested; const prev = m.get(k); if (prev && prev.error && !p.error) p.note = "first attempt failed (" + prev.error + "), retried OK"; m.set(k, p); } return [...m.values()]; };
for (const f of files.filter((x) => /^crawl-.*\.jsonl$/.test(x))) for (const p of dedupe(lines(f))) {
  const real = (p.badResponses || []).filter((b) => !(b.status === 503 && /\/api\/(admin|ai|auth|billing|push|newsletter|waitlist|launch-access|card|psa|upc|comic|vinyl)/.test(b.url)));
  pages.push({ state: p.state, width: p.width, route: p.route, requested: p.requested, finalPath: p.finalPath || "", redirected: p.redirected ? "yes" : "", title: p.title || "", h1: p.h1 || "", settled: p.settled === false ? "no" : "yes", consoleErrors: (p.consoleErrors || []).length, failedRequests: real.map((b) => b.status + " " + b.url).slice(0, 4).join(" | "), overflowX: p.overflowX ? "YES" : "", controls: p.controls ? p.controls.length : 0, controlKinds: p.controlCounts ? Object.entries(p.controlCounts).map(([k, v]) => k + ":" + v).join(" ") : "", screenshot: p.shot || "", note: p.note || p.error || "" });
  for (const c of p.controls || []) controlsOut.push({ state: p.state, width: p.width, page: p.requested, kind: c.kind, label: c.label, href: c.href, target: c.target, region: c.region, visible: c.visible ? "yes" : "no", disabled: c.disabled ? "yes" : "", tag: c.tag });
}
// ---- smoke rows from probes
const smoke = []; let n = 0;
const verified = rd("noeffect-verified.json", []); const vmap = new Map(verified.map((v) => [v.kind + "|" + v.label, v]));
const noEffCount = new Map();
for (const f of files.filter((x) => /^probe-.*\.jsonl$/.test(x))) for (const pg of lines(f)) for (const p of pg.probes || []) if (p.effect === "NO VISIBLE EFFECT" && pg.width < 700) { const k = p.kind + "|" + p.label; noEffCount.set(k, (noEffCount.get(k) || 0) + 1); }
for (const f of files.filter((x) => /^probe-.*\.jsonl$/.test(x))) for (const pg of lines(f)) {
  for (const p of pg.probes) {
    if (p.kind === "link") continue;
    n++;
    const base = { id: "SMK-" + String(n).padStart(4, "0"), area: "SMK", page: `${pg.page} | ${pg.state} ${pg.width}px`, control: `${p.kind}: ${p.label || "(no label)"}`, evidence: "", impact: "", repro: `Open ${pg.page} as ${pg.state} at ${pg.width}px; click '${p.label || p.kind}'.`, depth: "smoke-responds-only" };
    if (p.effect === "NO VISIBLE EFFECT") {
      const v = vmap.get(p.kind + "|" + p.label);
      if (v && v.result === "responds") smoke.push({ ...base, expected: "Responds to a click", actual: "First probe saw no text/DOM change within 0.8 s; the re-check (mouse click, 2.2 s, screenshot comparison) shows the control does respond (pixels/DOM changed). Outcome correctness NOT asserted.", result: "PASS", evidence: "noeffect-verified.json" });
      else if (p.kind === "select") smoke.push({ ...base, expected: "Dropdown can be changed", actual: "Native select: opening it has no page-visible effect; changing its value is covered by behaviour rows where a suite exists", result: "NOT TESTED" });
      else if (/^(Dismiss|Install)$/.test(p.label)) smoke.push({ ...base, expected: "Install banner buttons work", actual: "The banner depends on the browser's install-prompt event, which headless Chrome fires unpredictably; not judged. (Other auditors recorded that the banner can cover controls on phones.)", result: "NOT TESTED" });
      else if (pg.width < 700 && p.region === "main" && (noEffCount.get(p.kind + "|" + p.label) || 0) >= 8) smoke.push({ ...base, expected: "Responds to a click", actual: "Control belongs to a panel that is in the page's DOM but not shown on this page at phone width (it repeats on " + noEffCount.get(p.kind + "|" + p.label) + " pages); not a visible control", result: "NOT TESTED" });
      else if (vmap.get(p.kind + "|" + p.label)) smoke.push({ ...base, expected: "Responds to a click", actual: "Candidate no-effect on this page/width; the same control could not be re-found for the screenshot re-check (" + vmap.get(p.kind + "|" + p.label).result + ")", result: "NOT TESTED" });
      else smoke.push({ ...base, expected: "Responds to a click (label: " + (p.label || "") + ")", actual: "No visible effect within 0.8 s" + (p.covered ? "; element under the click point: " + p.covered : "") + " (UNCONFIRMED candidate: not re-checked with screenshots)", result: "FAIL", impact: "usability" });
    }
    else if (p.disabled) smoke.push({ ...base, expected: "A disabled control explains why", actual: "Disabled; explanation not checked by the smoke probe", result: "NOT TESTED" });
    else if (p.note) smoke.push({ ...base, expected: "Form field works", actual: p.note, result: "NOT TESTED" });
    else if (p.error || /could not be clicked/.test(p.effect || "")) smoke.push({ ...base, expected: "Can be clicked", actual: p.error || p.effect, result: "NOT TESTED" });
    else smoke.push({ ...base, expected: "Responds to a click", actual: "Responds: " + p.effect + ". Correctness of the outcome is NOT asserted here.", result: "PASS" });
  }
  for (const s of pg.skipped || []) { n++; smoke.push({ id: "SMK-" + String(n).padStart(4, "0"), area: "SMK", page: `${pg.page} | ${pg.state} ${pg.width}px`, control: s.label, expected: "(not exercised by the generic probe)", actual: s.why, result: "NOT TESTED", evidence: "", impact: "", repro: "", depth: "skipped-by-generic-probe" }); }
}
// ---- link rows
const links = rd("links-internal.json", []);
for (const l of links) { n++; smoke.push({ id: "SMK-" + String(n).padStart(4, "0"), area: "LNK", page: `${l.example} (and ${Math.max(0, l.linkedFromPages - 1)} more)`, control: `link '${l.label || ""}' -> ${l.path}`, expected: "Leads to a page that exists", actual: l.status >= 400 || l.status < 0 ? "HTTP " + l.status : l.status >= 300 ? "Redirects (" + l.status + ") to " + l.redirect : "HTTP " + l.status, result: l.status >= 400 || l.status < 0 ? "FAIL" : "PASS", evidence: "links-internal.json", impact: l.status >= 400 ? "blocked workflow" : "", repro: `Click it on ${l.example}.`, depth: "link-resolves-only" }); }
const RCs = rd("root-causes.json", []); const rcOf = new Map(); for (const rc of RCs) for (const id of rc.rowIds) if (!rcOf.has(id)) rcOf.set(id, rc);
for (const r of behaviour) { r.triage = ""; if (r.result === "FAIL") { const rc = rcOf.get(r.id); r.triage = rc ? "confirmed defect: " + rc.id + " (P" + rc.priority + ")" : "UNRECONCILED first-run failure (the auditor reports most of these as its own test mistakes; not individually superseded)"; } else if (r.result === "SUPERSEDED") r.triage = "first-run failure replaced by " + r.supersededBy; }
for (const r of smoke) r.triage = r.result === "FAIL" ? "UNCONFIRMED smoke candidate" : "";
const all = [...behaviour, ...smoke];
const cols = ["id", "area", "page", "control", "expected", "actual", "result", "triage", "evidence", "impact", "repro", "depth"];
fs.writeFileSync(AUD + "/results.csv", csv(cols, all));
fs.writeFileSync(AUD + "/inventory-pages.csv", csv(["state", "width", "route", "requested", "finalPath", "redirected", "title", "h1", "settled", "consoleErrors", "failedRequests", "overflowX", "controls", "controlKinds", "screenshot", "note"], pages));
fs.writeFileSync(AUD + "/inventory-controls.csv", csv(["state", "width", "page", "kind", "label", "href", "target", "region", "visible", "disabled", "tag"], controlsOut));
const tally = (arr) => arr.reduce((a, r) => { a[r.result] = (a[r.result] || 0) + 1; return a; }, {});
const summary = { generated: new Date().toISOString(), rows: all.length, behaviourRows: behaviour.length, smokeRows: smoke.length, byResult: tally(all), confirmedDefectRows: behaviour.filter((r) => r.result === "FAIL" && rcOf.has(r.id)).length, unreconciledFailRows: behaviour.filter((r) => r.result === "FAIL" && !rcOf.has(r.id)).length, rootCauses: RCs.length, behaviourByResult: tally(behaviour), pages: pages.length, controls: controlsOut.length, apiRoutes: rd("api-inventory.json", []).length, staticRoutes: (rd("routes-static.json", { pages: [] }).pages || []).length, byArea: all.reduce((a, r) => { a[r.area] = a[r.area] || {}; a[r.area][r.result] = (a[r.area][r.result] || 0) + 1; return a; }, {}) };
fs.writeFileSync(AUD + "/summary.json", JSON.stringify(summary, null, 1));
const rootCauses = rd("root-causes.json", []);
const data = { summary, rows: all, pages, rootCauses, api: rd("api-inventory.json", []), routes: (rd("routes-static.json", { pages: [] }).pages || []).map((r) => ({ route: r.route, file: r.file, dynamic: r.dynamic, guard: r.guard, linkedFrom: r.linkedFrom })), extLinks: rd("links-external.json", []) };
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>VLTD audit 2026-10-18</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{font:14px/1.45 system-ui,Segoe UI,sans-serif;margin:0;background:#101214;color:#e6e8ea}header{padding:16px 24px;border-bottom:1px solid #2a2e33}h1{margin:0;font-size:20px}h2{font-size:16px;margin:26px 24px 8px}
.wrap{padding:0 24px 40px}.cards{display:flex;gap:10px;flex-wrap:wrap;margin:12px 24px}.card{background:#181b1e;border:1px solid #2a2e33;border-radius:8px;padding:10px 14px;min-width:110px}.card b{display:block;font-size:20px}
.SUPERSEDED{color:#7d8791}.PASS{color:#6fd08c}.FAIL{color:#ff7b72}.BLOCKED{color:#e3b341}.NOT\\ TESTED{color:#9aa4ad}
table{border-collapse:collapse;width:100%;font-size:12.5px}th,td{border-bottom:1px solid #23272b;padding:6px 8px;text-align:left;vertical-align:top}th{position:sticky;top:0;background:#181b1e;cursor:pointer}
input,select{background:#181b1e;color:#e6e8ea;border:1px solid #2a2e33;border-radius:6px;padding:6px 8px;margin:0 6px 8px 0}a{color:#7cc4ff}.small{color:#9aa4ad;font-size:12px}.pill{border-radius:10px;padding:1px 8px;border:1px solid #2a2e33}
details{margin:0 24px 8px;background:#181b1e;border:1px solid #2a2e33;border-radius:8px;padding:8px 12px}summary{cursor:pointer}</style></head><body>
<header><h1>VLTD application audit — 2026-10-18</h1><div class="small">Inventory and behaviour results. Depth tells you how much a PASS proves: <b>behaviour-asserted</b> (a test checked the outcome), <b>smoke-responds-only</b> (the control did something; the outcome was not judged), <b>link-resolves-only</b>.</div></header>
<div id="cards" class="cards"></div>
<h2>Prioritized defects (root causes)</h2><div id="rc" class="wrap"></div>
<h2>All results</h2><div class="wrap"><input id="q" placeholder="search…" size="30"><select id="fr"><option value="">any result</option><option>PASS</option><option>FAIL</option><option>BLOCKED</option><option>NOT TESTED</option><option>SUPERSEDED</option></select><select id="fa"><option value="">any area</option></select><select id="fd"><option value="">any depth</option></select><select id="fi"><option value="">any impact</option></select> <span id="count" class="small"></span>
<table id="t"><thead><tr><th>ID</th><th>Page and state</th><th>Control / workflow</th><th>Expected</th><th>Actual</th><th>Result</th><th>Triage</th><th>Evidence</th><th>Impact</th><th>Reproduction</th><th>Depth</th></tr></thead><tbody></tbody></table><div><button id="more">show more</button></div></div>
<h2>Pages inventoried</h2><div class="wrap"><input id="pq" placeholder="filter pages…" size="30"><table id="pt"><thead><tr><th>State</th><th>Requested</th><th>Ended at</th><th>Heading</th><th>Controls</th><th>Console errors</th><th>Failed requests</th><th>Sideways scroll</th><th>Screenshot</th></tr></thead><tbody></tbody></table></div>
<h2>Routes (from the repository)</h2><div class="wrap"><table id="rt"><thead><tr><th>Route</th><th>Source</th><th>Linked from (files)</th><th>Guard</th></tr></thead><tbody></tbody></table></div>
<h2>API routes</h2><div class="wrap"><table id="at"><thead><tr><th>Route</th><th>Methods</th><th>Caller checks found in code</th><th>Probe</th></tr></thead><tbody></tbody></table></div>
<script id="d" type="application/json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>
<script>
const D=JSON.parse(document.getElementById('d').textContent);const $=s=>document.querySelector(s);const esc=s=>String(s??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
$('#cards').innerHTML=[['Static routes',D.summary.staticRoutes],['Page visits',D.summary.pages],['Controls inventoried',D.summary.controls],['API routes',D.summary.apiRoutes],['Result rows',D.summary.rows],...Object.entries(D.summary.byResult).map(([k,v])=>[k,v])].map(([k,v])=>'<div class="card"><span class="small">'+esc(k)+'</span><b class="'+esc(k)+'">'+v+'</b></div>').join('');
$('#rc').innerHTML=D.rootCauses.length?D.rootCauses.map(r=>'<details '+(r.priority<=2?'open':'')+'><summary><b>P'+r.priority+'</b> '+esc(r.title)+' <span class="pill">'+esc(r.impact)+'</span> <span class="small">'+(r.rowIds||[]).length+' rows</span></summary><div>'+esc(r.summary)+'</div><div class="small">'+(r.rowIds||[]).map(esc).join(', ')+'</div></details>').join(''):'<div class="small">Not yet assembled.</div>';
const areas=[...new Set(D.rows.map(r=>r.area))].sort(),depths=[...new Set(D.rows.map(r=>r.depth))],imps=[...new Set(D.rows.map(r=>r.impact).filter(Boolean))];
areas.forEach(a=>$('#fa').insertAdjacentHTML('beforeend','<option>'+esc(a)+'</option>'));depths.forEach(a=>$('#fd').insertAdjacentHTML('beforeend','<option>'+esc(a)+'</option>'));imps.forEach(a=>$('#fi').insertAdjacentHTML('beforeend','<option>'+esc(a)+'</option>'));
let shown=300;const ord={FAIL:0,BLOCKED:1,'NOT TESTED':3,PASS:2,SUPERSEDED:4};
function draw(){const q=$('#q').value.toLowerCase(),fr=$('#fr').value,fa=$('#fa').value,fd=$('#fd').value,fi=$('#fi').value;
let rows=D.rows.filter(r=>(!fr||r.result===fr)&&(!fa||r.area===fa)&&(!fd||r.depth===fd)&&(!fi||r.impact===fi)&&(!q||JSON.stringify(r).toLowerCase().includes(q)));rows.sort((a,b)=>(ord[a.result]-ord[b.result])||a.id.localeCompare(b.id));
$('#count').textContent=rows.length+' rows';$('#t tbody').innerHTML=rows.slice(0,shown).map(r=>'<tr><td>'+esc(r.id)+'</td><td>'+esc(r.page)+'</td><td>'+esc(r.control)+'</td><td>'+esc(r.expected)+'</td><td>'+esc(r.actual)+'</td><td class="'+esc(r.result)+'"><b>'+esc(r.result)+'</b></td><td class="small">'+esc(r.triage||'')+'</td><td>'+(r.evidence?String(r.evidence).split(' ; ').map(e=>'<a href="'+esc(e)+'" target="_blank">'+esc(e.split('/').pop())+'</a>').join('<br>'):'')+'</td><td>'+esc(r.impact)+'</td><td>'+esc(r.repro)+'</td><td class="small">'+esc(r.depth)+'</td></tr>').join('');$('#more').style.display=rows.length>shown?'':'none';}
['#q','#fr','#fa','#fd','#fi'].forEach(s=>$(s).addEventListener('input',()=>{shown=300;draw();}));$('#more').onclick=()=>{shown+=500;draw();};draw();
function pdraw(){const q=$('#pq').value.toLowerCase();$('#pt tbody').innerHTML=D.pages.filter(p=>!q||JSON.stringify(p).toLowerCase().includes(q)).map(p=>'<tr><td>'+esc(p.state)+' '+p.width+'</td><td>'+esc(p.requested)+'</td><td>'+esc(p.finalPath)+'</td><td>'+esc(p.h1)+'</td><td>'+p.controls+'</td><td>'+p.consoleErrors+'</td><td>'+esc(p.failedRequests)+'</td><td>'+esc(p.overflowX)+'</td><td>'+(p.screenshot?'<a href="'+esc(p.screenshot)+'" target="_blank">view</a>':'')+'</td></tr>').join('');}
$('#pq').addEventListener('input',pdraw);pdraw();
$('#rt tbody').innerHTML=D.routes.map(r=>'<tr><td>'+esc(r.route)+'</td><td class="small">'+esc(r.file)+'</td><td>'+r.linkedFrom+'</td><td>'+esc(r.guard)+'</td></tr>').join('');
$('#at tbody').innerHTML=D.api.map(r=>'<tr><td>'+esc(r.route)+'</td><td>'+esc(r.methods)+'</td><td>'+esc(r.authSignals)+'</td><td>'+esc(r.probe)+'</td></tr>').join('');
</script></body></html>`;
fs.writeFileSync(AUD + "/report.html", html);
console.log(JSON.stringify(summary.byResult), "rows", all.length, "pages", pages.length, "controls", controlsOut.length);
