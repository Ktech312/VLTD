// Batch 16, part 1 (the account table does not exist yet, so this is the device-only path that must keep working): insurance exclusions on the Insurance tab,
// packet and per-item pages, and the crop step's Cancel on the Add page. Production, isolated QA owner; exclusions are cleared afterwards.
//   AUDIT_MANIFEST=<manifest> node rb53-exclusions-crop.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { sleep, session, clickText, chooseViaButton, mkPng, tmp } = T;
const LABEL = process.argv[2] || "run";
const r = T.R("RB53");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] }; let n = 0;
async function rec(S, ok, control, expected, actual, page) {
  let ev = ""; if (S) { try { await sleep(250); ev = path.join(T.AUD, await S.jshot(`rb53-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page, control, expected, actual, evidence: ev ? path.relative(T.AUD, ev).replace(/\\/g, "/") : "", impact: "GIN-095 / ADD-168", repro: "" });
}
const body = async (S) => (await S.text().catch(() => "")).replace(/\s+/g, " ").trim();
(async () => {
  let S;
  try {
    S = await session("owner", { width: 1440, height: 900 });
    await S.visit("/insurance"); await S.waitFor("document.querySelectorAll('input[type=checkbox][aria-label^=\"Include \"]').length > 0", 60000).catch(() => {}); await sleep(3000);
    let t = await body(S);
    await rec(S, /Exclusions are saved on this device only/.test(t), "Insurance tab while the account cannot hold exclusions yet", "says plainly that exclusions are on this device only", `note shown=${/Exclusions are saved on this device only/.test(t)}`, "/insurance");
    const label = await S.evaluate("(() => { const i = document.querySelector('input[type=checkbox][aria-label^=\"Include \"]'); return i ? i.getAttribute('aria-label') : null; })()");
    await T.click(S, `[...document.querySelectorAll('input[type=checkbox]')].find((i) => i.getAttribute('aria-label') === ${JSON.stringify(label)})`).catch(() => {});
    await sleep(2500);
    t = await body(S);
    const stored = await S.evaluate("(() => { const k = Object.keys(localStorage).find((x) => x.startsWith('vltd_insurance_excluded_v2:')); return k ? localStorage.getItem(k) : null; })()");
    await rec(S, /Excluded from the insurance documents on this device/.test(t) && /excluded by you on this device/.test(t) && stored && JSON.parse(stored).length === 1, "Insurance tab: untick one item", "the row says excluded on this device, the not-counted line counts it, and the device keeps it", `row text=${/Excluded from the insurance documents on this device/.test(t)}; not-counted=${/1 excluded by you on this device/.test(t)}; stored=${stored}`, "/insurance");
    await S.visit("/insurance"); await S.waitFor("document.body.innerText.length > 500", 40000).catch(() => {}); await sleep(4000);
    t = await body(S);
    await rec(S, /Excluded from the insurance documents/.test(t), "Insurance tab after reloading", "the exclusion is still there", `still excluded=${/Excluded from the insurance documents/.test(t)}`, "/insurance");
    await S.visit("/insurance/packet"); await sleep(9000);
    t = await body(S);
    await rec(S, /1 excluded by you/.test(t) && /this device only/.test(t), "Policy packet: the exclusion and where it lives", "counts the exclusion and says it is on this device", `text=${(t.match(/Not counted[^.]*\.[^.]*\./) || ["(none)"])[0]}`, "/insurance/packet");
    await S.visit("/insurance"); await sleep(8000);
    await clickText(S, "^Include all$", "button"); await sleep(2500);
    const stored2 = await S.evaluate("(() => { const k = Object.keys(localStorage).find((x) => x.startsWith('vltd_insurance_excluded_v2:')); return k ? localStorage.getItem(k) : null; })()");
    t = await body(S);
    await rec(S, stored2 === "[]" && !/Excluded from the insurance documents/.test(t), "Insurance tab: Include all", "every item is included again", `stored=${stored2}`, "/insurance");

    // ---------------- the crop step's Cancel
    await S.visit("/vault/add"); await S.waitFor("document.getElementById('scan-title')", 60000); await sleep(1000);
    await chooseViaButton(S, T.btnExpr("Upload a photo from a file"), mkPng(tmp("rb53-" + Date.now() + ".png"), 640, 480, [90, 60, 160])); await sleep(3500);
    const open1 = (await body(S)).includes("Use This Picture");
    const blobsBefore = await S.evaluate("document.querySelectorAll('img[src^=\"blob:\"]').length");
    await T.click(S, "[...document.querySelectorAll('[role=dialog][aria-label=\"Edit photo crop\"] button')].find((b) => (b.innerText || '').trim() === 'Cancel')");
    await sleep(1800);
    t = await body(S);
    const blobsAfter = await S.evaluate("document.querySelectorAll('img[src^=\"blob:\"]').length");
    await rec(S, open1 && !t.includes("Use This Picture") && /Picture discarded/.test(t) && blobsAfter === 0, "Add Item: choose a photo, then Cancel in the crop step", "the photo that was just chosen is discarded (nothing attached)", `crop step was open=${open1}; closed=${!t.includes("Use This Picture")}; says discarded=${/Picture discarded/.test(t)}; picture elements ${blobsBefore} -> ${blobsAfter}`, "/vault/add");
    await chooseViaButton(S, T.btnExpr("Upload a photo from a file"), mkPng(tmp("rb53b-" + Date.now() + ".png"), 640, 480, [160, 90, 60])); await sleep(3500);
    await clickText(S, "^Use This Picture$", "button"); await sleep(2500);
    t = await body(S);
    const blobs3 = await S.evaluate("document.querySelectorAll('img[src^=\"blob:\"]').length");
    await rec(S, !t.includes("Use This Picture") && blobs3 > 0, "Add Item: choose a photo, then Use This Picture", "the photo stays attached", `crop step closed=${!t.includes("Use This Picture")}; picture elements=${blobs3}`, "/vault/add");
    await chooseViaButton(S, T.btnExpr("Upload a photo from a file"), mkPng(tmp("rb53c-" + Date.now() + ".png"), 640, 480, [20, 160, 90])); await sleep(3500);
    await S.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await sleep(1800);
    t = await body(S);
    await rec(S, !t.includes("Use This Picture") && /Picture discarded/.test(t), "Add Item: choose a second photo, then press Escape in the crop step", "Escape is a Cancel: the newly chosen photo is discarded, the first one stays", `closed=${!t.includes("Use This Picture")}; says discarded=${/Picture discarded/.test(t)}; picture elements=${await S.evaluate("document.querySelectorAll('img[src^=\"blob:\"]').length")}`, "/vault/add");
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    try { if (S) await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb53-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    for (const c of out.cases.filter((c) => !c.ok)) console.log("NOT OK:", c.control, "|", String(c.actual).slice(0, 460));
    process.exit(0);
  }
})();
