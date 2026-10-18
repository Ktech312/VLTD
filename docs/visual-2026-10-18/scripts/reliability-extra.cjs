// Extra reliability checks on a synthetic account: (A) the route gate's own stall message, (B) pending data is never shown as an empty Vault,
// (C) the bug report carries no item content. Production UI, synthetic account only; removes only the rows it created.
//   node reliability-extra.cjs --base=https://vltd.app
process.env.CHROME_PROFILE_ROOT = process.env.CHROME_PROFILE_ROOT || "C:/Users/EK/AppData/Local/Temp/qa-c";
const { browser, admin, sleep, man } = require("./journey-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=https://vltd.app").slice(7);
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 600)); };
const info = (n, d) => console.log("INFO", n, JSON.stringify(d ?? "").slice(0, 700));
const marks = (S) => S.evaluate("JSON.parse(sessionStorage.getItem('vltd_load_diag_v1') || '[]')");
const names = (a) => a.map((m) => m.stage + (m.ok ? "" : " [FAILED]") + (m.note ? " (" + m.note + ")" : ""));
// rules = [{ url, mode: 'fail'|'hold', methods?: ['POST'] }]
async function intercept(S, rules0) {
  const held = [];
  await S.send("Fetch.enable", { patterns: [{ urlPattern: "*/rest/v1/*", requestStage: "Request" }, { urlPattern: "*/auth/v1/*", requestStage: "Request" }] });
  const state = { active: true, held, failed: 0, rules: rules0 };
  S.c.on(async (e) => {
    if (e.method !== "Fetch.requestPaused") return;
    const { url, method } = e.params.request; const rule = state.rules.find((r) => url.includes(r.url) && (!r.methods || r.methods.includes(method)));
    try {
      if (state.active && rule && rule.mode === "fail") { state.failed++; await S.send("Fetch.failRequest", { requestId: e.params.requestId, errorReason: "Failed" }); }
      else if (state.active && rule && rule.mode === "hold") held.push(e.params.requestId);
      else await S.send("Fetch.continueRequest", { requestId: e.params.requestId });
    } catch { /* gone */ }
  });
  state.set = (r) => { state.rules = r; };
  state.release = async () => { state.rules = []; for (const id of held.splice(0)) { try { await S.send("Fetch.continueRequest", { requestId: id }); } catch { /* gone */ } } await S.send("Fetch.disable").catch(() => {}); };
  return state;
}

