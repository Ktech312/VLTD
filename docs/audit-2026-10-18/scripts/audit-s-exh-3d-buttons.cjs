// EXH suite 8b: 3D builder buttons, one fresh load each, with the saved panel state cleared (the first run reused a collapsed panel).
const X = require("./audit-s-exh-lib.cjs");
const { session, admin, sleep, man, rows, mclick, key, controls } = X;
const R = rows(); const m = man();
(async () => {
  const flag = await admin.from("profiles").update({ museum_beta_enabled: true }).eq("id", m.personalId);
  if (flag.error) { R.blocked({ page: "/museum/virtual-room | beta on", control: "3D builder buttons", expected: "Open", actual: "BLOCKED: " + flag.error.message, impact: "usability" }); process.exit(0); }
  const S = await session("owner");
  try {
    const clean = async () => { await S.evaluate(`Object.keys(localStorage).filter(k => !['vltd-auth','vltd_active_profile_id_v1','vltd-theme'].includes(k)).forEach(k => localStorage.removeItem(k)); try { sessionStorage.clear(); } catch (e) {} true`); };
    await S.visit("/museum/virtual-room"); await sleep(8000); await clean(); await S.visit("/museum/virtual-room"); await sleep(8000);
    const cs = (await controls(S)).filter((c) => c.visible && c.region !== "nav" && c.kind === "button" && c.label && !/delete|remove|clear|reset|publish|save|share|bug|help|search|account|install|dismiss/i.test(c.label));
    const labels = [...new Set(cs.map((c) => c.label))].slice(0, 10);
    console.log("buttons", JSON.stringify(labels));
    const state = (lab) => S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => ((b.getAttribute('aria-label') || b.textContent).trim().replace(/\s+/g,' ')).slice(0, 70) === ${JSON.stringify(lab)}); const root = document.querySelector('main') || document.body; return (b ? (b.className + '|' + b.getAttribute('aria-pressed') + '|' + b.getAttribute('aria-expanded') + '|' + b.textContent.trim().slice(0, 30)) : 'gone') + '#' + root.innerHTML.length + '#' + document.querySelectorAll('[role=dialog],[role=menu]').length + '#' + location.pathname; })()`);
    for (const lab of labels) {
      await S.visit("/museum/virtual-room"); await sleep(7000); await clean(); await S.visit("/museum/virtual-room"); await sleep(7000);
      const before = await state(lab);
      if (before.startsWith("gone")) { R.nt({ page: "/museum/virtual-room | beta ON | fresh load", control: `Button '${lab}'`, expected: "Reacts when clicked", actual: "button not present on this fresh load (panel state differs); not exercised", impact: "usability" }); continue; }
      const ok = await mclick(S, `[...document.querySelectorAll('button')].find(b => ((b.getAttribute('aria-label') || b.textContent).trim().replace(/\s+/g,' ')).slice(0, 70) === ${JSON.stringify(lab)})`, { wait: 900 });
      const after = await state(lab);
      R.check(ok && before !== after, { page: "/museum/virtual-room | beta ON (set on the fixture profile) | fresh load, saved panel state cleared", control: `Button '${lab}'`, expected: "Reacts: the control's state, the panel, a menu or the address changes", actual: ok ? (before === after ? "no change in the page or in the button's state (a change inside the 3D canvas cannot be seen by this audit)" : "changed") : "not clickable", evidence: before === after ? await S.jshot("exh-3d-btn-" + lab.replace(/\W+/g, "-").slice(0, 24)) : "", impact: "usability", repro: "Open the 3D builder with an approved account, click the button" });
      await key(S, "Escape", "Escape", 27);
    }
  } finally { await S.close(); await admin.from("profiles").update({ museum_beta_enabled: false }).eq("id", m.personalId); }
  console.log("DONE 3d-buttons"); process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
