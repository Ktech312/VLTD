// ADD audit, suite 7b: /ai/review Approve & save to vault (first run typed into the wrong box). Drafts are seeded directly into the browser's draft store (no app flow creates drafts).
const T = require("./audit-s-add-lib.cjs");
const { session, sleep, man, admin, rec, click, clickText, typeInto, text, rowsByTitle, removeItems, mine, poll } = T;
const PREFIX = "AUD ADD N ";
const KEY = "vltd_ai_drafts_v1";
const draft = (i, extra = {}) => ({ id: "aud_n_" + i, workspaceId: "w", createdByLabel: "audit seed", status: "READY_FOR_REVIEW", confidenceLabel: "Good", confidenceScore: 70, title: PREFIX + "Draft " + i, subtitle: "sub", missingFields: [], createdAt: new Date().toISOString(), categoryLabel: "Comics", ...extra });
const inp = (name) => `document.querySelector('input[name="${name}"]')`;
(async () => {
  const P = man().personalId;
  await T.removeByPrefix(PREFIX);
  const created = [];
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    await S.visit("/ai/drafts"); await sleep(1000);
    await S.evaluate(`localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(JSON.stringify([draft(1), draft(2), draft(3)]))}); true`);
    // A: price 0, no value
    await S.visit("/ai/review?id=aud_n_1"); await S.waitFor("document.querySelector('input[name=\"title\"]') && document.querySelector('input[name=\"title\"]').value.length > 0", 30000); await sleep(500);
    await typeInto(S, inp("purchasePrice"), "0");
    await click(S, T.btnExpr("Approve & save")); await sleep(2500);
    const toastA = (await text(S)).match(/✓ Saved to vault!/);
    const rA = await poll(async () => { const r = await rowsByTitle(P, PREFIX + "Draft 1"); return r.length ? r : null; }, 90000, 4000) || []; created.push(...rA);
    await rec(S, !!toastA && rA.length === 1, { page: "/ai/review | owner (seeded draft)", control: "Approve & save to vault (reaches the account)", expected: "After '✓ Saved to vault!' the item exists in the account", actual: `toast shown=${!!toastA}; rows in the account after up to 90 s: ${rA.length}${rA[0] ? "; added_via=" + rA[0].added_via + ", profile ok=" + (rA[0].profile_id === P) : ""}`, impact: "data loss", repro: "Seed a draft, open Review, Approve & save, check the account" });
    await rec(S, rA.length === 1 && rA[0].purchase_price === 0, { page: "/ai/review | owner (seeded draft)", control: "Purchase price typed 0 on the review form", expected: "Saved as 0 (it cost nothing), not turned into 'unknown'", actual: rA[0] ? "purchase_price=" + rA[0].purchase_price : "no row to read", impact: "misleading result", repro: "Type 0 for Purchase price, Approve" });
    // B: negative values
    await S.visit("/ai/review?id=aud_n_2"); await S.waitFor("document.querySelector('input[name=\"title\"]') && document.querySelector('input[name=\"title\"]').value.length > 0", 30000); await sleep(500);
    await typeInto(S, inp("purchasePrice"), "-5"); await typeInto(S, inp("currentValue"), "-7");
    await click(S, T.btnExpr("Approve & save")); await sleep(2500);
    const rB = await poll(async () => { const r = await rowsByTitle(P, PREFIX + "Draft 2"); return r.length ? r : null; }, 90000, 4000) || []; created.push(...rB);
    await rec(S, rB.length === 0 || (Number(rB[0].purchase_price) !== 5 && Number(rB[0].current_value) !== 7 && !(Number(rB[0].purchase_price) > 0)), { page: "/ai/review | owner (seeded draft)", control: "Purchase price -5 / Current value -7 typed on the review form", expected: "Refused with the negative-cost message, or saved as blank - never as +5 / +7", actual: rB[0] ? `saved: purchase_price=${rB[0].purchase_price}, current_value=${rB[0].current_value}; the page said: '${((await text(S)).match(/✓ Saved[^\n]*|[^\n]*negative[^\n]*/) || ["(nothing about a negative amount)"])[0].slice(0, 80)}'` : "no row", impact: "misleading result", repro: "Type -5 and -7, Approve, read the row" });
    // C: converted draft in the queue
    await S.visit("/ai/drafts"); await sleep(1200);
    const marks = await S.evaluate("(document.body.innerText.match(/In vault/g) || []).length");
    await rec(S, marks >= 2, { page: "/ai/drafts | owner", control: "Drafts after Approve & save", expected: "The approved drafts show '✓ In vault'", actual: "'In vault' marks: " + marks, impact: "misleading result", repro: "Approve two drafts, return to the queue" });
  } catch (e) { console.error("SUITE ERROR", e); try { await S.jshot("add-ai2-error"); } catch {} }
  finally { try { await S.evaluate(`localStorage.removeItem(${JSON.stringify(KEY)}); true`); } catch {} await S.close(); await T.removeByPrefix(PREFIX); await removeItems(created.filter(Boolean)); for (const p of mine()) console.log("leftover AUD ADD N rows", (await rowsByTitle(p, PREFIX)).length); }
})();
