// GIN insurance suite 5: phone width 390 (browser-emulated touch) on the insurance routes and reports.
const L = require("./audit-s-gin-lib.cjs");
const { R, sleep, man, clickEl } = L;
(async () => {
  const m = man(); const st = m.stamp; const id1 = `qa_vz_${st}_1`;
  const S = await L.session("owner", { width: 390, height: 844, mobile: true });
  const PH = "390x844 browser-emulated phone";
  try {
    await S.visit("/vault"); await S.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 3", 90000); await sleep(1500);
    const routes = [["/insurance", "Insurance inventory"], [`/insurance/item?id=${id1}`, "Item sheet"], ["/insurance/packet", "Policy packet"], ["/reports/insurance", "Insurance report"], ["/portfolio/insurance", "Inventory schedule"], ["/reports/weekly", "Weekly report"]];
    for (const [path, name] of routes) {
      await S.visit(path); await sleep(3500);
      const g = await S.evaluate(`(() => { const ov = document.documentElement.scrollWidth - innerWidth; const wraps = [...document.querySelectorAll('.overflow-x-auto')].map((w) => ({ sw: w.scrollWidth, cw: w.clientWidth })); const small = [...document.querySelectorAll('main a, main button, main label, main input[type=checkbox]')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1 && r.height < 44; }).length; const tot = [...document.querySelectorAll('main a, main button, main label, main input[type=checkbox]')].filter((e) => e.getBoundingClientRect().width > 1).length; return { ov, wraps, small, tot }; })()`);
      R.check(g.ov <= 1, { page: `${path} | owner, Personal | ${PH}`, control: `${name} at phone width: no sideways page scroll`, expected: "The page fits 390px; wide tables scroll inside their own box", actual: `page overflow ${g.ov}px; table boxes ${JSON.stringify(g.wraps)}; ${g.small} of ${g.tot} controls under 44px tall`, evidence: await L.SHOT(S, "phone-" + name.replace(/\W+/g, "-").toLowerCase()), impact: "usability", repro: `Open ${path} at 390px.` });
    }
    // packet controls by touch
    await S.visit("/insurance/packet"); await S.waitFor("document.querySelectorAll('table tbody tr').length > 5", 60000); await sleep(1500);
    await L.tapEl(S, `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Next')`); await sleep(700);
    const pg = (await L.mainText(S)).match(/Page (\d+) of (\d+)/)?.[0];
    R.check(/Page 2 of 2/.test(pg || ""), { page: "/insurance/packet | " + PH, control: "Next by touch (browser-emulated)", expected: "Page 2 of 2", actual: pg, evidence: await L.SHOT(S, "phone-packet-next"), impact: "blocked workflow", repro: "Tap Next." });
    const sizes = await S.evaluate(`['Prev', 'Next', 'Open Printable Page'].map((l) => { const e = [...document.querySelectorAll('button, a')].find((b) => b.textContent.trim() === l); const r = e.getBoundingClientRect(); return l + ' ' + Math.round(r.width) + 'x' + Math.round(r.height); })`);
    R.check(sizes.every((s) => Number(s.split("x")[1]) >= 44), { page: "/insurance/packet | " + PH, control: "Packet control tap sizes (Prev, Next, Open Printable Page)", expected: "At least 44px tall", actual: sizes.join("; "), evidence: "", impact: "usability", repro: "Measure at 390px." });
    // checkbox by touch on /insurance
    await S.visit("/insurance"); await S.waitFor("document.querySelectorAll('table tbody tr').length > 5", 60000); await sleep(1500);
    await L.tapEl(S, `[...document.querySelectorAll('input[type=checkbox]')][1]`); await sleep(600);
    const inc = (await L.mainText(S)).match(/Included (\d+) of (\d+)/)?.[0];
    R.check(/Included 30 of 31/.test(inc || ""), { page: "/insurance | " + PH, control: "Row Include checkbox by touch", expected: "Included 30 of 31", actual: inc, evidence: "", impact: "usability", repro: "Tap a row checkbox." });
    await L.tapEl(S, `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Include all')`); await sleep(600);
    R.check(/Included 31 of 31/.test((await L.mainText(S))), { page: "/insurance | " + PH, control: "Include all by touch", expected: "Included 31 of 31", actual: (await L.mainText(S)).match(/Included \d+ of \d+/)?.[0], evidence: "", impact: "usability", repro: "Tap Include all." });
  } finally { await S.evaluate("localStorage.removeItem('vltd_insurance_excluded_item_ids_v1'); true").catch(() => {}); await S.close(); }
})().catch((e) => { console.error("ERR", e); process.exit(2); });
