// ADD audit, suite 3e: /vault/add attribute pills, Type, Auto (notes), More details; /capture Retake and Expand image.
const T = require("./audit-s-add-lib.cjs");
const { session, sleep, man, admin, rec, click, clickText, typeInto, pickSelect, text, rowsByTitle, removeItems, mine, rectOf, chooseViaButton, fieldInput, mkPng, tmp, poll } = T;
const PG = "/vault/add | owner, Personal";
const PREFIX = "AUD ADD Z ";
const created = [];
const title = "document.getElementById('scan-title')";
const saveBtn = T.btnExpr("^Save$|^Saving");
(async () => {
  const P = man().personalId;
  await T.removeByPrefix(PREFIX);
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    await S.visit("/vault/add"); await S.waitFor("document.getElementById('scan-title')", 60000); await sleep(800);
    const tz = PREFIX + "Attr " + Date.now().toString(36);
    await typeInto(S, title, tz);
    const pressed = async (lab) => S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(lab)}); return b ? (b.getAttribute('aria-pressed') || 'no-aria') : 'missing'; })()`);
    const p0 = await pressed("Autographed");
    await click(S, T.btnExpr("^Autographed$")); await click(S, T.btnExpr("^Framed$")); await sleep(500);
    const p1 = { a: await pressed("Autographed"), f: await pressed("Framed"), c: await pressed("CoA Included") };
    await rec(S, p0 === "false" && p1.a === "true" && p1.f === "true" && p1.c === "false", { page: PG, control: "Attribute pills (Autographed, Framed)", expected: "Pressing turns a pill on (pressed state shown); the others stay off", actual: `Autographed before=${p0}; after: ${JSON.stringify(p1)}`, impact: "usability", repro: "Press Autographed and Framed" });
    // Auto notes
    await typeInto(S, fieldInput("Grade"), "Grade-Z"); await typeInto(S, fieldInput("Number / Issue"), "No-Z");
    await click(S, T.btnExpr("^Auto$")); await sleep(800);
    const notes = await S.evaluate("document.querySelector('textarea').value");
    await rec(S, /Grade-Z|No-Z|Autographed|Framed/.test(notes), { page: PG, control: "Auto (notes summary)", expected: "Writes a notes summary from the fields filled so far", actual: "notes now: '" + notes.slice(0, 120) + "'", impact: "usability", repro: "Fill a few fields, press Auto beside Notes" });
    // More details
    const before = await S.evaluate("document.querySelectorAll('input').length");
    await click(S, T.btnExpr("^More details")); await sleep(600);
    const after = await S.evaluate("document.querySelectorAll('input').length");
    await rec(S, after !== before, { page: PG, control: "More details (4)", expected: "Expands or collapses the extra fields", actual: `inputs on the page before=${before}, after=${after}`, impact: "usability", repro: "Press More details" });
    await click(S, saveBtn); const r = await poll(async () => { const x = await rowsByTitle(P, tz); return x.length ? x : null; }, 40000, 2000) || []; created.push(...r);
    const wide = r[0] ? (await admin.from("vault_items").select("item_attributes,notes,grade,number,item_type").eq("id", r[0].id).single()).data : null;
    const attrs = wide && wide.item_attributes;
    await rec(S, !!wide && JSON.stringify(attrs || []).includes("Autographed") && JSON.stringify(attrs || []).includes("Framed") && !JSON.stringify(attrs || []).includes("CoA"), { page: PG, control: "Attribute pills saved with the item", expected: "item_attributes holds Autographed and Framed only", actual: JSON.stringify(wide), impact: "data loss", repro: "Press two pills, Save, read the row" });
    // /capture Retake + Expand image
    await S.visit("/capture"); await S.waitFor("document.getElementById('capture-item-name')", 60000); await sleep(800);
    await T.uploadFiles(S, "input[type=file]", mkPng(tmp("z1-" + Date.now() + ".png"), 640, 480, [30, 90, 200]), 0); await sleep(2200);
    const exp = await S.evaluate("(() => { const a = document.querySelector('a[aria-label=\"Expand image\"]'); return a ? { href: a.getAttribute('href').slice(0, 20), target: a.getAttribute('target') } : null; })()");
    await rec(S, !!exp && /^blob:/.test(exp.href) && exp.target === "_blank", { page: "/capture | owner", control: "Expand image (over the photo)", expected: "A link that opens the photo bigger in its own tab", actual: JSON.stringify(exp), impact: "usability", repro: "Attach a photo, look at the expand icon" });
    await clickText(S, "^Retake$"); await sleep(1500);
    const afterRetake = await S.evaluate("({ tiles: document.querySelectorAll('[aria-label=\"Remove photo\"]').length, cam: !![...document.querySelectorAll('button')].find((b) => /Capture photo/.test(b.getAttribute('aria-label') || b.textContent)) })");
    await rec(S, afterRetake.tiles === 0 || afterRetake.cam, { page: "/capture | owner", control: "Retake", expected: "Clears the photo or opens the camera to take another", actual: JSON.stringify(afterRetake), impact: "usability", repro: "Attach a photo, press Retake" });
  } catch (e) { console.error("SUITE ERROR", e); try { await S.jshot("add-vaultadd5-error"); } catch {} }
  finally { await S.close(); await T.removeByPrefix(PREFIX); await removeItems(created.filter(Boolean)); for (const p of mine()) console.log("leftover AUD ADD Z rows", (await rowsByTitle(p, PREFIX)).length); }
})();
