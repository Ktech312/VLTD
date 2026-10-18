process.env.CHROME_PROFILE_ROOT = "C:/Users/EK/AppData/Local/Temp/qa-c";
const { browser, sleep } = require("./journey-lib.cjs");
(async () => {
  const S = await browser("https://vltd.app");
  await S.go("/vault"); await S.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 0", 180000, "first"); await sleep(3000);
  await S.send("Fetch.enable", { patterns: [{ urlPattern: "*/rest/v1/vault_items*", requestStage: "Request" }] });
  const log = []; S.c.on(async (e) => { if (e.method !== "Fetch.requestPaused") return; const r = e.params.request; if (r.method === "GET") { log.push({ t: Date.now(), url: r.url.replace(/^https?:\/\/[^/]+/, "").replace(/profile_id=eq\.[0-9a-f-]+/, "profile_id=eq.P").slice(0, 150) }); await S.send("Fetch.failRequest", { requestId: e.params.requestId, errorReason: "Failed" }).catch(() => {}); } else await S.send("Fetch.continueRequest", { requestId: e.params.requestId }).catch(() => {}); });
  const t0 = Date.now(); await S.go("/vault"); await sleep(45000);
  const by = {}; for (const x of log) { const k = x.url.replace(/offset=\d+/, "offset=N").replace(/range=[^&]*/, "range=R"); by[k] = by[k] || []; by[k].push(Math.round((x.t - t0) / 1000)); }
  for (const [k, v] of Object.entries(by)) console.log(v.length + "x", k, "| at s:", v.slice(0, 14).join(","));
  console.log("total", log.length, "in 45 s");
  await S.close();
})();
