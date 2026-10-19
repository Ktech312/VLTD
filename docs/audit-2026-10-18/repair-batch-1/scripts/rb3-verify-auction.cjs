// Repair batch 1 / RC-03 verification on PRODUCTION with a SYNTHETIC item: auction cancellation is an explicit choice about visibility.
//   AUDIT_MANIFEST=<manifest> node rb3-verify-auction.cjs <label>
const { session, sleep, admin, man, fs, AUD, R } = require("./audit-lib.cjs");
const LABEL = process.argv[2] || "run";
const r = R("RB3");
const OUT = AUD + "/repair-batch-1/evidence"; fs.mkdirSync(OUT, { recursive: true });
const log = { label: LABEL, fixtureOnly: true, steps: [] };
(async () => {
  const m = man();
  const owned = (await admin.from("vault_items").select("id").eq("profile_id", m.personalId).eq("status", "COLLECTION").order("id")).data.map((x) => x.id);
  const ID = owned[3];
  await admin.from("profiles").update({ is_public: true }).eq("id", m.personalId);
  const db = async () => (await admin.from("vault_items").select("status,is_public,auction_status,auction_ends_at,auction_bid_count").eq("id", ID).single()).data;
  const reset = async (isPublic) => admin.from("vault_items").update({ status: "COLLECTION", is_public: isPublic, auction_status: null, auction_ends_at: null, auction_starting_bid: null, auction_bid_count: 0 }).eq("id", ID);
  const mclick = async (S, js) => { const pos = await S.evaluate(`(() => { const e = (${js})(); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`); if (!pos) return false; await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: pos.x, y: pos.y, button: "none" }); await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x: pos.x, y: pos.y, button: "left", clickCount: 1, buttons: 1 }); await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: pos.x, y: pos.y, button: "left", clickCount: 1, buttons: 0 }); return true; };
  const btn = (re, scope = "button") => `() => [...document.querySelectorAll(${JSON.stringify(scope)})].find((b) => ${re}.test((b.textContent || '').trim()) && b.getBoundingClientRect().width > 1)`;
  const dialogs = (S) => S.evaluate(`[...document.querySelectorAll('[role=dialog]')].map((d) => ({ label: d.getAttribute('aria-label'), text: d.innerText.replace(/\\s+/g, ' ').slice(0, 300), buttons: [...d.querySelectorAll('button')].map((b) => (b.textContent || '').trim()).filter(Boolean) }))`);
  const visitorSees = async () => { const V = await session("visitor", { width: 1440, height: 900 }); await V.visit(`/share/${ID}`); await sleep(3500); const t = await V.evaluate("document.body.innerText.replace(/\\s+/g,' ')"); await V.close(); return !/could not be found|404/i.test(t) && t.length > 150; };
  const open = async (S) => { await S.visit(`/vault/item/${ID}`); await S.waitFor("document.body.innerText.includes('Auction')", 40000, "auction button").catch(() => {}); await sleep(2500); };
  const pass = (ok, x) => { log.steps.push({ ok, control: x.control, actual: x.actual }); return r.check(ok, { impact: "privacy/data loss", ...x }); };

  // ---- 1. starting discloses that it makes the item public
  await reset(false);
  let S = await session("owner", { width: 1440, height: 900 });
  await open(S);
  await mclick(S, btn("/Start Auction/")); await sleep(1200);
  let d = await dialogs(S);
  const notice = await S.evaluate("(document.querySelector('[data-testid=auction-start-public-notice]') || {}).innerText || ''");
  pass(/makes the item public/i.test(notice), { page: "/vault/item/<id> | owner, Personal, private item", control: "Start Auction (sheet)", expected: "the sheet says plainly that starting makes the item public", actual: `notice: "${notice}"; dialog: ${d.map((x) => x.label).join(",")}`, evidence: await S.jshot("rb3-" + LABEL + "-1-start"), repro: "Open a private item, press Start Auction." });
  await mclick(S, btn("/^Start Auction$/", "[role=dialog] button")); await sleep(5000);
  let row = await db();
  pass(row.auction_status === "ACTIVE" && row.is_public === true, { page: "/vault/item/<id>", control: "Start Auction -> Start", expected: "auction ACTIVE and the item public (as disclosed)", actual: JSON.stringify(row), repro: "Press Start in the sheet." });

  // ---- 2. the cancel question: wording and closing without a choice
  await open(S);
  await mclick(S, btn("/Manage Auction/")); await sleep(1200);
  await mclick(S, btn("/^Cancel Auction$/", "[role=dialog] button")); await sleep(1000);
  d = await dialogs(S);
  const cd = d.find((x) => x.label === "Cancel auction");
  pass(!!cd && /Choose whether this item should remain publicly visible\./.test(cd.text) && JSON.stringify(cd.buttons) === JSON.stringify(["Cancel auction and make private", "Cancel auction and keep public", "Go back"]), { page: "/vault/item/<id> | active auction", control: "Cancel Auction -> question", expected: 'title "Cancel auction", text "Choose whether this item should remain publicly visible.", buttons exactly: Cancel auction and make private / Cancel auction and keep public / Go back', actual: cd ? `${cd.text.slice(0, 120)} | buttons: ${cd.buttons.join(" / ")}` : "no dialog named Cancel auction: " + JSON.stringify(d.map((x) => x.label)), evidence: await S.jshot("rb3-" + LABEL + "-2-question"), repro: "Manage Auction -> Cancel Auction." });
  const claims = cd ? /previously private|was private|was public before|originally/i.test(cd.text) : true;
  pass(!claims, { page: "/vault/item/<id> | cancel question", control: "wording", expected: "the dialog does not claim what the item was before", actual: cd ? cd.text.slice(0, 160) : "n/a", repro: "Read the dialog." });
  // Go back
  await mclick(S, btn("/^Go back$/", "[role=dialog] button")); await sleep(1500);
  row = await db(); d = await dialogs(S);
  pass(row.auction_status === "ACTIVE" && row.is_public === true && !d.some((x) => x.label === "Cancel auction"), { page: "/vault/item/<id>", control: "Go back", expected: "the question closes and nothing changes", actual: `${JSON.stringify(row)}; question still open: ${d.some((x) => x.label === "Cancel auction")}`, repro: "Press Go back." });
  // Escape
  await mclick(S, btn("/^Cancel Auction$/", "[role=dialog] button")); await sleep(800);
  await S.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await sleep(1500);
  row = await db(); d = await dialogs(S);
  pass(row.auction_status === "ACTIVE" && row.is_public === true && !d.some((x) => x.label === "Cancel auction"), { page: "/vault/item/<id>", control: "Escape on the question", expected: "closes the question only; auction still active and public", actual: `${JSON.stringify(row)}; dialogs open: ${d.map((x) => x.label).join(",") || "none"}`, repro: "Open the question, press Escape." });
  // backdrop click (dialog open again if Escape closed the sheet too)
  d = await dialogs(S);
  if (!d.length) { await open(S); await mclick(S, btn("/Manage Auction/")); await sleep(1000); }
  await mclick(S, btn("/^Cancel Auction$/", "[role=dialog] button")); await sleep(800);
  await mclick(S, `() => document.querySelector('button[aria-label="Go back"]')`); await sleep(1200);
  row = await db();
  pass(row.auction_status === "ACTIVE" && row.is_public === true, { page: "/vault/item/<id>", control: "click outside the question", expected: "closes the question; nothing changes", actual: JSON.stringify(row), repro: "Open the question, click the dimmed area." });

  // ---- 3. make private: cancellation and visibility together, persisted, reload
  await open(S); d = await dialogs(S); if (!d.length) await mclick(S, btn("/Manage Auction/")); await sleep(1000);
  await mclick(S, btn("/^Cancel Auction$/", "[role=dialog] button")); await sleep(800);
  await mclick(S, btn("/^Cancel auction and make private$/", "[role=dialog] button")); await sleep(6000);
  row = await db();
  pass(row.auction_status === "CANCELLED" && row.is_public === false && row.status === "COLLECTION", { page: "/vault/item/<id>", control: "Cancel auction and make private", expected: "CANCELLED, private, back in the collection, saved together", actual: JSON.stringify(row), evidence: await S.jshot("rb3-" + LABEL + "-3-private"), repro: "Choose the first action." });
  await open(S); const reloaded = await S.evaluate("document.body.innerText.replace(/\\s+/g,' ')"); row = await db();
  pass(row.auction_status === "CANCELLED" && row.is_public === false && !(await visitorSees()), { page: "/vault/item/<id> | after reload, and a signed-out visitor", control: "persistence after reload", expected: "still cancelled and private; the public share link shows nothing", actual: `${JSON.stringify(row)}; page shows 'Start Auction' again: ${/Start Auction/.test(reloaded)}`, repro: "Reload; open /share/<id> signed out." });

  // ---- 4. keep public
  await reset(false);
  await open(S); await mclick(S, btn("/Start Auction/")); await sleep(900); await mclick(S, btn("/^Start Auction$/", "[role=dialog] button")); await sleep(5000);
  await open(S); await mclick(S, btn("/Manage Auction/")); await sleep(900);
  await mclick(S, btn("/^Cancel Auction$/", "[role=dialog] button")); await sleep(800);
  await mclick(S, btn("/^Cancel auction and keep public$/", "[role=dialog] button")); await sleep(6000);
  row = await db(); const vis = await visitorSees();
  pass(row.auction_status === "CANCELLED" && row.is_public === true && vis, { page: "/vault/item/<id>", control: "Cancel auction and keep public", expected: "CANCELLED and still public (visitor can open the share page)", actual: `${JSON.stringify(row)}; visitor sees the item: ${vis}`, repro: "Choose the second action." });

  // ---- 5. interrupted save: both choices queued together, then delivered
  await reset(false);
  await open(S); await mclick(S, btn("/Start Auction/")); await sleep(900); await mclick(S, btn("/^Start Auction$/", "[role=dialog] button")); await sleep(5000);
  await open(S); await mclick(S, btn("/Manage Auction/")); await sleep(900);
  await S.send("Network.setBlockedURLs", { urls: ["*supabase.co/rest/v1/vault_items*"] });
  await mclick(S, btn("/^Cancel Auction$/", "[role=dialog] button")); await sleep(800);
  await mclick(S, btn("/^Cancel auction and make private$/", "[role=dialog] button")); let toast = "", noticeShown = false;
  for (let i = 0; i < 18 && !noticeShown; i++) { await sleep(3000); toast = await S.evaluate("document.body.innerText.replace(/\\s+/g,' ')"); noticeShown = /will sync when back online|saved on this device/i.test(toast); }
  row = await db();
  pass(row.auction_status === "ACTIVE" && row.is_public === true && noticeShown, { page: "/vault/item/<id> | connection refused", control: "Cancel auction and make private while the save is refused", expected: "the person is told it is saved on this device and will sync; the cloud still shows the old state (nothing half-applied)", actual: `cloud: ${JSON.stringify(row)}; notice shown: ${noticeShown}`, evidence: await S.jshot("rb3-" + LABEL + "-5-interrupted"), repro: "Block the item save, cancel and make private." });
  await S.visit(`/vault/item/${ID}`); await sleep(5000);
  const localState = await S.evaluate("document.body.innerText.replace(/\\s+/g,' ')");
  pass(/Start Auction/.test(localState) && !/Manage Auction/.test(localState), { page: "/vault/item/<id> | reload while still refused", control: "local state after reload", expected: "this device shows the auction cancelled (the choice is kept locally)", actual: `shows Start Auction: ${/Start Auction/.test(localState)}; shows Manage Auction: ${/Manage Auction/.test(localState)}`, repro: "Reload while the save is still refused." });
  await S.send("Network.setBlockedURLs", { urls: [] });
  let delivered = null; for (let i = 0; i < 18; i++) { await sleep(5000); delivered = await db(); if (delivered.auction_status === "CANCELLED") break; if (i === 6) await S.visit(`/vault/item/${ID}`); }
  pass(delivered.auction_status === "CANCELLED" && delivered.is_public === false, { page: "/vault/item/<id> | connection restored", control: "queued cancellation delivered", expected: "cancellation AND private arrive together once the connection is back", actual: JSON.stringify(delivered), repro: "Unblock; wait (the page may need a reload to retry)." });
  await S.close();
  await reset(false);
  fs.writeFileSync(OUT + `/rb3-auction-${LABEL}.json`, JSON.stringify(log, null, 1));
  console.log("steps:", log.steps.map((x) => (x.ok ? "ok" : "FAIL")).join(" "));
  process.exit(0);
})().catch((e) => { console.error(e); try { fs.writeFileSync(OUT + `/rb3-auction-${LABEL}-crashed.json`, JSON.stringify(log, null, 1)); } catch {} process.exit(1); });
