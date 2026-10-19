// ITM visibility + the public/private boundary: /share/[itemId] as visitor, owner and unrelated viewer; the public_vault_items view and direct table reads as anon and as another signed-in user.
const X = require("./audit-s-itm-lib.cjs");
const { mclick, byText, byLabel, ESC, text, dbItem, dbWait, mkItem, sleep, admin, dismissBanner, m } = X;
const J = require("./journey-lib.cjs");
const anonSb = () => J.createClient(J.env.NEXT_PUBLIC_SUPABASE_URL, J.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const BASE = X.BASE;
const SECRETS = { notes: "SECRET-NOTE-QA", order: "SECRET-ORDER-QA", loc: "SECRET-LOC-QA", source: "SECRET-SOURCE-QA" };
(async () => {
  const { ck, nt, out } = X.makeCk(() => cur, {});
  let cur = null;
  const richPrivate = { purchase_price: 123.45, purchase_tax: 9, notes: SECRETS.notes, order_number: SECRETS.order, storage_location: SECRETS.loc, purchase_source: SECRETS.source, current_value: 777, description: "PUBLIC-DESC-QA", grade: "9.6", cert_number: "CERT-PUB-1" };
  const pub = await mkItem("vpub", { ...richPrivate, is_public: true, title: "QA ITM public share item" });
  const priv = await mkItem("vpriv", { ...richPrivate, is_public: false, title: "QA ITM private share item" });
  const sup = await mkItem("vsup", { ...richPrivate, is_public: true, title: "QA ITM supply box", universe: "MISC", category: "SUPPLIES", category_label: "Supplies & Display" });
  const PGs = (who, extra = "") => `/share/[itemId] | ${who}${extra ? ", " + extra : ""}`;
  const leak = (s) => Object.entries(SECRETS).filter(([k, v]) => s.includes(v)).map(([k]) => k);
  const rawGet = async (path, headers = {}) => { const r = await fetch(BASE + path, { headers, redirect: "manual" }); return { status: r.status, body: await r.text() }; };
  try {
    // ---------- 1. raw server responses (what any visitor/crawler gets), no browser session ----------
    let r = await rawGet(`/share/${priv}`);
    await ck(r.status === 404 && leak(r.body).length === 0 && !r.body.includes("QA ITM private share item"), { page: PGs("signed-out raw request", "PRIVATE item"), control: "Direct /share link to a private item", expected: "404, with no title, description, price or private text in the response body", actual: `status=${r.status}; private strings in body=${leak(r.body).join(",") || "none"}; title in body=${r.body.includes("QA ITM private share item")}`, evidence: "itm-privacy-1440.log", impact: "privacy/data loss", repro: "Request /share/<private item id> with no cookies" });
    r = await rawGet(`/share/${pub}`);
    const hasTitle = r.body.includes("QA ITM public share item"), hasDesc = r.body.includes("PUBLIC-DESC-QA");
    await ck(r.status === 200 && hasTitle && hasDesc, { page: PGs("signed-out raw request", "PUBLIC item"), control: "Direct /share link to a public item", expected: "200 with the title and the owner's public description", actual: `status=${r.status}; title=${hasTitle}; description=${hasDesc}`, repro: "Request /share/<public item id>" });
    const l1 = leak(r.body);
    await ck(l1.length === 0 && !/123\.45|\b777\b|Total cost|purchase_price|"notes"/i.test(r.body.replace(/\b777\d*px/g, "")), { page: PGs("signed-out raw request", "PUBLIC item with private fields filled"), control: "Public /share page body (private fields)", expected: "No notes, order number, storage location, purchase source, purchase price (123.45) or value (777) anywhere in the HTML/flight data", actual: `leaked private text=[${l1.join(",") || "none"}]; price/value/field-name match=${/123\.45|\b777\b|purchase_price/i.test(r.body)}`, evidence: "itm-privacy-1440.log", impact: "privacy/data loss", repro: "Fetch /share/<public id> and search the body" });
    r = await rawGet(`/share/${sup}`);
    await ck(r.status === 404, { page: PGs("signed-out raw request", "public SUPPLY item"), control: "Direct /share link to a supply item (Supplies & Display) marked public", expected: "404: supplies are never shared", actual: `status=${r.status}`, repro: "Mark a Supplies & Display item public; open its /share link", impact: "privacy/data loss" });
    r = await rawGet(`/share/qa_does_not_exist_${m.stamp}`);
    await ck(r.status === 404, { page: PGs("signed-out raw request", "unknown id"), control: "/share link with an id that does not exist", expected: "404 (same as a private item: no way to tell them apart)", actual: `status=${r.status}`, repro: "Request a random id" });

    // ---------- 2. in a browser: visitor, owner, unrelated viewer ----------
    for (const [kind, label] of [["visitor", "signed out"], ["owner", "owner"], ["viewer", "unrelated viewer"]]) {
      const S = await X.S_(kind, { width: 1440, height: 900 }); cur = S;
      try {
        // watch every response body for secrets
        const bodies = []; const reqIds = new Map();
        S.c.on(async (e) => { if (e.method === "Network.responseReceived" && /(vltd\.app|supabase\.co)/.test(e.params.response.url) && /json|html|text|javascript/.test(e.params.response.mimeType || "")) reqIds.set(e.params.requestId, e.params.response.url); });
        await S.visit(`/share/${priv}`);
        let t = await text(S);
        const privShown = t.includes("QA ITM private share item") || leak(t).length > 0;
        await ck(!privShown && /not found|404|could not be found/i.test(t), { page: PGs(label, "PRIVATE item"), control: "Open a private item's /share link", expected: "A not-found page; nothing about the item is shown (title, description, photo, notes)", actual: `title/private text visible=${privShown}; page says: ${t.slice(0, 120)}`, repro: `As ${label}: open /share/<private item id>` });
        await S.visit(`/share/${pub}`);
        t = await text(S);
        const shot = await S.jshot(`itm-share-public-${kind}`);
        await ck(t.includes("QA ITM public share item") && t.includes("PUBLIC-DESC-QA") && /9\.6/.test(t) && leak(t).length === 0 && !/\$\s?777|123\.45/.test(t), { page: PGs(label, "PUBLIC item with private fields filled"), control: "Open a public item's /share link", expected: "Title, grade 9.6 and public description show; purchase price, value, notes, order number, storage location do not", actual: `title=${t.includes("QA ITM public share item")} desc=${t.includes("PUBLIC-DESC-QA")} grade=${/9\.6/.test(t)}; private text=[${leak(t).join(",") || "none"}]; price/value shown=${/\$\s?777|123\.45/.test(t)}`, evidence: shot, impact: "privacy/data loss", repro: `As ${label}: open /share/<public item id>` });
        // network: any supabase call from the page that returned private fields
        let netLeak = []; let n = 0;
        for (const [id, url] of reqIds) { try { const b = await S.send("Network.getResponseBody", { requestId: id }); n++; const body = b.body || ""; const lk = leak(body); if (lk.length) netLeak.push(url.slice(0, 80) + " -> " + lk.join(",")); } catch {} }
        await ck(netLeak.length === 0, { page: PGs(label, "PUBLIC item"), control: "Network responses while viewing /share (private fields)", expected: "No response the page received contains the private notes/order/location/source", actual: `${n} responses inspected; leaks=${netLeak.join("; ") || "none"}`, impact: "privacy/data loss", repro: "Open the public share page with the network log on" });
        // links on the page
        const links = await S.evaluate(`[...document.querySelectorAll('a')].map(a => ({ t: (a.innerText||'').trim().slice(0,30), h: a.getAttribute('href') }))`);
        nt({ page: PGs(label), control: "Share page links", expected: "Observation: " + links.map((l) => `${l.t}=>${(l.h || "").slice(0, 60)}`).join(" ; "), actual: "listed", impact: "none", repro: "n/a" });
      } finally { await S.close(); }
    }

    // ---------- 3. database boundary: anon and another signed-in user ----------
    const probe = async (sb, who) => {
      const v = await sb.from("public_vault_items").select("*").in("id", [pub, priv, sup]);
      const t1 = await sb.from("vault_items").select("id,purchase_price,notes,order_number,storage_location,purchase_source,purchase_tax").in("id", [pub, priv, sup]);
      return { who, view: v, tbl: t1 };
    };
    const anon = anonSb();
    const A = await probe(anon, "anon");
    const viewerSb = anonSb(); const vs = await viewerSb.auth.signInWithPassword({ email: m.k.email, password: JSON.parse(require("fs").readFileSync(J.MANIFEST, "utf8")).k.password });
    const V = await probe(viewerSb, "viewer");
    const ownerSb = anonSb(); const os = await ownerSb.auth.signInWithPassword({ email: m.email, password: m.password });
    const O = await probe(ownerSb, "owner");
    for (const P of [A, V]) {
      const viewIds = (P.view.data || []).map((x) => x.id);
      const keys = (P.view.data || [])[0] ? Object.keys(P.view.data[0]) : [];
      const bad = keys.filter((k) => /purchase|notes|order|storage|serial|tax|ship|fees|sold_price|asking/i.test(k));
      await ck(viewIds.includes(pub) && !viewIds.includes(priv) && !viewIds.includes(sup) === true || (viewIds.includes(pub) && !viewIds.includes(priv)), { page: `public_vault_items view | ${P.who}`, control: "Rows returned by the public view", expected: "Only the public item (not the private one); supply item may appear (it is public) but is filtered by the pages", actual: `ids returned=${viewIds.map((i) => i.split("_").slice(-1)[0]).join(",")}; error=${P.view.error?.message || "none"}`, impact: "privacy/data loss", repro: `${P.who}: select * from public_vault_items where id in (...)` });
      await ck(bad.length === 0, { page: `public_vault_items view | ${P.who}`, control: "Columns exposed by the public view", expected: "No cost, notes, order number, storage location, serial, fee, asking or sold-price columns", actual: `columns=${keys.length}; sensitive columns present=[${bad.join(",") || "none"}]`, impact: "privacy/data loss", repro: "Read the keys of a row from public_vault_items" });
      const rows = P.tbl.data || [];
      const pubRow = rows.find((x) => x.id === pub), privRow = rows.find((x) => x.id === priv);
      await ck(!privRow, { page: `vault_items table (REST) | ${P.who}`, control: "Direct table read of a PRIVATE item's private columns", expected: "Row-level security returns nothing for another person's private item", actual: privRow ? `RETURNED private columns: ${JSON.stringify(privRow).slice(0, 160)}` : `no row (error=${P.tbl.error?.message || "none"})`, impact: "privacy/data loss", repro: `${P.who}: select purchase_price,notes,... from vault_items where id=<private id>` });
      const leaks = pubRow ? Object.entries(pubRow).filter(([k, v]) => k !== "id" && v !== null && v !== undefined).map(([k]) => k) : [];
      await ck(!pubRow || leaks.length === 0, { page: `vault_items table (REST) | ${P.who}`, control: "Direct table read of a PUBLIC item's private columns (purchase price, notes, order number, storage, source, tax)", expected: "Another person cannot read a public item's cost/notes/order/storage columns from the base table (only the public view is meant for that)", actual: pubRow ? `table returned private columns to ${P.who}: ${leaks.join(",")} (notes=${pubRow.notes}, order=${pubRow.order_number}, price=${pubRow.purchase_price})` : "no row returned", evidence: "itm-privacy-1440.log", impact: "privacy/data loss", repro: `${P.who} (REST, anon key): select purchase_price,notes,order_number,storage_location from vault_items where id=<public item id>` });
    }
    await ck((O.tbl.data || []).length === 3, { page: "vault_items table (REST) | owner", control: "Owner reads their own rows", expected: "The owner sees all three of their own items", actual: `rows=${(O.tbl.data || []).length}`, repro: "Owner REST select" });

    // ---------- 4. owner flips the eye (plain item, in no exhibit) ----------
    const S = await X.S_("owner", { width: 1440, height: 900 }); cur = S;
    try {
      const id = await mkItem("veye", { ...richPrivate, is_public: false, title: "QA ITM eye item" });
      await X.openItem(S, id); await dismissBanner(S);
      let t = await text(S);
      await ck(/Private/i.test(t) && !!(await S.evaluate(`document.querySelector('button[aria-label="Make item public"]')`)), { page: "/vault/item/[id] | owner, Personal, desktop 1440, private item in no exhibit", control: "Visibility eye (private state)", expected: "Reads Private with a 'Make item public' button", actual: (t.match(/Visibility.{0,160}/) || [""])[0], repro: "Open a private item" });
      await mclick(S, byLabel("^Make item public$")); await sleep(1800);
      let d = await dbWait(id, (r) => r.is_public === true, 25000);
      await ck(d.ok && !!(await S.evaluate(`document.querySelector('button[aria-label="Make item private"]')`)), { page: "/vault/item/[id] | owner, Personal, desktop 1440", control: "Visibility eye -> Make item public", expected: "The account has is_public=true and the control now offers 'Make item private'", actual: `db is_public=${d.row.is_public}`, repro: "Click the eye on a private item" });
      let rr = await rawGet(`/share/${id}`);
      await ck(rr.status === 200 && leak(rr.body).length === 0, { page: PGs("signed-out raw request", "item just made public"), control: "Share link right after Make item public", expected: "The link now works (200) and still shows no private fields", actual: `status=${rr.status}; leaks=[${leak(rr.body).join(",") || "none"}]`, repro: "Make item public; open its /share link signed out" });
      const view = await anonSb().from("public_vault_items").select("id").eq("id", id);
      await ck((view.data || []).length === 1, { page: "public_vault_items view | anon", control: "Item appears in the public view after being made public", expected: "1 row", actual: `rows=${(view.data || []).length}`, repro: "Make public; query the view" });
      await mclick(S, byLabel("^Make item private$")); await sleep(1800);
      d = await dbWait(id, (r) => r.is_public === false, 25000);
      await ck(d.ok, { page: "/vault/item/[id] | owner", control: "Visibility eye -> Make item private", expected: "is_public=false in the account", actual: `db is_public=${d.row.is_public}`, repro: "Click the eye on a public item" });
      rr = await rawGet(`/share/${id}`);
      await ck(rr.status === 404 && leak(rr.body).length === 0, { page: PGs("signed-out raw request", "item just made private again"), control: "Share link right after Make item private", expected: "404 immediately: an old link stops working", actual: `status=${rr.status}`, impact: "privacy/data loss", repro: "Make private; reload the old /share link" });
      const view2 = await anonSb().from("public_vault_items").select("id").eq("id", id);
      await ck((view2.data || []).length === 0, { page: "public_vault_items view | anon", control: "Item leaves the public view after being made private", expected: "0 rows", actual: `rows=${(view2.data || []).length}`, impact: "privacy/data loss", repro: "Make private; query the view" });
      // reload keeps the choice
      await X.openItem(S, id); t = await text(S);
      await ck(!!(await S.evaluate(`document.querySelector('button[aria-label="Make item public"]')`)), { page: "/vault/item/[id] | owner", control: "Visibility after reload", expected: "Still private after reload", actual: (t.match(/Visibility.{0,140}/) || [""])[0], repro: "Reload" });

      // exhibit item: the eye controls the exhibit view only
      await X.openItem(S, X.ID.valued); await dismissBanner(S);
      await mclick(S, byLabel("^Hide this item in your exhibits$")); await sleep(900);
      t = await text(S);
      const dlg = await S.evaluate(`(() => { const d = document.querySelector('[role=dialog]'); return d ? d.innerText.replace(/\\s+/g,' ').slice(0,260) : ''; })()`);
      await ck(dlg.length > 0, { page: "/vault/item/[id] | owner, item inside exhibits", control: "Visibility eye on an item that is in an exhibit", expected: "Asks for confirmation before hiding the item in exhibits", actual: dlg || t.slice(0, 160), repro: "Open an item that is in an exhibition; click the eye" });
      await mclick(S, byText("^Cancel$", "[role=dialog] button")); await sleep(700);
      d = await dbItem(X.ID.valued);
      await ck(d.is_public === false && !!(await S.evaluate(`document.querySelector('button[aria-label="Hide this item in your exhibits"]')`)), { page: "/vault/item/[id] | owner, item inside exhibits", control: "Exhibit-hide confirmation -> Cancel", expected: "Cancel leaves the item shown in its exhibits and private to the world", actual: `is_public=${d.is_public}; eye label still 'Hide...' = ${!!(await S.evaluate(`document.querySelector('button[aria-label="Hide this item in your exhibits"]')`))}`, repro: "Click the eye; Cancel" });
    } finally { await S.close(); }

    // ---------- 5. other people on the owner-only pages ----------
    for (const kind of ["visitor", "viewer"]) {
      const S2 = await X.S_(kind, { width: 1440, height: 900 }); cur = S2;
      try {
        for (const p of [`/vault/item/${priv}`, `/vault/item/${priv}/present`, `/vault/item/${pub}`]) {
          await S2.visit(p); await sleep(1500);
          const t = await text(S2); const path = await S2.path();
          const exposed = leak(t).length > 0 || t.includes("QA ITM private share item") || t.includes("QA ITM public share item") || /\$\s?777|123\.45/.test(t);
          await ck(!exposed, { page: `${p.replace(/qa_vz_[a-z0-9_]+/, "[id]")} | ${kind === "visitor" ? "signed out" : "unrelated viewer"}`, control: "Owner-only item page opened by someone else", expected: "Sign-in page or 'Item not found'; no title, price, notes or photos of the owner's item (private OR public) are shown", actual: `landed on ${path}; exposed=${exposed}; page: ${t.slice(0, 90)}`, impact: "privacy/data loss", repro: `${kind}: open ${p.replace(/qa_vz_[a-z0-9_]+/, "<id>")}` });
        }
      } finally { await S2.close(); }
    }
    // ---------- 6. public profile page /v/[profileId] ----------
    const prof = (await admin.from("profiles").select("id,is_public,username").eq("id", X.P).single()).data;
    const Sv = await X.S_("visitor", { width: 1440, height: 900 }); cur = Sv;
    try {
      await Sv.visit(`/v/${X.P}`); const t = await text(Sv);
      const showsPub = t.includes("QA ITM public share item"), showsPriv = t.includes("QA ITM private share item"), showsLeak = leak(t).length > 0;
      await ck(!showsPriv && !showsLeak && (prof.is_public ? showsPub : !showsPub), { page: `/v/[profileId] | signed out, profile is_public=${prof.is_public}`, control: "Public vault page", expected: "Private items never show; a public item shows only if the profile itself is public; no private fields", actual: `public item shown=${showsPub}; private item shown=${showsPriv}; leak=${showsLeak}; page: ${t.slice(0, 100)}`, impact: "privacy/data loss", repro: "Signed out: open /v/<profile id>" });
    } finally { await Sv.close(); }
    // ---------- 7. cleanup of the three items is by profile at drop time ----------
  } catch (e) { console.error("SUITE ERROR", e); try { await ck(false, { page: "suite", control: "privacy suite runner", expected: "completes", actual: "script error (test mistake candidate): " + String(e.message).slice(0, 200), impact: "none" }); } catch {} }
  finally { console.log(JSON.stringify(X.sumRows(out))); process.exit(0); }
})();
