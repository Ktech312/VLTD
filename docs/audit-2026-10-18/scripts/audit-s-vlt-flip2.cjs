// VLT suite 13b: Flip drag with the app's own direction convention (the Flip view is page-turning: dragging right = next, dragging left = previous, wraps). First run (VLT-486/487/499) assumed the opposite; first-failure rows stay.
const X = require("./audit-s-vlt-vlib.cjs");
const { R, sleep, drag, touchSwipe } = X; const r = R("VLT");
const n = async (S) => { const m = /(\d+) \/ (\d+)/.exec(await S.evaluate("document.body.innerText.replace(/\\s+/g, ' ')")); return m ? Number(m[1]) : null; };
const top = (S) => S.evaluate("(() => { const el = [...document.querySelectorAll('div,span,button,p,label')].filter((e) => /^\\d+ ?\\/ ?\\d+$/.test(e.innerText.trim())).pop(); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 200 }; })()");
(async () => {
  for (const [kind, W, H, mobile] of [["desktop 1440 (mouse)", 1440, 900, false], ["390 phone (browser-emulated touch)", 390, 844, true]].filter((x) => !process.env.ONLY_PHONE || x[3])) {
    const S = await X.session("owner", { width: W, height: H, mobile });
    try {
      await S.visit("/vault"); await S.evaluate("localStorage.setItem('vltd_vault_view_mode', 'flip'); sessionStorage.clear(); true"); await S.visit("/vault"); await S.waitFor("document.querySelectorAll('button').length > 5 && /\\d+ \\/ \\d+/.test(document.body.innerText)", 60000, "flip counter"); await sleep(800);
      const move = async (dx) => { const c = await top(S); await sleep(300); if (mobile) await touchSwipe(S, c.x - dx / 2, c.y, c.x + dx / 2, c.y); else await drag(S, c.x - dx / 2, c.y, c.x + dx / 2, c.y, 8); await sleep(1300); return n(S); };
      const p0 = await S.path(); const a = await n(S);
      const b = await move(220);   // drag right
      const c = await move(220);
      const d = await move(-220);  // drag left
      const e = await move(-220); const f = await move(-220); // from 1 going left wraps to the last card
      const total = Number(/\/ (\d+)/.exec(await S.evaluate("document.body.innerText.replace(/\\s+/g, ' ')"))[1]);
      r.check(a === 1 && b === 2 && c === 3 && d === 2 && e === 1 && f === total && (await S.path()) === p0, { page: `/vault | owner, Personal, Flip view, ${kind}`, control: `Flip: drag/swipe the card (${kind})`, expected: "Dragging right goes to the next card (2, 3), dragging left goes back (2, 1), a further drag left wraps to the last card; the item is never opened by a drag", actual: `sequence ${[a, b, c, d, e, f].join(" -> ")} (N=${total}); path ${await S.path()}`, evidence: await S.jshot("vlt-flip-" + (mobile ? "390" : "1440")), impact: "blocked workflow", repro: "Flip view; drag the card right twice, left three times" });
      if (!mobile) r.pass({ page: "/vault | owner, Personal, Flip view", control: "Flip: direction convention", expected: "(observation) dragging the card to the left shows the PREVIOUS card and dragging right shows the NEXT; most card-stack apps do the opposite (drag left = next). Keyboard Right arrow = next", actual: "as observed above", evidence: "", impact: "improvement", repro: "drag left on the card" });
    } finally { await S.close(); }
  }
  r.pass({ page: "/vault | owner, Personal", control: "(test note) VLT-486, 487, 499, 496", expected: "n/a", actual: "VLT-486/487/499 assumed dragging left = next; the app's Flip view uses the opposite convention (see the two rows above). VLT-496 counted two copies of the header Add buttons (the second copy is the phone version): Quick Add -> /vault/quick and Add Item -> /capture are correct.", evidence: "", impact: "none", repro: "see scripts" });
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });
