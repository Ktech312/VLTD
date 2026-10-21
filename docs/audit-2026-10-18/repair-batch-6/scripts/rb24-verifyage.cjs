// RC-28 (Verify Age): the button must say it is not saved until Save is pressed. Production, isolated QA owner account; its age fields are restored.
//   AUDIT_MANIFEST=<manifest> node rb24-verifyage.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const { sleep, admin, session } = A;
const m = A.man(); const P = m.personalId;
const LABEL = process.argv[2] || "run";
const r = A.R("RB24");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] }; let n = 0, S;
async function rec(ok, control, expected, actual) {
  let ev = ""; try { await sleep(250); ev = path.join(A.AUD, await S.jshot(`rb24-${LABEL}-${++n}`)); } catch {}
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page: "/account/security | QA owner", control, expected, actual, evidence: ev ? path.relative(A.AUD, ev).replace(/\\/g, "/") : "", impact: "RC-28", repro: "" });
}
const row = async () => (await admin.from("profiles").select("date_of_birth,age_verified").eq("id", P).maybeSingle()).data;
const note = () => S.evaluate("(() => { const e = document.querySelector('[data-testid=age-unsaved-note]'); return e ? e.innerText : null; })()");
(async () => {
  const orig = await row();
  try {
    S = await session("owner");
    await S.visit("/account/security"); await S.waitFor("document.body.innerText.includes('Age verification')", 40000, "security").catch(() => {}); await sleep(2000);
    await S.evaluate(`(() => { const i = document.querySelector('input[type=date]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, '1990-05-17'); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
    await sleep(500);
    await A.clickText(S, "^Verify Age$", "button"); await sleep(600);
    const n1 = await note(); const d1 = await row();
    await rec(/not saved yet/i.test(n1 || "") && !d1.age_verified, "Verify Age pressed on its own", "the page says it is not saved yet; nothing stored", `note=${JSON.stringify(n1)}; stored age_verified=${d1.age_verified}`);
    await A.clickText(S, "^Save$", "button"); await sleep(3000);
    const n2 = await note(); const d2 = await row();
    await rec(!n2 && d2.age_verified === true && d2.date_of_birth === "1990-05-17", "Save after Verify Age", "the note disappears; verification and date of birth stored", `note=${JSON.stringify(n2)}; stored age_verified=${d2.age_verified}, dob=${d2.date_of_birth}`);
    await A.clickText(S, "^Remove Verification$", "button"); await sleep(600);
    const n3 = await note(); const d3 = await row();
    await rec(/remove/i.test(n3 || "") && d3.age_verified === true, "Remove Verification pressed on its own", "the page says removal is not saved yet; stored value unchanged", `note=${JSON.stringify(n3)}; stored age_verified=${d3.age_verified}`);
    await A.clickText(S, "^Save$", "button"); await sleep(3000);
    const d4 = await row();
    await rec(!(await note()) && d4.age_verified === false, "Save after Remove Verification", "note gone; verification removed in the database", `stored age_verified=${d4.age_verified}`);
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    try { await admin.from("profiles").update({ date_of_birth: orig.date_of_birth, age_verified: orig.age_verified }).eq("id", P); } catch {}
    try { await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb24-verifyage-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    for (const c of out.cases.filter((c) => !c.ok)) console.log("NOT OK:", c.control, "|", String(c.actual).slice(0, 300));
    process.exit(0);
  }
})();
