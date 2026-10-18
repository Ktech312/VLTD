process.env.CHROME_PROFILE_ROOT = "C:/Users/EK/AppData/Local/Temp/qa-c";
const { browser, sleep } = require("./journey-lib.cjs");
(async () => {
  const S = await browser("https://vltd.app");
  await S.go("/vault"); await S.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 0", 180000, "first"); await sleep(3000);
  await S.send("Fetch.enable", { patterns: [{ urlPattern: "*/rest/v1/vault_items*", requestStage: "Request" }] });
  let blocked = 0; S.c.on(async (e) => { if (e.method !== "Fetch.requestPaused") return; if (e.params.request.method === "GET") { blocked++; await S.send("Fetch.failRequest", { requestId: e.params.requestId, errorReason: "Failed" }).catch(() => {}); } else await S.send("Fetch.continueRequest", { requestId: e.params.requestId }).catch(() => {}); });
  const t0 = Date.now(); await S.go("/vault");
  for (let i = 0; i < 12; i++) { await sleep(5000); const t = (await S.text()).replace(/\s+/g, " "); const rec = await S.evaluate("JSON.parse(sessionStorage.getItem('vltd_load_diag_v1')||'[]').map(m=>Math.round(m.ms||m.t||0)+' '+m.stage+(m.ok?'':' FAILED')+' '+(m.note||'')).slice(-6).join(' | ')"); console.log(Math.round((Date.now() - t0) / 1000) + "s", "blocked GETs", blocked, "| says:", /Could not reach|saved on this device/i.test(t), "| items", await S.evaluate("document.querySelectorAll('a[href^=\"/vault/item/\"]').length"), "|", rec.slice(0, 330)); }
  await S.close();
})();
