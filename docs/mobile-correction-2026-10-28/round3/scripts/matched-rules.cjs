// Which CSS rules set the text colour of a given element on a live page (CDP CSS.getMatchedStylesForNode).
//   node matched-rules.cjs <path> <js expression that returns the element>
const GUIDE = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/walkthrough/add-item-guide/_build";
const { start, T } = require(GUIDE + "/lib.cjs");
(async () => {
  const R = await start({ scene: "matched-rules", phone: true, camera: false });
  const { S } = R;
  try {
    await S.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await R.goto(process.argv[2]); await T.sleep(2500);
    await S.send("DOM.enable", {}); await S.send("CSS.enable", {});
    await S.evaluate(`(() => { const e = ${process.argv[3]}; if (e) e.setAttribute('data-probe', '1'); return !!e; })()`);
    const doc = await S.send("DOM.getDocument", { depth: 1 });
    const q = await S.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "[data-probe='1']" });
    const m = await S.send("CSS.getMatchedStylesForNode", { nodeId: q.nodeId });
    const out = [];
    for (const r of m.matchedCSSRules || []) { const sel = r.rule.selectorList.text; const props = (r.rule.style.cssProperties || []).filter((p) => /^(color|-webkit-text-fill-color)$/.test(p.name) && !p.disabled); if (props.length) out.push({ origin: r.rule.origin, sel: sel.slice(0, 150), props: props.map((p) => `${p.name}: ${p.value}${p.important ? " !important" : ""}`), src: (r.rule.styleSheetId ? "sheet" : "") }); }
    console.log(JSON.stringify(out, null, 1));
  } catch (e) { console.log("SCRIPT ERROR:", e.message); }
  await R.close(); process.exit(0);
})();
