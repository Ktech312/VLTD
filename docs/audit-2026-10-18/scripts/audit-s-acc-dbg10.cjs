const A = require("./audit-s-acc-lib.cjs");
const { admin, man } = A; const m = man();
(async () => {
  const S = await A.session("owner", { width: 390, height: 844, mobile: true });
  try {
    await S.visit("/account/security"); await A.sleep(2500);
    const sw = await S.evaluate("[...document.querySelectorAll('main [role=switch],main input[type=checkbox]')].map((e) => ({ al: e.getAttribute('aria-label'), checked: e.getAttribute('aria-checked') || e.checked, dis: e.disabled, y: Math.round(e.getBoundingClientRect().y) }))");
    console.log("switches", JSON.stringify(sw));
    const near = await S.evaluate("(document.body.innerText.match(/Receive product updates[^\\n]*/g) || [])");
    console.log(near);
    // tap the switch next to 'Receive product updates'
    const expr = "(() => { const lab = [...document.querySelectorAll('main *')].find((e) => e.children.length === 0 && /Receive product updates/.test(e.innerText)); let p = lab; for (let i = 0; i < 6 && p; i++) { const s = p.querySelector && p.querySelector('[role=switch],input[type=checkbox]'); if (s) return s; p = p.parentElement; } return null; })()";
    const ok = await A.clickExpr(S, expr, { touch: true }); await A.sleep(800);
    console.log("tap switch", ok, await S.evaluate(`(() => { const s = ${expr}; return s ? (s.getAttribute('aria-checked') || s.checked) : null; })()`));
    await S.jshot("acc-dbg10-marketing");
    const ok2 = await A.clickText(S, "^Save$", "main button", { touch: true }); await A.sleep(2500);
    const { data } = await admin.from("profiles").select("marketing_opt_in").eq("id", m.personalId).single();
    console.log("save", ok2, "db", data.marketing_opt_in);
  } finally { await S.close(); await admin.from("profiles").update({ marketing_opt_in: false }).eq("id", m.personalId); }
})();
