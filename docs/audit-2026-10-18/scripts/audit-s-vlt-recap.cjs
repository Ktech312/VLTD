// VLT: recap card generation, observed directly (first run VLT-403 was a weak assertion).
const X = require("./audit-s-vlt-vlib.cjs");
const { R, sleep, squash, clickEl, fs } = X; const r = R("VLT");
(async () => {
  const S = await X.session("owner");
  try {
    await S.visit("/vault"); await S.visit("/portfolio"); await sleep(1500);
    await clickEl(S, "[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Collection tools')", { js: true }); await sleep(500);
    await clickEl(S, "[...document.querySelectorAll('[role=menuitem]')].find((a) => /Collection recap/.test(a.innerText))", { js: true }); await sleep(2000);
    S.consoleErrors.length = 0;
    const btn = await S.evaluate("(() => { const b = [...document.querySelectorAll('[role=dialog] button')].find((x) => /Generate recap card/.test(x.innerText)); return b ? { disabled: b.disabled, text: b.innerText } : null; })()");
    const clicked = await clickEl(S, "[...document.querySelectorAll('[role=dialog] button')].find((b) => /Generate recap card/.test(b.innerText))", { js: true });
    let state = null;
    for (let i = 0; i < 20; i++) { await sleep(1000); state = await S.evaluate("(() => { const d = document.querySelector('[role=dialog]'); const img = d && d.querySelector('img[alt=\"Collection recap card\"]'); return { img: !!img, imgOk: img ? img.naturalWidth : 0, buttons: d ? [...d.querySelectorAll('button')].map((b) => b.innerText.trim()).filter(Boolean) : [] }; })()"); if (state.img) break; }
    console.log(JSON.stringify({ btn, clicked, state, errors: S.consoleErrors }));
    r.check(state.img && state.imgOk > 0 && state.buttons.includes("Download"), { page: "/portfolio | owner, Personal | Collection recap sheet", control: "Generate recap card", expected: "Shows a 9:16 recap image preview with Regenerate / Share / Download", actual: JSON.stringify({ btn, state, console: S.consoleErrors.slice(0, 2) }), evidence: await S.jshot("vlt-insights-recap-generate"), impact: "blocked workflow", repro: "Insights > Collection tools > Collection recap > Generate recap card" });
    if (state.img) {
      await S.evaluate("window.__aud.downloads.length = 0; true");
      await clickEl(S, "[...document.querySelectorAll('[role=dialog] button')].find((b) => b.innerText.trim() === 'Download')", { js: true }); await sleep(800);
      const lk = await S.look();
      r.check(lk.downloads.some((d) => /vltd-wrapped-2026\.png/.test(d)), { page: "/portfolio | owner, Personal | Collection recap sheet", control: "Recap Download", expected: "Saves vltd-wrapped-2026.png", actual: JSON.stringify(lk.downloads), impact: "blocked workflow", repro: "Download" });
    }
    r.pass({ page: "/portfolio | owner, Personal", control: "(correction) VLT-398 same-day snapshot", expected: "(by design, disclosed) 'value is recorded once a day'", actual: "VLT-398 is recorded FAIL by my script but the page states value is recorded once a day; I re-classify it as an improvement: after re-pricing, the chart/Total Value Change keep the morning figure until the next day while the Total Vault Value card is live", evidence: "", impact: "improvement", repro: "see VLT-398" });
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });
