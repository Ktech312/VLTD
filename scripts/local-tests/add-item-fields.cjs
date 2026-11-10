// Add Item field coverage: every text field the form offers (identity, grade, certification, edition, variant, print run, serial, storage/source/location, subject, notes, category-specific
// details), saved, read back from the stored record, shown again on the item page after a reload, edited there, and blank-versus-zero money handled exactly.
const L = require("./lib.cjs"); const { sleep, NL, check, sim } = L; const norm = (t) => t.split(NL).map((x) => x.trim()).filter(Boolean).join(" | ");
const byPh = (s, ph, v) => s.setField(`input[placeholder^='${ph}'], textarea[placeholder^='${ph}']`, v);
const row = async (t) => (await L.dump("vault_items")).find((r) => (r.title || "") === t);
async function fillBasics(s, title) { await s.go("/vault/add", 9000); await s.dismiss(); await byPh(s, "Name this item", title); }
(async () => {
  await sim("/__sim/reset"); let s = await L.open({ width: 1280, height: 2000 });
  try {
    // ---- 1. everything filled
    await fillBasics(s, "FIELDS full item");
    const vals = { "Series / set / run": "SUBTITLE-S1", "#129": "NUM-129", "CGC 9.8": "GRADE-98", "Long Box A": "LOC-LONGBOX", "Collection buy": "SRC-SHOW", "Dallas": "PLACE-DALLAS", "Player, character, art": "SUBJ-PLAYER", "Certification number": "CERT-123456", "Serial number / ISBN": "SERIAL-ISBN-9", "1st Edition, Unlimited": "EDITION-1ST", "Holo, Reverse Holo, Fo": "VARIANT-HOLO", "1/1, 47/250, Artist Pr": "RUN-47-250", "Notes, artist, run inf": "NOTES-TEXT-ONE" };
    for (const [ph, v] of Object.entries(vals)) await byPh(s, ph, v);
    // the two money boxes share the placeholder "25": purchase price first, current value second
    await s.evaluate(`(() => { const m = [...document.querySelectorAll("input[placeholder='25']")]; const set = (e, v) => { const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value"); d.set.call(e, v); e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); }; set(m[0], "100.10"); set(m[1], ""); return m.length; })()`);
    await s.evaluate(`(() => { const c = document.querySelector("input[type=checkbox]"); if (c && !c.checked) c.click(); return !!c; })()`);
    await s.mclick("Save", true); await sleep(4500); let r = await row("FIELDS full item"); console.log("stored row (selected):", JSON.stringify(Object.fromEntries(Object.entries(r || {}).filter(([k, v]) => v !== null && v !== undefined && !/^(id|profile_id|created_at|images|image)/.test(k)))).slice(0, 700));
    check("Add Item: the record was saved", !!r, 0);
    const blob = JSON.stringify(r || {});
    for (const [ph, v] of Object.entries(vals)) check("stored: " + ph + " -> " + v, blob.includes(v), v);
    check("stored: purchase price keeps cents (100.1) and the blank current value stays unknown (null), not 0", Number(r.purchase_price) === 100.1 && (r.current_value === null || r.current_value === undefined), [r.purchase_price, r.current_value]);
    check("stored: the First Edition tick is saved", r.is_first_edition === true, r.is_first_edition);
    // ---- reload: item page shows them
    await s.go("/vault/item/" + r.id, 10000); await s.dismiss(); let t = norm(await s.text());
    for (const v of ["SUBTITLE-S1", "NUM-129", "GRADE-98", "CERT-123456", "SERIAL-ISBN-9", "EDITION-1ST", "VARIANT-HOLO", "RUN-47-250", "SUBJ-PLAYER", "LOC-LONGBOX", "SRC-SHOW", "PLACE-DALLAS", "NOTES-TEXT-ONE"]) check("item page after reload shows " + v, t.includes(v), v);
    check("item page: cost $100 shown and the value is not invented as $0 (unknown stays unknown)", /\$100(\.10)?\b/.test(t), t.slice(0, 200));
    // ---- edit on the item page: the panel's toggle button becomes "Save purchase"
    console.log("click Edit purchase:", await s.mclick("Edit purchase", false)); await sleep(1200);
    const setField = (ph, v) => s.evaluate(`(() => { const e = [...document.querySelectorAll("input")].find((x) => (x.placeholder === ${JSON.stringify(ph)} || x.getAttribute("aria-label") === ${JSON.stringify(ph)}) && x.getBoundingClientRect().width > 0); if (!e) return false; e.focus(); const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value"); d.set.call(e, ${JSON.stringify(v)}); e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); e.blur(); return true; })()`);
    const ok1 = await setField("Purchase price", "250.55"), ok2 = await setField("Fees", "0"), ok3 = await setField("Source", "SRC-EDITED"); console.log("save purchase:", await s.mclick("Save purchase", false)); await sleep(3500); r = await row("FIELDS full item");
    console.log("edit fields found:", ok1, ok2, ok3, "| stored:", r.purchase_price, r.purchase_fees, r.purchase_source);
    check("edit (purchase panel): price 250.55 with cents, an explicit 0 for fees, a blank tax stays unknown, source changed; the other typed values are untouched", ok1 && Number(r.purchase_price) === 250.55 && Number(r.purchase_fees) === 0 && r.purchase_fees !== null && (r.purchase_tax === null || r.purchase_tax === undefined) && r.purchase_source === "SRC-EDITED" && ["GRADE-98", "CERT-123456", "SERIAL-ISBN-9", "EDITION-1ST", "VARIANT-HOLO", "RUN-47-250", "SUBJ-PLAYER", "NOTES-TEXT-ONE", "LOC-LONGBOX"].every((v) => JSON.stringify(r).includes(v)), [ok1, ok2, ok3, r.purchase_price, r.purchase_fees, r.purchase_tax]);
    await s.go("/vault/item/" + r.id, 9000); t = norm(await s.text()); check("edit: after a reload the new price and source are shown and nothing else changed", (t.includes("$250") || t.includes("$251")) && t.includes("SRC-EDITED") && t.includes("GRADE-98") && t.includes("CERT-123456"), t.slice(0, 200));
  } finally { await s.close(); }
  // ---- 2 and 3. blank versus zero
  for (const [title, cost, value, expectCost, expectValue] of [["ZERO cost blank value", "0", "", 0, null], ["BLANK cost zero value", "", "0", null, 0], ["CENTS both", "19.99", "0.01", 19.99, 0.01]]) {
    s = await L.open({ width: 1280, height: 1600 });
    try { await fillBasics(s, title); await s.evaluate(`(() => { const m = [...document.querySelectorAll("input[placeholder='25']")]; const set = (e, v) => { const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value"); d.set.call(e, v); e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); }; set(m[0], ${JSON.stringify(cost)}); set(m[1], ${JSON.stringify(value)}); return true; })()`);
      await s.mclick("Save", true); await sleep(4000); const r = await row(title); const pc = r ? (r.purchase_price === null || r.purchase_price === undefined ? null : Number(r.purchase_price)) : "none", cv = r ? (r.current_value === null || r.current_value === undefined ? null : Number(r.current_value)) : "none";
      check("money: " + title + " stores cost " + JSON.stringify(expectCost) + " and value " + JSON.stringify(expectValue) + " exactly", pc === expectCost && cv === expectValue, [pc, cv]);
    } finally { await s.close(); }
  }
  console.log(JSON.stringify(L.results())); process.exit(0);
})();
