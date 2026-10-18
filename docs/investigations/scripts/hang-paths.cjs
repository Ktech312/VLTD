// The cloud download HANGS (request held open, never answered) with a saved copy on the device: what does each page show, and when?
process.env.CHROME_PROFILE_ROOT = "C:/Users/EK/AppData/Local/Temp/qa-c";
const { browser, sleep } = require("./journey-lib.cjs");
const SEE = "(() => { const t = document.body.innerText.replace(/\s+/g, ' '); return { cards: document.querySelectorAll('a[href^=\"/vault/item/\"]').length, loadingHome: /Loading Home/.test(t), overview: /COLLECTION OVERVIEW/.test(t), msg: (t.match(/could not[^.]*\.|Still loading[^.]*\./i) || [''])[0].slice(0, 90), len: t.length }; })()";
async function run(path, label) {
  const S = await browser("https://vltd.app");
  await S.go("/vault"); await S.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 0", 180000, "first"); await sleep(3000);
  const held = []; await S.send("Fetch.enable", { patterns: [{ urlPattern: "*/rest/v1/vault_items*", requestStage: "Request" }] });
  S.c.on(async (e) => { if (e.method !== "Fetch.requestPaused") return; if (e.params.request.method === "GET") held.push(e.params.requestId); else await S.send("Fetch.continueRequest", { requestId: e.params.requestId }).catch(() => {}); });
  const t0 = Date.now(); await S.go(path);
  const out = [];
  for (const sec of [3, 8, 15, 25, 40, 60]) { await sleep(Math.max(0, sec * 1000 - (Date.now() - t0))); out.push(sec + "s: " + JSON.stringify(await S.evaluate(SEE))); }
  console.log("== " + label + " (cloud download held open)"); out.forEach((l) => console.log("  ", l));
  for (const id of held.splice(0)) await S.send("Fetch.continueRequest", { requestId: id }).catch(() => {});
  await S.close();
}
(async () => { await run("/dashboard", "HOME"); await run("/vault", "VAULT"); })();
