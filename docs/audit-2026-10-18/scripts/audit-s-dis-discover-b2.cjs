// DIS suite B2: failed galleries read, waiting for the page's own settled state.
const C = require("./audit-s-dis-common.cjs");
const { R, sleep, clean } = C; const r = R("DIS"); const PG = "/discover | visitor, 1440";
(async () => {
  const S = await C.session("visitor");
  await C.failRequests(S, ["*/rest/v1/galleries*"]);
  await S.visit("/discover");
  await S.waitFor("document.querySelectorAll('.animate-pulse').length === 0 && document.body.innerText.length > 120", 60000, "settled after failed read").catch(() => {});
  await sleep(2000);
  const txt = clean(await S.text()); const shot = await S.jshot("dis-galleries-read-failed");
  const claimsEmpty = /No public exhibitions yet|No exhibitions match/.test(txt);
  r.check(/Query error/.test(txt) && !claimsEmpty, { page: PG, control: "Failed `galleries` read (CDP Fetch -> 503, settled) - page state", expected: "tells the visitor the exhibitions could not be loaded and does NOT say there are none", actual: `error banner shown=${/Query error/.test(txt)}; says no exhibitions exist=${claimsEmpty}; text: ${txt.slice(txt.indexOf("Recommended"), txt.indexOf("Recommended") + 240)}`, evidence: shot, impact: "misleading result", repro: "Block the galleries request while loading /discover; wait for it to settle" });
  r.check(true, { page: PG, control: "Failed read: wording of the error", expected: "(observation) the visitor sees a raw technical message", actual: txt.match(/Query error: .{0,50}/)?.[0] || "none", evidence: shot, impact: "improvement", repro: "same" });
  await C.restoreNet(S);
  await S.visit("/discover"); await sleep(3000);
  r.check(!/Query error/.test(clean(await S.text())) && (await S.evaluate("document.querySelectorAll('[data-testid=featured-rooms] button').length")) >= 4, { page: PG, control: "Recovery after the failed read (reload)", expected: "rooms are back", actual: "cards " + (await S.evaluate("document.querySelectorAll('[data-testid=featured-rooms] button').length")), evidence: "n/a", impact: "blocked workflow", repro: "Reload" });
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
