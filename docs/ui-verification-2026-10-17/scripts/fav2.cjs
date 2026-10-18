// LIVE: Saved content (Favorites): Save, reload, open, unsave, and account/profile isolation, with synthetic public content. Synthetic accounts only.
//   needs journey-setup.cjs (viewer J: Personal + Business) and referral-setup-k.cjs (owner K) first.   node fav2.cjs [--base=https://vltd.app]
// Browser profiles go under the scratchpad (not under the protected C:/qa-chrome folder).
process.env.CHROME_PROFILE_ROOT = process.env.CHROME_PROFILE_ROOT || "C:/Users/EK/AppData/Local/Temp/qa-c";
const crypto = require("crypto");
const { browser, admin, sleep, man, env, createClient } = require("./journey-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=https://vltd.app").slice(7);
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 500)); };
const info = (n, d) => console.log("INFO", n, JSON.stringify(d ?? "").slice(0, 600));
const favRows = async (userId, anonId) => (await admin.from("public_favorites").select("id,content_type,content_id,user_id,anonymous_id,metadata").match(userId ? { user_id: userId } : { anonymous_id: anonId })).data || [];
const saveBtn = (S) => S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => /to your saved list|Saved\\. Remove/.test(x.getAttribute('aria-label') || '')); return b ? b.getAttribute('aria-label') : null; })()");
const clickSave = (S) => S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => /to your saved list|Saved\\. Remove/.test(x.getAttribute('aria-label') || '')); if (!b) return false; b.scrollIntoView({ block: 'center' }); b.click(); return true; })()");
const waitSaveBtn = (S) => S.waitFor("[...document.querySelectorAll('button')].some((x) => /to your saved list|Saved\\. Remove/.test(x.getAttribute('aria-label') || ''))", 90000, "Save button");

