// Quick Add manual review/save path on PRODUCTION (fixed build), synthetic camera, no paid AI.
//   AUDIT_MANIFEST=<manifest> node rb9-quickadd.cjs <label>
// Chrome's synthetic camera supplies the photos. Every /api/ai request is answered by the audit harness (never sent) and counted;
// the AI button is never pressed, so the expected count is 0, and the account's ai_usage_log must not change.
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
process.env.CHROME_EXTRA = "--use-fake-device-for-media-stream --use-fake-ui-for-media-stream";
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const L = require(path.join(SD, "audit-lib.cjs"));
const { session, sleep, admin, click, typeInto, alertText, rectOf, rowsByTitle, poll, text, man } = T;
const LABEL = process.argv[2] || "run";
const r = L.R("RB9");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] };
const P = man().personalId, ST = man().stamp;
const shutter = "document.querySelector('button[aria-label=\"Take picture\"]')";
const names = (i) => `document.querySelectorAll('input[placeholder="Item name"]')[${i}]`;
const cost = (i) => `document.querySelectorAll('input[aria-label="Cost"]')[${i}]`;
const value = (i) => `[...document.querySelectorAll('input')].filter((e) => /^Value/.test(e.getAttribute('aria-label') || e.placeholder || ''))[${i}]`;
const saveBtn = "[...document.querySelectorAll('button')].find((b) => /^Save \\d+ item/.test(b.textContent.trim()))";
const created = [];
let S, n = 0;
async function rec(ok, control, expected, actual, page = "/vault/quick") {
  let ev = ""; try { await sleep(250); ev = await S.jshot(`rb9-quick-${LABEL}-${++n}`); } catch {}
  out.cases.push({ control, expected, ok: !!ok, actual, evidence: ev });
  r.check(!!ok, { page: `${page} | owner, Personal, desktop 1440, synthetic camera`, control, expected, actual, evidence: ev, impact: "RB9 (RC-17 Quick Add)", repro: "" });
}
const aiCalls = () => S.intercepted.filter((x) => /api\/ai/.test(x.url)).length;

