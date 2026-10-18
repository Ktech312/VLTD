// LIVE: public sharing boundaries together, one synthetic collector with private and public content.
//   node share2.cjs [--base=https://vltd.app]
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { browser, admin, sleep, man, env, createClient } = require("./journey-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=https://vltd.app").slice(7);
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 600)); };
const info = (n, d) => console.log("INFO", n, JSON.stringify(d ?? "").slice(0, 700));
const anonClient = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const DL = "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/ui/dl-share2";

(async () => {
  const m = man(); const P = m.personalId; const stamp = m.stamp;
  const SENT = { notes: "PRIVATE-NOTE-" + stamp, storage: "PRIVATE-SHELF-" + stamp, source: "PRIVATE-SOURCE-" + stamp, order: "PRIVATE-ORDER-" + stamp, serial: "PRIVATE-SERIAL-" + stamp, grader: "PRIVATE-GRADER-" + stamp };
  const img = (n) => ({ image_front_url: `/collectibles/${n}.png`, image_front_storage_path: `/collectibles/${n}.png`, images_json: [{ id: `/collectibles/${n}.png#0`, storageKey: `/collectibles/${n}.png`, url: `/collectibles/${n}.png`, order: 0, localOnly: false, role: "primary", isPrivateStorage: false }] });
  const base = (id, title, pub, photo) => ({ id, profile_id: P, title, status: "COLLECTION", is_public: pub, created_at: Date.now(), purchase_price: 77, current_value: 123, notes: SENT.notes, storage_location: SENT.storage, purchase_source: SENT.source, order_number: SENT.order, serial_number: SENT.serial, comic_grading_company: SENT.grader, ...img(photo) });
  const PRIV = "qa_sh_" + stamp + "_priv", PUB = "qa_sh_" + stamp + "_pub";
  await admin.from("vault_items").delete().eq("profile_id", P).like("id", "qa_sh_%");
  await admin.from("galleries").delete().eq("profile_id", P).like("title", "QA Share %");
  const ins = await admin.from("vault_items").insert([base(PRIV, "QA Share Private Item", false, "sports-slab"), base(PUB, "QA Share Public Item", true, "vinyl-record")]);
  if (ins.error) throw new Error(ins.error.message);
  const mkG = (title, vis, tok) => { const id = crypto.randomUUID(); const sec = { id: "s1", title: "Exhibit 1", description: "", itemIds: [PUB, PRIV], slotLayout: [PUB, PRIV, null, null, null, null] }; return { id, profile_id: P, title, description: "synthetic", visibility: vis, state: "ACTIVE", layout: { itemIds: [PUB, PRIV], themePack: "classic", displayMode: "grid", guestViewMode: "public", sections: [sec] }, exhibition_layout: { itemIds: [PUB, PRIV], sections: [sec] }, public_token: tok, alias_enabled: false }; };
  const GG = mkG("QA Share Guest Exhibition", "INVITE", "qash-guest-" + stamp), GP = mkG("QA Share Public Exhibition", "PUBLIC", "qash-pub-" + stamp);
  const gi = await admin.from("galleries").insert([GG, GP]); if (gi.error) throw new Error(gi.error.message);
  await admin.from("gallery_items").insert([GG, GP].flatMap((g) => [{ gallery_id: g.id, position: 1, artifact_id: PUB }, { gallery_id: g.id, position: 2, artifact_id: PRIV }]));
  fs.mkdirSync(DL, { recursive: true }); for (const f of fs.readdirSync(DL)) try { fs.unlinkSync(path.join(DL, f)); } catch { /* none */ }

  const S = await browser(BASE, { width: 1440, height: 900 });
  let blockWrites = false;
  try {
    info("deployed commit", ((await (await fetch(BASE + "/")).text()).match(/name="vltd-commit" content="([^"]+)"/) || [])[1]);
    await S.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: DL.replace(/\//g, "\\") });
    await S.send("Fetch.enable", { patterns: [{ urlPattern: "*/rest/v1/vault_items*", requestStage: "Request" }] });
    S.c.on(async (e) => { if (e.method === "Fetch.requestPaused") { const w = /^(PATCH|POST|PUT|DELETE)$/.test(e.params.request.method); try { if (blockWrites && w) await S.send("Fetch.failRequest", { requestId: e.params.requestId, errorReason: "Failed" }); else await S.send("Fetch.continueRequest", { requestId: e.params.requestId }); } catch { /* done */ } } });

    // ---- A. photo-only export of a PRIVATE item ----
    await S.go("/vault/item/" + PRIV); await S.waitFor("document.body.innerText.includes('QA Share Private Item')", 120000, "private item"); await sleep(3500);
    const w0 = S.reqs.filter((r) => /vault_items/.test(r.url) && /^(PATCH|POST|PUT|DELETE)$/.test(r.method)).length;
    const shareBtn = await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => /^share$/i.test((x.getAttribute('aria-label') || x.textContent).trim()) || /^share$/i.test(x.textContent.trim())); if (!b) return false; b.click(); return true; })()");
    await S.waitFor("document.querySelector('[aria-label=\"Share photos\"]')", 30000, "Share photos section").catch(() => {}); await sleep(1500);
    const hasPhotos = await S.evaluate("!!document.querySelector('[aria-label=\"Share photos\"]')");
    check("[export] a PRIVATE item's Share panel offers 'Share photos'", shareBtn && hasPhotos, { shareBtn, hasPhotos });
    await S.evaluate("(() => { const t = document.querySelector('[aria-label=\"Pictures to share\"] button'); if (t && t.getAttribute('aria-pressed') !== 'true') t.click(); return true; })()"); await sleep(500);
    await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => /Download to device/.test(x.textContent)); if (b) b.click(); return true; })()"); await sleep(4500);
    const files = fs.readdirSync(DL).filter((f) => !/\.crdownload$/.test(f) && !/^downloads\.htm$/i.test(f));
    check("[export] 'Download to device' saves the photo file (a picture, not the record)", files.length >= 1 && /\.(png|jpe?g|webp)$/i.test(files[0]), files);
    const w1 = S.reqs.filter((r) => /vault_items/.test(r.url) && /^(PATCH|POST|PUT|DELETE)$/.test(r.method)).length;
    const dbP = (await admin.from("vault_items").select("is_public").eq("id", PRIV).maybeSingle()).data;
    check("[export] exporting the photo published nothing: the item is still private and no write to the item was made", dbP.is_public === false && w1 === w0, { is_public: dbP.is_public, writes: w1 - w0 });

    // ---- B. public-link sharing needs a successful visibility save ----
    const prompt0 = await S.evaluate("!!([...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Yes')) && !document.querySelector('input[aria-label^=\"Link to this\"]')");
    check("[public link] for a private item the panel asks first (no link is shown yet)", prompt0 === true, prompt0);
    blockWrites = true;
    await S.evaluate("[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Yes').click(); true"); await sleep(5000);
    const afterFail = await S.evaluate("({ link: !!document.querySelector('input[aria-label^=\"Link to this\"]'), text: [...document.querySelectorAll('[role=dialog]')].map((d) => d.innerText).join(' ').split('\\n').join(' | ').slice(0, 400) })");
    const dbFail = (await admin.from("vault_items").select("is_public").eq("id", PRIV).maybeSingle()).data;
    check("[public link] when the visibility save FAILS the item stays private, no link is shown", afterFail.link === false && dbFail.is_public === false, { afterFail, db: dbFail });
    info("message shown after the failed save", afterFail.text.slice(-260));
    blockWrites = false;
    await S.evaluate("[...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Yes') && [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Yes').click(); true"); await sleep(6000);
    const afterOk = await S.evaluate("(document.querySelector('input[aria-label^=\"Link to this\"]') || {}).value || ''");
    const dbOk = (await admin.from("vault_items").select("is_public").eq("id", PRIV).maybeSingle()).data;
    check("[public link] once the save succeeds the link appears and the item is public", /\/share\//.test(afterOk) && dbOk.is_public === true, { afterOk, db: dbOk });
    await admin.from("vault_items").update({ is_public: false }).eq("id", PRIV); // put the fixture back to private
    await S.send("Fetch.disable");

    // ---- C. Guest View exhibition stays out of discovery ----
    const V = await browser(BASE, { withSession: false });
    try {
      await V.go("/discover"); await V.waitFor("document.body.innerText.length > 500", 120000, "Discover"); await sleep(9000);
      const dt = await V.text();
      info("discover: does it list the PUBLIC control?", dt.includes("QA Share Public Exhibition"));
      check("[discovery] the Guest View exhibition does NOT appear on Discover", !dt.includes("QA Share Guest Exhibition"), dt.slice(0, 120));
      if (dt.includes("QA Share Public Exhibition")) check("[discovery] the Public exhibition (control) DOES appear on Discover", true);
      const anon = anonClient();
      const list = (await anon.from("galleries").select("id,title").eq("visibility", "PUBLIC").eq("state", "ACTIVE").limit(200)).data || [];
      check("[discovery] the same query Discover uses returns the Public exhibition and never the Guest View one", list.some((g) => g.id === GP.id) && !list.some((g) => g.id === GG.id), { n: list.length });
      const direct = (await anon.from("galleries").select("id").eq("id", GG.id)).data || [];
      check("[discovery] a signed-out visitor cannot read the Guest View exhibition's row directly (only through its link)", direct.length === 0, direct);

      // ---- D. public responses exclude private fields ----
      const bad = Object.values(SENT);
      const rpcItems = (await anon.rpc("get_gallery_items_by_share_token", { p_token: GG.public_token })).data || [];
      const rpcGal = (await anon.rpc("get_gallery_by_share_token", { p_token: GG.public_token })).data || [];
      const rpcJson = JSON.stringify([rpcItems, rpcGal]);
      check("[public data] the share-link responses carry none of the private values (notes, storage, source, order no., serial no., grader)", rpcItems.length >= 1 && !bad.some((s) => rpcJson.includes(s)), { rows: rpcItems.length, keys: Object.keys(rpcItems[0] || {}).slice(0, 40) });
      // current_value, reserve_price, buy_it_now_price and the auction_* columns are on the public whitelist ON PURPOSE (public profile / market pages show a value; auctions show their terms)
      const forbiddenKeys = ["notes", "purchase_price", "purchase_source", "purchase_tax", "purchase_shipping", "purchase_fees", "order_number", "storage_location", "serial_number", "comic_grading_company"];
      const keys = new Set(rpcItems.flatMap((r) => Object.keys(r || {})));
      check("[public data] the share-link item rows do not even have the private columns", !forbiddenKeys.some((k) => keys.has(k)), [...keys].filter((k) => forbiddenKeys.includes(k)));
      // a PRIVATE profile's items are hidden from the public item view by design, so the profile is made public for this one read and put back
      const origProf = (await admin.from("profiles").select("is_public").eq("id", P).maybeSingle()).data;
      await admin.from("profiles").update({ is_public: true }).eq("id", P); await sleep(1500);
      const view = (await anon.from("public_vault_items").select("*").eq("id", PUB)).data || [];
      const privView0 = (await anon.from("public_vault_items").select("id").eq("id", PRIV)).data || [];
      await admin.from("profiles").update({ is_public: origProf.is_public }).eq("id", P);
      const vkeys = Object.keys(view[0] || {});
      check("[public data] the public item view for a PUBLIC item has none of the private columns or values", view.length === 1 && !forbiddenKeys.some((k) => vkeys.includes(k)) && !bad.some((s) => JSON.stringify(view).includes(s)), vkeys);
      const privView = privView0;
      const rawTable = await anon.from("vault_items").select("id").eq("id", PUB);
      check("[public data] the PRIVATE item is not in the public view and the raw items table is closed to visitors", privView.length === 0 && ((rawTable.data || []).length === 0 || !!rawTable.error), { privView: privView.length, raw: rawTable.error?.message || (rawTable.data || []).length });
      await V.go("/museum/share/" + GG.public_token); await V.waitFor("document.body.innerText.includes('QA Share Guest Exhibition')", 90000, "visitor page"); await sleep(6000);
      const page = await V.evaluate("document.documentElement.outerHTML + ' ' + document.body.innerText");
      check("[public data] the visitor page (text and HTML) contains none of the private values or prices", !bad.some((s) => page.includes(s)) && !/\$\s?(77|123)\b/.test(await V.text()), bad.filter((s) => page.includes(s)));
    } finally { await V.close(); }

    // ---- E. switching the exhibition to Private invalidates its old visitor link ----
    await S.go("/museum/" + GG.id); await S.waitFor("document.body.innerText.includes('Edit/Add')", 120000); await sleep(3000);
    await S.clickText("Private"); await sleep(5000);
    const gNow = (await admin.from("galleries").select("visibility,state,public_token").eq("id", GG.id).maybeSingle()).data;
    check("[private] choosing Private on the exhibition page makes it Private (locked)", gNow.visibility === "LOCKED", gNow);
    const V2 = await browser(BASE, { withSession: false });
    try {
      await V2.go("/museum/share/" + GG.public_token); await sleep(10000);
      const t2 = await V2.text();
      check("[private] the old visitor link now shows 'not available' and none of the exhibition", /Link not available|invalid or no longer available/i.test(t2) && !t2.includes("QA Share Public Item"), t2.split("\n").join(" | ").slice(0, 200));
      const rpc2 = (await anonClient().rpc("get_gallery_items_by_share_token", { p_token: GG.public_token })).data || [];
      check("[private] and the data call for the old link returns nothing", rpc2.length === 0, rpc2.length);
    } finally { await V2.close(); }

    // ---- F. the alias limitation, as displayed ----
    await S.go("/museum/" + GP.id); await S.waitFor("document.querySelector('[aria-label=\"Alias help\"]')", 120000); await sleep(2500);
    await S.clickSel('[aria-label="Alias help"]'); await sleep(700);
    const aliasHelp = await S.evaluate("(document.getElementById('gallery-alias-info') || {}).innerText || ''");
    info("alias help text shown in the app", aliasHelp);
    check("[alias] the in-app alias help makes only the narrow claim (hides the real NAME on this exhibition's public page) and promises no anonymity", /Hides your real name on THIS exhibition's public page/.test(aliasHelp) && !/anonymous|untraceable|cannot be (linked|traced|identified)|private identity|completely hidden/i.test(aliasHelp), aliasHelp);
  } catch (e) { console.log("STOPPED", e.message); try { await S.shot("share2-stop.png"); await S.c.captureDiag(String(e.message), "share2-diag"); } catch { /* ignore */ } fail++; }
  finally {
    try { await S.send("Fetch.disable"); } catch { /* ignore */ }
    await S.close();
    await admin.from("gallery_items").delete().in("gallery_id", [GG.id, GP.id]);
    await admin.from("galleries").delete().in("id", [GG.id, GP.id]);
    await admin.from("vault_items").delete().eq("profile_id", P).like("id", "qa_sh_%");
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
