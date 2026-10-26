// RB79: the five recording fixes on PRODUCTION, as a non-owner QA collector (no AI access) and, for the "owner still sees AI" half, the same pages with the browser's own idea of who is
// signed in switched to the owner's address (screens only: the server still sees the QA account, and nothing here presses an AI button, so no AI request is ever sent).
// Checks: (1) no AI button or allowance for an account without AI, on every screen that has one; the owner's screens still show them; (2) tax and costs to the cent;
// (3) the phone camera button is fully above the bottom bar; (4) no timing text in the crop editor; (5) the recorded Brand is shown under Brand, the stored value untouched.
//   AUDIT_MANIFEST=<manifest> node rb79-ui-fixes-prod.cjs <label>
const path = require("path");
const fs = require("fs");
const LIB = path.join(__dirname, "..", "..", "..", "walkthrough", "tutorial-1-redo", "_build", "lib.cjs");
const { start, btn, T, ASSETS } = require(LIB);
const sleep = T.sleep;
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-add-lib.cjs"));
const { admin } = A;
const r = A.R("RB79");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { cases: [] };
const ck = (ok, control, expected, actual) => { out.cases.push({ ok: !!ok, control }); r.check(!!ok, { page: "various", control, expected, actual: String(actual).slice(0, 400), evidence: "", impact: "ai spend / display", repro: "" }); };
const AI_TEXT = /Identify( again)? with AI|Scan certificate with AI|Scan with AI to fill details|AI scans? left|\d+\s+left\b/i;
const OWNER = "eck1679@gmail.com";
const clickLastBtn = (t) => `[...document.querySelectorAll('button')].filter((b) => b.innerText.trim() === ${JSON.stringify(t)} && b.getBoundingClientRect().width > 0).pop()`;
const secBtn = (n) => `[...document.querySelectorAll('button')].find((x) => x.innerText.split('\\n')[0].trim() === ${JSON.stringify(String(n))} && x.getBoundingClientRect().width > 200)`;

// make the page believe the signed-in user is the owner (browser side only)
async function asOwnerInBrowser(R) {
  await R.js(`(() => { try { const k = 'vltd-auth'; const s = JSON.parse(localStorage.getItem(k)); s.user.email = ${JSON.stringify(OWNER)}; s.user.email_confirmed_at = s.user.email_confirmed_at || '2026-01-01T00:00:00Z'; localStorage.setItem(k, JSON.stringify(s)); return true; } catch (e) { return String(e); } })()`);
}

