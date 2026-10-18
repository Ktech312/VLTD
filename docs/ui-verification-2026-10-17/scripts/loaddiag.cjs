// Failure injection for the load instrumentation: each failure is made in a real browser (network requests are failed or held with the browser's own
// interception) and the page + the per-tab load record are read. Synthetic account only. Browser profiles go under Temp, not under C:/qa-chrome.
//   node loaddiag.cjs --base=http://localhost:3000        (journey-setup.cjs first; journey-cleanup.cjs after)
process.env.CHROME_PROFILE_ROOT = process.env.CHROME_PROFILE_ROOT || "C:/Users/EK/AppData/Local/Temp/qa-c";
const { browser, admin, sleep, man } = require("./journey-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=http://localhost:3000").slice(7);
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 600)); };
const info = (n, d) => console.log("INFO", n, JSON.stringify(d ?? "").slice(0, 700));
const marks = (S) => S.evaluate("JSON.parse(sessionStorage.getItem('vltd_load_diag_v1') || '[]')");
const names = (a) => a.map((m) => m.stage + (m.ok ? "" : " [FAILED]"));
// intercept: rules = [{ url: 'substring', mode: 'fail' | 'hold' }]; 'hold' keeps the request open until release()
async function intercept(S, rules) {
  const held = [];
  await S.send("Fetch.enable", { patterns: rules.map((r) => ({ urlPattern: "*" + r.url + "*", requestStage: "Request" })) });
  const state = { active: true, held };
  S.c.on(async (e) => {
    if (e.method !== "Fetch.requestPaused") return;
    const url = e.params.request.url; const rule = rules.find((r) => url.includes(r.url));
    try {
      if (state.active && rule && rule.mode === "fail" && (!rule.type || e.params.resourceType === rule.type)) await S.send("Fetch.failRequest", { requestId: e.params.requestId, errorReason: "Failed" });
      else if (state.active && rule && rule.mode === "hold") held.push(e.params.requestId);
      else await S.send("Fetch.continueRequest", { requestId: e.params.requestId });
    } catch { /* gone */ }
  });
  state.release = async () => { state.active = false; for (const id of held.splice(0)) { try { await S.send("Fetch.continueRequest", { requestId: id }); } catch { /* gone */ } } await S.send("Fetch.disable").catch(() => {}); };
  return state;
}

