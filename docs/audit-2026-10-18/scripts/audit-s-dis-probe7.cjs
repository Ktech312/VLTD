const C = require("./audit-s-dis-common.cjs");
const src = require("fs").readFileSync("audit-s-dis-upcoming.cjs", "utf8");
(async () => {
  const DATA = [{ id: 990001, series: "QA Dis Spider", number: "1", publisher: "Marvel", storeDate: "2026-11-04", coverDate: null, imageUrl: null }];
  const H = function (url, init, data) { return { status: 200, body: { count: 1, page: 1, pageSize: 25, hasMore: false, resolvedCreator: null, results: data } }; };
  const M = await C.session("visitor");
  await C.stubHandler(M, "api/comic-upcoming", H, DATA);
  await M.visit("/upcoming"); await C.sleep(3000);
  const btn = `([...document.querySelector('a[href="https://metron.cloud/issue/990001/"]').querySelectorAll('button')].find((b) => b.textContent.trim() === 'Want'))`;
  await C.click(M, btn);
  for (const t of [300, 700, 1500, 3000]) { await C.sleep(t === 300 ? 300 : 500); console.log(t, await M.evaluate(`${btn}.getAttribute('aria-pressed')`), (C.clean(await M.text()).match(/(Couldn.t[^.]*\.|Added[^.]*)/) || ["no toast"])[0]); }
  console.log("ls", await M.evaluate("Object.keys(localStorage).filter((k) => /wish/.test(k)).map((k) => k + '=' + localStorage.getItem(k).slice(0, 80))"));
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
