// EXH suite 11: leaving the editor mid-edit (there is no Cancel/discard): does the list show the edit, and does Back/Forward keep the page?
const X = require("./audit-s-exh-lib.cjs");
const { session, admin, sleep, man, rows, mclick, byLabel, typeInto, gdb } = X;
const R = rows();
const ex = JSON.parse(require("fs").readFileSync(__dirname + "/exh-created.json", "utf8"));
const A = ex.A;
(async () => {
  const S = await session("owner");
  try {
    await S.visit("/vault"); await sleep(5000);
    await S.visit("/museum/" + A); await sleep(7000);
    const hasCancel = await S.evaluate(`[...document.querySelectorAll('main button')].some(b => /^(cancel|discard|undo|revert)/i.test(b.textContent.trim()))`);
    R.nt({ page: "/museum/[galleryId] | owner", control: "Cancel / discard changes in the exhibition editor", expected: "Product decision: the editor autosaves every edit, so there is no way to discard a change except undoing it by hand", actual: hasCancel ? "a Cancel/Discard control exists" : "No Cancel, Discard or Undo control on the page; 'Back to Exhibitions' keeps whatever was edited", impact: "improvement" });
    await mclick(S, byLabel("Edit title and description"), { wait: 400 });
    await typeInto(S, `document.querySelector('input[aria-label="Exhibit title"]')`, "QA Spare A leave test");
    await sleep(3500);
    await mclick(S, byLabel("Back to Exhibitions"), { wait: 3500 });
    const cards = await X.cardText(S);
    R.check(cards.some((c) => c.includes("QA Spare A leave test")), { page: "/museum | owner, after editing a title and pressing Back", control: "Exhibitions list after leaving the editor", expected: "The list shows the new title", actual: cards.map((c) => c.replace(/^\+\s*/, "").slice(0, 28)).filter((c) => /Spare A/.test(c)).join(" | "), evidence: "", impact: "misleading result", repro: "Rename an exhibition, press Back to Exhibitions" });
    await S.evaluate("history.back()"); await sleep(3500);
    const p1 = await S.path();
    await S.evaluate("history.forward()"); await sleep(3500);
    const p2 = await S.path();
    R.check(p1.startsWith("/museum/" + A) && p2 === "/museum", { page: "/museum/[galleryId] <-> /museum | owner", control: "Browser Back then Forward", expected: "Back returns to the exhibition, Forward to the list", actual: `${p1} then ${p2}`, impact: "usability", repro: "Open an exhibition, press Back to Exhibitions, then browser Back and Forward" });
    await admin.from("galleries").update({ title: "QA Spare A" }).eq("id", A);
  } finally { await S.close(); }
  console.log("DONE leave");
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
