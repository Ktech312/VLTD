const X = require("./audit-s-vlt-vlib.cjs");
const { R, sleep, clickEl } = X; const r = R("VLT");
(async () => {
  const S = await X.session("owner");
  try {
    await S.visit("/vault"); await S.visit("/vault/frames"); await sleep(1500);
    await clickEl(S, "[...document.querySelectorAll('button')].find((b) => /^QA Album 1 /.test(b.innerText))", { js: true }); await sleep(1500);
    const cap = () => S.evaluate("(() => { const c = [...document.querySelectorAll('div')].find((d) => /canvas · 2× resolution/.test(d.textContent) && d.children.length === 0); const t = c.previousElementSibling; return { bg: getComputedStyle(t).backgroundColor, inline: t.getAttribute('style').slice(0, 80) }; })()");
    const want = { Warm: "rgb(200, 191, 178)", Dark: "rgb(26, 26, 26)", White: "rgb(255, 255, 255)", Navy: "rgb(13, 27, 42)", Walnut: "rgb(45, 27, 0)", Void: "rgb(10, 0, 20)" };
    const got = {};
    for (const [lab] of Object.entries(want)) {
      const ok = await clickEl(S, `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '${lab}' || b.getAttribute('title') === '${lab}' || b.getAttribute('aria-label') === '${lab}')`, { js: true });
      await sleep(600); got[lab] = ok ? (await cap()).bg : "button not found";
    }
    const bad = Object.keys(want).filter((k) => got[k] !== want[k]);
    const info = await S.evaluate("[...document.querySelectorAll('button')].filter((b) => /^(Warm|Dark|White|Navy|Walnut|Void)$/.test(b.textContent.trim())).map((b) => b.outerHTML.slice(0, 160))");
    console.log(JSON.stringify(got), JSON.stringify(info.slice(0, 2)));
    r.check(bad.length === 0, { page: "/vault/frames | owner, Personal, item QA Album 1 selected", control: "Background colour buttons (Warm, Dark, White, Navy, Walnut, Void)", expected: "Each button sets the preview background to its colour", actual: JSON.stringify(got), evidence: await S.jshot("vlt-frames-bg"), impact: "usability", repro: "Frame Studio: pick an item; click each background swatch" });
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });
