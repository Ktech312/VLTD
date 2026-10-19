// ADD audit, suite 4: Quick Add (/vault/quick) - no camera, fake camera (Chrome's synthetic camera) capture -> review -> verify -> save,
// cancel paths, AI identify (INTERCEPTED), numbers, double click, refused connection, refresh, Business profile, phone width (browser-emulated).
const fs = require("fs");
const T = require("./audit-s-add-lib.cjs");
const { alertText, session, sleep, man, admin, rec, click, clickText, typeInto, pickSelect, text, rowsByTitle, allCount, poll, removeItems, mine, mouseAt, rectOf, block } = T;
const PG = "/vault/quick | owner, Personal, 26 items";
const PREFIX = "AUD ADD Q ";
const created = [];
const FAKE = "--use-fake-device-for-media-stream --use-fake-ui-for-media-stream";
const shutter = "document.querySelector('button[aria-label=\"Take picture\"]')";
const count = (S) => S.evaluate("(() => { const m = document.body.innerText.match(/Finished \\((\\d+)\\)/); return m ? Number(m[1]) : 0; })()");
async function open(S, path = "/vault/quick") { await S.visit(path); await sleep(3000); await S.waitFor("document.querySelector('button[aria-label=\"Take picture\"]')", 60000, "scanner"); await sleep(1200); }
async function snap(S, n) { for (let i = 0; i < n; i++) { await click(S, shutter); await sleep(1300); } }
async function toVerify(S) { await click(S, "document.querySelector('button[aria-label=\"Review captured items\"]')"); await sleep(1500); await click(S, "[...document.querySelectorAll('button')].find((b) => /^Add \\d+ item/.test(b.textContent.trim()))"); await sleep(2500); }
const names = (i) => `document.querySelectorAll('input[placeholder="Item name"]')[${i}]`;
const cost = (i) => `document.querySelectorAll('input[aria-label="Cost"]')[${i}]`;
const value = (i) => `[...document.querySelectorAll('input')].filter((e) => /^Value/.test(e.getAttribute('aria-label') || e.placeholder || ''))[${i}]`;
const saveBtnQ = "[...document.querySelectorAll('button')].find((b) => /^Save \\d+ item/.test(b.textContent.trim()))";
async function dbRows(prefix, profile = man().personalId, n = 1, ms = 40000) { return (await poll(async () => { const r = await rowsByTitle(profile, prefix); return r.length >= n ? r : null; }, ms, 2000)) || (await rowsByTitle(profile, prefix)); }

