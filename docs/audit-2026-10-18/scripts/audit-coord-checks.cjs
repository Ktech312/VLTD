// Coordinator checks that follow up page-level observations from the crawl (area CRW).
const { session, controls, R, sleep, AUD, fs, BASE } = require("./audit-lib.cjs");
const r = R("CRW");
const txt = (S) => S.evaluate("document.body.innerText.replace(/\\s+/g,' ')");
(async () => {
  const V = await session("visitor");
  // a. admin pages as a signed-out visitor
  for (const p of ["/admin/themes", "/admin/scan-limits", "/ai/drafts", "/ai/review"]) {
    await V.visit(p); await sleep(8000);
    const t = await txt(V); const cs = await controls(V);
    const interactive = cs.filter((c) => c.visible && ["input", "select", "toggle", "upload"].includes(c.kind) && c.region !== "form" && !/Search vault/.test(c.label));
    const btns = cs.filter((c) => c.visible && c.kind === "button" && !/Help|Account menu|Search|Install|Dismiss|Report a bug|Sign in|Log in/i.test(c.label));
    const shot = await V.jshot("crw-visitor" + p.replace(/\W+/g, "_"));
    const reqs = V.reqs.filter((q) => /supabase\.co\/rest/.test(q.url)).map((q) => q.method + " " + q.url.split("?")[0].split("/").pop());
    r.check(interactive.length === 0 && btns.length === 0, { page: p + " | signed-out visitor", control: "page content and controls", expected: "a signed-out visitor is sent to login or shown only an access-denied message, with no admin/working-area controls", actual: `Page stays at ${await V.path()}; text starts: "${t.replace(/^Home Vault.*?Level \d /, "").slice(0, 120)}"; fields/toggles: ${interactive.map((c) => c.label || c.type).join(", ") || "none"}; buttons: ${btns.map((c) => c.label).slice(0, 8).join(", ") || "none"}; data requests: ${[...new Set(reqs)].slice(0, 5).join(", ") || "none"}`, evidence: shot, impact: interactive.length || btns.length ? "privacy/data loss" : "none", repro: `Open ${p} while signed out.` });
  }
  // c. unknown club id never leaves 'Loading…'
  for (const kind of ["visitor", "owner"]) {
    const S = kind === "visitor" ? V : await session("owner");
    await S.visit("/clubs/00000000-0000-0000-0000-000000000000"); await sleep(12000);
    const t = await txt(S); const shot = await S.jshot("crw-club-unknown-" + kind);
    r.check(!/Loading…/.test(t.replace(/^Home Vault.*?Level \d /, "")) , { page: "/clubs/<unknown id> | " + kind, control: "club page for an id that does not exist", expected: "a clear 'club not found' state, not an endless 'Loading…'", actual: "After 12 s the page text is: " + t.replace(/^Home Vault.*?Level \d /, "").slice(0, 140), evidence: shot, impact: "misleading result", repro: "Open /clubs/00000000-0000-0000-0000-000000000000 and wait." });
    if (kind === "owner") await S.close();
  }
  // d. email confirmation page with no code
  await V.visit("/auth/confirmed"); await sleep(15000);
  const t4 = await txt(V); const s4 = await V.jshot("crw-auth-confirmed-nocode");
  r.check(!/Confirming your email/.test(t4), { page: "/auth/confirmed | signed out, no confirmation code", control: "'Confirming your email…' page", expected: "ends in a clear state (error with a way back, or redirect) rather than staying on 'Confirming…'", actual: "After 15 s: " + t4.replace(/^Home Vault.*?Level \d /, "").slice(0, 160) + " | path " + await V.path(), evidence: s4, impact: "misleading result", repro: "Open /auth/confirmed with no query string and wait 15 s." });
  await V.close();
  // e. unrelated viewer opens the insurance sheet for someone else's item id
  const W = await session("viewer");
  const m = require("./audit-lib.cjs").man();
  await W.visit(`/insurance/item?id=${m.audit.itemIds[0]}`); await sleep(4000);
  const t5 = await txt(W); const s5 = await W.jshot("crw-viewer-insurance-other-item");
  r.check(!/QA Album|Purchase|\$\d/.test(t5.replace(/^Home Vault.*?Level \d /, "")), { page: "/insurance/item?id=<another user's item> | unrelated viewer", control: "insurance item sheet", expected: "no data of another user's item is shown", actual: "Shows: " + t5.replace(/^Home Vault.*?Level \d /, "").slice(0, 150), evidence: s5, impact: "privacy/data loss", repro: "Sign in as a different user and open /insurance/item?id=<owner's item id>." });
  r.pass({ page: "/insurance/item?id=<another user's item> | unrelated viewer", control: "wording of the missing-item state", expected: "improvement: say 'item not found' rather than 'No items to insure yet'", actual: "The sheet for an item that is not the viewer's shows the empty-inventory message ('No items to insure yet') instead of 'item not found'. No data is exposed.", evidence: s5, impact: "improvement", repro: "as above" });
  await W.close();
  console.log("done"); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
