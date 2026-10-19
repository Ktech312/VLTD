// GIN extra checks: print-media contrast and top bar, goals loading state / no Upcoming Milestones, packet history and refresh, superseding rows.
const L = require("./audit-s-gin-lib.cjs");
const { R, admin, sleep, man, clickEl, X } = L;
(async () => {
  const m = man(); const P = m.personalId, st = m.stamp; const id1 = `qa_vz_${st}_1`;
  const S = await L.session("owner");
  try {
    // ---- item sheet print contrast
    await S.visit(`/insurance/item?id=${id1}`); await S.waitFor("document.querySelector('main section h1')", 60000); await sleep(1500);
    await S.send("Emulation.setEmulatedMedia", { media: "print" }); await sleep(700);
    const c = await S.evaluate(`(() => { const lum = (s) => { const m = s.match(/[\\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); }; const cr = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }; const bg = getComputedStyle(document.querySelector('main section')).backgroundColor; const pick = (el) => ({ color: getComputedStyle(el).color, ratio: Math.round(cr(getComputedStyle(el).color, bg) * 100) / 100 }); const h1 = document.querySelector('main section h1'); const spans = [...document.querySelectorAll('main section span.font-semibold')].map((e) => ({ t: e.textContent.trim(), ...pick(e) })); return { bg, h1: pick(h1), spans }; })()`);
    const shot = await L.SHOT(S, "ins-item-print-contrast");
    await S.send("Emulation.setEmulatedMedia", { media: "" });
    const low = [c.h1, ...c.spans].filter((x) => x.ratio < 4.5);
    R.check(low.length === 0, { page: `/insurance/item?id=${id1} | print media`, control: "Item sheet print: title, Purchase Cost and Current Value legibility", expected: "Black text on white (contrast at least 4.5:1) for everything on the printed sheet", actual: `Title colour ${c.h1.color} (contrast ${c.h1.ratio}:1); money figures ${c.spans.map((s) => `${s.t} ${s.color} ${s.ratio}:1`).join("; ")} on ${c.bg}. The print CSS whitens backgrounds but the title and the money figures keep the dark-theme light grey text, so they print almost invisible.`, evidence: shot, impact: "misleading result", repro: "Emulate print media (or Print preview) on a per-item sheet: title and cost/value are barely visible." });
    // ---- top bar printing
    for (const [p, nm, wait] of [["/insurance", "inventory", "document.querySelectorAll('table tbody tr').length > 5"], [`/insurance/item?id=${id1}`, "item sheet", "document.querySelector('main section h1')"], ["/reports/insurance", "insurance report", "document.querySelectorAll('table tbody tr').length > 5"], ["/portfolio/insurance", "inventory schedule", "document.querySelectorAll('table tbody tr').length > 5"]]) {
      await S.visit(p); await S.waitFor(wait, 60000); await sleep(1500);
      await S.send("Emulation.setEmulatedMedia", { media: "print" }); await sleep(600);
      const bar = await S.evaluate(`(() => [...document.querySelectorAll('body *')].filter((x) => { const cs = getComputedStyle(x); const r = x.getBoundingClientRect(); return cs.display !== 'none' && r.height > 30 && r.top < 6 && r.width > innerWidth * 0.8 && /Home.*Vault.*Exhibitions/s.test(x.textContent) && x.children.length > 1; }).length)()`);
      const sh = await L.SHOT(S, "print-topbar-" + nm.replace(/\s+/g, "-"));
      await S.send("Emulation.setEmulatedMedia", { media: "" });
      R.check(bar === 0, { page: `${p} | print media`, control: `${nm} print layout: site top navigation bar`, expected: "The printout contains the document only, not the site navigation (Home / Vault / Exhibitions / search / account)", actual: `${bar} full-width navigation bar element(s) still displayed in print media at the top of the page (emulated print media; screenshot)`, evidence: sh, impact: "cosmetic", repro: `Emulate print media on ${p}.` });
    }
    // ---- goals: no Upcoming Milestones
    await L.gotoGoals(S, { vault: true });
    const gt = await L.mainText(S);
    R.check(!/Upcoming Milestones|Milestones will appear|goal due dates|goal model/i.test(gt), { page: "/goals | owner, Personal", control: "'Upcoming Milestones' removed", expected: "No milestones panel or placeholder text anywhere", actual: `No milestones/placeholder text on the page; side panel sections: ${await S.evaluate("[...document.querySelectorAll('main aside h3')].map((h) => h.textContent.trim()).join(' | ')")}`, evidence: "", impact: "cosmetic", repro: "Open Goals." });
  } finally { await S.close(); }
  // loading state sampled while loading (fresh browser)
  const S2 = await L.session("owner");
  try {
    await S2.go("/goals");
    let seen = false; const t0 = Date.now();
    while (Date.now() - t0 < 12000) { const t = await S2.evaluate("document.body ? document.body.innerText : ''").catch(() => ""); if (/Loading your goals/.test(t)) { seen = true; break; } await sleep(40); }
    await sleep(3500);
    R.check(seen, { page: "/goals | owner, Personal, clean browser", control: "Loading state while goals are fetched", expected: "'Loading your goals...' (not 'No goals yet') while the first fetch is in flight", actual: seen ? "Loading message seen before the list" : "no loading message observed in 12 s of 40 ms sampling", evidence: "", impact: "usability", repro: "Open /goals in a new browser; watch the first second." });
  } finally { await S2.close(); }
  // ---- packet history + refresh
  const S3 = await L.session("owner");
  try {
    await S3.visit("/insurance"); await S3.waitFor("document.querySelectorAll('table tbody tr').length > 5", 60000); await sleep(1500);
    await clickEl(S3, `[...document.querySelectorAll('a')].find((a) => /Policy Packet \\(PDF\\)/.test(a.textContent))`, { js: true });
    await S3.waitFor("location.pathname === '/insurance/packet'", 20000); await sleep(1500);
    await clickEl(S3, `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Next')`, { js: true }); await sleep(600);
    await S3.visit("/insurance/packet"); await S3.waitFor("document.querySelectorAll('table tbody tr').length > 5", 60000); await sleep(1500);
    const pg = (await L.mainText(S3)).match(/Page \d+ of \d+/)?.[0];
    R.nt({ page: "/insurance/packet | owner, Personal", control: "Refresh on page 2 / Back-Forward inside the packet", expected: "n/a (page number and 'Include images' are not in the URL)", actual: `After going to page 2 and refreshing the packet shows '${pg}': the page and image setting are held in memory only. Not a defect against a stated promise; improvement note.`, evidence: "", impact: "improvement", repro: "Open the packet, Next, refresh." });
    await S3.evaluate("history.back(); true"); await S3.waitFor("location.pathname === '/insurance'", 20000); await sleep(1500);
    const okB = await S3.evaluate("document.querySelectorAll('table tbody tr').length");
    await S3.evaluate("history.forward(); true"); await S3.waitFor("location.pathname === '/insurance/packet'", 20000); await sleep(2000);
    const okF = await S3.evaluate("document.querySelectorAll('table tbody tr').length");
    R.check(okB > 5 && okF > 5, { page: "/insurance -> /insurance/packet | owner, Personal", control: "Browser Back then Forward between inventory and packet", expected: "Both pages show their lists after Back and Forward", actual: `after Back: ${okB} inventory rows; after Forward: ${okF} packet rows`, evidence: "", impact: "usability", repro: "Inventory -> Policy Packet -> Back -> Forward." });
  } finally { await S3.close(); }
  // ---- corrections and supersessions
  R.fail({ page: "/goals | owner, Personal, 26 items", control: "Suggested Action 'View set' link: 'Uses the current goal and matching vault items.' (the claim GIN-034 did not assert)", expected: "The Vault opens already filtered to the goal's category/subject (the sentence under the link says it uses the current goal and matching items)", actual: "Link goes to plain /vault listing all 26 items with no filter for the goal's category (GIN-034 evidence): the sentence under the link is untrue for set goals", evidence: "shots/gin-goals-suggested-vault.jpg", impact: "misleading result", repro: "Select 'Complete the Spider-Man run' (Pop Culture), click Suggested Action." });
  R.fail({ page: "/goals | owner, Personal, goal with 8 matching items (target 12)", control: "'View all' (Items In Goal), precise result (replaces the wording of GIN-037)", expected: "'View all' lists all 8 matching items", actual: "Before: 5 thumbnails and a '+7' tile; after clicking View all: still 5 thumbnails, the '+7' tile disappears, button becomes 'Show less'. Heading reads 'Items In Goal (12)' (the target) while 8 items match. At most 5 items can ever be shown.", evidence: "shots/gin-goals-view-all.jpg", impact: "misleading result", repro: "Select the goal, click View all, count thumbnails." });
  R.nt({ page: "(correction) GIN rows", control: "CORRECTION: GIN-007, GIN-010, GIN-037, GIN-065, GIN-081 and GIN-148 superseded or reworded", expected: "First-run rows that were wrong because of a test mistake are excluded from the defect count", actual: "GIN-007 (PASS) used a condition that the fixture's public exhibition made true; the real check is GIN-026. GIN-010 (FAIL) clicked the third row but the list order had changed so a different goal was third; the side panel correctly showed the clicked row; re-check is GIN-027 (PASS). GIN-037 wording ('7 thumbnails', 'stays/disappears') is imprecise: see the precise row. GIN-065 (Enter does not save) is an improvement note, not a defect. GIN-081 (PASS) wording overstates: with 3 goals the side panel was visible at y=643 after a tap. GIN-148 (PASS) records that the site top bar still prints; the dedicated rows for that are the 'print layout: site top navigation bar' series.", evidence: "", impact: "none", repro: "n/a" });
})().catch((e) => { console.error("ERR", e); process.exit(2); });
