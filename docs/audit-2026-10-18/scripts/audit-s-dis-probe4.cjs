const C = require("./audit-s-dis-common.cjs");
(async () => {
  const S = await C.session("visitor");
  await C.failRequests(S, ["*/rest/v1/public_vault_items*", "*/rest/v1/vault_items*"]);
  await S.visit("/discover");
  for (const t of [3, 8, 15, 25]) { await C.sleep(t === 3 ? 3000 : 7000); console.log(t, await S.evaluate("({ pulse: document.querySelectorAll('.animate-pulse').length, cards: document.querySelectorAll('[data-testid=featured-rooms] button').length, err: !!document.body.innerText.match(/Query error/), inflight: 0 })"), S.intercepted.length); }
  await S.jshot("dis-itemfacts-blank");
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