(async () => {
  const m = man(); const P = m.personalId;
  const created = { items: [], bugs: [] };
  try {
    // ---------- A. the gate itself stalls: the account lookups never answer ----------
    let S = await browser(BASE);
    const rA = await intercept(S, [{ url: "/auth/v1/user", mode: "hold" }, { url: "/rest/v1/profiles", mode: "hold" }]);
    await S.go("/vault");
    await sleep(6000);
    const t6 = await S.text();
    info("A at 6 s", t6.replace(/\s+/g, " ").slice(0, 160));
    await S.waitFor("/COULD NOT FINISH LOADING|COULD NOT LOAD|Your vault is empty/i.test(document.body.innerText)", 40000, "gate message").catch(() => {});
    const tA = await S.text(); const mkA = await marks(S);
    info("A recorded steps", names(mkA));
    check("[A gate stall] within the limit, a plain message replaces the empty placeholder (never a blank page)", /COULD NOT FINISH LOADING|COULD NOT LOAD/i.test(tA), tA.replace(/\s+/g, " ").slice(0, 200));
    check("[A gate stall] it says the items are safe and offers Try again", /Your items are safe/i.test(tA) && /Try again/.test(tA), tA.replace(/\s+/g, " ").slice(0, 200));
    check("[A gate stall] it never shows 'Your vault is empty'", !/Your vault is empty/i.test(tA), tA.slice(0, 120));
    check("[A gate stall] the record names the failing step (account check)", mkA.some((x) => /guard:account-check|vault:profile|vault:account-check/.test(x.stage) && !x.ok), names(mkA));
    await rA.release();
    const retry = await S.clickText("Try again").catch(() => false);
    await S.waitFor("/TOTAL VALUE/.test(document.body.innerText) && document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 0", 120000, "recovered").then(() => check("[A gate stall] after the connection returns, Try again brings the Vault back with its items", true)).catch(async () => { check("[A gate stall] after the connection returns, Try again brings the Vault back", false, { retry, text: (await S.text()).slice(0, 200) }); });
    await S.close();

    // ---------- B. pending data: writes blocked, add an item, then the profile lookup stalls on reload ----------
    S = await browser(BASE);
    await S.go("/vault"); await S.waitFor("/TOTAL VALUE/.test(document.body.innerText) && document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 0", 180000, "vault"); await sleep(2500);
    const before = (await admin.from("vault_items").select("id", { count: "exact", head: true }).eq("profile_id", P)).count;
    const WRITES = { url: "/rest/v1/vault_items", mode: "fail", methods: ["POST", "PATCH", "PUT", "DELETE"] };
    const rW = await intercept(S, [WRITES]);
    await S.go("/vault/add"); await S.waitFor("document.querySelector(\"input[placeholder*='Name this item']\")", 90000, "add page"); await sleep(2500);
    await S.setVal("input[placeholder*='Name this item']", "QA Pending Item");
    await sleep(400);
    await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Save'); b.click(); return true; })()");
    await sleep(6000);
    const q1 = await S.evaluate("(() => { try { return JSON.parse(localStorage.getItem('vltd_sync_queue_v1') || '[]').length; } catch { return -1; } })()");
    const inDb1 = (await admin.from("vault_items").select("id").eq("profile_id", P).eq("title", "QA Pending Item")).data;
    check("[B pending] with writes blocked the item is NOT in the database yet but IS queued on the device", inDb1.length === 0 && q1 > 0, { dbRows: inDb1.length, queue: q1, blockedWrites: rW.failed });
    // reload while the profile lookup also never answers (the exact false-empty risk)
    rW.set([WRITES, { url: "/rest/v1/profiles", mode: "hold" }]);
    await S.go("/vault"); await sleep(12000);
    const t = await S.text();
    const q2 = await S.evaluate("(() => { try { return JSON.parse(localStorage.getItem('vltd_sync_queue_v1') || '[]').length; } catch { return -1; } })()");
    check("[B pending] reload with the profile lookup stalled never shows 'Your vault is empty'", !/Your vault is empty/i.test(t), t.replace(/\s+/g, " ").slice(0, 200));
    check("[B pending] the queued change is still on the device after the reload", q2 >= q1 && q2 > 0, { q1, q2 });
    info("B what the page showed", t.replace(/\s+/g, " ").slice(0, 160));
    await rW.release();
    // unblock everything: one sync, one row
    const sinceRelease = S.reqs.length;
    await S.go("/vault"); await S.waitFor("/TOTAL VALUE/.test(document.body.innerText)", 180000, "vault after unblock");
    let rows = [];
    for (let i = 0; i < 40; i++) { rows = (await admin.from("vault_items").select("id").eq("profile_id", P).eq("title", "QA Pending Item")).data; if (rows.length) break; await sleep(1500); }
    rows.forEach((r) => created.items.push(r.id));
    await sleep(6000);
    const posts = S.reqs.slice(sinceRelease).filter((r) => r.method === "POST" && /\/rest\/v1\/vault_items/.test(r.url));
    const after = (await admin.from("vault_items").select("id", { count: "exact", head: true }).eq("profile_id", P)).count;
    const q3 = await S.evaluate("(() => { try { return JSON.parse(localStorage.getItem('vltd_sync_queue_v1') || '[]').length; } catch { return -1; } })()");
    check("[B pending] after unblocking, the item reaches the database exactly once", rows.length === 1 && after === before + 1, { rows: rows.length, before, after });
    check("[B pending] the device queue is empty afterwards", q3 === 0, q3);
    info("B upload POSTs after unblocking (count)", posts.length);
    await S.close();

    // ---------- C. bug report privacy ----------
    S = await browser(BASE);
    await S.go("/vault"); await S.waitFor("/TOTAL VALUE/.test(document.body.innerText) && document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 0", 180000, "vault c"); await sleep(3000);
    await S.evaluate("document.querySelector('[aria-label=\"Report a bug\"]').click(); true"); await sleep(800);
    await S.setVal("textarea[placeholder^='What happened']", "QA synthetic report: please ignore (reliability closeout check).");
    await sleep(300);
    await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => /Send report/.test(x.textContent)); b.click(); return true; })()");
    let bug = null;
    for (let i = 0; i < 20; i++) { const r = await admin.from("bug_reports").select("id,user_id,email,message,page_path,user_agent,screenshot_url,created_at").eq("user_id", m.userId).order("created_at", { ascending: false }).limit(1); bug = r.data && r.data[0]; if (bug) break; await sleep(1000); }
    if (bug) created.bugs.push(bug.id);
    check("[C bug report] the synthetic report was saved", !!bug, null);
    if (bug) {
      const titles = (await admin.from("vault_items").select("title,id").eq("profile_id", P)).data;
      const leaked = titles.filter((x) => bug.message.includes(x.title) || bug.message.includes(x.id));
      info("C message sent (first 700 chars)", bug.message);
      check("[C bug report] the report text carries no item title or item id", leaked.length === 0, leaked.slice(0, 3));
      check("[C bug report] it carries no price, profile id or email address in the message", !/\$\s?\d/.test(bug.message.split("\n\n").slice(1).join(" ")) && !bug.message.includes(P) && !bug.message.includes(m.email), bug.message.slice(0, 400));
      check("[C bug report] the load record rides along (steps/timings)", /page:start|hydration|vault:/.test(bug.message), bug.message.slice(0, 300));
    }
    await S.close();
  } catch (e) { console.log("STOPPED", e.message); fail++; }
  finally {
    for (const id of created.items) await admin.from("vault_items").delete().eq("id", id);
    for (const id of created.bugs) await admin.from("bug_reports").delete().eq("id", id);
    const gone = (await admin.from("vault_items").select("id").eq("profile_id", P).eq("title", "QA Pending Item")).data.length === 0;
    info("cleanup: exact ids removed", { items: created.items.length, bugs: created.bugs.length, pendingGone: gone });
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
