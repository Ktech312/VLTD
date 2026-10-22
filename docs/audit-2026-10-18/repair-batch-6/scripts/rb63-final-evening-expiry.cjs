// Synthetic production checks for the last-evening and local-midnight rules (RB63), after the owner ran SQL file 7. SYNTHETIC means two things here:
//  1. Database read rule, on the REAL production database: short-lived QA rows that ended 1, 9, 11 and 13 hours ago (plus a disabled one) are read with the public key.
//     They are far in the past and their end times are real instants, so no page ever shows them; they are deleted by exact slug at the end.
//  2. The pages' own time-zone logic, on the LIVE site: the browser's clock is moved to chosen instants (Nov 1 evening Pacific etc.) and the answer of the events
//     table is topped up IN THE BROWSER ONLY with QA events in Los Angeles, Miami, Honolulu and London (nothing is written for real users to see). The real
//     LA Comic Con row is read as it is. This is not the real calendar: the real check is the evening of Nov 1 itself.
//   AUDIT_MANIFEST=<manifest> node rb63-final-evening-expiry.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { sleep, session, admin } = T;
const LABEL = process.argv[2] || "run";
const r = T.R("RB63");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [], samples: [] };
const ENV = require(path.join(SD, "..", "qa", "env.cjs"));
const URL_ = ENV.NEXT_PUBLIC_SUPABASE_URL, ANON = ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PREFIX = "qa-rb63-";
const LA_REAL = "freshcomics-la-comic-con-2026";

