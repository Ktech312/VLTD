// Controlled failures in an isolated browser (synthetic account, production). One scenario = one fresh browser; nothing is retried hoping the failure
// returns: every failure here is injected by the browser's own network interception. Each scenario reports what a person would SEE.
// PASS means: the page shows items or a plain message, never a blank main area, never "Your vault is empty" when the cause was a failed request.
//   node reliability-paths.cjs --base=https://vltd.app [--only=A1,A6]
process.env.CHROME_PROFILE_ROOT = process.env.CHROME_PROFILE_ROOT || "C:/Users/EK/AppData/Local/Temp/qa-c";
const { browser, admin, sleep, man } = require("./journey-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=https://vltd.app").slice(7);
const ONLY = ((process.argv.find((a) => a.startsWith("--only=")) || "--only=").slice(7)).split(",").filter(Boolean);
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 700)); };
const info = (n, d) => console.log("INFO", n, JSON.stringify(d ?? "").slice(0, 900));
const marks = (S) => S.evaluate("JSON.parse(sessionStorage.getItem('vltd_load_diag_v1') || '[]').map((m) => m.stage + (m.ok ? '' : ' [FAILED]') + (m.note ? ' (' + m.note + ')' : ''))").catch(() => []);
// rules: [{ test: (url, method) => bool, act: 'fail' | 'hold' | { status, body } }]; rules can be swapped at any time
async function intercept(S, patterns) {
  const held = []; const st = { rules: [], hits: 0, chunkSeen: 0 };
  await S.send("Fetch.enable", { patterns: patterns.map((p) => ({ urlPattern: p, requestStage: "Request" })) });
  S.c.on(async (e) => {
    if (e.method !== "Fetch.requestPaused") return;
    const { url, method } = e.params.request; const rule = st.rules.find((r) => r.test(url, method, e.params));
    try {
      if (!rule) return await S.send("Fetch.continueRequest", { requestId: e.params.requestId });
      st.hits++;
      if (rule.act === "fail") await S.send("Fetch.failRequest", { requestId: e.params.requestId, errorReason: "Failed" });
      else if (rule.act === "hold") held.push(e.params.requestId);
      else await S.send("Fetch.fulfillRequest", { requestId: e.params.requestId, responseCode: rule.act.status, responseHeaders: [{ name: "content-type", value: "application/json" }, { name: "access-control-allow-origin", value: "*" }], body: Buffer.from(rule.act.body || "").toString("base64") });
    } catch { /* gone */ }
  });
  st.release = async () => { st.rules = []; for (const id of held.splice(0)) { try { await S.send("Fetch.continueRequest", { requestId: id }); } catch { /* gone */ } } };
  return st;
}
const SEE = `(() => { const t = document.body.innerText.replace(/\\s+/g, ' '); return { items: document.querySelectorAll('a[href^="/vault/item/"]').length, msg: /could not|COULD NOT|Still loading|Still checking|did not finish|Sign in|sign in/i.test(t), emptyClaim: /Your vault is empty/i.test(t), len: t.length, head: t.slice(0, 220) }; })()`;
const REST = (frag) => (u) => u.includes("/rest/v1/" + frag);
async function ready(S, ms = 40000) { const t0 = Date.now(); let v; while (Date.now() - t0 < ms) { await sleep(2000); try { v = await S.evaluate(SEE); } catch { continue; } if (v.items > 0 || v.msg || v.emptyClaim) { await sleep(2500); return await S.evaluate(SEE); } } return v || { items: 0, msg: false, emptyClaim: false, len: 0, head: "(no reading)" }; }
// a Vault load once so this browser holds the device copy
async function withDeviceCopy(S) { await S.go("/vault"); await S.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 0", 180000, "first load"); await sleep(3000); }

const SCEN = {
  async A1() { // device copy present; cloud item reads fail
    const S = await browser(BASE); try {
      await withDeviceCopy(S); const ic = await intercept(S, ["*/rest/v1/*"]); ic.rules = [{ test: (u, m) => u.includes("/rest/v1/vault_items") && m === "GET", act: "fail" }];
      await S.go("/vault"); const v = await ready(S);
      check("[A1 device copy + cloud download fails] the saved items are shown, not an empty Vault", v.items > 0 && !v.emptyClaim, v);
      let said = false; for (let i = 0; i < 30 && !said; i++) { said = /Could not reach the cloud|Showing what is saved on this device/i.test(await S.text()); if (!said) await sleep(2000); }
      check("[A1] the page says the cloud could not be reached (not silent)", said, (await S.text()).slice(0, 300));
      check("[A1] the items are still shown after the failure was reported", (await S.evaluate(SEE)).items > 0);
      info("A1 record", await marks(S)); await ic.release(); await S.close();
    } catch (e) { check("[A1] ran", false, e.message); try { await S.close(); } catch { /* */ } }
  },
  async A2() { // device copy present; cloud answers 500
    const S = await browser(BASE); try {
      await withDeviceCopy(S); const ic = await intercept(S, ["*/rest/v1/*"]); ic.rules = [{ test: (u, m) => u.includes("/rest/v1/vault_items") && m === "GET", act: { status: 500, body: '{"message":"boom"}' } }];
      await S.go("/vault"); const v = await ready(S);
      check("[A2 device copy + cloud answers 500] the saved items are shown, never 'empty'", v.items > 0 && !v.emptyClaim, v); await ic.release(); await S.close();
    } catch (e) { check("[A2] ran", false, e.message); try { await S.close(); } catch { /* */ } }
  },
  async A3() { // no device copy; cloud answers 500
    const S = await browser(BASE); try {
      const ic = await intercept(S, ["*/rest/v1/*"]); ic.rules = [{ test: (u, m) => u.includes("/rest/v1/vault_items") && m === "GET", act: { status: 500, body: '{"message":"boom"}' } }];
      await S.go("/vault"); const v = await ready(S, 90000);
      check("[A3 no device copy + cloud answers 500] 'could not load' with a way to retry, never 'empty'", v.msg && !v.emptyClaim && v.items === 0, v);
      await ic.release(); await S.clickText("Try again").catch(() => {}); await S.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 0", 90000, "after retry").then(() => check("[A3] Try again brings the items once the cloud answers", true)).catch(() => check("[A3] Try again brings the items once the cloud answers", false, null)); await S.close();
    } catch (e) { check("[A3] ran", false, e.message); try { await S.close(); } catch { /* */ } }
  },
  async A4() { // device copy present; profile lookup held
    const S = await browser(BASE); try {
      await withDeviceCopy(S); const ic = await intercept(S, ["*/rest/v1/*"]); ic.rules = [{ test: REST("profiles"), act: "hold" }];
      await S.go("/vault"); const v = await ready(S, 60000);
      check("[A4 device copy + profile lookup stalls] the saved items are shown from the device while the lookup is pending", v.items > 0 && !v.emptyClaim, v);
      await ic.release(); await S.close();
    } catch (e) { check("[A4] ran", false, e.message); try { await S.close(); } catch { /* */ } }
  },
  async A5() { // session rejected: 401 JWT expired on the account's data
    const S = await browser(BASE); try {
      await withDeviceCopy(S); const ic = await intercept(S, ["*/rest/v1/*"]); ic.rules = [{ test: (u) => u.includes("/rest/v1/profiles") || u.includes("/rest/v1/vault_items"), act: { status: 401, body: '{"code":"PGRST303","message":"JWT expired"}' } }];
      await S.go("/vault"); const v = await ready(S, 60000);
      check("[A5 session rejected (401 JWT expired)] never presented as an empty Vault (items from the device, a sign-in prompt, or a message)", !v.emptyClaim && (v.items > 0 || v.msg || (await S.path()).indexOf("/login") === 0), v);
      info("A5 what was shown", { path: await S.path(), head: v.head }); await ic.release(); await S.close();
    } catch (e) { check("[A5] ran", false, e.message); try { await S.close(); } catch { /* */ } }
  },
  async A6() { // cloud answers 200 with an empty list although the device holds items
    const S = await browser(BASE); try {
      await withDeviceCopy(S); const ic = await intercept(S, ["*/rest/v1/*"]); ic.rules = [{ test: (u, m) => u.includes("/rest/v1/vault_items") && m === "GET" && !u.includes("count"), act: { status: 200, body: "[]" } }];
      await S.go("/vault"); const v = await ready(S);
      check("[A6 cloud answers an empty list while the device holds items] the device items stay (a pull never removes anything)", v.items > 0, v);
      await ic.release(); await S.close();
    } catch (e) { check("[A6] ran", false, e.message); try { await S.close(); } catch { /* */ } }
  },
  async A7() { // deploy skew: page-code files answer 404 (an old page asking for files a newer deploy replaced); first load, several cut-offs
    for (const keep of [3, 6, 10, 16]) {
      const S = await browser(BASE); try {
        const ic = await intercept(S, ["*/_next/static/*"]); let n = 0;
        ic.rules = [{ test: (u) => /\/_next\/static\/chunks\/.*\.js/.test(u) && ++n > keep, act: { status: 404, body: "Not Found" } }];
        await S.go("/vault"); const v = await ready(S, 45000); const mk = await marks(S);
        const shown = await S.evaluate("(() => { const w = document.getElementById('vltd-load-stalled'); return w ? { display: getComputedStyle(w).display, text: w.innerText.replace(/\\s+/g, ' ').slice(0, 200) } : null; })()");
        const sees = v.items > 0 || v.msg || (shown && shown.display !== "none");
        check(`[A7 deploy skew: chunk files after the first ${keep} answer 404] a person sees items or a plain message, not a blank page`, !!sees && !v.emptyClaim, { v, shown, hits: ic.hits });
        info(`A7 keep=${keep}`, { hits: ic.hits, stalled: shown, record: mk.slice(0, 8) });
        await ic.release(); await S.close();
      } catch (e) { check(`[A7 keep=${keep}] ran`, false, e.message); try { await S.close(); } catch { /* */ } }
    }
  },
  async A8() { // client navigation (Home -> Vault) while the page-data request fails (deploy skew on the app's own navigation)
    const S = await browser(BASE); try {
      await S.go("/dashboard"); await S.waitFor("/COLLECTION OVERVIEW/.test(document.body.innerText)", 180000, "home"); await sleep(3000);
      const ic = await intercept(S, ["*_rsc=*", "*/_next/static/chunks/*"]); ic.rules = [{ test: (u) => u.includes("_rsc="), act: { status: 404, body: "Not Found" } }];
      await S.evaluate("[...document.querySelectorAll('nav a')].find((a) => a.getAttribute('href') === '/vault').click(); true");
      const v = await ready(S, 60000);
      check("[A8 in-app navigation while its page-data request answers 404] the Vault still opens (full page load) or a plain message shows; not a blank page", !v.emptyClaim && (v.items > 0 || v.msg), { v, path: await S.path(), hits: ic.hits });
      await ic.release(); await S.close();
    } catch (e) { check("[A8] ran", false, e.message); try { await S.close(); } catch { /* */ } }
  },
};
(async () => {
  for (const k of Object.keys(SCEN)) { if (ONLY.length && !ONLY.includes(k)) continue; console.log("--", k); await SCEN[k](); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
