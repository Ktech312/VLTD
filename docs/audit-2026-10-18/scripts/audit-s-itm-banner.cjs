// ITM: does the "Add to Home Screen" install banner cover page content at the end of the item page? (the page scrolls inside a container, not the window)
const X = require("./audit-s-itm-lib.cjs");
const { sleep } = X;
const WIDTH = Number(process.argv[2] || 1440);
const MOBILE = WIDTH < 500;
(async () => {
  const S = await X.S_("owner", { width: WIDTH, height: MOBILE ? 800 : 900, mobile: MOBILE });
  const { ck, out } = X.makeCk(() => S, {});
  const dev = MOBILE ? "phone 390 (browser-emulated)" : "desktop 1440";
  try {
    const id = await X.mkItem("misc2", { title: "QA ITM banner item" });
    await X.openItem(S, id); await sleep(2500);
    const up = await S.evaluate(`!![...document.querySelectorAll('div')].find(x => /Add to Home Screen/.test(x.innerText||'') && x.innerText.length < 80)`);
    const r = await S.evaluate(`(() => {
      const sec = [...document.querySelectorAll('section')].find(s => /^TAGS/.test(s.innerText));
      let sc = sec; while (sc && !(sc.scrollHeight > sc.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
      const scroller = sc || document.scrollingElement;
      scroller.scrollTop = scroller.scrollHeight;
      return new Promise((res) => setTimeout(() => {
        const chips = [...sec.querySelectorAll('button')].filter(x => /^\\+ \\S/.test(x.innerText.trim()));
        const banner = [...document.querySelectorAll('div')].filter(x => /Add to Home Screen/.test(x.innerText||'') && x.innerText.length < 80).pop();
        const br = banner ? banner.getBoundingClientRect() : null;
        res({ scroller: scroller.tagName + '.' + String(scroller.className).slice(0, 40), banner: br ? { l: Math.round(br.left), t: Math.round(br.top), r: Math.round(br.right), b: Math.round(br.bottom) } : null, vh: innerHeight,
          chips: chips.map(b => { const q = b.getBoundingClientRect(); const e = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); const hb = e && e.closest('button'); return { chip: b.innerText.trim(), l: Math.round(q.left), t: Math.round(q.top), covered: !!e && hb !== b, by: e ? (e.closest('div') ? (e.closest('div').innerText || '').trim().slice(0, 24) : '') : 'offscreen' }; }) });
      }, 400));
    })()`);
    const shot = await S.jshot(`itm-banner-overlap-${MOBILE ? "390" : "1440"}`);
    const covered = r.chips.filter((c) => c.covered);
    await ck(!up || covered.length === 0, { page: `/vault/item/[id] | owner, Personal, ${dev}, PWA install banner showing, scrolled to the end`, control: "Suggested tag chips vs the 'Add to Home Screen' banner", expected: "Every suggested-tag chip at the end of the page can be clicked (nothing fixed sits on top of page content)", actual: `banner ${JSON.stringify(r.banner)} in viewport height ${r.vh}; scroller ${r.scroller}; ${covered.length} of ${r.chips.length} chips covered: ${covered.map((c) => `'${c.chip}' (x${c.l},y${c.t}) by '${c.by}'`).join("; ") || "none"} (the banner can be dismissed with its X)`, evidence: shot, impact: "usability", repro: "Open an item with the install banner showing; scroll to the very end; try the '+ tag' chips at the lower left" });
  } catch (e) { console.error(e); await ck(false, { page: "suite", control: "banner runner", expected: "completes", actual: "script error: " + String(e.message).slice(0, 200), impact: "none" }); }
  finally { console.log(JSON.stringify(X.sumRows(out))); await S.close(); process.exit(0); }
})();
