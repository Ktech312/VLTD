// LA Comic Con on the LIVE banner (RB62): featured so it is in the ten, its artwork loads, the dates read right, the slide opens that event, the phone title is not cut,
// and the banner keeps one size. Isolated QA owner; nothing is written. Touch is browser-emulated, not a physical phone.
//   AUDIT_MANIFEST=<manifest> node rb62-la-comic-con-banner.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { sleep, session } = T;
const LABEL = process.argv[2] || "run";
const r = T.R("RB62");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [], samples: [] };
const SLUG = "freshcomics-la-comic-con-2026";
const CARD = `document.querySelector('[data-seasonal-banner]')`;
const STATE = `(() => {
  const card = ${CARD}; if (!card) return null; const r = card.getBoundingClientRect(); const ov = document.querySelector('section[aria-label="Collection overview"]');
  const ps = [...card.querySelectorAll('p')]; const label = ps[0]; const img = card.querySelector('img'); const a = card.querySelector('a');
  const clipped = (el) => !!el && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
  return { slide: card.getAttribute('data-slide'), art: card.getAttribute('data-art'), imgLoaded: img ? (img.complete && img.naturalWidth > 0) : null, imgSrc: img ? img.src.slice(0, 120) : null,
    label: label ? label.textContent.trim() : '', sub: ps[1] ? ps[1].textContent.trim() : '', labelClipped: clipped(label), labelLines: label ? Math.round(label.getBoundingClientRect().height / parseFloat(getComputedStyle(label).lineHeight)) : 0,
    cta: a ? a.textContent.trim() : '', ctaHref: a ? a.getAttribute('href') : null, ctaW: a ? Math.round(a.getBoundingClientRect().width) : 0,
    h: Math.round(r.height * 10) / 10, w: Math.round(r.width * 10) / 10, overviewTop: ov ? Math.round((ov.getBoundingClientRect().top + (document.querySelector('.vltd-content-wrap') ? document.querySelector('.vltd-content-wrap').scrollTop : 0)) * 10) / 10 : null,
    dots: card.querySelectorAll('button[aria-label^="Slide "]').length, path: location.pathname + location.search };
})()`;
(async () => {
  let S;
  const ck = (ok, control, expected, actual) => { out.cases.push({ ok: !!ok, control }); r.check(!!ok, { page: "/dashboard (Home)", control, expected, actual: String(actual).slice(0, 700), evidence: "", impact: "banner", repro: "" }); };
  async function open(w, h, mobile) {
    if (S) { try { await S.close(); } catch {} }
    S = await session("owner", { width: w, height: h, mobile });
    if (mobile) await S.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
    await S.visit("/"); await sleep(500); await S.visit("/"); await S.waitFor(`!!${CARD}`, 30000, "banner").catch(() => {}); await sleep(1500);
  }
  const st = () => S.evaluate(STATE);
  async function toSlide(i) { await S.evaluate(`(() => { const d = ${CARD}.querySelectorAll('button[aria-label^="Slide "]')[${i}]; if (d) d.click(); return true; })()`); await sleep(1000); }
  try {
    for (const [name, w, h, mobile] of [["desktop 1440", 1440, 900, false], ["phone 390 (emulated)", 390, 800, true]]) {
      await open(w, h, mobile);
      const first = await st(); const n = first.dots; const per = [];
      for (let i = 0; i < n; i++) { await toSlide(i); per.push({ i, ...(await st()) }); }
      out.samples.push({ name, per: per.map((p) => ({ i: p.i, slide: p.slide, art: p.art, imgLoaded: p.imgLoaded, label: p.label.slice(0, 40), sub: p.sub.slice(0, 40), h: p.h, w: p.w, clipped: p.labelClipped, lines: p.labelLines, cta: p.cta, ctaW: p.ctaW })) });
      const la = per.find((p) => p.slide === SLUG);
      ck(!!la, `LA Comic Con is among the banner's slides (${name})`, "the featured LA Comic Con is one of the ten", la ? `slide ${la.i + 1} of ${n}` : `not found; slides: ${per.map((p) => p.label.slice(0, 20)).join(" | ")}`);
      if (la) {
        await toSlide(la.i); const s = await st(); await S.jshot(`rb62-${LABEL}-${mobile ? "m" : "d"}-la`);
        ck(s.art === "graphic" && s.imgLoaded === true, `LA Comic Con's official artwork loads on the banner (${name})`, "its picture loads (shown as a graphic on the light card)", `art=${s.art}; loaded=${s.imgLoaded}; ${s.imgSrc}`);
        ck(/Starts in 8 days/.test(s.sub) && /Los Angeles/.test(s.sub), `dates and place read right (${name})`, "'Starts in 8 days — Los Angeles, CA' on Oct 22 (opens Oct 30)", s.sub);
        ck(s.ctaHref === `/events?highlight=${SLUG}`, `the button names this event (${name})`, "/events?highlight=<this event>", `${s.cta} -> ${s.ctaHref}`);
        ck(!s.labelClipped, `the title is not cut off (${name})`, "the full title shows", `"${s.label}" lines=${s.labelLines} clipped=${s.labelClipped}`);
        // destination: the button, and a click on the card
        await S.evaluate(`${CARD}.querySelector('a').click(); true`); await sleep(3500);
        const dest = await S.evaluate(`({ p: location.pathname + location.search, text: document.body.innerText.slice(0, 6000) })`);
        ck(dest.p === `/events?highlight=${SLUG}` && /L\.A\. Comic Con/.test(dest.text) && /Oct(ober)? 30/.test(dest.text) && /Nov(ember)? 1/.test(dest.text), `the button opens LA Comic Con on the Events page with its dates (${name})`, "Events page, event selected, Oct 30 to Nov 1 shown", `${dest.p}; page mentions the event: ${/L\.A\. Comic Con/.test(dest.text)}; dates: ${(dest.text.match(/Oct[a-z]* 30[^\n]{0,30}/) || [""])[0]}`);
        await S.jshot(`rb62-${LABEL}-${mobile ? "m" : "d"}-events-page`);
        await open(w, h, mobile);
      }
      const sizes = new Set(per.map((p) => p.h)); const widths = new Set(per.map((p) => p.w)); const tops = new Set(per.map((p) => p.overviewTop));
      ck(sizes.size === 1 && widths.size === 1 && tops.size === 1, `size and the overview's position identical on every slide (${name})`, "one height, one width, overview does not move", `heights=${[...sizes]} widths=${[...widths]} overview tops=${[...tops]}`);
      if (mobile) {
        const clipped = per.filter((p) => p.labelClipped).map((p) => p.label.slice(0, 40));
        const theme = per.find((p) => p.i === 0);
        ck(!theme.labelClipped, `the seasonal slide's title ("${theme.label}") shows in full on a phone (${name})`, "'Trick or Treat' not cut", `clipped=${theme.labelClipped}; button "${theme.cta}" is ${theme.ctaW}px wide`);
        out.samples.push({ name, phoneClippedTitles: clipped });
      }
    }
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String((e && e.stack) || e).slice(0, 800); }
  finally {
    try { if (S) await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb62-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(out.cases.map((c) => (c.ok ? "PASS" : "FAIL") + " " + c.control).join("\n"), out.error ? "\nRUNNER ERROR " + out.error : "");
    process.exit(0);
  }
})();