(async () => {
  const m = man(); const P = m.personalId, B = m.businessId;
  await T.removeByPrefix(PREFIX);
  const before = await allCount(P);
  // ================= no camera =================
  process.env.CHROME_EXTRA = "";
  const N = await session("owner", { width: 1440, height: 900 });
  try {
    await N.visit("/vault/quick"); await sleep(4500);
    const t = await text(N); const al = await alertText(N);
    await rec(N, /camera|blocked|unavailable|allow|permission/i.test(t + al), { page: PG + " (no camera in this browser)", control: "Quick Add scanner screen when no camera can start", expected: "Tells the person the camera is unavailable and what to do (as /capture does)", actual: "screen text: '" + t.replace(/Home Vault.*$/, "").slice(0, 90) + "'; any camera message: " + /camera|blocked|unavailable|permission/i.test(t + al), impact: "usability", repro: "Open /vault/quick in a browser without a usable camera" });
    const sh = await rectOf(N, shutter);
    await click(N, shutter); await sleep(1500);
    await rec(N, (await count(N)) === 0, { page: PG + " (no camera)", control: "Take picture (shutter, no camera)", expected: "No phantom capture; and the person is told why nothing happened", actual: `captured=${await count(N)}; shutter disabled=${sh && sh.disabled}; message shown=${/camera|unavailable|blocked/i.test(await text(N))}`, impact: "usability", repro: "Press the shutter with no camera" });
    await click(N, "document.querySelector('button[aria-label=\"Scan a barcode or QR code\"]')"); await sleep(2500);
    const scanTxt = await text(N);
    await rec(N, /cancel scan|scanning|no camera|unavailable|not supported|couldn.t|no code/i.test(scanTxt) || (await N.evaluate("!!document.querySelector('button[aria-label=\"Cancel scan\"]')")), { page: PG + " (no camera)", control: "Scan a barcode or QR code (no camera)", expected: "Shows scanning state or a message that scanning is unavailable", actual: "button label now: " + (await N.evaluate("(document.querySelector('button[aria-label*=\"scan\" i]') || {}).getAttribute && document.querySelector('button[aria-label*=\"scan\" i]').getAttribute('aria-label')")) + "; text: '" + scanTxt.slice(0, 80).replace(/\n/g, " ") + "'", impact: "usability", repro: "Press the barcode button with no camera" });
    await click(N, "document.querySelector('button[aria-label=\"Close scanner\"]')"); await sleep(3500);
    await rec(N, (await N.path()) === "/vault" && (await allCount(P)) === before, { page: PG + " (no camera)", control: "Close scanner (X)", expected: "Returns to the Vault; nothing created", actual: `path=${await N.path()}; items ${before}->${await allCount(P)}`, impact: "blocked workflow", repro: "Open Quick Add, press X" });
    await N.visit("/vault/quick"); await sleep(3000); await clickText(N, "^Finished"); await sleep(3000);
    await rec(N, (await N.path()) === "/vault", { page: PG + " (no camera)", control: "Finished (nothing captured)", expected: "Returns to the Vault", actual: "path=" + (await N.path()), impact: "usability", repro: "Open Quick Add, press Finished with nothing captured" });
  } finally { await N.close(); }

  // ================= fake camera =================
  process.env.CHROME_EXTRA = FAKE;
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    await open(S);
    await snap(S, 3);
    await rec(S, (await count(S)) === 3, { page: PG, control: "Take picture x3 (real clicks)", expected: "Counter and the Finished button show 3 captures", actual: "Finished count = " + (await count(S)), impact: "blocked workflow", repro: "Press the shutter three times" });
    await click(S, "document.querySelector('button[aria-label=\"Review captured items\"]')"); await sleep(1800);
    const rv = await text(S);
    await rec(S, /Review your Drop/.test(rv) && /3 items ready/.test(rv), { page: PG, control: "Review captured items", expected: "Review list shows 3 items", actual: (rv.match(/Review your Drop[^]{0,60}/) || ["no review sheet"])[0].replace(/\n/g, " "), impact: "blocked workflow", repro: "Capture 3, press the review button" });
    await click(S, "document.querySelectorAll('button')[0] && [...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Remove')[2]"); await sleep(1000);
    const rv2 = await text(S);
    await rec(S, /2 items ready/.test(rv2) && /Add 2 items to Vault/.test(rv2), { page: PG, control: "Remove (third captured item)", expected: "Two items remain; the Add button says 2", actual: (rv2.match(/\d items ready[^.]{0,30}/) || [""])[0] + " | " + (rv2.match(/Add \d items? to Vault/) || ["no add button"])[0], impact: "usability", repro: "Capture 3, review, press Remove on the third" });
    // pick Music for item 1 through its Universe select
    const univ = await pickSelect(S, "document.querySelectorAll('select')[0]", "Music"); await sleep(500);
    await click(S, "[...document.querySelectorAll('button')].find((b) => /^Add \\d+ item/.test(b.textContent.trim()))"); await sleep(2500);
    const vt = await text(S);
    await rec(S, /Verify your Drop/.test(vt), { page: PG, control: "Add 2 items to Vault -> Verify your Drop", expected: "Verify sheet with 2 items: name, Cost, Value and an explicit 'Identify with AI'", actual: (vt.match(/Verify your Drop[^]{0,120}/) || ["no verify sheet"])[0].replace(/\n/g, " ") + " | universe pick: " + univ, impact: "blocked workflow", repro: "Review then press Add" });
    await S.jshot("add-quick-verify");
    // negative cost refused
    await typeInto(S, names(0), PREFIX + "Zero"); await typeInto(S, cost(0), "-5"); await typeInto(S, names(1), PREFIX + "Blank"); await sleep(600);
    const neg = { alert: await alertText(S), dis: (await rectOf(S, saveBtnQ)) && (await rectOf(S, saveBtnQ)).disabled };
    await rec(S, /can't be negative/.test(neg.alert) && neg.dis === true, { page: PG, control: "Cost = -5 on the Verify sheet", expected: "Plain message and Save held", actual: JSON.stringify(neg), impact: "misleading result", repro: "Type -5 in Cost" });
    await typeInto(S, cost(0), "0"); await typeInto(S, value(0), "10"); await typeInto(S, cost(1), "");
    // AI identify, intercepted
    const logBefore = (await admin.from("ai_usage_log").select("id", { count: "exact", head: true }).eq("profile_id", P)).count;
    const iBefore = S.intercepted.length;
    await clickText(S, "^Identify \\d+ with AI"); await sleep(12000);
    const aiTxt = await text(S); const aiAl = await alertText(S);
    const aiCalls = S.intercepted.slice(iBefore).filter((x) => /api\/ai/.test(x.url)).length;
    await rec(S, /couldn.t|could not|failed|try again|by hand|unavailable|not identified|unable/i.test(aiTxt + aiAl), { page: PG, control: "Identify 2 with AI (INTERCEPTED, not a successful AI result)", expected: "After the AI call is refused the sheet says identification failed and the items can be filled by hand", actual: `AI requests refused by the audit: ${aiCalls}; message after: '${(aiAl || (aiTxt.match(/(Couldn.t|Could not|failed)[^.]{0,80}/i) || ["(none)"])[0]).slice(0, 120)}'; sheet still says: '${(aiTxt.match(/Identifying[^.]{0,40}…?/) || ["-"])[0]}'`, impact: "misleading result", repro: "Verify sheet, press Identify 2 with AI while AI is refused" });
    await rec(S, (await S.evaluate(`(${names(0)}).value`)) === PREFIX + "Zero" && (await allCount(P)) === before && (await admin.from("ai_usage_log").select("id", { count: "exact", head: true }).eq("profile_id", P)).count === logBefore, { page: PG, control: "Identify refusal: typed data kept, no item created, no AI usage logged", expected: "Name still there, item count unchanged, usage log unchanged", actual: `name='${await S.evaluate(`(${names(0)}).value`)}'; items ${before}->${await allCount(P)}`, impact: "data loss", repro: "As above" });
    const stillBusy = await S.evaluate("[...document.querySelectorAll('button')].some((b) => /Identifying|Scanning/i.test(b.textContent) )");
    // save
    await T.click(S, saveBtnQ); await sleep(3000);
    const okSave = await S.waitFor("location.pathname === '/vault'", 40000).then(() => true).catch(() => false);
    const rows = await dbRows(PREFIX, P, 2); created.push(...rows);
    const z = rows.find((r) => r.title === PREFIX + "Zero"), b = rows.find((r) => r.title === PREFIX + "Blank");
    await rec(S, okSave && rows.length === 2, { page: PG, control: "Save 2 items to Vault", expected: "Returns to the Vault; exactly 2 rows exist", actual: `redirected=${okSave}; rows=${rows.length}`, impact: "data loss", repro: "Fill names, press Save 2 items" });
    await rec(S, !!z && z.purchase_price === 0 && Number(z.current_value) === 10 && !!b && b.purchase_price === null && b.current_value === null, { page: PG, control: "Cost 0 / Value 10, and blank Cost / blank Value", expected: "0 stays 0, 10 stays 10; blank stays unknown (null)", actual: JSON.stringify({ zero: z && [z.purchase_price, z.current_value], blank: b && [b.purchase_price, b.current_value] }), impact: "misleading result", repro: "Type 0 and 10 for one item, leave the other blank, Save" });
    await rec(S, !!z && /MUSIC/i.test(z.universe || ""), { page: PG, control: "Universe chosen on the Review list (Music)", expected: "The first item is saved in Music", actual: `universe=${z && z.universe}; category_label=${z && z.category_label}; other item universe=${b && b.universe}`, impact: "data loss", repro: "On the Review list set item 1 to Music, Save" });
    await rec(S, !!z && z.profile_id === P && z.added_via === "manual", { page: PG, control: "Saved Quick Add item (profile/source)", expected: "Personal profile, added_via manual (no AI used)", actual: JSON.stringify({ profile: (z && z.profile_id || "").slice(0, 8), via: z && z.added_via }), impact: "privacy/data loss", repro: "Read the row" });
    // image stored? give the sync time
    await sleep(15000);
    const z2 = (await rowsByTitle(P, PREFIX + "Zero"))[0] || {};
    const imgs = Array.isArray(z2.images_json) ? z2.images_json : [];
    await rec(S, imgs.length === 1 && !imgs[0].localOnly && !!z2.image_front_url, { page: PG, control: "Quick Add photo reaches the cloud", expected: "A captured photo is uploaded and linked to the saved item within a short time", actual: JSON.stringify({ images: imgs.length, localOnly: imgs[0] && imgs[0].localOnly, cover: (z2.image_front_url || "").replace(/^https:\/\/[^/]+/, "").slice(0, 60) }), impact: "data loss", repro: "Capture, save, wait 15 s, read images_json" });
    await S.visit("/vault"); await S.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 0", 60000).catch(() => {}); await sleep(1500);
    await rec(S, (await text(S)).includes(PREFIX + "Zero"), { page: "/vault | owner", control: "Vault after reload", expected: "Quick Add item listed", actual: (await text(S)).includes(PREFIX + "Zero") ? "listed" : "missing", impact: "data loss", repro: "Reload /vault" });
    const S2 = await session("owner", { width: 1440, height: 900 });
    try {
      await S2.visit("/vault/item/" + (z2.id || "x")); await sleep(2500); const b2 = await text(S2);
      const im2 = await S2.evaluate("[...document.querySelectorAll('img')].filter((i) => i.getBoundingClientRect().width > 60 && /supabase\\.co\\/storage/.test(i.src)).map((i) => ({ w: i.naturalWidth }))");
      await rec(S2, b2.includes(PREFIX + "Zero"), { page: `/vault/item/${(z2.id || "").slice(0, 8)} | clean second browser`, control: "Quick Add item in a clean second browser", expected: "Item shown", actual: b2.includes(PREFIX + "Zero") ? "shown" : "not shown", impact: "data loss", repro: "Open the item in a second browser" });
      await rec(S2, im2.length > 0 && im2.every((i) => i.w > 0), { page: `/vault/item/${(z2.id || "").slice(0, 8)} | clean second browser`, control: "Quick Add photo in a clean second browser", expected: "The captured photo shows", actual: JSON.stringify(im2), impact: "data loss", repro: "Open the item in a second browser" });
    } finally { await S2.close(); }

    // ---- cancel paths: close the Verify sheet / the review ----
    await open(S); await snap(S, 1);
    await toVerify(S); await typeInto(S, names(0), PREFIX + "Cancelled");
    const closeR = await clickText(S, "^Close$"); await sleep(1500);
    await click(S, "document.querySelector('button[aria-label=\"Close scanner\"]')"); await sleep(3500);
    await rec(S, (await rowsByTitle(P, PREFIX + "Cancelled")).length === 0, { page: PG, control: "Close (Verify sheet) then Close scanner", expected: "Nothing saved when cancelled", actual: `rows named Cancelled: ${(await rowsByTitle(P, PREFIX + "Cancelled")).length}; path=${await S.path()}`, impact: "data loss", repro: "Capture 1, Verify, type a name, close everything" });

    // ---- double click on Save ----
    await open(S); await snap(S, 1); await toVerify(S);
    const t8 = PREFIX + "Double " + Date.now().toString(36);
    await typeInto(S, names(0), t8);
    const r8 = await rectOf(S, saveBtnQ); await mouseAt(S, r8.x, r8.y, { clicks: 2 });
    await sleep(12000); const d8 = await rowsByTitle(P, t8); created.push(...d8);
    await rec(S, d8.length === 1, { page: PG, control: "Save 1 item (double click)", expected: "Exactly one row", actual: "rows: " + d8.length, impact: "data loss", repro: "Capture 1, Verify, name, double-click Save" });

    // ---- refresh mid-capture ----
    await open(S); await snap(S, 2);
    await S.send("Page.reload"); await sleep(4000); await S.settle().catch(() => {});
    const afterReload = await count(S); const rt = await text(S);
    await rec(S, afterReload === 2 || /restor|draft|unsaved/i.test(rt), { page: PG, control: "Refresh with 2 captured photos not yet added", expected: "Captures kept (or a warning before leaving / a clear note that they were lost)", actual: `captures after reload=${afterReload}; warning dialog seen=${S.dialogs.some((d) => d.type === "beforeunload")}; notice=${/restor|draft|unsaved|lost/i.test(rt)}`, impact: "data loss", repro: "Take 2 pictures, reload" });
    await open(S); await snap(S, 1);
    S.dialogs.length = 0; S.dialogMode = "dismiss";
    await S.evaluate("history.back(); true"); await sleep(2500);
    await rec(S, S.dialogs.length > 0 || (await S.path()) === "/vault/quick", { page: PG, control: "Browser Back with a captured photo", expected: "Warns or stays; a captured photo is not silently dropped", actual: `dialogs=${S.dialogs.length}; path=${await S.path()}`, impact: "data loss", repro: "Take a picture, press Back" });
    S.dialogMode = "accept";

    // ---- refused connection ----
    await open(S); await snap(S, 1); await toVerify(S);
    const t9 = PREFIX + "Refused " + Date.now().toString(36);
    await typeInto(S, names(0), t9);
    await block(S, true); await T.click(S, saveBtnQ);
    await S.waitFor("location.pathname === '/vault'", 30000).catch(() => {});
    await sleep(15000);
    const rr = await rowsByTitle(P, t9); const bodyR = await text(S);
    await S.jshot("add-quick-refused");
    await rec(S, rr.length === 0 && /not saved|couldn.t|failed|offline|retry|will sync|on this device|waiting/i.test(bodyR), { page: PG, control: "Save 1 item while the database refuses the save", expected: "The page says the item has not reached the account (kept on this device)", actual: `rows=${rr.length}; page says: '${(bodyR.match(/Saving to your account|[^\n]*(couldn.t|failed|offline|retry|on this device)[^\n]*/i) || ["(no failure notice)"])[0].slice(0, 110)}'`, impact: "data loss", repro: "Block vault_items, Quick Add, Save, wait 15 s" });
    await block(S, false);
    await S.visit("/vault/sync"); await sleep(2500); await clickText(S, "^Retry Sync$"); await sleep(10000);
    const rr2 = await dbRows(t9, P, 1, 30000); created.push(...rr2);
    await rec(S, rr2.length === 1, { page: "/vault/sync | owner", control: "Retry Sync after a refused Quick Add save", expected: "The queued item is saved once", actual: "rows=" + rr2.length, impact: "data loss", repro: "Unblock, open /vault/sync, Retry Sync" });
  } catch (e) { console.error("SUITE ERROR", e); try { await S.jshot("add-quick-error"); } catch {} }
  finally { try { await block(S, false); } catch {} await S.close(); }

  // ================= Business profile =================
  try {
    process.env.CHROME_EXTRA = FAKE;
    const SB = await session("business", { width: 1440, height: 900 });
    try {
      await open(SB); await snap(SB, 1); await toVerify(SB);
      const tb = PREFIX + "Biz " + Date.now().toString(36);
      await typeInto(SB, names(0), tb); await T.click(SB, saveBtnQ);
      const inB = await dbRows(tb, B, 1, 40000), inP = await rowsByTitle(P, tb); created.push(...inB, ...inP);
      await rec(SB, inB.length === 1 && inP.length === 0, { page: "/vault/quick | owner, Business profile active", control: "Save 1 item (Business)", expected: "Row lands in Business only", actual: `Business=${inB.length}, Personal=${inP.length}`, impact: "privacy/data loss", repro: "Activate Business, Quick Add, Save" });
    } finally { await SB.close(); }
  } catch (e) { console.error("BIZ ERROR", e); }

  // ================= phone width, browser-emulated =================
  try {
    process.env.CHROME_EXTRA = FAKE;
    const SP = await session("owner", { width: 390, height: 844, mobile: true });
    try {
      await SP.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
      await SP.visit("/vault/quick"); await sleep(4500);
      const hit = await SP.evaluate("(() => { const b = document.querySelector('button[aria-label=\"Take picture\"]'); if (!b) return null; const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { shutterCenter: [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)], topElement: e.tagName + ':' + (e.getAttribute('aria-label') || e.textContent.trim().slice(0, 30)) , bannerShown: !!document.querySelector('button[aria-label=\"Dismiss\"], button[aria-label=\"Install\"]') }; })()");
      await rec(SP, hit && /Take picture/.test(hit.topElement), { page: PG + " at 390x844 (browser-emulated phone, first visit)", control: "Take picture (shutter) under the 'Add to Home Screen' banner", expected: "The shutter is the element a finger would hit at its centre", actual: JSON.stringify(hit), impact: "blocked workflow", repro: "Open /vault/quick on a phone-width screen in a browser that shows the Add to Home Screen banner; tap the centre of the round shutter" });
      await SP.jshot("add-quick-phone-banner");
      // dismiss the banner like a person, then tap
      await click(SP, "document.querySelector('button[aria-label=\"Dismiss\"]')"); await sleep(800);
      const tap = async (x, y) => { await SP.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] }); await sleep(60); await SP.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); };
      const rs = await rectOf(SP, shutter); await tap(rs.x, rs.y); await sleep(1500);
      await rec(SP, (await count(SP)) === 1, { page: PG + " at 390x844 (browser-emulated touch)", control: "Take picture (tap, banner dismissed)", expected: "A tap captures one photo", actual: "captured = " + (await count(SP)), impact: "blocked workflow", repro: "Dismiss the banner, tap the shutter" });
    } finally { await SP.close(); }
  } catch (e) { console.error("PHONE ERROR", e); }

  await T.removeByPrefix(PREFIX); await removeItems(created.filter(Boolean));
  for (const p of mine()) console.log("leftover AUD ADD Q rows", (await rowsByTitle(p, PREFIX)).length);
})();
