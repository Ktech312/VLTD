// Invite link to a "Registered Users" exhibition. The invite page used to show it to a signed-out visitor; now it asks them to sign in (and the database repair withholds the content from a signed-out
// caller, so there would otherwise be nothing to show). Checked with the repair OFF (today's database) and ON (simulated; the real SQL is tested in scripts/test-registered-users-link-sql.cjs).
// Public and Guest View invites must be unchanged, and a signed-in visitor still sees the exhibition.
const L = require("./lib.cjs"); const { sleep, NL, check, sim, seed } = L;
const O = "33333333-3333-4333-8333-333333333333"; const now = new Date().toISOString();
const lay = (title, extra) => ({ itemIds: ["i1"], publicItemSnapshots: [{ id: "i1", title, imageFrontUrl: "/collectibles/guitar.png" }], ...(extra || {}) });
const gal = (id, tok, vis, title, extra) => ({ id, profile_id: O, title: "Exhibit " + tok, visibility: vis, state: "ACTIVE", public_token: "pub_" + tok, layout: lay(title, extra), exhibition_layout: lay(title, extra), created_at: now, updated_at: now });
const G = { reg: "00000000-0000-4000-8000-0000000000a1", pub: "00000000-0000-4000-8000-0000000000a2", gv: "00000000-0000-4000-8000-0000000000a3" };
const norm = (t) => t.split(NL).map((x) => x.trim()).filter(Boolean).join(" | ");
async function view(signedIn, token) { const s = await L.open({ width: 1280, height: 1000, signedIn }); try { await s.go("/museum/invite/" + token, 10000); await s.dismiss(); const t = norm(await s.text()); const loginHref = await s.evaluate(`(() => { const a = [...document.querySelectorAll("a")].find((x) => /login/.test(x.getAttribute("href") || "")); return a ? a.getAttribute("href") : ""; })()`); return { t, loginHref }; } finally { await s.close(); } }
(async () => {
  await sim("/__sim/reset");
  await seed({ galleries: [gal(G.reg, "reg", "INVITE", "SNAP SECRET TITLE", { guestViewMode: "guest" }), gal(G.pub, "pub", "PUBLIC", "SNAP PUBLIC TITLE"), gal(G.gv, "gv", "INVITE", "SNAP GV TITLE")],
    gallery_invites: [{ token: "inv_reg", gallery_id: G.reg, disabled: false, permissions: {}, created_at: now }, { token: "inv_pub", gallery_id: G.pub, disabled: false, permissions: {}, created_at: now }, { token: "inv_gv", gallery_id: G.gv, disabled: false, permissions: {}, created_at: now }] });
  for (const gate of [0, 1]) {
    await sim("/__sim/fail?registeredGate=" + gate); const label = gate ? "repair ON" : "repair OFF (today's database)";
    const so = await view(false, "inv_reg");
    check("signed-out invite to a Registered Users exhibition (" + label + "): asks to sign in, shows no item title", /registered users/i.test(so.t) && /sign in|create free account/i.test(so.t) && !/SNAP SECRET TITLE/.test(so.t), so.t.slice(0, 200));
    check("signed-out (" + label + "): the sign-in link returns to this invite afterwards", /\/login\?next=%2Fmuseum%2Finvite%2Finv_reg/.test(so.loginHref), so.loginHref);
    const pub = await view(false, "inv_pub"); const gv = await view(false, "inv_gv");
    check("signed-out Public and Guest View invites are unchanged (" + label + "): no sign-in prompt, content shown", !/registered users/i.test(pub.t + gv.t) && /SNAP PUBLIC TITLE/.test(pub.t) && /SNAP GV TITLE/.test(gv.t), [pub.t.slice(0, 120), gv.t.slice(0, 120)]);
    const si = await view(true, "inv_reg");
    check("signed-in visitor opening the Registered Users invite (" + label + ") sees the exhibition, not the sign-in prompt", !/Owner only allows registered users/i.test(si.t) && /SNAP SECRET TITLE|Exhibit reg/.test(si.t), si.t.slice(0, 200));
  }
  console.log(JSON.stringify(L.results())); process.exit(0);
})();
