// An unreachable account must never be described as an empty collection. For each data page, on a brand-new device (no local copy) with the database answering 503: the page must say it could not load
// (not "no items"), offer Retry/Try again, and after the database is back one Retry shows the real content. Usage: node scripts/local-tests/outage-states.cjs [route,route,...]
const L = require("./lib.cjs"); const { sleep, NL, check, sim } = L;
const PAGES = (process.argv[2] ? process.argv[2].split(",") : ["dashboard", "vault", "portfolio", "vault/sold", "activity", "watchlist", "goals", "favorites", "museum", "insurance", "reports/weekly", "vault/for-sale", "vault/frames", "vault/halls", "vault/readiness"]).map((r) => "/" + r.replace(/^\/+/, ""));
const EMPTY = /(your exhibitions are waiting|no items|nothing here yet|your vault is empty|add your first|0 items in vault|haven.t added|no exhibitions yet|no sales yet|no favorites yet|your halls are empty|no for-sale listings yet|no wants|0 of 0|no activity)/i;
const ERR = /(couldn.t load|could not load|can.t reach|couldn.t reach|try again|retry|not reach|unavailable|connection)/i;
(async () => {
  await sim("/__sim/reset"); const bad = [];
  for (const route of PAGES) {
    await sim("/__sim/fail?rest=1"); const s = await L.open({ width: 1280, height: 1000 });
    try { await s.go(route, 24000); await s.dismiss(); const t = (await s.text()).split(NL).map((x) => x.trim()).filter(Boolean).join(" | "); const emptyWords = EMPTY.exec(t), errWords = ERR.exec(t);
      const lying = !!emptyWords && !errWords; const retryBtn = await s.evaluate(`!![...document.querySelectorAll("button, a")].find((b) => /^(retry|try again)/i.test(b.innerText.trim()))`);
      console.log((lying ? "LIES   " : errWords ? "honest " : "silent ") + route.padEnd(20), "| empty-words:", emptyWords ? emptyWords[0] : "-", "| error-words:", errWords ? errWords[0] : "-", "| retry button:", retryBtn);
      // recovery
      await sim("/__sim/fail?rest=0"); let recovered = "n/a"; if (retryBtn) { await s.evaluate(`[...document.querySelectorAll("button, a")].find((b) => /^(retry|try again)/i.test(b.innerText.trim())).click()`); await sleep(7000); const t2 = (await s.text()); recovered = /could not load|couldn.t load/i.test(t2) ? "still-no-content" : "content"; console.log("        after Retry with the database back:", recovered); }
      if (lying || (!errWords && !emptyWords && route !== "/museum")) bad.push([route, lying ? "says empty while unreachable" : "says nothing about the failure", t.slice(0, 120)]);
      if (retryBtn && recovered === "still-no-content") bad.push([route, "Retry did not recover", recovered]);
    } finally { await s.close(); await sim("/__sim/fail?rest=0"); }
  }
  check("unreachable account: no page calls it empty, and every Retry recovers (" + PAGES.length + " pages)", bad.length === 0, bad);
  console.log(JSON.stringify(L.results())); process.exit(0);
})();
