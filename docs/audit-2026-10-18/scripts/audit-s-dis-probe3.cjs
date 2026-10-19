const C = require("./audit-s-dis-common.cjs");
(async () => {
  const sd = C.seed();
  const S = await C.session("visitor");
  await C.failRequests(S, ["*/rest/v1/bug_reports*"]); // safety net: nothing can reach the real inbox
  await C.failRequests(S, ["*/rest/v1/bug_reports*"]);
  await C.stubFetch(S, "rest/v1/bug_reports");
  await S.visit("/discover"); await C.sleep(2500);
  console.log("installed", await S.evaluate("[window.__fxInstalled, typeof window.__fx, String(window.fetch).slice(0, 60)]"));
  await C.click(S, `([...document.querySelectorAll('[data-testid=featured-rooms] button')].find((x) => x.innerText.includes(${JSON.stringify(sd.titles.A)})))`);
  await S.evaluate("window.prompt = (m) => '[QA audit] test report - ignore'; true");
  await C.scrollTo(S, "end"); await C.sleep(600);
  console.log("click", await C.click(S, `([...document.querySelectorAll('aside button')].find((x) => x.textContent.trim() === 'Report'))`));
  await C.sleep(2500);
  console.log("fx", JSON.stringify(await C.fxList(S)));
  console.log("intercepted", JSON.stringify(S.intercepted.slice(0, 5)), "reqs", S.reqs.filter((r) => /bug_reports/.test(r.url)));
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
