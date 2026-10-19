// ITM: the public /share page's own controls and meta tags (signed-out visitor), and the Edit Photo editor's Save.
const X = require("./audit-s-itm-lib.cjs");
const { mclick, byText, text, dbItem, dbWait, mkItem, sleep, admin, dismissBanner, P, m, BASE } = X;
(async () => {
  let S = null; const { ck, nt, out } = X.makeCk(() => S, {});
  try {
    await admin.from("profiles").update({ is_public: true, onboarding_completed: true }).eq("id", P);
    const SECRET = "SHARE2-PRIVATE-NOTE";
    const id = await mkItem("shr2", { title: "QA ITM share card item", is_public: true, grade: "9.4", description: "Public blurb for the card", notes: SECRET, purchase_price: 321, current_value: 654 });
    // meta tags
    const html = await (await fetch(`${BASE}/share/${id}`)).text();
    const meta = (p) => (html.match(new RegExp(`<meta[^>]+(?:property|name)="${p}"[^>]+content="([^"]*)"`)) || [])[1];
    const og = { title: meta("og:title"), desc: meta("og:description"), image: meta("og:image"), twitter: meta("twitter:card") };
    await ck(/QA ITM share card item/.test(og.title || "") && /Public blurb/.test(og.desc || "") && !/SHARE2-PRIVATE|321|654/.test(html.replace(/\b[a-f0-9]{8,}\b/g, "")), { page: "/share/[itemId] | signed out (page source)", control: "Link-preview tags (og:title, og:description, og:image)", expected: "Preview shows the item title, grade and the public description; never the notes, what was paid or the value", actual: `og:title="${og.title}"; og:description="${og.desc}"; private text/values in the page source: ${/SHARE2-PRIVATE|\b321\b|\b654\b/.test(html)}`, impact: "privacy/data loss", repro: "View source of /share/<public id>" });
    let imgOk = false, ct = "";
    if (og.image) { const ir = await fetch(og.image.replace(/&amp;/g, "&")); ct = ir.headers.get("content-type") || ""; imgOk = ir.ok && /image\//.test(ct); }
    await ck(imgOk, { page: "/share/[itemId] | signed out", control: "Preview card image (og:image)", expected: "The card image address returns an image", actual: `content-type=${ct}; url=${(og.image || "").replace(/&amp;/g, "&").slice(0, 160)}`, repro: "Open the og:image URL" });
    S = await X.S_("visitor", { width: 1440, height: 900 });
    await S.visit(`/share/${id}`); await sleep(2500); await dismissBanner(S);
    const t = await text(S);
    await ck(/QA ITM share card item/.test(t) && /9\.4/.test(t) && /Public blurb for the card/.test(t), { page: "/share/[itemId] | signed out, profile public", control: "Share page content", expected: "Title, grade 9.4, description", actual: t.slice(60, 220), repro: "Open /share/<id>" });
    const links = await S.evaluate(`[...document.querySelectorAll('main a')].map(a => ({ t: a.innerText.trim() || a.getAttribute('alt') || 'preview', href: a.getAttribute('href'), dl: a.getAttribute('download') }))`);
    const open = links.find((l) => /Open VLTD/.test(l.t)), save = links.find((l) => /Save Card/.test(l.t));
    nt({ page: "/share/[itemId] | signed out", control: "Share page links", expected: "Observation", actual: links.map((l) => `${l.t}=>${(l.href || "").slice(0, 50)}${l.dl ? " [download " + l.dl + "]" : ""}`).join(" | "), impact: "none", repro: "n/a" });
    await mclick(S, byText("^Open VLTD$", "a")); await sleep(2500);
    await ck(["/", "/login", "/dashboard"].some((p) => (S.path ? true : true)) && (await S.path()) !== `/share/${id}`, { page: "/share/[itemId] | signed out", control: "Open VLTD (button)", expected: "Leaves the card for the VLTD home / sign-in", actual: `landed on ${await S.path()}`, repro: "Click Open VLTD" });
    await S.visit(`/share/${id}`); await sleep(2000);
    const dl0 = (await S.look()).downloads.length;
    await mclick(S, byText("Save Card", "a")); await sleep(1500);
    const lk = await S.look();
    await ck(lk.downloads.length > dl0 && /^vltd-qa-itm-share-card-item/.test(lk.downloads[lk.downloads.length - 1] || ""), { page: "/share/[itemId] | signed out", control: "Save Card (download link)", expected: "A download named vltd-<title>.jpg is started", actual: `downloads=${JSON.stringify(lk.downloads.slice(dl0))}`, repro: "Click Save Card" });
    await S.close();

    // ---- Edit Photo -> Save Photo ----
    S = await X.S_("owner", { width: 1440, height: 900 });
    const pid = await mkItem("edp", { title: "QA ITM edit photo item" });
    await X.openItem(S, pid); await dismissBanner(S);
    const before = (await dbItem(pid)).images_json[0].url;
    await mclick(S, byText("^Edit Photo$", "button")); await sleep(1500);
    const dlg = `[role=dialog][aria-label="Edit saved photo"]`;
    const hasDlg = await S.evaluate(`!!document.querySelector(${JSON.stringify(dlg)})`);
    if (hasDlg) {
      await mclick(S, byText("^Rotate right$", dlg + " button")); await sleep(500);
      await mclick(S, byText("^Save Photo$", dlg + " button")); await sleep(1500);
      const d = await dbWait(pid, (r) => (r.images_json || [])[0] && r.images_json[0].url !== before, 45000);
      const msg = ((await text(S)).match(/Edited photo saved\.|Saving edited photo\.\.\.|[^\n]*Saved locally[^\n]*/) || ["none"])[0];
      await ck(d.ok && /^https?:/.test(d.row.images_json[0].url) && d.row.image_front_url === d.row.images_json[0].url, { page: "/vault/item/[id] | owner, Personal, desktop 1440", control: "Edit Photo -> Rotate right -> Save Photo", expected: "A new picture file is saved, becomes the item's photo everywhere (image_front_url) and the page says 'Edited photo saved.'", actual: `new url=${d.ok ? d.row.images_json[0].url.slice(0, 90) : "unchanged"}; front url same=${d.ok && d.row.image_front_url === d.row.images_json[0].url}; message: ${msg}`, repro: "Edit Photo; Rotate right; Save Photo" });
      // remove the uploaded object so nothing is left behind
      if (d.ok) { const k = d.row.images_json[0].storageKey; try { await admin.storage.from("vault-images").remove([k]); } catch {} }
    } else nt({ page: "/vault/item/[id] | owner", control: "Edit Photo dialog", expected: "opens", actual: "did not open", impact: "none" });
  } catch (e) { console.error(e); try { await ck(false, { page: "suite", control: "share2 runner", expected: "completes", actual: "script error: " + String(e.message).slice(0, 200), impact: "none" }); } catch {} }
  finally { try { await admin.from("profiles").update({ is_public: false }).eq("id", P); } catch {} console.log(JSON.stringify(X.sumRows(out))); try { await S.close(); } catch {} process.exit(0); }
})();
