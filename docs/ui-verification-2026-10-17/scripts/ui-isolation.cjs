// Queue F: account and profile isolation with two (three) synthetic accounts, through the real sign-out / sign-in screens.
//   node ui-isolation.cjs <label> --base=http://localhost:3000
// A = the QA account from ui-setup (12 items, 4 exhibitions). B = second synthetic account with a Personal and a Business
// profile. C = third synthetic account whose onboarding is unfinished. Everything is removed at the end (and by --cleanup).
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { launch } = require("./cdp.cjs");
const { session, qa, admin, sleep, env } = require("./ui-lib.cjs");
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=http://localhost:3000").slice(7);
const LABEL = process.argv[2] || "iso";
const OUT = path.join(__dirname, "shots-iso-" + LABEL); fs.mkdirSync(OUT, { recursive: true });
const MAN = path.join(__dirname, "qa_iso.json");
let pass = 0, fail = 0;
const check = (name, ok, detail) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", name, ok ? "" : JSON.stringify(detail ?? "").slice(0, 600)); };
const info = (name, detail) => console.log("INFO", name, JSON.stringify(detail ?? "").slice(0, 500));
const stamp = Date.now().toString(36);
const setVal = (S, sel, v) => S.evaluate("(() => { const i = document.querySelector(" + JSON.stringify(sel) + "); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, " + JSON.stringify(v) + "); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()");
const body = (S) => S.evaluate("document.body.innerText");

async function cleanupAll(man) {
  if (!man) return;
  for (const u of man.users || []) {
    const profs = (await admin.from("profiles").select("id").eq("user_id", u.id)).data || [];
    for (const p of profs) {
      await admin.from("vault_items").delete().eq("profile_id", p.id);
      await admin.from("galleries").delete().eq("profile_id", p.id);
    }
    await admin.from("profiles").delete().eq("user_id", u.id);
    await admin.auth.admin.deleteUser(u.id);
  }
  const left = [];
  for (const u of man.users || []) {
    const p = (await admin.from("profiles").select("id").eq("user_id", u.id)).data || [];
    if (p.length) left.push(u.id);
    const g = await admin.auth.admin.getUserById(u.id); if (g.data && g.data.user) left.push("auth:" + u.id);
  }
  console.log(left.length ? "CLEANUP LEFTOVERS: " + left.join(",") : "cleanup: 0 synthetic accounts/rows left");
  try { fs.unlinkSync(MAN); } catch { /* none */ }
}

async function mkUser(label, { onboarded = true, business = false } = {}) {
  const email = "vltdadmin+qa-iso-" + label + "-" + stamp + "@gmail.com";
  const password = "Qa!" + crypto.randomBytes(9).toString("base64url");
  const cu = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (cu.error) throw cu.error;
  const man = JSON.parse(fs.readFileSync(MAN, "utf8")); man.users.push({ id: cu.data.user.id, label, email }); fs.writeFileSync(MAN, JSON.stringify(man));
  const mk = async (type, uname, display) => {
    const r = await admin.from("profiles").insert({ user_id: cu.data.user.id, username: uname, display_name: display, profile_type: type, primary_focus: "Sports", avatar_emoji: "key", onboarding_completed: onboarded, is_public: false, avatar_url: "__preset:key" }).select("id").single();
    if (r.error) throw new Error(r.error.message);
    return r.data.id;
  };
  const personal = await mk("personal", "qa_iso_" + label + "_p_" + stamp, "QA " + label.toUpperCase() + " Personal");
  const bus = business ? await mk("business", "qa_iso_" + label + "_b_" + stamp, "QA " + label.toUpperCase() + " Business") : null;
  return { id: cu.data.user.id, email, password, personal, business: bus };
}
const mkItems = (profileId, prefix, n) => admin.from("vault_items").insert(Array.from({ length: n }, (_, k) => ({ id: "qa_iso_" + stamp + "_" + prefix.replace(/ /g, "") + "_" + k, profile_id: profileId, title: prefix + " " + (k + 1), created_at: Date.now() - k * 1000, is_public: false, status: "COLLECTION", universe: "SPORTS", category: "SPORTS_CARDS", category_label: "Sports Cards", purchase_price: 10 })));

