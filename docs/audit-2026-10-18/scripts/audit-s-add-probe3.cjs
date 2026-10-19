const T = require("./audit-s-add-lib.cjs");
const { session, sleep } = T;
(async () => {
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    const p1 = T.mkPng(T.tmp("a1.png"), 800, 600, [200, 60, 60]); const p2 = T.mkPng(T.tmp("a2.png"), 640, 480, [60, 200, 60]);
    await S.visit("/capture");
    await T.uploadFiles(S, "input[type=file]", p1, 0); await sleep(2000);
    await T.uploadFiles(S, "input[type=file]", p2, 0); await sleep(2000);
    await T.click(S, "document.querySelector('[aria-label=\"Photo 2\"]')"); await sleep(800);
    const d = await S.evaluate("[...document.querySelectorAll('button,[role=button]')].filter((b) => b.getBoundingClientRect().width > 0).map((b) => (b.getAttribute('aria-label') || '') + '|' + (b.title || '') + '|' + b.textContent.trim().slice(0, 30))");
    console.log(JSON.stringify(d));
    await S.jshot("probe-multi2");
  } finally { await S.close(); }
})().catch((e) => { console.error(e); process.exit(2); });