(async () => {
  const m = man(); const K = m.k; const stamp = m.stamp;
  const GID = crypto.randomUUID(), IID = "qa_fav_" + stamp + "_item";
  await admin.from("profiles").update({ is_public: true }).eq("id", K.profileId);
  const ins = await admin.from("vault_items").insert({ id: IID, profile_id: K.profileId, title: "QA Fav Public Item", status: "COLLECTION", is_public: true, created_at: Date.now(), image_front_url: "/collectibles/vinyl-record.png", image_front_storage_path: "/collectibles/vinyl-record.png", images_json: [{ id: "/collectibles/vinyl-record.png#0", storageKey: "/collectibles/vinyl-record.png", url: "/collectibles/vinyl-record.png", order: 0, localOnly: false, role: "primary", isPrivateStorage: false }] });
  if (ins.error) throw new Error(ins.error.message);
  const sec = { id: "s1", title: "Exhibit 1", description: "", itemIds: [IID], slotLayout: [IID, null, null, null, null, null] };
  const g = await admin.from("galleries").insert({ id: GID, profile_id: K.profileId, title: "QA Fav Public Exhibition", description: "synthetic", visibility: "PUBLIC", state: "ACTIVE", layout: { itemIds: [IID], themePack: "classic", displayMode: "grid", guestViewMode: "public", sections: [sec] }, exhibition_layout: { itemIds: [IID], sections: [sec] }, public_token: "qafav-" + stamp, alias_enabled: false });
  if (g.error) throw new Error(g.error.message);
  await admin.from("gallery_items").insert({ gallery_id: GID, position: 1, artifact_id: IID });
  const anonId = "qa_guest_" + stamp;
  // a public item is saved from the collector page (/v/<profile>): open the item there, where its Save button is
  const openItem = async (S) => { await S.go("/v/" + K.profileId); await S.waitFor("document.body.innerText.includes('QA Fav Public Item')", 120000, "public profile with the item"); await sleep(2500); await S.evaluate("(() => { const el = [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.textContent.trim() === 'QA Fav Public Item').pop(); if (el) el.click(); return true; })()"); await waitSaveBtn(S); await sleep(3000); };
  let S, S2, G, KB, BZ;
  try {
    info("deployed commit", ((await (await fetch(BASE + "/")).text()).match(/name="vltd-commit" content="([^"]+)"/) || [])[1]);
    // ---- 1. Save an exhibition and an item as J (Personal) ----
    S = await browser(BASE, { width: 1280, height: 900 });
    await S.go("/museum/" + GID + "/guest"); await waitSaveBtn(S); await sleep(3000);
    check("[save] a public exhibition shows 'Save' (not yet saved)", /to your saved list/.test(await saveBtn(S)), await saveBtn(S));
    await clickSave(S); await sleep(4000);
    check("[save] clicking Save marks the exhibition Saved", /^Saved\./.test(await saveBtn(S)), await saveBtn(S));
    let rows = await favRows(m.userId);
    const gRow = rows.find((r) => r.content_type === "gallery" && r.content_id === GID);
    check("[save] the saved exhibition is stored for this account, stamped with the Personal profile", !!gRow && gRow.metadata?.profile_id === m.personalId, gRow);
    await openItem(S);
    await clickSave(S); await sleep(4000);
    rows = await favRows(m.userId);
    const iRow = rows.find((r) => r.content_type === "item" && r.content_id === IID);
    check("[save] a public item can be saved too, stored for this account and profile", !!iRow && iRow.metadata?.profile_id === m.personalId, iRow);
    // ---- 2. reload keeps it saved ----
    await openItem(S);
    check("[reload] after a refresh the item still shows Saved", /^Saved\./.test(await saveBtn(S)), await saveBtn(S));
    await S.go("/museum/" + GID + "/guest"); await waitSaveBtn(S); await sleep(3500);
    check("[reload] and so does the exhibition", /^Saved\./.test(await saveBtn(S)), await saveBtn(S));
    await S.close(); S = null;

    // ---- 3. a CLEAN second browser: Favorites lists both, and they open ----
    S2 = await browser(BASE, { width: 1280, height: 900 });
    await S2.go("/favorites"); await S2.waitFor("/Favorites/.test(document.body.innerText) && document.querySelectorAll('a[href]').length > 5", 90000); await sleep(6000);
    const favText = (await S2.text()).split("\n").join(" | ");
    info("Favorites page", favText.slice(favText.indexOf("Favorites"), favText.indexOf("Favorites") + 420));
    const cards = await S2.evaluate("[...document.querySelectorAll('a[href^=\"/share/\"], a[href*=\"/guest\"]')].map((a) => ({ href: a.getAttribute('href'), text: a.innerText.split('\\n').join(' | ').slice(0, 80) }))");
    check("[favorites] both saved things are listed in a clean browser (one Item, one Exhibition)", cards.some((c) => c.href === "/share/" + IID) && cards.some((c) => c.href === "/museum/" + GID + "/guest"), cards);
    check("[favorites] the cards carry real titles, not a placeholder", cards.some((c) => /QA Fav Public Item/.test(c.text)) && cards.some((c) => /QA Fav Public Exhibition/.test(c.text)), cards.map((c) => c.text));
    await S2.evaluate(`[...document.querySelectorAll('a')].find((a) => a.getAttribute('href') === ${JSON.stringify("/museum/" + GID + "/guest")}).click(); true`);
    await S2.waitFor("location.pathname.endsWith('/guest')", 60000, "open exhibition"); await sleep(5000);
    check("[open] the saved exhibition opens from Favorites and shows its title", /QA Fav Public Exhibition/.test(await S2.text()), (await S2.text()).slice(0, 120));
    await S2.evaluate("history.back(); true"); await S2.waitFor("location.pathname === '/favorites'", 30000); await sleep(4000);
    await S2.evaluate(`[...document.querySelectorAll('a')].find((a) => a.getAttribute('href') === ${JSON.stringify("/share/" + IID)}).click(); true`);
    await S2.waitFor("location.pathname.startsWith('/share/')", 60000, "open item"); await sleep(5000);
    check("[open] the saved item opens from Favorites and shows its title", /QA Fav Public Item/.test(await S2.text()), (await S2.text()).slice(0, 120));

    // ---- 4. unsave the exhibition ----
    await S2.go("/museum/" + GID + "/guest"); await waitSaveBtn(S2); await sleep(3500);
    check("[unsave] the exhibition shows Saved in the clean browser", /^Saved\./.test(await saveBtn(S2)), await saveBtn(S2));
    await clickSave(S2); await sleep(4000);
    check("[unsave] clicking Saved removes it (the button goes back to Save)", /to your saved list/.test(await saveBtn(S2)), await saveBtn(S2));
    rows = await favRows(m.userId);
    check("[unsave] the saved exhibition is gone from the database, the saved item is untouched", !rows.some((r) => r.content_id === GID) && rows.some((r) => r.content_id === IID), rows.map((r) => r.content_type));
    await S2.go("/favorites"); await sleep(8000);
    const after = await S2.evaluate("[...document.querySelectorAll('a[href^=\"/share/\"], a[href*=\"/guest\"]')].map((a) => a.getAttribute('href'))");
    check("[unsave] after a reload Favorites lists only the item", after.includes("/share/" + IID) && !after.includes("/museum/" + GID + "/guest"), after);
    await S2.close(); S2 = null;

    // ---- 5. isolation ----
    // (a) J's Business profile does not see what was saved as Personal
    BZ = await browser(BASE, { activeProfile: m.businessId });
    await BZ.go("/favorites"); await sleep(10000);
    const bz = await BZ.evaluate("[...document.querySelectorAll('a[href^=\"/share/\"], a[href*=\"/guest\"]')].map((a) => a.getAttribute('href'))");
    check("[isolation] the same account's BUSINESS profile does not list what Personal saved", bz.length === 0, bz);
    await BZ.close(); BZ = null;
    // (b) another account (K) sees nothing of J's
    KB = await browser(BASE, { creds: { email: K.email, password: K.password, profileId: K.profileId } });
    await KB.go("/favorites"); await sleep(10000);
    const kb = await KB.evaluate("[...document.querySelectorAll('a[href^=\"/share/\"], a[href*=\"/guest\"]')].map((a) => a.getAttribute('href'))");
    check("[isolation] a different account does not list J's saved item", !kb.includes("/share/" + IID), kb);
    await KB.close(); KB = null;
    // (c) a signed-out guest can save too; it is stored apart and does not appear for J
    G = await browser(BASE, { withSession: false });
    await G.evaluate("localStorage.setItem('vltd_public_favorite_anon_id_v1', " + JSON.stringify(anonId) + "); true");
    await G.go("/museum/" + GID + "/guest"); await waitSaveBtn(G); await sleep(3500);
    await clickSave(G); await sleep(4000);
    const grows = await favRows(null, anonId);
    check("[isolation] a signed-out guest's Save is stored under its own guest id, with no account", grows.length === 1 && grows[0].user_id === null && grows[0].content_id === GID, grows);
    await G.go("/museum/" + GID + "/guest"); await waitSaveBtn(G); await sleep(3500);
    check("[guest] after a reload the guest still sees the exhibition as Saved (its own guest id)", /^Saved./.test(await saveBtn(G)), await saveBtn(G));
    await G.go("/favorites"); await sleep(8000);
    check("[guest] the Favorites list is for signed-in accounts: a signed-out visitor is sent to the login page, so a guest cannot see anyone's saves there", (await G.path()).startsWith("/login"), await G.path());
    await G.go("/museum/" + GID + "/guest"); await waitSaveBtn(G); await sleep(3500); await clickSave(G); await sleep(4000);
    check("[isolation] the guest can unsave its own save", (await favRows(null, anonId)).length === 0);
    await G.close(); G = null;
    // (d) what a visitor can read of other people's saves through the API
    const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const peek = await anon.from("public_favorites").select("user_id,content_id,metadata").eq("user_id", m.userId);
    const cnt = await anon.from("public_favorites").select("id", { count: "exact", head: true }).eq("content_id", IID);
    info("API peek: rows of another account's saves readable by a visitor", { rows: (peek.data || []).length, error: peek.error?.message, publicCountForTheItem: cnt.count });
    check("[isolation FINDING] a signed-out visitor cannot list another account's saves (only the public counts exist)", (peek.data || []).length === 0, peek.data);
  } catch (e) { console.log("STOPPED", e.message); fail++; try { if (S) await S.shot("fav2-stop.png"); } catch { /* ignore */ } }
  finally {
    for (const b of [S, S2, G, KB, BZ]) { try { if (b) await b.close(); } catch { /* ignore */ } }
    await admin.from("public_favorites").delete().in("content_id", [GID, IID]);
    await admin.from("gallery_items").delete().eq("gallery_id", GID);
    await admin.from("galleries").delete().eq("id", GID);
    await admin.from("vault_items").delete().eq("id", IID);
    await admin.from("profiles").update({ is_public: false }).eq("id", K.profileId);
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
