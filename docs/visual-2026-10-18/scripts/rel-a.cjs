process.env.CHROME_PROFILE_ROOT = "C:/Users/EK/AppData/Local/Temp/qa-c";
const { browser, sleep } = require("./journey-lib.cjs");
async function intercept(S, rules) {
  const held = []; await S.send("Fetch.enable", { patterns: rules.map((r) => ({ urlPattern: "*" + r.url + "*", requestStage: "Request" })) });
  const st = { active: true };
  S.c.on(async (e) => { if (e.method !== "Fetch.requestPaused") return; const url = e.params.request.url; const rule = rules.find((r) => url.includes(r.url));
    try { if (st.active && rule) held.push(e.params.requestId); else await S.send("Fetch.continueRequest", { requestId: e.params.requestId }); } catch {} });
  st.release = async () => { st.active = false; for (const id of held.splice(0)) { try { await S.send("Fetch.continueRequest", { requestId: id }); } catch {} } };
  return st;
}
(async () => {
  const S = await browser(process.argv[2] || "https://vltd.app");
  const r = await intercept(S, [{ url: "/auth/v1/user", mode: "hold" }, { url: "/rest/v1/profiles", mode: "hold" }]);
  await S.go("/vault"); await S.waitFor("/COULD NOT LOAD|COULD NOT FINISH/i.test(document.body.innerText)", 240000, "msg");
  console.log("msg shown:", (await S.text()).replace(/\s+/g, " ").slice(0, 300));
  console.log('LOCKS before release', JSON.stringify(await S.evaluate("navigator.locks.query().then((x) => ({ held: x.held.map((l) => l.name), pending: x.pending.map((l) => l.name) }))"))); await r.release(); const n0 = S.reqs.length;
  console.log("clicked retry:", await S.clickText("Try again"));
  for (let i = 0; i < 3; i++) { await sleep(5000); const t = (await S.text()).replace(/\s+/g, " "); console.log(i * 5 + 5, "s:", t.slice(0, 40), "| items:", await S.evaluate("document.querySelectorAll('a[href^=\"/vault/item/\"]').length"), "| flags:", /Your vault is empty/i.test(t), /COULD NOT/i.test(t)); }
  console.log(JSON.stringify(await S.evaluate("JSON.parse(sessionStorage.getItem('vltd_load_diag_v1') || '[]').map((m) => m.stage + (m.ok ? '' : ' FAILED') + ' ' + (m.note || ''))")));
  console.log('LOCKS', JSON.stringify(await S.evaluate("navigator.locks.query().then((x) => ({ held: x.held.map((l) => l.name + ':' + l.mode), pending: x.pending.map((l) => l.name) }))")));
  console.log(JSON.stringify(S.reqs.slice(n0).filter((x) => /supabase/.test(x.host || x.url) || /auth|rest/.test(x.url)).map((x) => x.method + ' ' + x.url.slice(0, 70))));
  await S.close();
})();
