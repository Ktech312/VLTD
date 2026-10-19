// ADD audit, suite 3d: /vault/add - 'Use This Picture' then Identify with AI (INTERCEPTED), 'Use Full Photo' label, 'Unlock All' behaviour.
const T = require("./audit-s-add-lib.cjs");
const { alertText, session, sleep, man, admin, rec, click, clickText, typeInto, text, rowsByTitle, allCount, removeItems, mine, rectOf, chooseViaButton, fieldInput, mkPng, tmp } = T;
const PG = "/vault/add | owner, Personal, 26 items";
const PREFIX = "AUD ADD V4 ";
const title = "document.getElementById('scan-title')";
const labelsOf = async (S) => (await T.controls(S)).filter((c) => c.visible && c.kind === "button").map((c) => c.label);
(async () => {
  const P = man().personalId;
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    await S.visit("/vault/add"); await S.waitFor("document.getElementById('scan-title')", 60000); await sleep(800);
    await chooseViaButton(S, T.btnExpr("Upload a photo from a file"), mkPng(tmp("v4-" + Date.now() + ".png"), 640, 480, [160, 60, 90])); await sleep(3000);
    await clickText(S, "^Use Full Photo$"); await sleep(1500);
    const stillOpen = (await labelsOf(S)).includes("Use Full Photo");
    await rec(S, !stillOpen, { page: PG, control: "Use Full Photo (crop step)", expected: "Accepts the whole photo and closes the crop step", actual: stillOpen ? "nothing visible happens: the crop step stays open; the button only resets the crop frame (the person must then press 'Use This Picture')" : "closed", impact: "misleading result", repro: "Upload a photo, press Use Full Photo" });
    await clickText(S, "^Use This Picture$"); await sleep(2500);
    const l = await labelsOf(S);
    await rec(S, !l.includes("Use This Picture") && l.includes("Identify with AI"), { page: PG, control: "Use This Picture", expected: "Crop step closes with the photo attached", actual: `crop step closed=${!l.includes("Use This Picture")}; Identify with AI offered=${l.includes("Identify with AI")}`, impact: "blocked workflow", repro: "Upload a photo, press Use This Picture" });
    await typeInto(S, title, PREFIX + "IdKeep");
    const logB = (await admin.from("ai_usage_log").select("id", { count: "exact", head: true }).eq("profile_id", P)).count; const itemsB = await allCount(P); const iB = S.intercepted.length;
    await clickText(S, "^Identify with AI$"); await sleep(12000);
    const idt = await text(S); const calls = S.intercepted.slice(iB).filter((x) => /api\/ai/.test(x.url)).length;
    const fail = (idt.match(/[^\n]*(couldn.t|could not|failed|try again|unavailable|by hand|manually|unable|no match|not identified)[^\n]*/i) || [""])[0];
    await S.jshot("add-vaultadd-identify-refused2");
    await rec(S, calls >= 1 && !!fail, { page: PG, control: "Identify with AI (INTERCEPTED, not a successful AI result)", expected: "After the AI call is refused the page says identification did not work and the form stays usable", actual: `AI requests refused by the audit: ${calls}; failure message: '${fail.slice(0, 120) || "(none visible)"}'; page text near the top: '${idt.slice(0, 0)}'`, impact: "misleading result", repro: "Attach a photo (Use This Picture), press Identify with AI while AI is refused" });
    await rec(S, (await S.evaluate(`(${title}).value`)) === PREFIX + "IdKeep" && (await allCount(P)) === itemsB && (await admin.from("ai_usage_log").select("id", { count: "exact", head: true }).eq("profile_id", P)).count === logB, { page: PG, control: "Identify refusal: title kept, no item created, no AI usage logged", expected: "Nothing lost, nothing created, nothing logged", actual: `title kept=${(await S.evaluate(`(${title}).value`)) === PREFIX + "IdKeep"}; items ${itemsB}->${await allCount(P)}`, impact: "data loss", repro: "As above" });
    // Unlock All
    const lockTitle = (labText) => S.evaluate(`(() => { const l = [...document.querySelectorAll('label')].find((x) => x.textContent.trim() === ${JSON.stringify(labText)}); const b = l && l.parentElement.querySelector('button'); return b ? (b.getAttribute('title') || b.getAttribute('aria-label')) : 'none'; })()`);
    await typeInto(S, fieldInput("Purchase Price"), "77");
    const before = { universe: await lockTitle("Universe"), storage: await lockTitle("Storage Location"), title: await S.evaluate(`(${title}).value`), price: await S.evaluate(`(${fieldInput("Purchase Price")}).value`), photo: (await labelsOf(S)).includes("Identify with AI") };
    await clickText(S, "^Unlock All$"); await sleep(1200);
    const after = { universe: await lockTitle("Universe"), storage: await lockTitle("Storage Location"), title: await S.evaluate(`(${title}).value`), price: await S.evaluate(`(${fieldInput("Purchase Price")}).value`), photo: (await labelsOf(S)).includes("Identify with AI") };
    await S.jshot("add-vaultadd-unlockall");
    await rec(S, after.universe === "Unlocked for next item" && after.storage === "Unlocked for next item", { page: PG, control: "Unlock All", expected: "Unlocks every field (the lock icons open)", actual: `lock icons before ${JSON.stringify({ u: before.universe, s: before.storage })} after ${JSON.stringify({ u: after.universe, s: after.storage })}; typed title/price/photo before ${JSON.stringify({ t: before.title, p: before.price, photo: before.photo })} after ${JSON.stringify({ t: after.title, p: after.price, photo: after.photo })} - it clears the unlocked fields and the photo (status 'Unlocked fields reset.') without asking`, impact: "data loss", repro: "Type a title and price, attach a photo, press Unlock All" });
  } catch (e) { console.error("SUITE ERROR", e); try { await S.jshot("add-vaultadd4-error"); } catch {} }
  finally { await S.close(); await T.removeByPrefix(PREFIX); for (const p of mine()) console.log("leftover AUD ADD V4 rows", (await rowsByTitle(p, PREFIX)).length); }
})();
