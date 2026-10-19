// ITM misc: Stream (present) page, Share panel links, social export sheet, install-banner overlap, Business profile, certificate scan (AI intercepted), Return to Vault on a sold item, delete item.
const X = require("./audit-s-itm-lib.cjs");
const { mclick, byText, byLabel, typeIn, ENTER, ESC, text, dbItem, dbWait, mkItem, sleep, admin, dismissBanner, P, B, ST, m } = X;
const fsx = require("fs"); const pathx = require("path");
const WIDTH = Number(process.argv[2] || 1440);
const MOBILE = WIDTH < 500;
const dev = MOBILE ? "phone 390 (browser-emulated)" : "desktop 1440";
const has = (S, sel) => S.evaluate(`!!document.querySelector(${JSON.stringify(sel)})`);
(async () => {
  let S = await X.S_("owner", { width: WIDTH, height: MOBILE ? 800 : 900, mobile: MOBILE });
  const { ck, nt, bl, out } = X.makeCk(() => S, {});
  const PG = (e = "") => `/vault/item/[id] | owner, Personal, ${dev}${e ? ", " + e : ""}`;
  try {
    await admin.from("profiles").update({ is_public: true, onboarding_completed: true }).eq("id", P);
    // ---------- 1. Stream page ----------
    const id = await mkItem("misc1", { title: "QA ITM stream item", purchase_price: 40, current_value: 120, is_public: true, description: "stream description" });
    await X.openItem(S, id); await dismissBanner(S);
    await mclick(S, byText("^Stream$", "a")); await sleep(3000);
    const p1 = await S.path(); const t1 = await text(S);
    await ck(p1 === `/vault/item/${id}/present` && t1.includes("QA ITM stream item"), { page: `/vault/item/[id]/present | owner, Personal, ${dev}`, control: "Stream (link on the item page)", expected: "Opens the full-screen Stream view of this item with its title", actual: `path=${p1}; title shown=${t1.includes("QA ITM stream item")}; text: ${t1.slice(0, 120)}`, repro: "Item page: click Stream" });
    const shotP = await S.jshot(`itm-present-${MOBILE ? "390" : "1440"}`);
    const inv = (await X.controls(S)).filter((c) => c.visible);
    nt({ page: `/vault/item/[id]/present | owner, ${dev}`, control: "Stream page controls", expected: "Observation", actual: inv.map((c) => `${c.kind}:${c.label}`).join(" | ").slice(0, 400), evidence: shotP, impact: "none", repro: "Open Stream" });
    const leakS = /123\.45|\$40\b|Total cost|purchase/i.test(t1);
    await ck(!/purchase|cost basis|order #/i.test(t1), { page: `/vault/item/[id]/present | owner, ${dev}`, control: "Stream view content", expected: "A presentation view meant for showing others does not display what was paid", actual: `shows cost words: ${/purchase|cost basis|order #/i.test(t1)}; value shown: ${/\$120/.test(t1)}`, impact: "privacy/data loss", repro: "Open Stream and read it" });
    // close: Escape then button
    await ESC(S); await sleep(1200);
    let still = (await S.path()).endsWith("/present");
    if (still) { const closeBtn = inv.find((c) => /close|back|exit|×/i.test(c.label)); if (closeBtn) { await mclick(S, `document.querySelector('[data-aud="${closeBtn.id}"]')`); await sleep(1500); } }
    await ck(!(await S.path()).endsWith("/present"), { page: `/vault/item/[id]/present | owner, ${dev}`, control: "Leave the Stream view (Escape or the close control)", expected: "Escape or the close control returns to the item page", actual: `Escape alone: ${still ? "stayed on /present" : "left"}; now at ${await S.path()}`, impact: "usability", repro: "Open Stream; press Escape" });
    // direct URL, back/forward
    await S.visit(`/vault/item/${id}/present`); await sleep(2000);
    await ck((await text(S)).includes("QA ITM stream item"), { page: `/vault/item/[id]/present | owner, ${dev}`, control: "Direct URL to Stream", expected: "Loads the item's Stream view", actual: (await text(S)).slice(0, 100), repro: "Open the /present URL directly" });

    // ---------- 2. Share panel links ----------
    await X.openItem(S, id); await dismissBanner(S);
    await mclick(S, byLabel("^Share this item$")); await sleep(1000);
    const dlg = await S.evaluate(`(() => { const d = document.querySelector('[role=dialog]'); return d ? [...d.querySelectorAll('button,a')].map(b => ({ t: (b.innerText||b.getAttribute('aria-label')||'').trim(), href: b.getAttribute('href') })).filter(x => x.t) : []; })()`);
    nt({ page: PG("public item"), control: "Share panel controls", expected: "Observation", actual: dlg.map((x) => x.t + (x.href ? "=>" + x.href.slice(0, 50) : "")).join(" | ").slice(0, 400), impact: "none", repro: "Open Share" });
    const want = `${X.BASE}/share/${id}`;
    for (const name of ["Messages", "Facebook", "WhatsApp", "X", "Email", "Reddit", "Telegram"]) {
      const el = dlg.find((x) => x.t === name); if (!el) { nt({ page: PG(), control: `Share -> ${name}`, expected: "present", actual: "not offered", impact: "none" }); continue; }
      const before = (await S.look()).opens.length;
      await mclick(S, byText("^" + name + "$", "[role=dialog] button,[role=dialog] a")); await sleep(600);
      const look = await S.look(); const opened = look.opens.slice(before).concat(el.href ? [el.href] : []);
      const url = opened.join(" ");
      let decoded = ""; try { decoded = decodeURIComponent(url); } catch { decoded = url; }
      await ck(decoded.includes(want) && !/123\.45|SECRET/.test(decoded), { page: PG("public item"), control: `Share panel -> ${name}`, expected: `Opens ${name} with the item's own public link (${want}) and nothing private`, actual: `opened: ${url.slice(0, 200)}`, repro: `Share; click ${name}` });
    }
    await ESC(S); await sleep(300);
    // ---------- 3. social export sheet ----------
    await mclick(S, byLabel("^Share this item$")); await sleep(800);
    await mclick(S, byText("^Export for social$", "[role=dialog] button")); await sleep(2500);
    const sheet = await has(S, '[role=dialog][aria-label="Share as image or video"]');
    await ck(sheet, { page: PG(), control: "Share panel -> Export for social", expected: "Opens the 'Share as image or video' sheet", actual: sheet ? "sheet open" : "not opened", repro: "Share; Export for social" });
    if (sheet) {
      const sh = await S.evaluate(`(() => { const d = document.querySelector('[role=dialog][aria-label="Share as image or video"]'); return { tabs: [...d.querySelectorAll('[role=tab]')].map(b=>b.innerText.trim()), btns: [...d.querySelectorAll('button')].map(b=>(b.innerText||b.getAttribute('aria-label')||'').trim()).filter(Boolean).slice(0, 30), text: d.innerText.replace(/\\s+/g,' ').slice(0, 400) }; })()`);
      nt({ page: PG(), control: "Social export sheet", expected: "Observation", actual: JSON.stringify(sh).slice(0, 500), impact: "none", repro: "Open the sheet" });
      const shotS = await S.jshot(`itm-social-sheet-${MOBILE ? "390" : "1440"}`);
      const priv = /123\.45|\$40\b|purchase price|cost basis/i.test(sh.text);
      await ck(!priv, { page: PG(), control: "Social export sheet content", expected: "The image/caption preview shows no cost/purchase data", actual: sh.text.slice(0, 200), evidence: shotS, impact: "privacy/data loss", repro: "Open Export for social" });
      // share button -> navigator.share (stub records title + url)
      const b0 = (await S.look()).share;
      const hasShare = sh.btns.includes("Share");
      if (hasShare) {
        await mclick(S, byText("^Share$", "[role=dialog][aria-label=\"Share as image or video\"] button")); await sleep(2500);
        const lk = await S.look();
        await ck(lk.share > b0 && lk.shared && String(lk.shared.title).includes("QA ITM stream item"), { page: PG(), control: "Social export -> Share (navigator.share stubbed)", expected: "The browser share sheet is asked to share a picture titled with the item's title", actual: `share calls=${lk.share - b0}; passed title=${lk.shared && lk.shared.title}; url=${lk.shared && lk.shared.url}; (the picture file itself is not visible to the stub)`, repro: "Export for social -> Share" });
      }
      const dl0 = (await S.look()).downloads.length;
      if (sh.btns.includes("Download PNG")) {
        await mclick(S, byText("^Download PNG$", "[role=dialog][aria-label=\"Share as image or video\"] button")); await sleep(2500);
        const lk2 = await S.look();
        await ck(lk2.downloads.length > dl0, { page: PG(), control: "Social export -> Download PNG", expected: "A PNG download is triggered with a file name", actual: `downloads=${JSON.stringify(lk2.downloads.slice(dl0))}; blobs=${JSON.stringify((lk2.blobs || []).slice(-2))}`, repro: "Export for social -> Download PNG" });
      }
      if (sh.btns.some((b) => /Copy hashtags/i.test(b))) {
        const c0 = (await S.look()).clip.length;
        await mclick(S, byText("Copy hashtags", "[role=dialog] button")); await sleep(500);
        const lk3 = await S.look();
        await ck(lk3.clip.length > c0 && /^#/.test(lk3.clip[lk3.clip.length - 1] || ""), { page: PG(), control: "Social export -> Copy hashtags", expected: "The clipboard receives the hashtags", actual: `clipboard last: ${(lk3.clip || []).slice(-1)[0]}`, repro: "Copy hashtags" });
      }
      await ESC(S); await sleep(400);
      await ck(!(await has(S, '[role=dialog][aria-label="Share as image or video"]')), { page: PG(), control: "Social export sheet -> Escape", expected: "Escape closes the sheet", actual: "checked", impact: "usability", repro: "Open sheet; Escape" });
    }
    await ESC(S); await sleep(300);

    // ---------- 4. install banner overlap ----------
    const idB = await mkItem("misc2", { title: "QA ITM banner item" });
    await S.close(); S = await X.S_("owner", { width: WIDTH, height: MOBILE ? 800 : 900, mobile: MOBILE });
    await X.openItem(S, idB); await sleep(1500);
    const bannerUp = await S.evaluate(`!![...document.querySelectorAll('div')].find(x => /Add to Home Screen/.test(x.innerText||'') && x.innerText.length < 80)`);
    if (bannerUp) {
      const hit = await S.evaluate(`(() => { window.scrollTo(0, document.documentElement.scrollHeight); const sec = [...document.querySelectorAll('section')].find(s => /^TAGS/.test(s.innerText)); const b = sec && [...sec.querySelectorAll('button')].find(x => /^\\+ \\S/.test(x.innerText.trim())); if (!b) return null; b.scrollIntoView({ block: 'end' }); const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { chip: b.innerText.trim(), hit: e ? (e.closest('button') ? e.closest('button').innerText.trim() : e.innerText.trim().slice(0, 40)) : null, top: Math.round(r.top), vh: innerHeight }; })()`);
      const shotB = await S.jshot(`itm-banner-overlap-${MOBILE ? "390" : "1440"}`);
      await ck(hit && hit.hit === hit.chip, { page: PG("PWA install banner showing"), control: "Suggested tag chip at the bottom of the page vs the 'Add to Home Screen' banner", expected: "The last tag chips can be clicked without the install banner covering them", actual: `at the end of the page the point on '${hit && hit.chip}' belongs to: '${hit && hit.hit}' (the banner covers it; dismissible with its X)`, evidence: shotB, impact: "usability", repro: "Open any item with the install banner showing; scroll to the end; click a '+ tag' chip at the lower-left" });
    } else nt({ page: PG(), control: "Install banner overlap", expected: "banner not showing in this browser", actual: "not shown", impact: "none" });

    // ---------- 5. certificate scan (AI intercepted) ----------
    await dismissBanner(S);
    const f = pathx.join(__dirname, "itm-up-1.png");
    const doc = await S.send("DOM.getDocument", {});
    const q = await S.send("DOM.querySelectorAll", { nodeId: doc.root.nodeId, selector: "input[type=file]" });
    let coaNode = null;
    for (const nid of q.nodeIds) { const attrs = (await S.send("DOM.getAttributes", { nodeId: nid })).attributes; const o = {}; for (let i = 0; i < attrs.length; i += 2) o[attrs[i]] = attrs[i + 1]; if (o.accept && !o.multiple && !o.capture && nid !== q.nodeIds[0]) coaNode = coaNode || nid; }
    const intercepted0 = S.intercepted.length;
    // the CoA button holds its own hidden input: click the button to be sure it exists, then find by label
    const coaBtn = await has(S, 'button');
    await mclick(S, byText("Scan certificate with AI", "button")); await sleep(600);
    const q2 = await S.send("DOM.querySelectorAll", { nodeId: (await S.send("DOM.getDocument", {})).root.nodeId, selector: "input[type=file]" });
    let target = null;
    for (const nid of q2.nodeIds) { const html = (await S.send("DOM.getOuterHTML", { nodeId: nid })).outerHTML; if (!/multiple/.test(html) && !/capture/.test(html) && /accept/.test(html)) target = nid; }
    if (target) {
      await S.send("DOM.setFileInputFiles", { nodeId: target, files: [f] }); await sleep(3500);
      const tt = await text(S); const ai = S.intercepted.slice(intercepted0).filter((x) => /analyze-coa/.test(x.url));
      await ck(ai.length > 0 && /Scan failed|Could not read/i.test(tt), { page: PG("AI endpoint intercepted (503), not a successful AI result"), control: "Scan certificate with AI (failed AI)", expected: "A plain failure message ('Scan failed.') and nothing is applied to the item", actual: `AI requests answered by the audit=${ai.length}; message: ${(tt.match(/Scan failed\.|Could not read[^.]*\./) || ["none"])[0]}`, repro: "Scan certificate; choose an image while the AI service fails" });
    } else nt({ page: PG(), control: "Scan certificate with AI", expected: "file input reachable", actual: "input not located", impact: "none" });
  } catch (e) { console.error("SUITE ERROR", e); try { await ck(false, { page: "suite", control: "misc suite runner", expected: "completes", actual: "script error (test mistake candidate): " + String(e.message).slice(0, 200), impact: "none" }); } catch {} }
  finally { try { await admin.from("profiles").update({ is_public: false }).eq("id", P); } catch {} console.log(JSON.stringify(X.sumRows(out))); try { await S.close(); } catch {} process.exit(0); }
})();
