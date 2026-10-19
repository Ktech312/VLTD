// watch for ANY transient message after Identify with AI is refused (/vault/add)
const T = require("./audit-s-add-lib.cjs");
const { session, sleep } = T;
(async () => {
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    await S.visit("/vault/add"); await sleep(1500);
    await T.chooseViaButton(S, T.btnExpr("Upload a photo from a file"), T.mkPng(T.tmp("pr12-" + Date.now() + ".png"), 640, 480, [10, 90, 190])); await sleep(3000);
    await T.clickText(S, "^Use This Picture$"); await sleep(2000);
    const before = (await T.text(S)).replace(/\s+/g, " ");
    await T.clickText(S, "^Identify with AI$");
    const seen = new Set();
    for (let i = 0; i < 40; i++) { await sleep(500); const t = (await T.text(S)).replace(/\s+/g, " "); const toasts = await S.evaluate("[...document.querySelectorAll('[role=status],[role=alert],[aria-live]')].map((e) => e.textContent.trim()).filter(Boolean).join(' | ')"); const d = t.split(" ").filter((w) => !before.includes(w)).join(" "); if (toasts) seen.add("LIVE: " + toasts.slice(0, 120)); if (d) seen.add("NEW: " + d.slice(0, 120)); }
    console.log([...seen].join("\n") || "nothing new appeared in 20 s");
  } finally { await S.close(); }
})().catch((e) => { console.error(e); process.exit(2); });