const synth = (slug, name, city, state, country) => ({ id: "00000000-0000-4000-8000-" + String(Math.abs(slug.split("").reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % 1e12).padStart(12, "0"), slug, name, emoji: null, short_desc: null, long_desc: null, event_type: "national",
  starts_at: "2026-10-30T00:00:00+00:00", ends_at: "2026-11-01T23:59:59+00:00", venue_name: null, venue_address: null, city, state_region: state, country, website_url: null, ticket_url: null, admission: null, image_url: null, relevant_universes: null, is_featured: true, enabled: true });
const SYNTH = [
  synth(PREFIX + "la", "QA Final Evening Los Angeles", "Los Angeles", "CA", "US"),
  synth(PREFIX + "miami", "QA Final Evening Miami", "Miami", "FL", "US"),
  synth(PREFIX + "honolulu", "QA Final Evening Honolulu", "Honolulu", "HI", "US"),
  synth(PREFIX + "london", "QA Final Evening London", "London", null, "GB"),
];

// runs in the page before anything else: clock moved to the instant held in sessionStorage, and the events answers topped up with the QA events
const INJECT = fs.readFileSync(path.join(__dirname, "rb63-inject.js"), "utf8");

const CARD = `document.querySelector('[data-seasonal-banner]')`;
const SLIDES = `(async () => { const card = ${CARD}; if (!card) return null; const dots = [...card.querySelectorAll('button[aria-label^="Slide "]')]; const seen = [];
  for (let i = 0; i < dots.length; i++) { dots[i].click(); await new Promise((r) => setTimeout(r, 900)); const c = ${CARD}; const ps = [...c.querySelectorAll('p')]; seen.push({ slug: c.getAttribute('data-slide'), label: ps[0] ? ps[0].textContent.trim() : '', sub: ps[1] ? ps[1].textContent.trim() : '' }); }
  return seen; })()`;

(async () => {
  let S;
  const ck = (ok, control, expected, actual, page) => { out.cases.push({ ok: !!ok, control }); r.check(!!ok, { page: page || "(database)", control, expected, actual: String(actual).slice(0, 700), evidence: "", impact: "events", repro: "" }); };
  try {
    // ── 1. database read rule on production
    await admin.from("collector_events").delete().like("slug", PREFIX + "%");
    const base = Date.now(); const iso = (h) => new Date(base + h * 3600000).toISOString();
    const row = (slug, endH, enabled = true) => ({ slug: PREFIX + slug, name: "QA read rule " + slug, starts_at: iso(-100), ends_at: iso(endH), country: "US", enabled });
    const ins = await admin.from("collector_events").insert([row("ended-1h", -1), row("ended-9h", -9), row("ended-11h", -11), row("ended-13h", -13), row("future", 30), row("disabled-1h", -1, false)]);
    if (ins.error) throw new Error("insert: " + ins.error.message);
    const anon = async () => { const res = await fetch(`${URL_}/rest/v1/collector_events?select=slug&slug=like.${PREFIX}*&order=slug`, { headers: { apikey: ANON, authorization: `Bearer ${ANON}` } }); return (await res.json()).map((x) => x.slug.replace(PREFIX, "")); };
    const seen = await anon();
    out.samples.push({ dbRead: seen });
    ck(JSON.stringify(seen) === JSON.stringify(["ended-11h", "ended-1h", "ended-9h", "future"]), "production read rule: events stay readable for 12 hours after their stored end, not longer, and disabled stay hidden (public key)", "ended 1, 9 and 11 hours ago and the future one are readable; ended 13 hours ago and the disabled one are not", JSON.stringify(seen));
    await admin.from("collector_events").delete().like("slug", PREFIX + "%");
    ck((await anon()).length === 0, "the QA read-rule rows are removed", "none left", (await anon()).length);

    // ── 2. the pages' own logic with the clock moved
    S = await session("owner", { width: 1440, height: 900 });
    await S.send("Page.addScriptToEvaluateOnNewDocument", { source: INJECT });
    const at = async (isoZ, label) => {
      await S.evaluate(`sessionStorage.setItem('__rb63_now', ${JSON.stringify(String(Date.parse(isoZ)))}); sessionStorage.setItem('__rb63_rows', ${JSON.stringify(JSON.stringify(SYNTH))}); true`);
      await S.visit("/"); await S.waitFor(`!!${CARD}`, 30000, "banner").catch(() => {}); await sleep(1500);
      const slides = await S.evaluate(SLIDES);
      const clock = await S.evaluate(`JSON.stringify({ probe: window.__rb63probe, now: new Date().toISOString(), path: location.pathname })`);
      return { label, at: isoZ, clock, slides: slides || [] };
    };
    const has = (st, slug) => st.slides.find((x) => x.slug === slug);
    const instants = [
      ["2026-11-02T04:00:00Z", "8 pm in Los Angeles on Nov 1 (11 pm Miami, 6 pm Honolulu, already Nov 2 in London)"],
      ["2026-11-02T07:59:00Z", "11:59 pm in Los Angeles"],
      ["2026-11-02T08:01:00Z", "00:01 on Nov 2 in Los Angeles"],
      ["2026-11-02T10:01:00Z", "00:01 on Nov 2 in Honolulu"],
      ["2026-10-30T06:30:00Z", "11:30 pm Oct 29 in Los Angeles (before it starts)"],
      ["2026-10-30T07:30:00Z", "00:30 on Oct 30 in Los Angeles (just started)"],
    ];
    const res = {};
    for (const [z, l] of instants) res[z] = await at(z, l);
    out.samples.push({ clocks: Object.fromEntries(Object.entries(res).map(([k, v]) => [k, v.clock])) });
    out.samples.push({ banner: Object.fromEntries(Object.entries(res).map(([k, v]) => [k, v.slides.map((s) => `${s.slug}: ${s.sub}`)])) });
    const [T1, T2, T3, T4, T5, T6] = instants.map((i) => res[i[0]]);
    ck(T1.slides.length > 0, "banner loads with the clock moved (synthetic clock)", "slides present", `slides at T1: ${T1.slides.length}`, "/dashboard (live banner, synthetic clock)");
    ck(has(T1, LA_REAL) && has(T1, PREFIX + "la") && has(T1, PREFIX + "miami") && has(T1, PREFIX + "honolulu") && !has(T1, PREFIX + "london"), "8 pm Pacific on the last day: the real LA Comic Con and the LA, Miami and Honolulu events are still on the banner, London's is gone (synthetic clock)", "present: real LA, LA, Miami, Honolulu; absent: London", T1.slides.map((s) => s.slug.replace(PREFIX, "qa:")).join(", "), "/dashboard (live banner, synthetic clock)");
    ck(/Happening now/.test((has(T1, LA_REAL) || {}).sub || ""), "the real LA Comic Con reads 'Happening now!' on its last evening (synthetic clock)", "Happening now!", (has(T1, LA_REAL) || {}).sub, "/dashboard (live banner, synthetic clock)");
    ck(has(T2, LA_REAL) && has(T2, PREFIX + "la") && !has(T2, PREFIX + "miami") && has(T2, PREFIX + "honolulu"), "11:59 pm Pacific: LA still on, Miami (02:59) gone, Honolulu still on (synthetic clock)", "LA and Honolulu present; Miami absent", T2.slides.map((s) => s.slug.replace(PREFIX, "qa:")).join(", "), "/dashboard (live banner, synthetic clock)");
    ck(!has(T3, LA_REAL) && !has(T3, PREFIX + "la") && has(T3, PREFIX + "honolulu"), "00:01 on Nov 2 Pacific: the LA events are over, Honolulu still on (synthetic clock)", "LA absent; Honolulu present", T3.slides.map((s) => s.slug.replace(PREFIX, "qa:")).join(", "), "/dashboard (live banner, synthetic clock)");
    ck(!has(T4, PREFIX + "honolulu"), "00:01 on Nov 2 in Honolulu: that event is over too (synthetic clock)", "Honolulu absent", T4.slides.map((s) => s.slug.replace(PREFIX, "qa:")).join(", "), "/dashboard (live banner, synthetic clock)");
    ck(has(T5, LA_REAL) && !/Happening now/.test(has(T5, LA_REAL).sub), "11:30 pm on Oct 29 Pacific: LA Comic Con has not started yet (synthetic clock)", "not 'Happening now!'", (has(T5, LA_REAL) || {}).sub, "/dashboard (live banner, synthetic clock)");
    ck(has(T6, LA_REAL) && /Happening now/.test(has(T6, LA_REAL).sub), "00:30 on Oct 30 Pacific: LA Comic Con has started (synthetic clock)", "Happening now!", (has(T6, LA_REAL) || {}).sub, "/dashboard (live banner, synthetic clock)");

    // Events page at the same instants
    const evAt = async (isoZ) => {
      await S.evaluate(`sessionStorage.setItem('__rb63_now', ${JSON.stringify(String(Date.parse(isoZ)))}); sessionStorage.setItem('__rb63_rows', ${JSON.stringify(JSON.stringify(SYNTH))}); true`);
      await S.visit("/events"); await sleep(3500);
      return S.evaluate(`document.body.innerText`);
    };
    const e1 = await evAt("2026-11-02T04:00:00Z"); const e3 = await evAt("2026-11-02T08:01:00Z");
    ck(/L\.A\. Comic Con/.test(e1) && /QA Final Evening Los Angeles/.test(e1) && !/QA Final Evening London/.test(e1), "Events page at 8 pm Pacific on the last day lists LA Comic Con and the LA event, not London's (synthetic clock)", "LA listed, London not", `LA Comic Con: ${/L\.A\. Comic Con/.test(e1)}; QA LA: ${/QA Final Evening Los Angeles/.test(e1)}; QA London: ${/QA Final Evening London/.test(e1)}`, "/events (live, synthetic clock)");
    ck(!/QA Final Evening Los Angeles/.test(e3) && !/L\.A\. Comic Con/.test(e3) && /QA Final Evening Honolulu/.test(e3), "Events page at 00:01 Pacific on Nov 2: LA gone, Honolulu still listed (synthetic clock)", "LA absent, Honolulu present", `LA Comic Con: ${/L\.A\. Comic Con/.test(e3)}; QA LA: ${/QA Final Evening Los Angeles/.test(e3)}; QA Honolulu: ${/QA Final Evening Honolulu/.test(e3)}`, "/events (live, synthetic clock)");
    await S.evaluate("sessionStorage.removeItem('__rb63_now'); sessionStorage.removeItem('__rb63_rows'); true");
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String((e && e.stack) || e).slice(0, 800); }
  finally {
    try { await admin.from("collector_events").delete().like("slug", PREFIX + "%"); } catch {}
    try { if (S) await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb63-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(out.cases.map((c) => (c.ok ? "PASS" : "FAIL") + " " + c.control).join("\n"), out.error ? "\nRUNNER ERROR " + out.error : "");
    process.exit(0);
  }
})();
