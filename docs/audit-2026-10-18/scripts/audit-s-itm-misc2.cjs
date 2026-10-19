// ITM misc rerun: social export sheet, install-banner overlap at the end of the page, certificate scan with the AI endpoint intercepted. (First run mis-selected the Export button and the capture input.)
const X = require("./audit-s-itm-lib.cjs");
const { mclick, byText, byLabel, ESC, text, dbItem, mkItem, sleep, admin, dismissBanner, P } = X;
const pathx = require("path");
const WIDTH = Number(process.argv[2] || 1440);
const MOBILE = WIDTH < 500;
const dev = MOBILE ? "phone 390 (browser-emulated)" : "desktop 1440";
const has = (S, sel) => S.evaluate(`!!document.querySelector(${JSON.stringify(sel)})`);
(async () => {
  let S = await X.S_("owner", { width: WIDTH, height: MOBILE ? 800 : 900, mobile: MOBILE });
  const { ck, nt, out } = X.makeCk(() => S, {});
  const PG = (e = "") => `/vault/item/[id] | owner, Personal, ${dev}${e ? ", " + e : ""}`;
  try {
    await admin.from("profiles").update({ is_public: true, onboarding_completed: true }).eq("id", P);
    const id = await mkItem("misc1", { title: "QA ITM stream item", purchase_price: 40, current_value: 120, is_public: true, description: "stream description" });
    await X.openItem(S, id); await dismissBanner(S);
    // ---------- social export sheet ----------
    await mclick(S, byLabel("^Share this item$")); await sleep(800);
    await mclick(S, byText("^Export for social", "[role=dialog] button")); await sleep(3000);
    const sheet = await has(S, '[role=dialog][aria-label="Share as image or video"]');
    await ck(sheet, { page: PG("public item"), control: "Share panel -> Export for social", expected: "Opens the 'Share as image or video' sheet", actual: sheet ? "sheet open" : "not opened (see screenshot)", repro: "Share; Export for social" });
    if (sheet) {
      const SEL = '[role=dialog][aria-label="Share as image or video"]';
      const sh = await S.evaluate(`(() => { const d = document.querySelector(${JSON.stringify(SEL)}); return { tabs: [...d.querySelectorAll('[role=tab]')].map(b=>b.innerText.trim()), btns: [...d.querySelectorAll('button')].map(b=>(b.innerText||b.getAttribute('aria-label')||'').trim()).filter(Boolean).slice(0, 40), text: d.innerText.replace(/\\s+/g,' ').slice(0, 500) }; })()`);
      const shotS = await S.jshot(`itm-social-sheet-${MOBILE ? "390" : "1440"}`);
      nt({ page: PG(), control: "Social export sheet", expected: "Observation: tabs and buttons", actual: JSON.stringify({ tabs: sh.tabs, btns: sh.btns }).slice(0, 500), evidence: shotS, impact: "none", repro: "Open the sheet" });
      await ck(!/123\.45|\$40\b|purchase price|cost basis/i.test(sh.text), { page: PG(), control: "Social export sheet content", expected: "The preview and caption show no cost/purchase data", actual: sh.text.slice(0, 220), evidence: shotS, impact: "privacy/data loss", repro: "Open Export for social" });
      const b0 = (await S.look()).share;
      if (sh.btns.includes("Share")) {
        await mclick(S, byText("^Share$", SEL + " button")); await sleep(3500);
        const lk = await S.look();
        await ck(lk.share > b0 && lk.shared && String(lk.shared.title).includes("QA ITM stream item"), { page: PG(), control: "Social export -> Share (navigator.share stubbed)", expected: "The browser share sheet is asked to share a picture titled with the item's title", actual: `share calls=${lk.share - b0}; passed title=${lk.shared && lk.shared.title}; url=${lk.shared && lk.shared.url} (the picture file is not visible to the stub)`, repro: "Export for social -> Share" });
      } else nt({ page: PG(), control: "Social export -> Share", expected: "Share button present", actual: "not shown: " + sh.btns.join(","), impact: "none" });
      const dl0 = (await S.look()).downloads.length;
      if (sh.btns.includes("Download PNG")) {
        await mclick(S, byText("^Download PNG$", SEL + " button")); await sleep(3000);
        const lk2 = await S.look();
        await ck(lk2.downloads.length > dl0, { page: PG(), control: "Social export -> Download PNG", expected: "A PNG download is triggered with a file name", actual: `downloads=${JSON.stringify(lk2.downloads.slice(dl0))}`, repro: "Export for social -> Download PNG" });
      }
      if (sh.btns.some((b) => /Copy hashtags/i.test(b))) {
        const c0 = (await S.look()).clip.length;
        await mclick(S, byText("Copy hashtags", SEL + " button")); await sleep(500);
        const lk3 = await S.look();
        await ck(lk3.clip.length > c0 && /^#/.test(lk3.clip[lk3.clip.length - 1] || ""), { page: PG(), control: "Social export -> Copy hashtags", expected: "The clipboard receives the hashtags", actual: `clipboard last: ${(lk3.clip || []).slice(-1)[0]}`, repro: "Copy hashtags" });
      }
      await ESC(S); await sleep(500);
      const closed = !(await has(S, SEL));
      await ck(closed, { page: PG(), control: "Social export sheet -> Escape", expected: "Escape closes the sheet", actual: closed ? "closed" : "still open", impact: "usability", repro: "Open sheet; Escape" });
      if (!closed) await mclick(S, byLabel("^Close$", SEL + " button"));
    }
    // ---------- install banner overlap at the end of the page ----------
    const idB = await mkItem("misc2", { title: "QA ITM banner item" });
    await S.close(); S = await X.S_("owner", { width: WIDTH, height: MOBILE ? 800 : 900, mobile: MOBILE });
    await X.openItem(S, idB); await sleep(2500);
    const bannerUp = await S.evaluate(`!![...document.querySelectorAll('div')].find(x => /Add to Home Screen/.test(x.innerText||'') && x.innerText.length < 80)`);
    if (bannerUp) {
      const hits = await S.evaluate(`(() => { window.scrollTo(0, document.documentElement.scrollHeight); const sec = [...document.querySelectorAll('section')].find(s => /^TAGS/.test(s.innerText)); return [...sec.querySelectorAll('button')].filter(x => /^\\+ \\S/.test(x.innerText.trim())).map(b => { const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); const hb = e && e.closest('button'); return { chip: b.innerText.trim(), y: Math.round(r.top), covered: !(hb === b), by: e ? (e.innerText || '').trim().slice(0, 30) : null }; }); })()`);
      const shotB = await S.jshot(`itm-banner-overlap-${MOBILE ? "390" : "1440"}`);
      const coveredChips = hits.filter((h) => h.covered);
      await ck(coveredChips.length === 0, { page: PG("PWA install banner showing, page scrolled to the end"), control: "Suggested tag chips vs the 'Add to Home Screen' banner", expected: "Every suggested-tag chip at the end of the page can be clicked (nothing fixed sits on top of page content)", actual: `${coveredChips.length} of ${hits.length} chips are covered: ${coveredChips.map((h) => `'${h.chip}' by '${h.by}'`).join(", ") || "none"} (the banner can be dismissed with its X)`, evidence: shotB, impact: "usability", repro: "Open an item with the install banner showing; scroll to the very end; click a '+ tag' chip at the lower left" });
    } else nt({ page: PG(), control: "Install banner overlap", expected: "banner not showing in this browser", actual: "not shown", impact: "none" });
    await dismissBanner(S);
    // ---------- certificate scan (AI intercepted) ----------
    const f = pathx.join(__dirname, "itm-up-1.png");
    const i0 = S.intercepted.length;
    const doc = await S.send("DOM.getDocument", {});
    const q = await S.send("DOM.querySelectorAll", { nodeId: doc.root.nodeId, selector: "input[type=file][capture]" });
    // the CoA input is the capture input that is not the photo-camera one: it sits in the Item Summary
    let target = null;
    for (const nid of q.nodeIds) { const loc = await S.send("DOM.resolveNode", { nodeId: nid }); const inSummary = (await S.send("Runtime.callFunctionOn", { objectId: loc.object.objectId, functionDeclaration: "function(){ return !!this.closest('section') && /ITEM SUMMARY/.test(this.closest('section').innerText); }", returnByValue: true })).result.value; if (inSummary) target = nid; }
    if (target) {
      await S.send("DOM.setFileInputFiles", { nodeId: target, files: [f] }); await sleep(3500);
      const tt = await text(S); const ai = S.intercepted.slice(i0).filter((x) => /analyze-coa/.test(x.url));
      const d = await dbItem(id);
      await ck(ai.length > 0 && /Scan failed|Could not read/i.test(tt), { page: PG("AI endpoint intercepted (503), not a successful AI result"), control: "Scan certificate with AI (failed AI)", expected: "A plain failure message ('Scan failed.') and nothing is applied to the item", actual: `AI requests answered by the audit=${ai.length}; message: ${(tt.match(/Scan failed\.|Could not read[^.]*\./) || ["none"])[0]}; item grade/cert unchanged=${!d.grade && !d.cert_number}`, repro: "Scan certificate; choose an image while the AI service fails" });
    } else nt({ page: PG(), control: "Scan certificate with AI", expected: "file input reachable", actual: "input not located", impact: "none" });
  } catch (e) { console.error("SUITE ERROR", e); try { await ck(false, { page: "suite", control: "misc2 suite runner", expected: "completes", actual: "script error (test mistake candidate): " + String(e.message).slice(0, 200), impact: "none" }); } catch {} }
  finally { try { await admin.from("profiles").update({ is_public: false }).eq("id", P); } catch {} console.log(JSON.stringify(X.sumRows(out))); try { await S.close(); } catch {} process.exit(0); }
})();
