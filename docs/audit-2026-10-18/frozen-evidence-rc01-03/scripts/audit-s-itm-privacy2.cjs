// ITM visibility + the public/private boundary, two phases: (1) QA profile PRIVATE (the database hides every item of a private profile), (2) QA profile PUBLIC.
// Checks /share/[itemId] as visitor, owner and unrelated viewer, the public_vault_items view and direct table reads as anon and as another signed-in user.
const X = require("./audit-s-itm-lib.cjs");
const { mclick, byText, byLabel, ESC, text, dbItem, dbWait, mkItem, sleep, admin, dismissBanner, m } = X;
const J = require("./journey-lib.cjs");
const fsx = require("fs");
const mfull = JSON.parse(fsx.readFileSync(J.MANIFEST, "utf8"));
const anonSb = () => J.createClient(J.env.NEXT_PUBLIC_SUPABASE_URL, J.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const BASE = X.BASE;
const SECRETS = { notes: "SECRET-NOTE-QA", order: "SECRET-ORDER-QA", loc: "SECRET-LOC-QA", source: "SECRET-SOURCE-QA" };
const has = (S, sel) => S.evaluate(`!!document.querySelector(${JSON.stringify(sel)})`);
(async () => {
  let cur = null;
  const { ck, nt, out } = X.makeCk(() => cur, {});
  const richPrivate = { purchase_price: 123.45, purchase_tax: 9, notes: SECRETS.notes, order_number: SECRETS.order, storage_location: SECRETS.loc, purchase_source: SECRETS.source, current_value: 777, description: "PUBLIC-DESC-QA", grade: "9.6", cert_number: "CERT-PUB-1" };
  const pub = await mkItem("vpub", { ...richPrivate, is_public: true, title: "QA ITM public share item" });
  const priv = await mkItem("vpriv", { ...richPrivate, is_public: false, title: "QA ITM private share item" });
  const sup = await mkItem("vsup", { ...richPrivate, is_public: true, title: "QA ITM supply box", universe: "MISC", category: "SUPPLIES", category_label: "Supplies & Display" });
  const PGs = (who, extra = "") => `/share/[itemId] | ${who}${extra ? ", " + extra : ""}`;
  const leak = (s) => Object.entries(SECRETS).filter(([k, v]) => s.includes(v)).map(([k]) => k);
  const rawGet = async (path) => { const r = await fetch(BASE + path, { redirect: "manual" }); const body = await r.text(); return { status: r.status, body, notFound: /This page could not be found/.test(body) }; };
  const setProfile = async (pubFlag) => { const u = await admin.from("profiles").update({ is_public: pubFlag, onboarding_completed: true }).eq("id", X.P); if (u.error) throw new Error(u.error.message); await sleep(1500); };
  const dbBoundary = async (phase, expectVisible) => {
    const probe = async (sb) => ({ view: await sb.from("public_vault_items").select("*").in("id", [pub, priv, sup]), tbl: await sb.from("vault_items").select("id,purchase_price,notes,order_number,storage_location,purchase_source,purchase_tax").in("id", [pub, priv, sup]) });
    const anon = anonSb();
    const vsb = anonSb(); await vsb.auth.signInWithPassword({ email: m.k.email, password: mfull.k.password });
    const osb = anonSb(); await osb.auth.signInWithPassword({ email: m.email, password: m.password });
    const A = { who: "anon", ...(await probe(anon)) }, V = { who: "unrelated viewer", ...(await probe(vsb)) }, O = { who: "owner", ...(await probe(osb)) };
    for (const P of [A, V]) {
      const ids = (P.view.data || []).map((x) => x.id);
      const keys = ids.length ? Object.keys(P.view.data[0]) : [];
      const bad = keys.filter((k) => /purchase|notes|order|storage|serial|tax|ship|fees|sold_price|asking/i.test(k));
      await ck(!ids.includes(priv) && (expectVisible ? ids.includes(pub) : !ids.includes(pub)), { page: `public_vault_items view | ${P.who} | ${phase}`, control: "Rows returned by the public view", expected: expectVisible ? "The public item appears; the private item never does" : "Neither the private item nor the public item of a PRIVATE profile appears", actual: `ids returned=${ids.map((i) => i.split("_").slice(-1)[0]).join(",") || "none"}; error=${P.view.error?.message || "none"}`, impact: "privacy/data loss", repro: `${P.who}: select * from public_vault_items where id in (public, private, supply)` });
      if (expectVisible) await ck(keys.length > 0 && bad.length === 0, { page: `public_vault_items view | ${P.who}`, control: "Columns exposed by the public view", expected: "No cost, notes, order number, storage location, serial, fee, asking or sold-price columns", actual: `columns=${keys.length}; sensitive columns=[${bad.join(",") || "none"}]; ${keys.join(",").slice(0, 200)}`, impact: "privacy/data loss", repro: "Read the keys of a row from public_vault_items" });
      const rows = P.tbl.data || []; const pubRow = rows.find((x) => x.id === pub), privRow = rows.find((x) => x.id === priv);
      await ck(!privRow, { page: `vault_items table (REST) | ${P.who} | ${phase}`, control: "Direct table read of a PRIVATE item's private columns", expected: "Nothing is returned for another person's private item", actual: privRow ? `RETURNED: ${JSON.stringify(privRow).slice(0, 160)}` : `no row (error=${P.tbl.error?.message || "none"})`, impact: "privacy/data loss", repro: `${P.who}: select purchase_price,notes,... from vault_items where id=<private id>` });
      const leaks = pubRow ? Object.entries(pubRow).filter(([k, v]) => k !== "id" && v !== null && v !== undefined).map(([k]) => k) : [];
      await ck(!pubRow || leaks.length === 0, { page: `vault_items table (REST) | ${P.who} | ${phase}`, control: "Direct table read of a PUBLIC item's private columns (price, notes, order, storage, source, tax)", expected: "Another person cannot read a public item's cost/notes/order/storage from the base table (only the public view is for that)", actual: pubRow ? `table returned private columns: ${leaks.join(",")} (notes=${pubRow.notes}, order=${pubRow.order_number})` : `no row returned (error=${P.tbl.error?.message || "none"})`, impact: "privacy/data loss", repro: `${P.who}: select purchase_price,notes,order_number,storage_location from vault_items where id=<public item id>` });
    }
    await ck((O.tbl.data || []).length === 3, { page: `vault_items table (REST) | owner | ${phase}`, control: "Owner reads their own rows", expected: "The owner sees all three of their own items", actual: `rows=${(O.tbl.data || []).length}`, repro: "Owner REST select" });
  };
  const shareMatrix = async (phase, expectVisible) => {
    let r = await rawGet(`/share/${priv}`);
    await ck(r.notFound && leak(r.body).length === 0 && !r.body.includes("QA ITM private share item"), { page: PGs("signed-out raw request", `PRIVATE item, ${phase}`), control: "Direct /share link to a private item", expected: "Not-found page; no title, description, price or private text in the response", actual: `not-found page=${r.notFound}; HTTP status=${r.status}; private strings=${leak(r.body).join(",") || "none"}; title in body=${r.body.includes("QA ITM private share item")}`, impact: "privacy/data loss", repro: "Request /share/<private item id> with no cookies" });
    r = await rawGet(`/share/${pub}`);
    const hasTitle = r.body.includes("QA ITM public share item"), hasDesc = r.body.includes("PUBLIC-DESC-QA");
    await ck(expectVisible ? (hasTitle && hasDesc && !r.notFound) : (r.notFound && !hasTitle), { page: PGs("signed-out raw request", `PUBLIC item, ${phase}`), control: "Direct /share link to a public item", expected: expectVisible ? "Title and the owner's public description are shown" : "Not-found: the profile is private so none of its items are shared", actual: `not-found page=${r.notFound}; title=${hasTitle}; description=${hasDesc}`, repro: "Request /share/<public item id>" });
    const l1 = leak(r.body);
    await ck(l1.length === 0 && !/123\.45|purchase_price|"notes"/i.test(r.body), { page: PGs("signed-out raw request", `PUBLIC item with private fields filled, ${phase}`), control: "/share page body (private fields)", expected: "No notes, order number, storage location, purchase source, purchase price (123.45) anywhere in the HTML/flight data", actual: `leaked private text=[${l1.join(",") || "none"}]; price/field-name match=${/123\.45|purchase_price/i.test(r.body)}; value 777 present=${/\b777\b/.test(r.body)}`, impact: "privacy/data loss", repro: "Fetch /share/<public id> and search the body" });
    r = await rawGet(`/share/${sup}`);
    await ck(r.notFound, { page: PGs("signed-out raw request", `public SUPPLY item, ${phase}`), control: "Direct /share link to a Supplies & Display item marked public", expected: "Not-found: supplies are never shared", actual: `not-found page=${r.notFound}`, impact: "privacy/data loss", repro: "Mark a Supplies & Display item public; open its /share link" });
    r = await rawGet(`/share/qa_does_not_exist_${m.stamp}`);
    await ck(r.notFound, { page: PGs("signed-out raw request", `unknown id, ${phase}`), control: "/share link with an id that does not exist", expected: "Not-found page (same as a private item)", actual: `not-found page=${r.notFound}; HTTP status=${r.status}`, repro: "Request a random id" });
    nt({ page: PGs("signed-out raw request", phase), control: "HTTP status of a not-found /share page", expected: "Improvement note: a private, unknown or hidden item returns the not-found page with HTTP " + r.status + " (streamed page), not 404, so crawlers see a normal page", actual: `status=${r.status}`, impact: "improvement", repro: "curl -i /share/<unknown id>" });
    for (const [kind, label] of [["visitor", "signed out"], ["owner", "owner"], ["viewer", "unrelated viewer"]]) {
      const S = await X.S_(kind, { width: 1440, height: 900 }); cur = S;
      try {
        const reqIds = new Map();
        S.c.on((e) => { if (e.method === "Network.responseReceived" && /(vltd\.app|supabase\.co)/.test(e.params.response.url) && /json|html|text|javascript/.test(e.params.response.mimeType || "")) reqIds.set(e.params.requestId, e.params.response.url); });
        await S.visit(`/share/${priv}`);
        let t = await text(S);
        const privShown = t.includes("QA ITM private share item") || leak(t).length > 0;
        await ck(!privShown && /could not be found/i.test(t), { page: PGs(label, `PRIVATE item, ${phase}`), control: "Open a private item's /share link", expected: "A not-found page; nothing about the item is shown", actual: `title/private text visible=${privShown}; page: ${t.slice(60, 140)}`, impact: "privacy/data loss", repro: `As ${label}: open /share/<private item id>` });
        await S.visit(`/share/${pub}`);
        t = await text(S);
        const shot = await S.jshot(`itm-share-${phase.replace(/\W+/g, "-")}-${kind}`);
        const okVis = t.includes("QA ITM public share item") && t.includes("PUBLIC-DESC-QA") && /9\.6/.test(t);
        await ck((expectVisible ? okVis : /could not be found/i.test(t)) && leak(t).length === 0 && !/\$\s?777|123\.45/.test(t), { page: PGs(label, `PUBLIC item with private fields filled, ${phase}`), control: "Open a public item's /share link", expected: expectVisible ? "Title, grade 9.6 and public description show; price, value, notes, order number, storage location do not" : "Not found (private profile); no private field shown", actual: `title=${t.includes("QA ITM public share item")} desc=${t.includes("PUBLIC-DESC-QA")} grade=${/9\.6/.test(t)}; private text=[${leak(t).join(",") || "none"}]; price/value shown=${/\$\s?777|123\.45/.test(t)}; page: ${t.slice(60, 120)}`, evidence: shot, impact: "privacy/data loss", repro: `As ${label}: open /share/<public item id>` });
        let netLeak = [], n = 0;
        for (const [id, url] of reqIds) { try { const b = await S.send("Network.getResponseBody", { requestId: id }); n++; const lk = leak(b.body || ""); if (lk.length || /123\.45/.test(b.body || "")) netLeak.push(url.slice(0, 80) + " -> " + lk.join(",")); } catch {} }
        await ck(netLeak.length === 0, { page: PGs(label, `PUBLIC item, ${phase}`), control: "Network responses while viewing /share", expected: "No response the page received contains the private notes/order/location/source or the purchase price", actual: `${n} responses inspected; leaks=${netLeak.join("; ") || "none"}`, impact: "privacy/data loss", repro: "Open the share page with the network log on" });
      } finally { await S.close(); }
    }
  };
  try {
    // ================= phase 1: profile private =================
    await setProfile(false);
    await shareMatrix("profile private", false);
    await dbBoundary("profile private", false);
    // the owner flips the eye and copies the link while the profile is private
    let S = await X.S_("owner", { width: 1440, height: 900 }); cur = S;
    try {
      const id = await mkItem("veye", { ...richPrivate, is_public: false, title: "QA ITM eye item" });
      await X.openItem(S, id); await dismissBanner(S);
      await mclick(S, byLabel("^Make item public$")); await sleep(2000);
      let d = await dbWait(id, (r) => r.is_public === true, 25000);
      await mclick(S, byLabel("^Share this item$")); await sleep(900);
      const dlg = await S.evaluate(`(() => { const d = document.querySelector('[role=dialog]'); return d ? d.innerText.replace(/\\s+/g,' ').slice(0,400) : ''; })()`);
      const rr = await rawGet(`/share/${id}`);
      const warns = /private|hidden|profile/i.test(dlg);
      await ck(!(rr.notFound && !warns), { page: "/vault/item/[id] | owner, Personal (profile PRIVATE), item public", control: "Share panel for a public item whose profile is private", expected: "If the link cannot be seen by anyone (profile private), the panel says so; it must not present a working-looking link that leads to Not found", actual: `item public in db=${d.ok}; link opens Not found=${rr.notFound}; panel text mentions private/hidden/profile=${warns}; panel: ${dlg.slice(0, 220)}`, impact: "misleading result", repro: "Profile private; make an item public; open Share; open the link signed out" });
      await ESC(S);
    } finally { await S.close(); }

    // ================= phase 2: profile public =================
    await setProfile(true);
    await shareMatrix("profile public", true);
    await dbBoundary("profile public", true);
    S = await X.S_("owner", { width: 1440, height: 900 }); cur = S;
    try {
      const id = await mkItem("veye2", { ...richPrivate, is_public: false, title: "QA ITM eye item 2" });
      await X.openItem(S, id); await dismissBanner(S);
      let t = await text(S);
      await ck(/Private/i.test(t) && (await has(S, 'button[aria-label="Make item public"]')), { page: "/vault/item/[id] | owner, Personal, desktop 1440, private item in no exhibit", control: "Visibility eye (private state)", expected: "Reads Private with a 'Make item public' button", actual: (t.match(/Visibility.{0,160}/) || [""])[0], repro: "Open a private item" });
      await mclick(S, byLabel("^Make item public$")); await sleep(1800);
      let d = await dbWait(id, (r) => r.is_public === true, 25000);
      await ck(d.ok && (await has(S, 'button[aria-label="Make item private"]')), { page: "/vault/item/[id] | owner, Personal, desktop 1440", control: "Visibility eye -> Make item public", expected: "The account has is_public=true and the control offers 'Make item private'", actual: `db is_public=${d.row.is_public}`, repro: "Click the eye on a private item" });
      let rr = await rawGet(`/share/${id}`);
      await ck(!rr.notFound && rr.body.includes("QA ITM eye item 2") && leak(rr.body).length === 0, { page: PGs("signed-out raw request", "item just made public"), control: "Share link right after Make item public", expected: "The link works and shows no private fields", actual: `not-found=${rr.notFound}; title shown=${rr.body.includes("QA ITM eye item 2")}; leaks=[${leak(rr.body).join(",") || "none"}]`, repro: "Make item public; open its /share link signed out" });
      const view = await anonSb().from("public_vault_items").select("id").eq("id", id);
      await ck((view.data || []).length === 1, { page: "public_vault_items view | anon", control: "Item appears in the public view after being made public", expected: "1 row", actual: `rows=${(view.data || []).length}`, repro: "Make public; query the view" });
      // share panel + clipboard
      await mclick(S, byLabel("^Share this item$")); await sleep(900);
      const dlg = await S.evaluate(`(() => { const d = document.querySelector('[role=dialog]'); return d ? { t: d.innerText.replace(/\\s+/g,' ').slice(0,500), b: [...d.querySelectorAll('button,a')].map(b=>(b.innerText||b.getAttribute('aria-label')||'').trim()).filter(Boolean) } : null; })()`);
      nt({ page: "/vault/item/[id] | owner, public item, profile public", control: "Share panel contents", expected: "Observation: " + (dlg ? dlg.b.join(" | ") : "no dialog"), actual: (dlg?.t || "").slice(0, 200), impact: "none", repro: "Click Share" });
      const copyBtn = dlg ? dlg.b.find((x) => /copy/i.test(x)) : null;
      if (copyBtn) {
        await mclick(S, byText("^" + copyBtn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "[role=dialog] button,[role=dialog] a")); await sleep(600);
        const look = await S.look(); const want = `${BASE}/share/${id}`;
        await ck((look.clip || []).some((c) => c.includes(want)), { page: "/vault/item/[id] | owner, public item", control: `Share panel -> ${copyBtn}`, expected: `The clipboard receives the item's own share link (${want})`, actual: `clipboard writes=${JSON.stringify(look.clip)}`, repro: "Share; Copy link" });
      }
      await ESC(S); await sleep(300);
      await mclick(S, byLabel("^Make item private$")); await sleep(1800);
      d = await dbWait(id, (r) => r.is_public === false, 25000);
      await ck(d.ok, { page: "/vault/item/[id] | owner", control: "Visibility eye -> Make item private", expected: "is_public=false in the account", actual: `db is_public=${d.row.is_public}`, repro: "Click the eye on a public item" });
      rr = await rawGet(`/share/${id}`);
      await ck(rr.notFound && leak(rr.body).length === 0, { page: PGs("signed-out raw request", "item just made private again"), control: "Share link right after Make item private", expected: "Not found immediately: the old link stops working", actual: `not-found=${rr.notFound}`, impact: "privacy/data loss", repro: "Make private; reload the old /share link" });
      const view2 = await anonSb().from("public_vault_items").select("id").eq("id", id);
      await ck((view2.data || []).length === 0, { page: "public_vault_items view | anon", control: "Item leaves the public view after being made private", expected: "0 rows", actual: `rows=${(view2.data || []).length}`, impact: "privacy/data loss", repro: "Make private; query the view" });
      await X.openItem(S, id); t = await text(S);
      await ck(await has(S, 'button[aria-label="Make item public"]'), { page: "/vault/item/[id] | owner", control: "Visibility after reload", expected: "Still private after reload", actual: (t.match(/Visibility.{0,140}/) || [""])[0], repro: "Reload" });
      // exhibit item: the eye controls exhibits only
      await X.openItem(S, X.ID.valued); await dismissBanner(S);
      await mclick(S, byLabel("^Hide this item in your exhibits$")); await sleep(900);
      const dlg2 = await S.evaluate(`(() => { const d = document.querySelector('[role=dialog]'); return d ? d.innerText.replace(/\\s+/g,' ').slice(0,260) : ''; })()`);
      await ck(dlg2.length > 0, { page: "/vault/item/[id] | owner, item inside exhibits", control: "Visibility eye on an item that is in an exhibit", expected: "Asks for confirmation before hiding the item in exhibits", actual: dlg2 || "no confirmation dialog", repro: "Open an item that is in an exhibition; click the eye" });
      await mclick(S, byText("^Cancel$", "[role=dialog] button")); await sleep(700);
      d = await dbItem(X.ID.valued);
      await ck(d.is_public === false && (await has(S, 'button[aria-label="Hide this item in your exhibits"]')), { page: "/vault/item/[id] | owner, item inside exhibits", control: "Exhibit-hide confirmation -> Cancel", expected: "Cancel leaves the item shown in its exhibits and private to the world", actual: `is_public=${d.is_public}; eye still offers 'Hide'=${await has(S, 'button[aria-label="Hide this item in your exhibits"]')}`, repro: "Click the eye; Cancel" });
    } finally { await S.close(); }
    // other people on owner-only pages
    for (const kind of ["visitor", "viewer"]) {
      const S2 = await X.S_(kind, { width: 1440, height: 900 }); cur = S2;
      try {
        for (const p of [`/vault/item/${priv}`, `/vault/item/${priv}/present`, `/vault/item/${pub}`]) {
          await S2.visit(p); await sleep(1500);
          const t = await text(S2); const path = await S2.path();
          const exposed = leak(t).length > 0 || t.includes("QA ITM private share item") || t.includes("QA ITM public share item") || /\$\s?777|123\.45/.test(t);
          await ck(!exposed, { page: `${p.replace(/qa_vz_[a-z0-9_]+/, "[id]")} | ${kind === "visitor" ? "signed out" : "unrelated viewer"}`, control: "Owner-only item page opened by someone else", expected: "Sign-in page or 'Item not found'; no title, price, notes or photos of the owner's item are shown", actual: `landed on ${path}; exposed=${exposed}; page: ${t.slice(0, 90)}`, impact: "privacy/data loss", repro: `${kind}: open ${p.replace(/qa_vz_[a-z0-9_]+/, "<id>")}` });
        }
      } finally { await S2.close(); }
    }
    // public profile page
    const Sv = await X.S_("visitor", { width: 1440, height: 900 }); cur = Sv;
    try {
      await Sv.visit(`/v/${X.P}`); await sleep(1500); const t = await text(Sv);
      const showsPub = t.includes("QA ITM public share item"), showsPriv = t.includes("QA ITM private share item"), showsLeak = leak(t).length > 0 || /123\.45/.test(t);
      await ck(!showsPriv && !showsLeak, { page: "/v/[profileId] | signed out, profile public", control: "Public vault page", expected: "Private items never show; no private fields", actual: `public item shown=${showsPub}; private item shown=${showsPriv}; leak=${showsLeak}; page: ${t.slice(60, 160)}`, impact: "privacy/data loss", repro: "Signed out: open /v/<profile id>" });
      const shot = await Sv.jshot("itm-v-profile-visitor");
      nt({ page: "/v/[profileId] | signed out, profile public", control: "Public vault lists the public item", expected: `Observation: the public item appears on the public vault page = ${showsPub}`, actual: t.slice(60, 200), evidence: shot, impact: "none", repro: "Open /v/<profile id>" });
    } finally { await Sv.close(); }
  } catch (e) { console.error("SUITE ERROR", e); try { await ck(false, { page: "suite", control: "privacy suite runner", expected: "completes", actual: "script error (test mistake candidate): " + String(e.message).slice(0, 200), impact: "none" }); } catch {} }
  finally { try { await setProfile(false); } catch {} console.log(JSON.stringify(X.sumRows(out))); process.exit(0); }
})();
