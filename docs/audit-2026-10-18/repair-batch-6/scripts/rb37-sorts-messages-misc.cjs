// RC-25 (Gain sort, Halls) and RC-27 (Upcoming range/Want, expired invite, Messages names and limit, Kickstarter failed search). Production, isolated QA accounts; temporary rows are QA-owned and removed.
//   AUDIT_MANIFEST=<manifest> node rb37-sorts-messages-misc.cjs <label>
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const { sleep, session, admin } = A;
const m = A.man(); const P = m.personalId;
const LABEL = process.argv[2] || "run";
const r = A.R("RB37");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] }; let n = 0;
async function rec(S, ok, control, expected, actual, page) {
  let ev = ""; if (S) { try { await sleep(250); ev = path.join(A.AUD, await S.jshot(`rb37-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page, control, expected, actual, evidence: ev ? path.relative(A.AUD, ev).replace(/\\/g, "/") : "", impact: "RC-25 / RC-27", repro: "" });
}
const body = async (S) => (await S.text().catch(() => "")).replace(/\s+/g, " ").trim();
const setSelect = (S, sel, value) => S.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return false; const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
(async () => {
  const sessions = []; const cleanup = [];
  try {
    const open = async (kind, o) => { const S = await session(kind, o || { width: 1440, height: 900 }); sessions.push(S); return S; };

    // ---------- Gain sort: measured gains first, the rest after
    const rows = (await admin.from("vault_items").select("id,title,status,current_value,purchase_price,purchase_tax,purchase_shipping,purchase_fees").eq("profile_id", P)).data.filter((i) => i.status !== "SOLD" && i.status !== "WISHLIST");
    const cost = (i) => Number(i.purchase_price || 0) + Number(i.purchase_tax || 0) + Number(i.purchase_shipping || 0) + Number(i.purchase_fees || 0);
    const measured = rows.filter((i) => i.current_value !== null && cost(i) > 0).map((i) => ({ title: i.title, gain: Number(i.current_value) - cost(i) })).sort((a, b) => b.gain - a.gain);
    const O = await open("owner");
    await O.visit("/vault"); await O.waitFor("!!document.querySelector('select[aria-label=\"Sort the vault\"]')", 45000).catch(() => {}); await sleep(4000);
    const firstTitles = (k = 3) => O.evaluate(`[...document.querySelectorAll('a[href^="/vault/item/"]')].map((a) => (a.innerText || a.getAttribute('aria-label') || '').trim().split('\\n')[0]).filter(Boolean).slice(0, ${k})`);
    await setSelect(O, 'select[aria-label="Sort the vault"]', "gain_desc"); await sleep(1500);
    const d = await firstTitles();
    await rec(O, measured.length >= 1 && d[0] === measured[0].title, "Vault sort: Gain high to low", `the biggest measured gain first (${measured[0] && measured[0].title}, +$${measured[0] && measured[0].gain})`, `first three: ${JSON.stringify(d)}`, "/vault");
    await setSelect(O, 'select[aria-label="Sort the vault"]', "gain_asc"); await sleep(1500);
    const a = await firstTitles();
    const lowest = measured[measured.length - 1];
    await rec(O, a[0] === lowest.title, "Vault sort: Gain low to high", `the biggest measured loss first (${lowest.title}, $${lowest.gain})`, `first three: ${JSON.stringify(a)}`, "/vault");

    // ---------- Halls
    const t1 = { id: "rb37_hz_" + m.stamp, profile_id: P, title: "RB37 Hall Zebra", status: "COLLECTION", purchase_price: 50, purchase_tax: 5, purchase_shipping: 5, universe: "POP_CULTURE", created_at: Date.now() - 86400e3 };
    const t2 = { id: "rb37_hs_" + m.stamp, profile_id: P, title: "RB37 Hall Sold Zebra", status: "SOLD", purchase_price: 20, universe: "POP_CULTURE", created_at: Date.now() - 86400e3 };
    await admin.from("vault_items").delete().in("id", [t1.id, t2.id]);
    const ins = await admin.from("vault_items").insert([t1, t2]); if (ins.error) throw new Error("halls items: " + ins.error.message);
    cleanup.push(() => admin.from("vault_items").delete().in("id", [t1.id, t2.id]));
    await O.visit("/vault/halls"); await sleep(6000);
    await A.typeInto(O, 'input[placeholder^="Search by name"]', "RB37 Hall"); await A.press(O, "Enter"); await sleep(3500);
    const ht = await body(O);
    await rec(O, /RB37 Hall Zebra|1 of 1 selected/.test(ht) && /1 of 1 selected/.test(ht) && /\$60\b/.test(ht), "Halls: an unpriced item bought for $50 + $5 tax + $5 shipping, and a sold item with the same name", "only the owned item is offered; its value is the all-in $60 (not $50), and the sold one is not counted", `summary: ${(ht.match(/\d+ of \d+ selected[^A-Za-z]{0,20}\$?[\d.,KM]*/) || [""])[0]}; sold offered=${/Sold Zebra/.test(ht)}`, "/vault/halls");
    await O.close();

    // ---------- Upcoming: the date range asks again; a signed-out visitor is asked to sign in for Want
    const U = await open("owner");
    await U.visit("/upcoming"); await sleep(9000);
    const reqs = []; U.c.on((e) => { if (e.method === "Network.requestWillBeSent" && /comic-upcoming/.test(e.params.request.url)) reqs.push(e.params.request.url); });
    await U.send("Network.enable").catch(() => {});
    await A.clickSel(U, '[aria-label="Date range"]'); await sleep(500);
    await A.clickText(U, "^Next 30 days$", "[role=option],[role=menuitem],button,li"); await sleep(6000);
    const refetch = reqs.filter((u) => /days=30/.test(u)).length;
    await rec(U, refetch >= 1, "Upcoming: change the date range to Next 30 days", "the list is fetched again for 30 days (the banner and the list agree)", `requests for days=30: ${refetch}`, "/upcoming");
    await U.close();
    const V = await open("visitor");
    await V.visit("/upcoming"); await sleep(10000);
    const want = await A.clickText(V, "^Want$", "button");
    await sleep(2500);
    const vt = await body(V);
    await rec(V, !want || /Sign in to save comics/i.test(vt), "Upcoming: Want while signed out", "asks the visitor to sign in (it said it could not save to an account)", `clicked=${!!want}; message=${(vt.match(/Sign in to save comics[^.]*\./i) || ["(none)"])[0]}; old wording shown=${/Couldn.t save to your account/i.test(vt)}`, "/upcoming");
    await V.close();

    // ---------- Expired invite
    const g = (await admin.from("galleries").select("id").eq("profile_id", P).limit(1)).data[0];
    const tok = `qarb37${m.stamp}${crypto.randomBytes(3).toString("hex")}`;
    const gi = await admin.from("gallery_invites").insert([{ token: tok, gallery_id: g.id, label: "RB37 expired", disabled: false, expires_at: new Date(Date.now() - 86400e3).toISOString(), permissions: { images: true, descriptionPage: true, financialHistory: false } }]);
    if (gi.error) throw new Error("invite insert: " + gi.error.message);
    cleanup.push(() => admin.from("gallery_invites").delete().eq("token", tok));
    const tokBad = `qarb37none${m.stamp}`;
    const I = await open("viewer"); // invite pages need a signed-in account
    await I.visit(`/museum/invite/${tok}`); await sleep(8000);
    let it = await body(I);
    const expiredShown = /Link expired/i.test(it);
    await I.visit(`/museum/invite/${tokBad}`); await sleep(8000);
    const it2 = await body(I);
    await rec(I, expiredShown && /Link not available/i.test(it2), "Invite links: an expired link and a link that never existed", "the expired one says 'Link expired'; the unknown one says 'Link not available'", `expired link says expired=${expiredShown}; unknown link says not available=${/Link not available/i.test(it2)}`, "/museum/invite/[token]");
    await I.close();

    // ---------- Messages: partner name and the 4,000-character limit
    const viewerUser = (await admin.auth.admin.listUsers({ perPage: 200 })).data.users.find((u) => u.email === m.k.email);
    const ownerProf = (await admin.from("profiles").select("id").eq("id", P)).data[0];
    const pa = P < m.k.profileId ? P : m.k.profileId, pb = P < m.k.profileId ? m.k.profileId : P;
    await admin.from("public_profiles").upsert([{ profile_id: m.k.profileId, display_name: "RB37 Partner", bio: "synthetic QA" }]);
    const prevViewer = (await admin.from("profiles").select("is_public,onboarding_completed").eq("id", m.k.profileId).maybeSingle()).data;
    await admin.from("profiles").update({ is_public: true, onboarding_completed: true }).eq("id", m.k.profileId);
    cleanup.push(async () => { await admin.from("profiles").update({ is_public: prevViewer.is_public, onboarding_completed: prevViewer.onboarding_completed }).eq("id", m.k.profileId); await admin.from("public_profiles").delete().eq("profile_id", m.k.profileId); });
    const conv = await admin.from("conversations").insert({ profile_a_id: pa, profile_b_id: pb, last_message_at: new Date().toISOString() }).select("id").single();
    if (conv.error) throw new Error("conversation insert: " + conv.error.message);
    cleanup.push(() => admin.from("conversations").delete().eq("id", conv.data.id));
    await admin.from("direct_messages").insert({ conversation_id: conv.data.id, sender_profile_id: m.k.profileId, body: "hello from QA", created_at: new Date().toISOString() });
    cleanup.push(() => admin.from("direct_messages").delete().eq("conversation_id", conv.data.id));
    const M = await open("owner");
    await M.visit("/messages"); await sleep(9000);
    const mt = await body(M);
    await rec(M, /RB37 Partner/.test(mt), "Messages: the conversation list names the other collector", "'RB37 Partner' (their public name), not 'Collector'", `shown=${/RB37 Partner/.test(mt)}; plain 'Collector' only=${/ Collector No messages| C Collector /.test(mt)}`, "/messages");
    await A.clickExpr(M, "[...document.querySelectorAll('button,[role=button],li,a')].filter((e) => /RB37 Partner/.test(e.innerText)).sort((a, b) => a.innerText.length - b.innerText.length)[0]"); await sleep(3000);
    const long = "x".repeat(4100);
    await M.evaluate(`(() => { const i = document.querySelector('input[placeholder="Write a message…"]'); if (!i) return false; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, ${JSON.stringify(long)}); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    await sleep(800);
    const lim = await M.evaluate("({ max: (document.querySelector('input[placeholder=\"Write a message…\"]') || {}).maxLength, len: ((document.querySelector('input[placeholder=\"Write a message…\"]') || {}).value || '').length, note: (document.querySelector('[data-testid=message-limit]') || {}).innerText || null })");
    await rec(M, lim.max === 4000 && lim.len <= 4000 && /4,000/.test(lim.note || ""), "Messages: a 4,100-character message", "the box stops at 4,000 and a visible note says why (it was cut silently)", JSON.stringify(lim), "/messages");
    await M.close();

    // ---------- Kickstarter: a failed search leaves no old result line
    const K = await open("visitor");
    await K.visit("/kickstarter"); await sleep(5000);
    await A.typeInto(K, 'input[placeholder^="Search —"]', "comics"); await A.press(K, "Enter"); await sleep(9000);
    const before = await body(K);
    const hadLine = /\d[\d,]*\s+(campaigns?|projects?|results?)/i.test(before);
    await K.send("Network.setBlockedURLs", { urls: ["*/api/kickstarter-comics*"] });
    await A.typeInto(K, 'input[placeholder^="Search —"]', "horror"); await A.press(K, "Enter"); await sleep(6000);
    const after = await body(K);
    await rec(K, /Couldn.t reach the campaign search|Failed to load campaigns/i.test(after) && !/\d[\d,]*\s+(campaigns?|projects?|results?)/i.test(after), "Kickstarter: a search that fails after a successful one", "an error message and no leftover result line from the earlier search", `earlier search showed a result line=${hadLine}; after failure: ${after.slice(after.search(/Couldn.t reach|Failed to load/i), after.search(/Couldn.t reach|Failed to load/i) + 90)}; leftover line=${/\d[\d,]*\s+(campaigns?|projects?|results?)/i.test(after)}`, "/kickstarter");
    await K.close();
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    for (const fn of cleanup.reverse()) { try { await fn(); } catch {} }
    for (const S of sessions) { try { await S.close(); } catch {} }
    fs.writeFileSync(path.join(EV, `rb37-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    for (const c of out.cases.filter((c) => !c.ok)) console.log("NOT OK:", c.control, "|", String(c.actual).slice(0, 420));
    process.exit(0);
  }
})();
