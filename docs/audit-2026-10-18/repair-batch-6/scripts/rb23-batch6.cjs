// Batch 6 (priority 1) verified on PRODUCTION with an isolated QA fixture (owner A, unrelated account B, unfinished-onboarding user C, and a signed-out visitor).
//   RC-08 admin Themes / Studio gate, RC-33 legacy vault API, RC-04 sign-out failure, RC-07/RC-28 account + onboarding validation, /museum/new create guards.
// QA data only; the profile fields and exhibitions touched are restored/removed at the end.
//   AUDIT_MANIFEST=<manifest> node rb23-batch6.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const env = require(path.join(SD, "..", "qa", "env.cjs"));
const { sleep, admin, session } = A;
const m = A.man();
const P = m.personalId;
const LABEL = process.argv[2] || "run";
const r = A.R("RB23");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [], facts: {} };
let n = 0;
async function rec(ok, control, expected, actual, page, S) {
  let ev = ""; if (S && page.startsWith("/")) { try { await sleep(250); ev = path.join(A.AUD, await S.jshot(`rb23-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page, control, expected, actual, evidence: ev ? path.relative(A.AUD, ev).replace(/\\/g, "/") : "", impact: "batch 6", repro: "" });
}
const body = async (S) => (await S.text().catch(() => "")).replace(/\s+/g, " ").trim();
const errBox = (S) => S.evaluate("(() => { const e = [...document.querySelectorAll('main div')].find((x) => /red-500/.test(x.className) && x.innerText); return e ? e.innerText : null; })()");
const prof = async (id) => (await admin.from("profiles").select("username,display_name").eq("id", id).maybeSingle()).data;

(async () => {
  let orig = null; const sessions = [];
  const open = async (kind, opts) => { const S = await session(kind, opts || { width: 1440, height: 900 }); sessions.push(S); return S; };
  try {
    orig = await prof(P);
    const taken = (await prof(m.k.profileId)).username;
    out.facts.original = orig; out.facts.takenUsername = taken ? "(B's username)" : null;

    // ---------- RC-08: admin Themes and Studio
    for (const kind of ["visitor", "viewer"]) {
      const S = await open(kind);
      for (const p of ["/admin/themes", "/studio"]) {
        await S.visit(p); await S.waitFor("document.body.innerText.includes(\"don't have access\")", 25000, "gate").catch(() => {}); await sleep(1500);
        const t = await body(S);
        const gated = /You don.t have access to this page/.test(t) && !/Seasonal Themes/.test(t) && !/Sanity|Content Studio|Create new document/i.test(t);
        await rec(gated, `${kind === "visitor" ? "Signed-out visitor" : "Signed-in non-admin (QA account B)"} opens ${p}`, "only 'You don't have access to this page.'; none of the page's tools or data", `message shown=${/don.t have access/.test(t)}; themes heading shown=${/Seasonal Themes/.test(t)}; text: ${t.slice(0, 120)}`, p, S);
      }
      await S.close();
    }

    // ---------- RC-33: legacy vault item API
    const base = "https://vltd.app/api/vault/qa-rb23-item";
    const post = async (headers) => fetch(base, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify({ item: { id: "qa-rb23-item", title: "QA" } }) });
    const del = async (headers) => fetch(base, { method: "DELETE", headers });
    const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const si = await sb.auth.signInWithPassword({ email: m.email, password: m.password }); if (si.error) throw new Error("sign-in");
    const token = si.data.session.access_token;
    const a1 = await post({}), a2 = await del({}), a3 = await post({ authorization: "Bearer not-a-real-token" }), a4 = await del({ authorization: "Bearer not-a-real-token" });
    await rec([a1, a2, a3, a4].every((x) => x.status === 401), "Anonymous and bad-token POST/DELETE on /api/vault/<id>", "401 for all four", `POST ${a1.status}, DELETE ${a2.status}, POST bad token ${a3.status}, DELETE bad token ${a4.status}`, "/api/vault/[id]");
    const s1 = await post({ authorization: `Bearer ${token}` }), s2 = await del({ authorization: `Bearer ${token}` });
    await rec(s1.status === 200 && s2.status === 200, "Signed-in (QA account A) POST/DELETE on /api/vault/<id>", "200 and 200", `POST ${s1.status}, DELETE ${s2.status}`, "/api/vault/[id]");
    await sb.auth.signOut({ scope: "local" }).catch(() => {});

    // ---------- RC-07 / RC-28: /account validation (owner A)
    const O = await open("owner");
    await O.visit("/account"); await O.waitFor("(document.querySelector('input[placeholder=\"Display name\"]')||{}).value", 40000, "account").catch(() => {}); await sleep(1500);
    const save = async () => { await A.clickText(O, "^Save changes$", "main button"); await sleep(3500); };
    const setFields = async (name, user) => { await A.typeInto(O, 'input[placeholder="Display name"]', name); await A.typeInto(O, 'input[placeholder="Username"]', user); };
    const cases = [
      ["Empty display name", "", orig.username, /display name/i],
      ["Username 'ab' (too short)", orig.display_name || "QA Owner", "ab", /at least 3/i],
      ["Username 'A B!' (spaces and symbols)", orig.display_name || "QA Owner", "A B!", /underscore|letters, numbers/i],
      ["A username another account already uses", orig.display_name || "QA Owner", taken, /already taken/i],
    ];
    for (const [label, name, user, re] of cases) {
      await setFields(name, user); await save();
      const e = await errBox(O); const now = await prof(P);
      const unchanged = now.username === orig.username && now.display_name === orig.display_name;
      const raw = /duplicate key|violates|unique constraint|23505|\bPGRST|\{|\[object|Failed to save account/i.test(e || "");
      await rec(!!e && re.test(e) && !raw && unchanged, `/account: ${label}, then Save changes`, "refused in plain words that name the problem; saved profile unchanged", `message=${JSON.stringify(e)}; saved username=${now.username}, display_name=${JSON.stringify(now.display_name)}; unchanged=${unchanged}`, "/account", O);
    }
    const fresh = `qarb23${m.stamp}`.toLowerCase().slice(0, 24);
    await setFields("QA Owner Edited", fresh); await save();
    const okNow = await prof(P);
    const okMsg = await O.evaluate("document.body.innerText.includes('Account updated.')");
    await rec(okNow.username === fresh && okNow.display_name === "QA Owner Edited" && okMsg, "/account: a valid new display name and username, then Save changes", "saves; says 'Account updated.'; database shows the new values", `username=${okNow.username}; display_name=${okNow.display_name}; message shown=${okMsg}`, "/account", O);
    await admin.from("profiles").update({ username: orig.username, display_name: orig.display_name }).eq("id", P);

    // ---------- RC-28: /museum/new
    await O.visit("/museum/new"); await O.waitFor("document.body.innerText.includes('Create Exhibition')", 40000, "museum/new").catch(() => {}); await sleep(1500);
    const hint = await O.evaluate("(() => { const h = document.querySelector('[data-testid=create-needs-title]'); const b = [...document.querySelectorAll('button')].find((x) => /Create Exhibition/.test(x.innerText)); return { hint: h ? h.innerText : null, disabled: b ? b.disabled : null }; })()");
    await rec(hint.disabled === true && /title/i.test(hint.hint || ""), "/museum/new: Create is disabled with no title", "disabled, with a sentence saying a title is needed", `disabled=${hint.disabled}; hint=${JSON.stringify(hint.hint)}`, "/museum/new", O);
    await A.typeInto(O, 'input[placeholder="e.g. Hall of Grails"]', "Q".repeat(140));
    const len = await O.evaluate("document.querySelector('input[placeholder=\"e.g. Hall of Grails\"]').value.length");
    await rec(len === 80, "/museum/new: a 140-character title", "cut to 80, like the exhibition editor", `length ${len}`, "/museum/new", O);
    const title = `QA RB23 ${m.stamp}`;
    await A.typeInto(O, 'input[placeholder="e.g. Hall of Grails"]', title);
    const rect = await O.evaluate(A.RECT_JS("[...document.querySelectorAll('button')].find((x) => /Create Exhibition/.test(x.innerText))"));
    for (const cc of [1, 2]) { // a real double-click: two press/release pairs back to back
      await O.send("Input.dispatchMouseEvent", { type: "mousePressed", x: rect.x, y: rect.y, button: "left", buttons: 1, clickCount: cc });
      await O.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: rect.x, y: rect.y, button: "left", buttons: 0, clickCount: cc });
    }
    await A.waitPath(O, /^\/museum\/[^/]+$/, 20000); await sleep(6000);
    const cache = await O.evaluate(`(() => { try { const l = JSON.parse(localStorage.getItem('vltd_galleries') || '[]'); return (Array.isArray(l) ? l : []).filter((g) => g.title === ${JSON.stringify(title)}).length; } catch { return -1; } })()`);
    const db = (await admin.from("galleries").select("id").eq("profile_id", P).eq("title", title)).data || [];
    await rec(cache === 1 && db.length <= 1, "/museum/new: double-click Create Exhibition", "exactly one exhibition", `on this device: ${cache}; in the database: ${db.length}`, "/museum/new", O);
    await admin.from("galleries").delete().eq("profile_id", P).eq("title", title);

    // ---------- RC-04: sign-out failure (the harness answers the sign-out request with a failure, so the request really fails)
    await O.visit("/dashboard"); await O.waitFor("!!document.querySelector('[aria-label=\"Account menu\"]')", 40000, "nav").catch(() => {}); await sleep(1500);
    await A.clickSel(O, '[aria-label="Account menu"]'); await sleep(600);
    await A.clickText(O, "^Sign Out$", "button"); await sleep(3500);
    const f = await O.evaluate("(() => { const e = document.querySelector('[data-testid=sign-out-error]'); return { err: e ? e.innerText : null, path: location.pathname, stored: !!localStorage.getItem('vltd-auth'), stillSignOut: !![...document.querySelectorAll('button')].find((b) => /^Sign Out$/.test(b.innerText.trim())) }; })()");
    await rec(!!f.err && /still signed in/i.test(f.err) && f.path !== "/login" && f.stored && f.stillSignOut, "Sign Out while the sign-out request fails", "a plain error ('still signed in'); the person is NOT sent to the login screen; the session stays", `error=${JSON.stringify(f.err)}; path=${f.path}; session kept=${f.stored}; menu still signed-in=${f.stillSignOut}`, "/dashboard", O);
    process.env.AUDIT_ALLOW_SIGNOUT = "1"; // let the request through this time
    await A.clickText(O, "^Sign Out$", "button"); await A.waitPath(O, /^\/login/, 15000); await sleep(1000);
    const g = await O.evaluate("({ path: location.pathname, stored: !!localStorage.getItem('vltd-auth') })");
    await rec(/^\/login/.test(g.path) && !g.stored, "Sign Out when the request succeeds", "goes to the login page and the session is cleared", `path=${g.path}; session kept=${g.stored}`, "/login", O);
    delete process.env.AUDIT_ALLOW_SIGNOUT;
    await O.close();

    // ---------- onboarding step 1: taken username (unfinished-onboarding QA user C; setup is NOT finished)
    const C = await open("onboard");
    await C.visit("/onboarding"); await sleep(5000);
    const onStep1 = await C.evaluate("/personal account/i.test((document.querySelector('main h1')||{}).innerText||'')");
    if (!onStep1) { await A.clickText(C, "^Back$", "main button"); await sleep(1200); }
    await A.typeInto(C, 'input[placeholder^="e.g. jordan"]', orig.username);
    await A.clickText(C, "Save and continue", "main button"); await sleep(3500);
    const ce = await errBox(C); const stillStep1 = await C.evaluate("/personal account/i.test((document.querySelector('main h1')||{}).innerText||'')");
    await rec(stillStep1 && /already taken/i.test(ce || ""), "/onboarding step 1: Save and continue with a username another account already uses", "stays on step 1 and says the username is taken", `message=${JSON.stringify(ce)}; still on step 1=${stillStep1}`, "/onboarding", C);
    await C.close();
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 700); }
  finally {
    try { if (orig) await admin.from("profiles").update({ username: orig.username, display_name: orig.display_name }).eq("id", P); } catch {}
    const restored = await prof(P).catch(() => null);
    out.facts.restored = restored && orig && restored.username === orig.username && restored.display_name === orig.display_name;
    for (const S of sessions) { try { await S.close(); } catch {} }
    fs.writeFileSync(path.join(EV, `rb23-batch6-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    for (const c of out.cases.filter((c) => !c.ok)) console.log("NOT OK:", c.control, "|", String(c.actual).slice(0, 300));
    console.log("facts", JSON.stringify(out.facts));
    process.exit(0);
  }
})();