(async () => {
  const usageBefore = (await admin.from("ai_usage_log").select("id", { count: "exact", head: true }).eq("profile_id", P)).count;
  S = await session("owner", { width: 1440, height: 900 });
  try {
    await S.visit("/vault/quick"); await sleep(3000);
    await S.waitFor("document.querySelector('button[aria-label=\"Take picture\"]')", 60000, "scanner"); await sleep(1200);
    for (let i = 0; i < 3; i++) { await click(S, shutter); await sleep(1300); }
    await click(S, "document.querySelector('button[aria-label=\"Review captured items\"]')"); await sleep(1800);
    await click(S, "[...document.querySelectorAll('button')].find((b) => /^Add \\d+ item/.test(b.textContent.trim()))"); await sleep(2500);
    const vt = await text(S);
    await rec(/Verify your Drop/.test(vt), "Quick Add: 3 synthetic-camera photos -> review -> Verify sheet (manual path)", "the Verify sheet opens with 3 items without any AI call", `sheet open=${/Verify your Drop/.test(vt)}; AI requests seen=${aiCalls()}`);

    const title = (s) => `QA RB9 quick ${s} ${ST}`;
    await typeInto(S, names(0), title("zero")); await typeInto(S, names(1), title("blank")); await typeInto(S, names(2), title("fmt"));
    const bad = [["Cost", cost, "abc"], ["Cost", cost, "1e3"], ["Cost", cost, "1,5"], ["Cost", cost, "-5"], ["Value", value, "abc"], ["Value", value, "-4"], ["Value", value, "5-3"]];
    for (const [lab, fn, v] of bad) {
      await typeInto(S, fn(0), v); await sleep(500);
      const al = await alertText(S); const rect = await rectOf(S, saveBtn);
      await rec(!!al && /can't be negative|numbers only|not a number|enter an amount|enter one amount|decimal|not supported/i.test(al) && rect && rect.disabled === true, `Quick Add ${lab} typed '${v}'`, "a plain message names the problem and Save is held (nothing is turned into $0 or blank)", `message='${al.slice(0, 140)}'; Save disabled=${rect && rect.disabled}`);
      await typeInto(S, fn(0), "");
    }
    // valid values: explicit zero, blank, supported currency format
    await typeInto(S, cost(0), "0"); await typeInto(S, value(0), "0");
    await typeInto(S, cost(1), ""); await typeInto(S, value(1), "");
    await typeInto(S, cost(2), "$1,250.50"); await typeInto(S, value(2), "2,000"); await sleep(500);
    const rectOk = await rectOf(S, saveBtn);
    await rec(rectOk && rectOk.disabled === false && !(await alertText(S)), "Quick Add valid entries (0 / blank / $1,250.50 & 2,000)", "no message and Save is available", `Save disabled=${rectOk && rectOk.disabled}; alert='${await alertText(S)}'`);
    await click(S, saveBtn); await sleep(3000);
    const moved = await S.waitFor("location.pathname === '/vault'", 45000).then(() => true).catch(() => false);
    const rows = await poll(async () => { const x = await rowsByTitle(P, `QA RB9 quick`); return x.length >= 3 ? x : null; }, 60000, 2000) || await rowsByTitle(P, "QA RB9 quick");
    created.push(...rows.map((x) => x.id));
    const by = (s) => rows.find((x) => x.title === title(s));
    const z = by("zero"), b = by("blank"), f = by("fmt");
    await rec(moved && z && Number(z.purchase_price) === 0 && z.purchase_price !== null && Number(z.current_value) === 0 && z.current_value !== null, "Quick Add explicit 0 cost and 0 value are kept", "saved as 0 / 0 (a known zero, not blank)", `moved=${moved}; purchase_price=${z && z.purchase_price}; current_value=${z && z.current_value}`);
    await rec(b && b.purchase_price === null && b.current_value === null, "Quick Add blank cost and value stay unknown", "saved as null / null (not $0)", `purchase_price=${b && b.purchase_price}; current_value=${b && b.current_value}`);
    await rec(f && Number(f.purchase_price) === 1250.5 && Number(f.current_value) === 2000, "Quick Add '$1,250.50' / '2,000' supported formats", "saved as 1250.5 / 2000", `purchase_price=${f && f.purchase_price}; current_value=${f && f.current_value}`);
    const usageAfter = (await admin.from("ai_usage_log").select("id", { count: "exact", head: true }).eq("profile_id", P)).count;
    await rec(aiCalls() === 0 && usageAfter === usageBefore, "Quick Add manual path makes no AI request", "0 AI requests (any would have been blocked by the audit and counted) and no AI usage logged for the account", `AI requests seen and blocked=${aiCalls()}; ai_usage_log ${usageBefore} -> ${usageAfter}`);
    // reload + clean second browser
    await S.visit("/vault"); await S.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 3", 90000, "vault").catch(() => {}); await sleep(3000);
    const listed = (await text(S)).includes(title("zero"));
    await S.close();
    S = await session("owner", { width: 1440, height: 900 });
    if (z) { await S.visit(`/vault/item/${z.id}`); await sleep(4000); }
    const t2 = await text(S);
    await rec(listed && z && t2.includes(title("zero")), "Quick Add item after reload and in a clean second browser", "the item is listed after reload and opens in a clean browser", `listed after reload=${listed}; second browser shows it=${t2.includes(title("zero"))}`, "/vault + /vault/item/[id]");
  } catch (e) { console.error("ERR", e); out.error = String(e && e.stack || e).slice(0, 500); }
  finally {
    for (const id of created) { try { await admin.from("vault_items").delete().eq("id", id).eq("profile_id", P); } catch {} }
    fs.writeFileSync(path.join(EV, `rb9-quickadd-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}`);
    try { await S.close(); } catch {}
    process.exit(0);
  }
})();
