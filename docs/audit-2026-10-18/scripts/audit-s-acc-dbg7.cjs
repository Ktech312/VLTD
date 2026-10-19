const A = require("./audit-s-acc-lib.cjs");
const { R } = A; const r = R("ACC");
(async () => {
  const S = await A.session("owner", { width: 1440, height: 900 });
  try {
    await S.visit("/activity"); await A.sleep(2500);
    await A.clickExpr(S, "[...document.querySelectorAll('main button')].find((b) => /QA Album 2 - /.test(b.innerText))", {}); await A.sleep(1000);
    const before = await S.evaluate("(() => { const a = document.querySelector('aside'); return a ? { text: a.innerText.replace(/\\s+/g, ' ').slice(0, 160), btns: [...a.querySelectorAll('button')].map((b) => (b.getAttribute('aria-label') || b.title || b.innerText).trim() + '@' + Math.round(b.getBoundingClientRect().x) + ',' + Math.round(b.getBoundingClientRect().y)) } : null; })()");
    console.log("before", JSON.stringify(before));
    await S.jshot("acc-activity-detail-open-1440");
    const ok = await A.clickExpr(S, "[...document.querySelectorAll('aside button')].find((b) => (b.getAttribute('aria-label') || '') === 'Close')", {});
    await A.sleep(900);
    const after = await S.evaluate("(() => { const a = document.querySelector('aside'); return a ? a.innerText.replace(/\\s+/g, ' ').slice(0, 160) : null; })()");
    console.log("clicked", ok, "after", after);
    await S.jshot("acc-activity-detail-closed-1440");
    const closed = !/QA Album/.test(after || "");
    r.check(closed, { page: "/activity | owner, Personal, 26 items | 1440", control: "Activity details panel: Close (X)", expected: "the details panel returns to 'Select an activity to see details'", actual: `before: ${before && before.text}; after: ${after}`, evidence: "shots/acc-activity-detail-closed-1440.jpg", impact: "usability", repro: "Open /activity; click a row; click the X in the details panel" });
    // Dismiss (second button)
    await A.clickExpr(S, "[...document.querySelectorAll('main button')].find((b) => /QA Album 3 - /.test(b.innerText))", {}); await A.sleep(800);
    const ok2 = await A.clickExpr(S, "[...document.querySelectorAll('aside button')].find((b) => /^Dismiss$/.test(b.innerText.trim()))", {}); await A.sleep(900);
    const rowStill = await S.evaluate("[...document.querySelectorAll('main button')].some((b) => /QA Album 3 - /.test(b.innerText))");
    const after2 = await S.evaluate("(() => { const a = document.querySelector('aside'); return a ? a.innerText.replace(/\\s+/g, ' ').slice(0, 160) : null; })()");
    await S.visit("/activity"); await A.sleep(2500); const rowAfterReload = await S.evaluate("[...document.querySelectorAll('main button')].some((b) => /QA Album 3 - /.test(b.innerText))");
    r.pass({ page: "/activity | owner, Personal, 26 items | 1440", control: "Activity details panel: Dismiss", expected: "(informational) what Dismiss does to the entry", actual: `clicked=${ok2}; entry still listed=${rowStill}; after reload the entry is listed again=${rowAfterReload}; panel now: ${after2}`, evidence: "", impact: "improvement", repro: "Click a row; click Dismiss" });
  } finally { await S.close(); }
})();