async function realLogin(S, email, password) {
  await S.go("/login");
  await S.waitFor("document.querySelector('input[type=email]')", 60000, "login form"); await sleep(800);
  await setVal(S, "input[type=email]", email); await setVal(S, "input[type=password]", password);
  await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Log in'); b.click(); return true; })()");
  await S.waitFor("location.pathname !== '/login'", 60000, "left login"); await sleep(2500);
}
async function realSignOut(S) {
  await S.waitFor("document.querySelector('button[aria-label=\"Account menu\"]')", 60000, "account menu");
  await S.click('button[aria-label="Account menu"]'); await sleep(700);
  await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Sign Out'); b.click(); return true; })()");
  await S.waitFor("location.pathname === '/login'", 60000, "login after sign out"); await sleep(1500);
}
// Keys in ACTIVE storage (not the parked "vltd_stash:" copies) that hold the needle. Item ids are also listed inside the PUBLIC
// exhibitions every visitor may read (cached in vltd_galleries), so the scan looks for private content instead: item titles,
// the private exhibition's title, notes.
const localLeak = (S, needle) => S.evaluate("(() => { const hits = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('vltd_stash:')) continue; const v = localStorage.getItem(k) || ''; if (v.includes(" + JSON.stringify(needle) + ")) hits.push(k); } return hits; })()");
const privateNeedles = ["QA Rookie Card Slab", "QA Batman Absolute", "QA Exhibition 1", "PRIVATE-NOTE-QA-"];
const leakAll = async (S) => { const out = {}; for (const n of privateNeedles) { const h = await localLeak(S, n); if (h.length) out[n] = h; } return out; };

