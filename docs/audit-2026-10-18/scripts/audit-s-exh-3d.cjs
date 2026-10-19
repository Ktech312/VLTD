// EXH suite 8: the existing 3D / Museum experiences: access requirements per audience and the DOM controls in isolation.
const X = require("./audit-s-exh-lib.cjs");
const { session, admin, sleep, man, rows, mclick, byLabel, byLabelRe, key, controls } = X;
const R = rows();
const m = man();
const webglOf = (S) => S.evaluate(`(() => { const c = document.createElement('canvas'); const g = c.getContext('webgl2') || c.getContext('webgl'); return g ? String((g.getParameter(g.RENDERER) || '')).slice(0, 40) : null; })()`);
const txt = async (S) => (await S.text()).replace(/\s+/g, " ");

(async () => {
  // ---------- signed-out visitor
  let S = await session("visitor");
  try {
    for (const r of ["/museum/vltd", "/museum/builder", "/museum/campus-prototype", "/museum/virtual-room"]) {
      await S.visit(r); await sleep(2500);
      const p = await S.path();
      R.check(p.startsWith("/login?next=" + encodeURIComponent(r)), { page: `${r} | signed-out visitor`, control: "Opening the 3D / Museum route signed out", expected: "Sent to sign-in with a return address", actual: p, evidence: "", impact: "privacy/data loss", repro: "Open " + r + " signed out" });
    }
    await S.visit("/museum/virtual-room/guest"); await sleep(5000);
    const t = await txt(S);
    const gl = await webglOf(S);
    R.check(!(await S.path()).startsWith("/login") && /VLTD ROOM BUILDER/.test(t), { page: "/museum/virtual-room/guest | signed-out visitor", control: "Virtual room guest route", expected: "Opens without an account (a public viewing route)", actual: (await S.path()) + " | " + t.slice(t.indexOf("⌘K") + 3, t.indexOf("⌘K") + 150), evidence: await S.jshot("exh-3d-guest-visitor-1440"), impact: "usability", repro: "Open /museum/virtual-room/guest signed out" });
    R.nt({ page: "/museum/virtual-room/guest | signed-out visitor", control: "Guest route content", expected: "Product question: a signed-out visitor opening this route sees the editor's own title 'VLTD ROOM BUILDER' and 'Grand Hall: Exhibitions coming soon … Pick items in the Items panel' (builder wording) rather than a finished viewing page", actual: "headless Chrome WebGL renderer: " + gl, impact: "improvement" });
    const cs = (await controls(S)).filter((c) => c.visible && !["nav"].includes(c.region));
    R.pass({ page: "/museum/virtual-room/guest | signed-out visitor", control: "Controls available (inventory)", expected: "Listed for the record", actual: cs.slice(0, 24).map((c) => c.kind + ":" + c.label.slice(0, 28)).join(" | "), evidence: "", impact: "none" });
    await S.visit("/museum/alpha"); await sleep(2500);
    R.check((await S.path()).startsWith("/login"), { page: "/museum/alpha | signed-out visitor", control: "Route /museum/alpha", expected: "No separate 'alpha' page exists; it is just an exhibition id so it needs sign-in like any /museum page", actual: await S.path(), impact: "none", repro: "Open /museum/alpha signed out" });
    await S.visit("/admin/museum-campus"); await sleep(3000);
    R.check(/Not authorized/.test(await txt(S)), { page: "/admin/museum-campus | signed-out visitor", control: "Admin museum campus page", expected: "Not authorized (no data shown)", actual: (await txt(S)).slice(-80), impact: "privacy/data loss", repro: "Open it signed out" });
  } finally { await S.close(); }

  // ---------- owner QA user (not an admin, not approved for the beta)
  S = await session("owner");
  try {
    for (const r of ["/museum/vltd", "/museum/builder", "/museum/campus-prototype", "/admin/museum-campus"]) {
      await S.visit(r); await sleep(3500);
      const t = await txt(S);
      R.check(/Not authorized/.test(t) && !/Walk|Room|Floor|Campus map/i.test(t.replace("Not authorized. Owner access required.", "")), { page: `${r} | signed-in QA user (not admin, not beta)`, control: "Opening the owner-only 3D page", expected: "'Not authorized. Owner access required.' and nothing else of the page", actual: t.slice(t.indexOf("Level"), t.indexOf("Level") + 90), evidence: await S.jshot("exh-3d-denied-" + r.replace(/\W+/g, "-")), impact: "privacy/data loss", repro: "Sign in as an ordinary user, open " + r });
    }
    await S.visit("/museum/virtual-room"); await sleep(3500);
    const t = await txt(S);
    R.check(/3D Gallery is invite-only/.test(t), { page: "/museum/virtual-room | signed-in QA user, beta flag off", control: "3D Gallery without approval", expected: "Explains it is invite-only and points to the request button", actual: t.slice(t.indexOf("3D Gallery"), t.indexOf("3D Gallery") + 160), evidence: await S.jshot("exh-3d-invite-only-1440"), impact: "usability", repro: "Open /museum/virtual-room without approval" });
    await mclick(S, byLabel("Back to Exhibitions"), { wait: 3000 });
    R.check((await S.path()) === "/museum", { page: "/museum/virtual-room | beta off", control: "'Back to Exhibitions'", expected: "Opens /museum", actual: await S.path(), impact: "usability", repro: "Click the link" });
    await S.visit("/museum/virtual-room/guest"); await sleep(5000);
    R.pass({ page: "/museum/virtual-room/guest | signed-in QA user", control: "Guest route when signed in", expected: "Opens", actual: (await txt(S)).slice((await txt(S)).indexOf("Level"), (await txt(S)).indexOf("Level") + 80), evidence: await S.jshot("exh-3d-guest-owner-1440"), impact: "none" });
  } finally { await S.close(); }

  // ---------- beta flag on the fixture profile only (QA-owned column on this agent's own fixture profile)
  const flag = await admin.from("profiles").update({ museum_beta_enabled: true }).eq("id", m.personalId);
  if (flag.error) {
    R.blocked({ page: "/museum/virtual-room | beta enabled", control: "3D builder with the beta flag on", expected: "Open the 3D room builder", actual: "BLOCKED: could not set museum_beta_enabled on the fixture profile (" + flag.error.message + "); the column is admin-only", impact: "usability" });
  } else {
    S = await session("owner");
    try {
      await S.visit("/museum/virtual-room"); await sleep(9000);
      const t = await txt(S);
      const gl = await webglOf(S);
      const canvases = await S.evaluate(`document.querySelectorAll('canvas').length`);
      const shot = await S.jshot("exh-3d-room-builder-1440");
      R.check(!/invite-only/.test(t) && /ROOM BUILDER|Grand Hall|ROOMS/i.test(t), { page: "/museum/virtual-room | signed-in QA user, beta flag ON (set on the fixture profile)", control: "Open the 3D builder with approval", expected: "The room builder opens", actual: t.slice(t.indexOf("Level"), t.indexOf("Level") + 200), evidence: shot, impact: "blocked workflow", repro: "Approved profile opens /museum/virtual-room" });
      R.pass({ page: "/museum/virtual-room | beta ON", control: "WebGL availability in the audit browser", expected: "Record only", actual: `renderer ${gl}; canvas elements ${canvases}`, evidence: "", impact: "none" });
      const cs = (await controls(S)).filter((c) => c.visible && c.region !== "nav");
      R.pass({ page: "/museum/virtual-room | beta ON", control: "Controls available (inventory)", expected: "Listed for the record", actual: cs.slice(0, 40).map((c) => c.kind + ":" + c.label.slice(0, 26)).join(" | "), evidence: "", impact: "none" });
      // try the first few simple buttons that are not destructive: record whether each reacts (DOM change)
      const labels = cs.filter((c) => c.kind === "button" && !/delete|remove|clear|reset|publish|save|share|bug|help|search|account|install|dismiss/i.test(c.label) && c.label).slice(0, 8).map((c) => c.label);
      const state = (lab) => S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find(b => ((b.getAttribute('aria-label') || b.textContent).trim().replace(/\s+/g,' ')).slice(0, 70) === ${JSON.stringify(lab)}); const root = document.querySelector('main') || document.body; return (b ? (b.className + '|' + b.getAttribute('aria-pressed') + '|' + b.getAttribute('aria-expanded')) : 'gone') + '#' + root.innerHTML.length + '#' + document.querySelectorAll('[role=dialog],[role=menu]').length + '#' + location.pathname; })()`);
      let first = true;
      for (const lab of labels) {
        if (!first) { await S.visit("/museum/virtual-room"); await sleep(8000); }
        first = false;
        const before = await state(lab);
        const ok = await mclick(S, `[...document.querySelectorAll('button')].find(b => ((b.getAttribute('aria-label') || b.textContent).trim().replace(/\s+/g,' ')).slice(0, 70) === ${JSON.stringify(lab)})`, { wait: 900 });
        const after = await state(lab);
        R.check(ok && before !== after, { page: "/museum/virtual-room | beta ON | fresh page load per button", control: `Button '${lab}'`, expected: "Reacts: the control's state, the panel, a menu or the address changes", actual: ok ? (before === after ? "no change in the page or the button's state (a change inside the 3D canvas cannot be seen by the audit)" : "changed") : "button not found / not clickable", impact: "usability", repro: "Open the 3D builder (approved account), click the button" });
        await key(S, "Escape", "Escape", 27);
      }
      R.nt({ page: "/museum/virtual-room | beta ON", control: "3D canvas (walk-through, placing items, camera)", expected: "3D scene behaviour", actual: canvases > 0 ? "canvas present (" + gl + ") but its pixels cannot be asserted by this audit; scene interactions are BLOCKED/NOT TESTED beyond the DOM controls above" : "no canvas", impact: "usability" });
    } finally { await S.close(); }
    await admin.from("profiles").update({ museum_beta_enabled: false }).eq("id", m.personalId);
  }
  R.nt({ page: "/museum/vltd, /museum/builder, /museum/campus-prototype", control: "Owner-only 3D Museum pages (the real VLTD owner role)", expected: "Walk-through and room editor", actual: "NOT TESTED: need the owner/admin role, which is not granted to QA users; only the access-denied behaviour was exercised", impact: "usability" });
  console.log("DONE 3d");
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
