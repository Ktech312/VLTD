// ACC: Security page > Receive product updates (checkbox) + Save, and age verification date field. --w=1440|390
const A = require("./audit-s-acc-lib.cjs");
const { admin, man, R } = A; const m = man(); const r = R("ACC");
setTimeout(() => process.exit(3), 900000).unref();
const W = Number((process.argv.find((a) => a.startsWith("--w=")) || "--w=1440").slice(4)); const MOBILE = W < 500;
const tag = MOBILE ? "390 (browser-emulated touch)" : "1440";
const db = async () => (await admin.from("profiles").select("marketing_opt_in,date_of_birth,age_verified").eq("id", m.personalId).single()).data;
(async () => {
  await admin.from("profiles").update({ marketing_opt_in: false, date_of_birth: null, age_verified: false }).eq("id", m.personalId);
  const S = await A.session("owner", { width: W, height: MOBILE ? 844 : 900, mobile: MOBILE });
  const page = `/account/security | owner, Personal | ${tag}`;
  try {
    await S.visit("/account/security"); await A.sleep(2000);
    const cb = () => S.evaluate("(() => { const c = [...document.querySelectorAll('main input[type=checkbox]')].map((e) => ({ checked: e.checked, label: (e.closest('label') || e.parentElement).innerText.replace(/\\s+/g, ' ').trim().slice(0, 60) })); return c; })()");
    const c0 = await cb();
    // click the visible label text (a real person taps the words or the box)
    await A.clickExpr(S, "[...document.querySelectorAll('main label')].find((l) => /Receive product updates/.test(l.innerText))", { touch: MOBILE }); await A.sleep(500);
    const c1 = await cb();
    await A.clickText(S, "^Save$", "main button", { touch: MOBILE }); await A.sleep(2500);
    const d1 = await db();
    await S.visit("/account/security"); await A.sleep(2000);
    const c2 = await cb();
    r.check(c0[0] && c0[0].checked === false && c1[0].checked === true && d1.marketing_opt_in === true && c2[0].checked === true, { page, control: "Receive product updates (checkbox) + Save", expected: "ticking the box and pressing Save stores the choice (marketing_opt_in true) and it is still ticked after reload", actual: `before=${JSON.stringify(c0)}; after tick=${JSON.stringify(c1)}; db=${d1.marketing_opt_in}; after reload=${JSON.stringify(c2)}`, evidence: await S.jshot(`acc-set-marketing2-${W}`), impact: "data loss", repro: "Security > Receive product updates: tick; Save; reload" });
    // untick + leave without saving
    await A.clickExpr(S, "[...document.querySelectorAll('main label')].find((l) => /Receive product updates/.test(l.innerText))", { touch: MOBILE }); await A.sleep(400);
    await S.visit("/vault"); await S.visit("/account/security"); await A.sleep(1800);
    const c3 = await cb(); const d3 = await db();
    r.check(c3[0].checked === true && d3.marketing_opt_in === true, { page, control: "Untick then leave without pressing Save", expected: "unsaved change dropped: still ticked and still stored as true", actual: `after return=${JSON.stringify(c3)}; db=${d3.marketing_opt_in}`, evidence: "", impact: "data loss", repro: "" });
    // age verification: future date and under-18 refused; valid adult accepted
    const dob = await S.evaluate("(() => { const i = document.querySelector('main input[type=date]') || document.querySelector('main input[placeholder*=\"YYYY\"],main input[placeholder*=\"MM\"]'); return i ? { type: i.type, ph: i.placeholder } : null; })()");
    r.pass({ page, control: "Date of birth field (informational)", expected: "(informational)", actual: JSON.stringify(dob), evidence: "", impact: "improvement", repro: "" });
    if (dob) {
      const sel = dob.type === "date" ? "main input[type=date]" : "main input[placeholder*=\"YYYY\"],main input[placeholder*=\"MM\"]";
      const setDob = async (v) => { if (dob.type === "date") await S.evaluate(`(() => { const i = document.querySelector('${sel}'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${JSON.stringify(v)}); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); })()`); else await A.typeInto(S, sel, v); await A.sleep(500); };
      const verifyState = () => S.evaluate("(() => { const b = [...document.querySelectorAll('main button')].find((x) => /Verify Age/.test(x.innerText)); return b ? b.disabled : null; })()");
      const hint = () => S.evaluate("(document.body.innerText.match(/(Not eligible yet|Eligible|Enter a valid date|You must be|18)[^\\n]*/g) || []).slice(0, 3)");
      const next = new Date(Date.now() + 86400000 * 400).toISOString().slice(0, 10);
      const kid = new Date(Date.now() - 86400000 * 365 * 10).toISOString().slice(0, 10);
      const adult = "1990-05-17";
      const out = {};
      for (const [k, v] of [["future", next], ["10-year-old", kid], ["adult", adult]]) { await setDob(v); out[k] = { disabled: await verifyState(), hint: await hint() }; }
      r.check(out.future.disabled === true && out["10-year-old"].disabled === true && out.adult.disabled === false, { page, control: "Date of birth: future date, a 10-year-old, an adult", expected: "Verify Age stays disabled (with the reason) for the first two, enabled for the adult", actual: JSON.stringify(out), evidence: await S.jshot(`acc-set-dob-${W}`), impact: "usability", repro: "Type each date in Date of birth" });
      await A.clickText(S, "Verify Age", "main button", { touch: MOBILE }); await A.sleep(1500);
      const d4 = await db();
      const msg4 = await S.evaluate("(document.body.innerText.match(/(Age verified|Verified|Saved|Eligible|Press Save|Save to)[^\\n]*/gi) || []).slice(0, 4)");
      r.check(d4.age_verified === true || /save/i.test(JSON.stringify(msg4)), { page, control: "Verify Age (adult date) — button on its own", expected: "either stores the verification straight away, or tells the person it still needs Save", actual: `stored right away=${d4.age_verified}; page says ${JSON.stringify(msg4)}`, evidence: await S.jshot(`acc-set-verifyage-${W}`), impact: "misleading result", repro: "Enter 1990-05-17; press Verify Age (do not press Save)" });
      await A.clickText(S, "^Save$", "main button", { touch: MOBILE }); await A.sleep(2500);
      const d5 = await db();
      r.check(d5.age_verified === true && String(d5.date_of_birth || "").startsWith("1990"), { page, control: "Verify Age then Save", expected: "age verified and date of birth are stored", actual: JSON.stringify(d5), evidence: "", impact: "data loss", repro: "Verify Age; Save" });
    }
  } finally { await S.close(); await admin.from("profiles").update({ marketing_opt_in: false, date_of_birth: null, age_verified: false }).eq("id", m.personalId); }
})().catch((e) => { console.error("ERR", e); process.exit(2); });