(async () => {
  if (fs.existsSync(MAN)) { console.log("earlier run left a manifest: cleaning it first"); await cleanupAll(JSON.parse(fs.readFileSync(MAN, "utf8"))); }
  fs.writeFileSync(MAN, JSON.stringify({ users: [] }));
  const B = await mkUser("b", { business: true });
  const C = await mkUser("c", { onboarded: false });
  await mkItems(B.personal, "QA-B Personal", 3); await mkItems(B.business, "QA-B Business", 2);
  const aItem = "qa_ui_" + qa.stamp + "_2"; const aRow = (await admin.from("vault_items").select("*").eq("id", aItem).maybeSingle()).data;
  await admin.from("vault_items").update({ notes: "PRIVATE-NOTE-QA-" + stamp, storage_location: "PRIVATE-SHELF-QA-" + stamp }).eq("id", aItem);
  console.log("setup: B (personal 3 items, business 2 items) and C (onboarding unfinished) created");

  // ---------------- browser 1: A -> sign out -> Back/refresh -> B -> profile switch -> C ----------------
  const S = await session(BASE, { width: 1440, height: 900 });
  try {
    await S.go("/vault"); await S.waitFor("/QA Batman|QA Rookie/.test(document.body.innerText)", 120000, "A's vault"); await sleep(1500);
    check("[F1] signed in as A: A's items are shown", /QA Rookie Card Slab/.test(await body(S)));
    await realSignOut(S);
    const leak1 = await leakAll(S);
    check("[F2] after sign-out none of A's private content (item titles, the private exhibition, notes) is left in active browser storage", Object.keys(leak1).length === 0, leak1);
    const pubCache = await S.evaluate("(() => { try { const g = JSON.parse(localStorage.getItem('vltd_galleries') || '[]'); return { n: g.length, titles: g.map((x) => x.title), visibility: g.map((x) => x.visibility) }; } catch (e) { return String(e); } })()");
    info("[F2] what the signed-out page keeps in vltd_galleries (the exhibitions anyone can read)", pubCache);
    check("[F2] and that cache holds only PUBLIC exhibitions (never A's private one)", pubCache && pubCache.visibility && pubCache.visibility.every((v) => v === "PUBLIC") && !pubCache.titles.includes("QA Exhibition 1"), pubCache);
    const hist = await S.send("Page.getNavigationHistory");
    info("[F2] browser history after sign-out", hist.entries.map((e) => new URL(e.url).pathname).join(" > ") + " (at " + hist.currentIndex + ")");
    const prev0 = hist.entries.slice(0, hist.currentIndex).reverse().find((e) => /\/vault$|\/dashboard$/.test(new URL(e.url).pathname));
    const prev = prev0 || hist.entries[Math.max(0, hist.currentIndex - 1)];
    await S.send("Page.navigateToHistoryEntry", { entryId: prev.id }); await sleep(6000);
    let t = await body(S);
    check("[F2] pressing Back after sign-out never shows A's items (A's page entry was replaced by the log-in redirect, so Back leaves the app's pages)", !/QA Rookie|QA Batman|QA Filler/.test(t) && !/vault|dashboard/.test(await S.evaluate("location.pathname")), { went: prev.url, path: await S.evaluate("location.pathname"), has: /QA Rookie/.test(t) });
    await S.send("Page.navigateToHistoryEntry", { entryId: hist.entries[hist.currentIndex].id }); await sleep(4000);
    await S.go("/vault"); await sleep(5000); t = await body(S);
    check("[F2] a refresh on /vault after sign-out goes to /login with no items", /login/.test(await S.evaluate("location.pathname")) && !/QA Rookie|QA Batman/.test(t), await S.evaluate("location.pathname"));
    await S.go("/dashboard"); await sleep(4000); t = await body(S);
    check("[F2] Home after sign-out shows none of A's figures or name", !/QA Curator|QA Rookie/.test(t), await S.evaluate("location.pathname"));

    await realLogin(S, B.email, B.password);
    await S.go("/vault"); await S.waitFor("/QA-B Personal/.test(document.body.innerText)", 120000, "B's vault"); await sleep(2500);
    t = await body(S);
    check("[F3] signed in as B on the same browser: B's three personal items, none of A's", /QA-B Personal 1/.test(t) && !/QA Rookie|QA Batman|QA Filler|QA Guitar|QA Poster/.test(t), t.slice(0, 400));
    const leak2 = await leakAll(S);
    check("[F3] none of A's private content is in B's active browser storage", Object.keys(leak2).length === 0, leak2);
    await S.go("/dashboard"); await S.waitFor("/Welcome back/i.test(document.body.innerText)", 120000, "B home"); await sleep(3000); t = await body(S);
    check("[F3] B's Home shows B's name and 3 items; none of A's name, items or exhibitions", /QA B Personal/.test(t) && /3 items/.test(t) && !/QA Curator|QA Exhibition/.test(t), t.slice(0, 500));

    // profile switch with a slow personal load: the personal answer must never land in the Business view
    await S.go("/vault"); await S.waitFor("/QA-B Personal/.test(document.body.innerText)", 120000); await sleep(1500);
    await S.send("Fetch.enable", { patterns: [{ urlPattern: "*/rest/v1/vault_items*", requestStage: "Response" }] });
    let delayed = 0;
    S.c.on(async (m) => {
      if (m.method !== "Fetch.requestPaused") return;
      const { requestId, request } = m.params;
      try { if (request.method === "GET" && request.url.includes(B.personal)) { delayed++; await sleep(7000); } await S.send("Fetch.continueResponse", { requestId }); } catch { /* gone */ }
    });
    await S.click('button[aria-label="Account menu"]'); await sleep(700);
    const switched = await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('QA B Business')); if (!b) return false; b.click(); return true; })()");
    check("[F4] the Business profile can be chosen from the account menu", switched === true, switched);
    await S.waitFor("/QA-B Business/.test(document.body.innerText)", 60000, "business items").catch(() => {});
    await sleep(9000); t = await body(S);
    check("[F4] after switching, the Business items are shown and no Personal item appears (even after the slow Personal answer arrives)", /QA-B Business 1/.test(t) && !/QA-B Personal/.test(t), { delayed, text: t.slice(0, 400) });
    await S.send("Fetch.disable");
    await S.go("/vault"); await sleep(5000); t = await body(S);
    check("[F4] a reload keeps the Business profile and shows only its items", /QA-B Business/.test(t) && !/QA-B Personal/.test(t), t.slice(0, 300));

    await realSignOut(S);
    await realLogin(S, C.email, C.password);
    await S.go("/vault"); await sleep(6000);
    const p = await S.evaluate("location.pathname"); t = await body(S);
    check("[F5] an account with unfinished onboarding is sent to /onboarding, not into the Vault", p.startsWith("/onboarding"), { path: p });
    await S.go("/museum"); await sleep(4000);
    check("[F5] and cannot reach /museum either", (await S.evaluate("location.pathname")).startsWith("/onboarding"), await S.evaluate("location.pathname"));
    await S.shot(OUT + "/unfinished-onboarding.png");
  } finally { await S.close(); }

  // ---------------- API level: B (and no one) against A's rows ----------------
  const sbB = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await sbB.auth.signInWithPassword({ email: B.email, password: B.password });
  const sbAnon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const aGallery = qa.galleryIds[0];
  const rd = await sbB.from("vault_items").select("id,title").eq("profile_id", qa.profileId);
  check("[F6] B cannot read A's items", !rd.error && (rd.data || []).length === 0, rd);
  const rdG = await sbB.from("galleries").select("id").eq("id", aGallery);
  check("[F6] B cannot read A's private exhibition", !rdG.error && (rdG.data || []).length === 0, rdG);
  const up = await sbB.from("vault_items").update({ title: "HACKED" }).eq("id", aItem).select("id");
  const after = (await admin.from("vault_items").select("title").eq("id", aItem).maybeSingle()).data;
  check("[F6] B cannot change A's item", after.title !== "HACKED" && (up.data || []).length === 0, { up, after });
  const del = await sbB.from("vault_items").delete().eq("id", aItem).select("id");
  const still = (await admin.from("vault_items").select("id").eq("id", aItem).maybeSingle()).data;
  check("[F6] B cannot delete A's item", !!still && (del.data || []).length === 0, { del });
  const ins = await sbB.from("vault_items").insert({ id: "qa_iso_" + stamp + "_intruder", profile_id: qa.profileId, title: "INTRUDER", status: "COLLECTION", created_at: Date.now() });
  const intr = (await admin.from("vault_items").select("id").eq("id", "qa_iso_" + stamp + "_intruder").maybeSingle()).data;
  check("[F6] B cannot write an item into A's profile", !!ins.error && !intr, { error: ins.error && ins.error.message });
  const insG = await sbB.from("galleries").update({ title: "HACKED" }).eq("id", aGallery).select("id");
  const gAfter = (await admin.from("galleries").select("title").eq("id", aGallery).maybeSingle()).data;
  check("[F6] B cannot change A's exhibition", gAfter.title !== "HACKED" && (insG.data || []).length === 0, { insG });
  const anonItems = await sbAnon.from("vault_items").select("id").eq("profile_id", qa.profileId);
  check("[F6] a visitor who is not signed in cannot read A's private items", !anonItems.error && (anonItems.data || []).length === 0, anonItems);
  const anonC = await sbAnon.from("profiles").select("id,display_name,user_id").eq("user_id", C.id);
  info("[F6] what a signed-out visitor can read of C's unfinished profile", { rows: (anonC.data || []).length, error: anonC.error && anonC.error.message });
  check("[F6] unfinished/private profile (C) is not readable by a signed-out visitor", !anonC.error && (anonC.data || []).length === 0, anonC);

  // ---------------- anonymous visitor on a shared exhibition link ----------------
  const gOrig = (await admin.from("galleries").select("id,visibility,public_token").in("id", qa.galleryIds.slice(0, 2))).data || [];
  const token = "qa-iso-" + stamp + "-" + crypto.randomBytes(6).toString("hex");
  await admin.from("galleries").update({ visibility: "INVITE", public_token: token }).eq("id", qa.galleryIds[1]);
  const rpc = await sbAnon.rpc("get_gallery_by_share_token", { p_token: token }).maybeSingle();
  check("[F7] a signed-out visitor can resolve the shared exhibition by its link token", !rpc.error && rpc.data && rpc.data.id === qa.galleryIds[1], rpc.error);
  const tokenLocked = "qa-iso-locked-" + stamp;
  await admin.from("galleries").update({ visibility: "LOCKED", public_token: tokenLocked }).eq("id", qa.galleryIds[0]);
  const rpcL = await sbAnon.rpc("get_gallery_by_share_token", { p_token: tokenLocked }).maybeSingle();
  info("[F7] private exhibition's token as a signed-out visitor", { gotRow: !!(rpcL.data), error: rpcL.error && rpcL.error.message });
  const V = await launch(9800 + Math.floor(Math.random() * 150));
  try {
    await V.send("Page.enable"); await V.send("Network.enable"); await V.send("Runtime.enable");
    await V.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    const seen = []; V.on((m) => { if (m.method === "Network.responseReceived" && /supabase/.test(m.params.response.url)) seen.push(m.params.requestId); });
    await V.send("Page.navigate", { url: BASE + "/museum/share/" + token }); await sleep(12000);
    const html = await V.evaluate("document.documentElement.innerText + ' ' + document.documentElement.outerHTML.length");
    const bodyText = await V.evaluate("document.body.innerText");
    await V.send("Page.captureScreenshot", { format: "png" }).then((r) => fs.writeFileSync(OUT + "/anonymous-share-link.png", Buffer.from(r.data, "base64")));
    check("[F7] the shared link opens for someone who is not signed in and names the exhibition", /QA Exhibition 2/.test(bodyText), bodyText.slice(0, 300));
    const bodies = [];
    for (const id of seen) { try { const r = await V.send("Network.getResponseBody", { requestId: id }); bodies.push(r.body || ""); } catch { /* no body */ } }
    const everything = bodyText + " " + bodies.join(" ");
    check("[F7] the page and the data it loaded contain none of the item's private notes or storage location", !everything.includes("PRIVATE-NOTE-QA-" + stamp) && !everything.includes("PRIVATE-SHELF-QA-" + stamp), { note: everything.includes("PRIVATE-NOTE-QA-" + stamp), shelf: everything.includes("PRIVATE-SHELF-QA-" + stamp) });
    check("[F7] nor the owner's account email or user id", !everything.includes(qa.email) && !everything.includes(qa.userId), { email: everything.includes(qa.email), uid: everything.includes(qa.userId) });
    info("[F7] owner display name visible to the visitor?", { shown: /QA Curator/.test(bodyText) });
    await V.send("Page.navigate", { url: BASE + "/museum/share/" + tokenLocked }); await sleep(9000);
    const lockedText = await V.evaluate("document.body.innerText");
    check("[F7] the link of a PRIVATE exhibition does not show its contents to a visitor", !/QA Exhibition 1/.test(lockedText) || /private|not available|unavailable|sign in|no longer/i.test(lockedText), lockedText.slice(0, 300));
  } finally { await V.close(); }

  // restore A's rows touched by this run, then remove B and C
  await admin.from("vault_items").update({ notes: aRow.notes, storage_location: aRow.storage_location }).eq("id", aItem);
  for (const g of gOrig) await admin.from("galleries").update({ visibility: g.visibility, public_token: g.public_token }).eq("id", g.id);
  await cleanupAll(JSON.parse(fs.readFileSync(MAN, "utf8")));
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch(async (e) => { console.error("ERR", e.message || e); try { await cleanupAll(JSON.parse(fs.readFileSync(MAN, "utf8"))); } catch { /* ignore */ } process.exit(2); });
