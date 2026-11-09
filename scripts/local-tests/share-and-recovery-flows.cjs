const L = require("./lib.cjs"); const { sleep, NL, check, sim } = L; const O = "33333333-3333-4333-8333-333333333333";
const norm = (t) => t.split(NL).join(" ").replace(/\s+/g, " ");
(async () => {
  // ---- public share (signed out)
  let s = await L.open({ width: 1280, height: 1400, signedIn: false });
  try {
    await L.seed({ vault_items: [
      { id: "sh_public", profile_id: O, title: "Shareable Guitar", universe: "MUSIC", category: "Collectors Choice", status: "COLLECTION", is_public: true, created_at: 1790000000000, current_value: 321, image_front_url: "/collectibles/guitar.png", purchase_price: 777, notes: "PRIVATE-NOTE-X", description: "Public description text", storage_location: "SECRET-SHELF", serial_number: "SERIAL-SECRET" },
      { id: "sh_private", profile_id: O, title: "Hidden Vinyl", universe: "MUSIC", category: "Collectors Choice", status: "COLLECTION", is_public: false, created_at: 1790000000001, current_value: 5 }],
      public_profiles: [{ profile_id: O, display_name: "Other Collector", username: "other_collector" }] });
    await s.go("/share/sh_public", 9000); let t = norm(await s.text());
    check("public item share shows title and description", /Shareable Guitar/.test(t) && /Public description text/.test(t), t.slice(0, 300));
    for (const secret of ["PRIVATE-NOTE-X", "SECRET-SHELF", "SERIAL-SECRET", "777"]) check("share page hides private value " + secret, !t.includes(secret), 0);
    const sel = String((await sim("/__sim/selects")).vault_items || (await sim("/__sim/selects")).public_vault_items || ""); console.log("share select:", sel.slice(0, 120));
    check("share request did not ask for private columns", sel === "" || !/purchase_price|notes|storage_location|serial_number/.test(sel), sel);
    await s.go("/share/sh_private", 8000); t = norm(await s.text()); check("private item share is not available", !/Hidden Vinyl/.test(t) && /(404|not found|not available|private)/i.test(t), t.slice(0, 200));
    await s.go("/share/does_not_exist", 7000); t = norm(await s.text()); check("unknown share id says not found, no crash", /(404|not found|not available)/i.test(t) && !/Application error/.test(t), t.slice(0, 160));
  } finally { await s.close(); }
  // ---- forgot / reset password (signed out)
  s = await L.open({ width: 1280, height: 1000, signedIn: false });
  try {
    await s.go("/forgot-password", 8000);
    const c0 = ((await sim("/__sim/counts")).counts["POST /auth/v1/recover"] || 0);
    await s.mclick("Send reset link", false); await sleep(1200); let t = norm(await s.text());
    check("empty email is not sent", ((await sim("/__sim/counts")).counts["POST /auth/v1/recover"] || 0) === c0, 0);
    console.log("empty submit text:", t.slice(t.indexOf("Reset your password"), t.indexOf("Reset your password") + 220));
    await s.setField("input[type=email]", "someone@example.com"); await s.mclick("Send reset link", false); await sleep(2200); t = norm(await s.text());
    const c1 = ((await sim("/__sim/counts")).counts["POST /auth/v1/recover"] || 0); console.log("recover calls:", c0, "->", c1, "| text:", t.slice(t.indexOf("Reset your password"), t.indexOf("Reset your password") + 260));
    check("valid email asks the (simulated) auth service once", c1 === c0 + 1, [c0, c1]);
    check("person is told to check their email", /check your (email|inbox)|sent|on its way/i.test(t), t.slice(0, 300));
    await s.go("/reset-password", 8000); await s.setField("input[type=password]", "abcdefgh1"); 
    const pw = await s.evaluate(`document.querySelectorAll("input[type=password]").length`); console.log("password fields:", pw);
    await s.mclick("Update password", false); await sleep(1500); t = norm(await s.text()); console.log("reset without link / mismatch:", t.slice(t.indexOf("Choose a new password"), t.indexOf("Choose a new password") + 260));
  } finally { await s.close(); }
  // ---- signed in: styles + invite
  s = await L.open({ width: 1280, height: 1400 });
  try {
    await s.go("/styles", 8000); await s.dismiss(); let t = norm(await s.text());
    const names = await s.evaluate(`JSON.stringify([...document.querySelectorAll("button")].filter((b) => b.getBoundingClientRect().width > 0).map((b) => b.innerText.trim().split(String.fromCharCode(10))[0].slice(0, 22)).filter(Boolean).slice(0, 24))`); console.log("styles buttons:", names);
    await s.go("/account/invite", 8000); t = norm(await s.text()); console.log("invite:", t.slice(t.indexOf("Invite friends"), t.indexOf("Invite friends") + 520));
    console.log("invite link:", await s.evaluate(`(document.querySelector("input[readonly]") || {}).value || ""`));
  } finally { await s.close(); }
  console.log(JSON.stringify(L.results())); process.exit(0); })();