(async () => {
  const m = JSON.parse(fs.readFileSync(process.env.AUDIT_MANIFEST, "utf8")); const P = m.personalId;
  const label = process.argv[2] || "run";
  let R;
  try {
    // ───── desktop, an account WITHOUT AI
    R = await start({ scene: "rb79-desktop" });
    await R.goto("/capture");
    const up = await T.chooseViaButton(R.S, T.btnExpr("Upload"), [`${ASSETS}/toy-figure.jpg`]); await sleep(3500);
    let t = await R.text();
    ck(up.dialog && /Cover/i.test(t), "setup: a photo was added on the Add Item form", "photo added", JSON.stringify(up));
    ck(!AI_TEXT.test(t), "Add Item with a photo: no Identify with AI button and no 'AI scans left' for an account without AI", "none of those words", (t.match(AI_TEXT) || ["none"])[0]);
    ck(!/then tap Identify/i.test(t), "Add Item: the empty-photo hint no longer promises Identify", "no 'then tap Identify'", (t.match(/then tap Identify/i) || ["none"])[0]);
    // costs to the cent, brand
    await R.type(`document.querySelector("input[placeholder='Item name']")`, "RB79 Retro Robots figure");
    await R.type(`document.querySelector("input[placeholder^='e.g. Nintendo']")`, "Retro Robots");
    await R.clickExpr(secBtn(2), 900);
    const sel = `[...document.querySelectorAll('select')].filter((s) => s.getBoundingClientRect().width > 0)`;
    const setSel = (i, text) => R.js(`(() => { const s = (${sel})[${i}]; const o = [...s.options].find((x) => x.text.trim() === ${JSON.stringify(text)}); if (!o) return 'no option'; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, o.value); s.dispatchEvent(new Event('change', { bubbles: true })); return 'ok'; })()`);
    const ui = await R.js(`(() => { const ss = ${sel}; return ss.findIndex((s) => [...s.options].some((o) => /Pop Culture/.test(o.text))); })()`);
    await setSel(ui, "Pop Culture"); await sleep(700); await setSel(ui + 1, "Toys & Figures"); await sleep(700);
    await R.clickExpr(secBtn(4), 900);
    await R.type(`document.querySelector("#capture-purchase-price")`, "38.00");
    await R.clickExpr(btn("Save to Vault"), 6000);
    await R.click(".*RB79 Retro Robots.*", 4500);
    await R.clickExpr(`document.querySelector('button[aria-label="Edit purchase"]')`, 1200);
    await R.type(`document.querySelector('input[aria-label="Tax"]')`, "3.50");
    await R.type(`document.querySelector('input[aria-label="Shipping"]')`, "4.25");
    await R.type(`document.querySelector('input[aria-label="Fees"]')`, "0");
    const check = `(() => { const p = document.querySelector('input[aria-label="Purchase price"]'); let e = p; for (let i = 0; i < 8 && e; i++) { e = e.parentElement; const b = e && [...e.querySelectorAll('button')].find((x) => x.getBoundingClientRect().width > 0 && x.getBoundingClientRect().width < 70 && x.getBoundingClientRect().top < p.getBoundingClientRect().top); if (b) return b; } return null; })()`;
    await R.clickExpr(check, 2500);
    t = await R.text();
    const row = (await admin.from("vault_items").select("*").eq("profile_id", P).ilike("title", "RB79%")).data[0];
    ck(row && row.purchase_tax === 3.5 && row.purchase_shipping === 4.25 && row.purchase_fees === 0 && row.purchase_price === 38 && row.brand === "Retro Robots", "the stored amounts and brand are exactly what was typed (3.5, 4.25, 0, 38, Retro Robots)", "exact", JSON.stringify([row && row.purchase_price, row.purchase_tax, row.purchase_shipping, row.purchase_fees, row.brand]));
    ck(/Tax\s*\$3\.50/.test(t.replace(/\n/g, " ")) && /Shipping\s*\$4\.25/.test(t.replace(/\n/g, " ")) && /Purchase price\s*\$38\.00/.test(t.replace(/\n/g, " ")) && /Fees\s*\$0\.00/.test(t.replace(/\n/g, " ")), "the Purchase panel reads $38.00, $3.50, $4.25 and $0.00 (3.50 stays 3.50)", "to the cent", (t.replace(/\n/g, " ").match(/Purchase price[^A-Za-z]*Tax[^A-Za-z]*Shipping[^A-Za-z]*Fees[^A-Za-z]*/) || ["no match"])[0]);
    ck(/Total cost\s*\$45\.75/.test(t.replace(/\n/g, " ")), "Total cost reads $45.75, not a rounded $46", "$45.75", (t.replace(/\n/g, " ").match(/Total cost[^A-Za-z]*/) || ["no match"])[0]);
    const flat = t.replace(/\n/g, " ");
    ck(/Brand\s*Retro Robots/.test(flat), "the recorded Brand is shown on the Brand row", "Brand Retro Robots", (flat.match(/Brand[^A-Za-z]{0,6}[A-Za-z ]{0,20}/) || ["none"])[0]);
    ck(!/Publisher \/ maker\s*Retro Robots/.test(flat), "it is no longer listed as Publisher / maker", "no Publisher / maker Retro Robots", (flat.match(/Publisher \/ maker[^A-Za-z]{0,6}[A-Za-z ]{0,20}/) || ["none"])[0]);
    ck(!AI_TEXT.test(t), "the item page has no 'Scan certificate with AI' for an account without AI", "none", (t.match(AI_TEXT) || ["none"])[0]);
    // crop editor has no timing text (desktop camera)
    await R.goto("/capture");
    await R.click("Take photo", 3500); await R.waitFeed("toy-figure"); await R.click("Capture photo", 3500);
    t = await R.text();
    ck(/Retake/.test(t) && !/blur-check|draw \d+ms|encode \d+ms|\d+x\d+px ·/.test(t), "the crop editor shows no timing or debug text", "no 'blur-check', 'draw ..ms'", (t.match(/blur-check|draw \d+ms|\d+x\d+px ·/) || ["none"])[0]);
    await R.close(); R = null;

    // ───── Quick Add verify sheet, Bulk Upload (no AI account)
    R = await start({ scene: "rb79-quick" });
    await R.goto("/vault/quick");
    for (const n of ["sports-card", "tcg-card"]) { await R.waitFeed(n); await R.click("Take picture", 700); }
    await R.click("Finished.*", 1500); await R.click("Add 2 items to Vault", 1800);
    t = await R.text();
    ck(/Verify your Drop/.test(t) && !AI_TEXT.test(t), "Quick Add's Verify sheet: no Identify with AI (per item or for all) and no allowance for an account without AI", "none", (t.match(AI_TEXT) || ["none"])[0]);
    ck(/Save 2 items to Vault/.test(t), "and the sheet still saves the items (nothing else was removed)", "Save 2 items to Vault", /Save 2 items to Vault/.test(t));
    await R.goto("/vault/bulk");
    t = await R.text();
    ck(!AI_TEXT.test(t), "Bulk Upload: no AI allowance for an account without AI", "none", (t.match(AI_TEXT) || ["none"])[0]);
    await R.close(); R = null;

    // ───── phone: camera button above the bottom bar
    R = await start({ scene: "rb79-phone", phone: true });
    await R.goto("/capture");
    await R.click("Take photo", 3500); await R.waitFeed("toy-figure");
    const geo = await R.js(`(() => { const b = document.querySelector('button[aria-label="Capture photo"]').getBoundingClientRect(); const navs = [...document.querySelectorAll('nav,[role=navigation]')].map((n) => n.getBoundingClientRect()).filter((x) => x.top > 400 && x.height > 30); return { bottom: Math.round(b.bottom), top: Math.round(b.top), tabTop: navs.length ? Math.round(Math.min(...navs.map((x) => x.top))) : null, vh: innerHeight }; })()`);
    ck(geo.tabTop !== null && geo.bottom <= geo.tabTop, "phone: the whole round camera button is above the bottom bar", "button bottom <= bar top", JSON.stringify(geo));
    // a real tap at the CENTRE of the button captures (it used to land on the bar)
    await R.clickExpr(`document.querySelector('button[aria-label="Capture photo"]')`, 3500);
    t = await R.text();
    ck(/Retake/.test(t) && !/Exhibitions\s*Lounge/.test("") , "phone: tapping the centre of the button takes the photo", "crop editor shown", /Retake/.test(t));
    ck(!/blur-check|draw \d+ms/.test(t), "phone: no timing text in the crop editor", "none", (t.match(/blur-check|draw \d+ms/) || ["none"])[0]);
    await R.close(); R = null;

    // ───── the owner's screens still show AI (browser side only; nothing is pressed)
    R = await start({ scene: "rb79-owner" });
    await asOwnerInBrowser(R);
    await R.goto("/capture");
    await T.chooseViaButton(R.S, T.btnExpr("Upload"), [`${ASSETS}/tcg-card.jpg`]); await sleep(3500);
    t = await R.text();
    ck(/Identify with AI/.test(t), "owner's browser identity: Add Item shows Identify with AI", "button present", /Identify with AI/.test(t));
    ck(/AI scans? left this cycle/.test(t), "owner's browser identity: Add Item shows the AI allowance", "allowance present", /AI scans? left this cycle/.test(t));
    await R.goto("/vault/quick");
    for (const n of ["sports-card"]) { await R.waitFeed(n); await R.click("Take picture", 700); }
    await R.click("Finished.*", 1500); await R.click("Add 1 item to Vault", 1800).catch(() => R.click("Add 1 items to Vault", 1800));
    t = await R.text();
    ck(/Identify with AI/.test(t) && /\d+\s*left/.test(t), "owner's browser identity: Quick Add's Verify sheet shows Identify with AI and the allowance", "present", /Identify with AI/.test(t));
    await R.close(); R = null;
  } catch (e) { out.error = String((e && e.stack) || e).slice(0, 600); console.error("RUNNER ERROR", e); }
  finally {
    try { if (R) await R.close(); } catch { /* done */ }
    try { await admin.from("vault_items").delete().eq("profile_id", P).like("title", "RB79%"); } catch { /* removed with the account anyway */ }
    fs.writeFileSync(path.join(EV, `rb79-${label}.json`), JSON.stringify(out, null, 1));
    console.log(out.cases.map((c) => (c.ok ? "PASS " : "FAIL ") + c.control).join("\n"), out.error ? "\nRUNNER ERROR " + out.error : "");
    process.exit(0);
  }
})();
