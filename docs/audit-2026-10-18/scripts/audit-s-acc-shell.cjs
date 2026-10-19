// ACC: Settings shell (category list on phones, side list on desktop, highlight, back link, Switch profile selector). --w=1440|390
const A = require("./audit-s-acc-lib.cjs");
const { session, R, sleep, admin, man } = A;
const r = R("ACC");
setTimeout(() => { console.log("WATCHDOG"); process.exit(3); }, 1200000).unref();
const W = Number((process.argv.find((a) => a.startsWith("--w=")) || "--w=1440").slice(4));
const MOBILE = W < 500; const touch = MOBILE;
const tag = MOBILE ? "390 (browser-emulated touch)" : "1440";
const m = man();
const go = async (S, p) => { await S.visit(p); await sleep(1500); };
const page = (x, who = "owner, Personal") => `${x} | ${who} | ${tag}`;
const CATS = [["Profile", /^\/account(\?section=profile)?$/], ["Preferences", /^\/account\?section=preferences$/], ["Privacy and security", /^\/account\/security$/], ["Billing and contact", /^\/account\/billing$/], ["Data and maintenance", /^\/account\?section=data$/]];
const catLinks = (S) => S.evaluate("[...document.querySelectorAll('nav[aria-label=\"Settings categories\"] a')].filter((a) => a.getBoundingClientRect().width > 1).map((a) => ({ t: a.innerText.trim(), cur: a.getAttribute('aria-current') }))");

(async () => {
  const S = await session("owner", { width: W, height: MOBILE ? 844 : 900, mobile: MOBILE });
  try {
    await go(S, "/account");
    const landing = await catLinks(S);
    const formVisible = await S.evaluate("(() => { const i = document.querySelector('input[placeholder=\"Display name\"]'); return !!i && i.getBoundingClientRect().width > 1; })()");
    r.check(landing.length === 5 && (MOBILE ? !formVisible : formVisible), { page: page("/account"), control: MOBILE ? "Settings landing on a phone" : "Settings landing on desktop", expected: MOBILE ? "a list of 5 categories only (no form until one is chosen)" : "category list beside the Profile form", actual: JSON.stringify({ landing, formVisible }), evidence: await S.jshot(`acc-shell-landing-${W}`), impact: "usability", repro: "Open /account" });
    for (const [label, want] of CATS) {
      await go(S, "/account");
      const ok = await A.clickText(S, `^${label}$`, 'nav[aria-label="Settings categories"] a', { touch }); await sleep(2200);
      const p = await S.path();
      const cur = await catLinks(S);
      const back = MOBILE ? await S.evaluate("(() => { const a = [...document.querySelectorAll('a')].find((x) => x.innerText.replace(/\s+/g, ' ').trim().startsWith('← Settings')); return a ? a.innerText.replace(/\s+/g, ' ').trim() : null; })()") : "n/a";
      const h = await S.evaluate("(document.querySelector('main h1,main h2') || {}).innerText || ''");
      r.check(ok && want.test(p) && (MOBILE ? !!back : cur.some((c) => c.t === label && c.cur === "page")), { page: page(p), control: `Settings category: ${label}`, expected: `opens ${label}${MOBILE ? " with a '← Settings' back link" : " and marks it current in the list"}`, actual: `clicked=${ok}; path=${p}; heading="${h}"; ${MOBILE ? "back link=" + back : "current=" + JSON.stringify(cur.filter((c) => c.cur))}`, evidence: "", impact: "blocked workflow", repro: `Open Settings; choose ${label}` });
      if (MOBILE && back) {
        await A.clickExpr(S, "[...document.querySelectorAll('a')].find((x) => x.innerText.replace(/\s+/g, ' ').trim().startsWith('← Settings'))", { touch }); await sleep(1800);
        r.check((await S.path()) === "/account" && (await catLinks(S)).length === 5, { page: page(p), control: `← Settings (back link from ${label})`, expected: "returns to the category list", actual: await S.path(), evidence: "", impact: "usability", repro: "" });
      }
    }
    // billing > contact is reachable and marks Billing and contact current
    await go(S, "/account?section=contact");
    const cur2 = await catLinks(S);
    r.check(!MOBILE ? cur2.some((c) => c.t === "Billing and contact" && c.cur === "page") : true, { page: page("/account?section=contact"), control: "Contact information highlighted under 'Billing and contact'", expected: "Billing and contact stays current on the contact screen", actual: JSON.stringify(cur2.filter((c) => c.cur)), evidence: "", impact: "cosmetic", repro: "" });
    // an unknown section value
    await go(S, "/account?section=nonsense");
    const fv = await S.evaluate("(() => { const i = document.querySelector('input[placeholder=\"Display name\"]'); return !!i && i.getBoundingClientRect().width > 1; })()");
    r.pass({ page: page("/account?section=nonsense"), control: "Unknown ?section= value (informational)", expected: "(informational)", actual: `profile form shown=${fv}; list: ${JSON.stringify((await catLinks(S)).filter((c) => c.cur))}`, evidence: "", impact: "improvement", repro: "" });
    // Switch profile selector in the Settings header
    await go(S, "/account?section=profile");
    const sel = await S.evaluate("(() => { const b = document.querySelector('button[aria-label=\"Switch profile\"]'); return b ? b.innerText.trim() : null; })()");
    await A.clickSel(S, 'button[aria-label="Switch profile"]', { touch }); await sleep(700);
    const opts = await S.evaluate("[...document.querySelectorAll('[role=menuitemradio]')].map((o) => o.innerText.replace(/\\s+/g, ' ').trim())");
    const clickedOpt = await A.clickText(S, "QA Journey Business", "[role=menuitemradio]", { touch }); await sleep(5000); await S.settle().catch(() => {});
    await sleep(2000);
    const active = await S.evaluate("localStorage.getItem('vltd_active_profile_id_v1')");
    const hdr = await S.evaluate("(document.body.innerText.match(/SETTINGS\\s+([^\\n]+)/) || [])[1]");
    r.check(clickedOpt && active === m.businessId && /QA Journey Business/.test(hdr || ""), { page: page("/account?section=profile"), control: "Settings header: Switch profile (selector)", expected: "lists both profiles; choosing Business reloads on the Business profile", actual: `shown "${sel}"; options=${JSON.stringify(opts)}; clicked=${clickedOpt}; active business=${active === m.businessId}; header="${hdr}"`, evidence: await S.jshot(`acc-shell-switch-${W}`), impact: "blocked workflow", repro: "Settings: open Switch profile; choose the business" });
    // restore Personal
    await A.clickSel(S, 'button[aria-label="Switch profile"]', { touch }); await sleep(600);
    await A.clickText(S, "QA Visual Collection|QA Settings Name", "[role=menuitemradio]", { touch }); await sleep(5000);
    const back2 = await S.evaluate("localStorage.getItem('vltd_active_profile_id_v1')");
    r.check(back2 === m.personalId, { page: page("/account"), control: "Switch profile back to Personal", expected: "Personal active again", actual: `personal=${back2 === m.personalId}`, evidence: "", impact: "usability", repro: "" });
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e); process.exit(2); });