(async () => {
  const m = man(); const P = m.personalId;
  await admin.from("vault_items").delete().eq("profile_id", P).like("id", "qa_ld_%");
  await admin.from("vault_items").insert([1, 2, 3].map((n) => ({ id: "qa_ld_" + m.stamp + "_" + n, profile_id: P, title: "QA LoadDiag " + n, status: "COLLECTION", is_public: false, created_at: Date.now() - n * 1000, purchase_price: 10 * n })));
  try {
    // ---------- S0: normal load (control) ----------
    let S = await browser(BASE);
    await S.go("/vault"); await S.waitFor("/QA LoadDiag/.test(document.body.innerText)", 240000, "Vault"); await sleep(2500);
    let mk = await marks(S);
    info("S0 normal load: the recorded steps", names(mk));
    const need = ["page:start", "hydration", "guard:account-check", "vault:device-copy", "vault:account-check", "vault:profile", "vault:cloud-pull", "vault:rendered"];
    check("[normal] every stage is recorded, in order, all ok", need.every((s) => mk.some((x) => x.stage === s && x.ok)) && mk.every((x) => x.ok), names(mk));
    check("[normal] the stall message stays hidden and the Vault shows its items", (await S.evaluate("getComputedStyle(document.getElementById('vltd-load-stalled')).display")) === "none" && /QA LoadDiag 1/.test(await S.text()));
    check("[normal] the record holds no title, price or id (privacy)", !/QA LoadDiag|qa_ld_|\$\d/.test(JSON.stringify(mk)) && !new RegExp(P).test(JSON.stringify(mk)), JSON.stringify(mk).slice(0, 200));
    await S.close();

    // ---------- S1: the page's own code fails to download (what a bad update or a dead connection does) ----------
    S = await browser(BASE);
    const r1 = await intercept(S, [{ url: "/_next/static/chunks/", mode: "fail", type: "Script" }]);
    await S.go("/vault"); await sleep(13000);
    const vis = await S.evaluate("({ attr: document.documentElement.getAttribute('data-load-stalled'), display: getComputedStyle(document.getElementById('vltd-load-stalled')).display, text: document.getElementById('vltd-load-stalled').innerText, detail: document.getElementById('vltd-load-detail').textContent })");
    mk = await marks(S);
    info("S1 page code blocked: message shown", vis);
    check("[page code fails] after 10 s a plain message replaces the blank page (with a Reload link)", vis.attr === "1" && vis.display === "block" && /did not finish loading/.test(vis.text) && /Reload this page/.test(vis.text), vis);
    check("[page code fails] the message names the step and the failed files (paths only)", /page code did not start/.test(vis.detail) && /resource:failed \(script \/_next\/static\/chunks\//.test(vis.detail), vis.detail);
    check("[page code fails] the record has resource:failed and hydration:stalled", mk.some((x) => x.stage === "resource:failed" && !x.ok) && mk.some((x) => x.stage === "hydration:stalled" && !x.ok), names(mk));
    check("[page code fails] the link reloads the same page (href is empty, no JavaScript needed)", (await S.evaluate("document.querySelector('#vltd-load-stalled a').getAttribute('href')")) === "", "");
    // recovery: stop failing and reload through the link
    await r1.release(); await S.evaluate("document.querySelector('#vltd-load-stalled a').click(); true");
    await S.waitFor("/QA LoadDiag/.test(document.body.innerText)", 240000, "Vault after reload"); await sleep(1500);
    check("[page code fails] once the files can load, Reload brings the Vault back and the message is gone", (await S.evaluate("getComputedStyle(document.getElementById('vltd-load-stalled')).display")) === "none");
    await S.close();

    // ---------- S2b: the profile lookup never answers (the gate passes on its own inner timeout; the Vault must not show an empty list) ----------
    S = await browser(BASE);
    const r2b = await intercept(S, [{ url: "/rest/v1/profiles", mode: "hold" }]);
    await S.go("/vault"); await sleep(6500);
    const slowText = await S.text();
    check("[profile lookup stalls] after ~4 s the empty placeholder says it is still checking (not a blank page)", /Still checking your account/.test(slowText), slowText.slice(0, 200));
    await S.waitFor("document.body.innerText.includes('COULD NOT LOAD') || document.body.innerText.includes('Your vault is empty')", 90000, "failure or empty");
    await sleep(1500);
    mk = await marks(S); const t2b = await S.text();
    info("S2b profile lookup held: recorded steps", names(mk));
    info("S2b the gate's own note", mk.filter((x) => x.stage === "guard:account-check").map((x) => x.note));
    check("[profile lookup stalls] the route gate answered (it did not hang) and let the page through", mk.some((x) => x.stage === "guard:account-check" && x.ok), names(mk));
    check("[profile lookup stalls] the Vault says 'could not load' and NEVER 'Your vault is empty'", /COULD NOT LOAD/.test(t2b) && !/Your vault is empty/i.test(t2b), t2b.slice(0, 200));
    check("[profile lookup stalls] the record names the failing stage: vault:profile (none resolved) and the screen kind could-not-load", mk.some((x) => x.stage === "vault:profile" && !x.ok) && mk.some((x) => x.stage === "vault:rendered" && !x.ok && /could-not-load/.test(x.note)), names(mk));
    await r2b.release(); await S.close();

    // ---------- S3: the cloud download fails and this browser has no copy ----------
    S = await browser(BASE);
    const r3 = await intercept(S, [{ url: "/rest/v1/vault_items", mode: "fail" }]);
    await S.go("/vault"); await S.waitFor("document.body.innerText.includes('COULD NOT LOAD') || document.body.innerText.includes('Your vault is empty')", 90000, "failure or empty state");
    await sleep(1500);
    const t3 = await S.text(); mk = await marks(S);
    info("S3 cloud blocked, no device copy: recorded steps", names(mk));
    check("[cloud fails] the page says 'could not load' with Try again, and NEVER 'Your vault is empty'", /COULD NOT LOAD/.test(t3) && /Try again/.test(t3) && !/Your vault is empty/i.test(t3), t3.slice(0, 200));
    check("[cloud fails] the record shows cloud-pull FAILED and the screen kind 'could-not-load' (flagged, not 'empty')", mk.some((x) => x.stage === "vault:cloud-pull" && !x.ok) && mk.some((x) => x.stage === "vault:rendered" && !x.ok && /could-not-load/.test(x.note)) && !mk.some((x) => x.stage === "vault:rendered" && /empty list shown/.test(x.note)), names(mk));
    await r3.release(); await S.clickText("Try again");
    await S.waitFor("/QA LoadDiag/.test(document.body.innerText)", 120000, "after Try again");
    check("[cloud fails] Try again, once the cloud answers, shows the items", /QA LoadDiag 1/.test(await S.text()));
    await S.close();
  } catch (e) { console.log("STOPPED", e.message); fail++; }
  finally { await admin.from("vault_items").delete().eq("profile_id", P).like("id", "qa_ld_%"); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
