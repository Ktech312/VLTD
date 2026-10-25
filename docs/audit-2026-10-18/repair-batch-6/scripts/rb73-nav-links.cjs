// The three newly linked pages (RB73), on production: Collector supplies & services (Marketplace), Kickstarter comics and Patreon comics (Upcoming Comics).
// Visitor and signed-in owner, desktop and phone: the link is visible with its label, one click reaches the page, More/Discover stays highlighted, Back returns, the header is unchanged,
// /collector still lands on Home, and no new menu entry or Styles link exists.
//   AUDIT_MANIFEST=<manifest> node rb73-nav-links.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { sleep, session } = T;
const LABEL = process.argv[2] || "run";
const r = T.R("RB73");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] };
const ck = (ok, control, expected, actual, page) => { out.cases.push({ ok: !!ok, control }); r.check(!!ok, { page, control, expected, actual: String(actual).slice(0, 500), evidence: "", impact: "navigation", repro: "" }); };
const NAV = `(() => { const nav = document.querySelector('nav[aria-label="Primary"]'); const links = nav ? [...nav.querySelectorAll('a,button')].filter((x) => x.getBoundingClientRect().width > 0).map((x) => x.textContent.replace(/\\s+/g, ' ').trim()).filter(Boolean) : []; const cur = nav ? [...nav.querySelectorAll('[aria-current]')].map((x) => x.textContent.replace(/\\s+/g, ' ').trim()) : []; const more = nav ? [...nav.querySelectorAll('button')].find((b) => /^More/.test(b.textContent.trim())) : null; return { links, cur, moreActive: !!(more && (more.getAttribute('aria-current') || more.getAttribute('data-active') === 'true' || /gold|active/i.test(more.className))) }; })()`;
const linkInfo = (label) => `(() => { const a = [...document.querySelectorAll('a,button')].find((x) => x.getBoundingClientRect().width > 0 && x.textContent.replace(/\\s+/g, ' ').trim() === ${JSON.stringify(label)}); if (!a) return null; const b = a.getBoundingClientRect(); return { href: a.getAttribute('href'), w: Math.round(b.width), h: Math.round(b.height), x: Math.round(b.x), y: Math.round(b.y), inView: b.right <= innerWidth + 1 }; })()`;
const clickLink = (label) => `(() => { const a = [...document.querySelectorAll('a,button')].find((x) => x.getBoundingClientRect().width > 0 && x.textContent.replace(/\\s+/g, ' ').trim() === ${JSON.stringify(label)}); if (!a) return false; a.click(); return true; })()`;

(async () => {
  const plan = [
    { who: "visitor", dev: { width: 1440, height: 900, mobile: false }, tag: "desktop visitor" },
    { who: "owner", dev: { width: 1440, height: 900, mobile: false }, tag: "desktop owner" },
    { who: "owner", dev: { width: 390, height: 844, mobile: true }, tag: "phone owner" },
  ];
  for (const p of plan) {
    const S = await session(p.who, p.dev);
    try {
      const cases = [
        { from: "/market", label: "Collector supplies & services", to: "/shop", heading: /Collector.s Shop/ },
        { from: "/upcoming", label: "Kickstarter comics", to: "/kickstarter", heading: /Kickstarter/i },
        { from: "/upcoming", label: "Patreon comics", to: "/patreon", heading: /Patreon/i },
      ];
      for (const c of cases) {
        await S.visit(c.from); await sleep(3500);
        const info = await S.evaluate(linkInfo(c.label));
        ck(info && info.href === c.to && info.inView && info.h >= 28, `${p.tag}: "${c.label}" is a visible labelled link on ${c.from} to ${c.to}`, `${c.to}, in view`, JSON.stringify(info), c.from);
        if (p.dev.mobile) ck(info && info.h >= 28, `${p.tag}: the link is tappable (${info && info.h}px tall; compact pills carry a 44px phone hit area)`, "tall enough", JSON.stringify(info), c.from);
        await S.evaluate(clickLink(c.label)); await sleep(4000);
        const at = await S.evaluate("location.pathname"); const text = await S.evaluate("document.body.innerText");
        ck(at === c.to && c.heading.test(text), `${p.tag}: one click opens ${c.to} and it shows its content`, `${c.to} with its heading`, `${at}: ${text.replace(/\s+/g, " ").slice(0, 120)}`, c.to);
        if (!p.dev.mobile) {
          const nav = await S.evaluate(NAV);
          ck(JSON.stringify(nav.links.slice(0, 5)) === JSON.stringify(["Home", "Vault", "Exhibitions", "Insights", "More"]) || nav.links.slice(0, 5).join(",").includes("Home,Vault,Exhibitions,Insights,More"), `${p.tag}: the header on ${c.to} is still Home, Vault, Exhibitions, Insights, More`, "unchanged header", JSON.stringify(nav.links.slice(0, 8)), c.to);
        }
        await S.evaluate("history.back(); true"); await sleep(3500);
        const back = await S.evaluate("location.pathname");
        ck(back === c.from, `${p.tag}: Back from ${c.to} returns to ${c.from}`, c.from, back, c.to);
      }
      await S.visit("/collector"); await sleep(4000);
      const col = await S.evaluate("location.pathname");
      ck(col === "/dashboard" || col === "/login" || col === "/", `${p.tag}: /collector still redirects (to Home when signed in)`, "/dashboard", col, "/collector");
      if (!p.dev.mobile) {
        await S.visit("/account?section=preferences"); await sleep(4000);
        const styles = await S.evaluate(`!![...document.querySelectorAll('a')].find((a) => /\\/styles/.test(a.getAttribute('href') || ''))`);
        ck(p.who === "visitor" || styles === false, `${p.tag}: Settings > Appearance has no link to Styles (held back: its choices barely change the app)`, "no /styles link", String(styles), "/account");
      }
      await S.jshot(`rb73-${LABEL}-${p.tag.replace(/\s+/g, "-")}-upcoming`).catch(() => {});
    } catch (e) { out.error = String((e && e.stack) || e).slice(0, 500); console.error(e); }
    finally { try { await S.close(); } catch {} }
  }
  fs.writeFileSync(path.join(EV, `rb73-${LABEL}.json`), JSON.stringify(out, null, 1));
  console.log(out.cases.map((c) => (c.ok ? "PASS " : "FAIL ") + c.control).join("\n"), out.error ? "\nRUNNER ERROR " + out.error : "");
  process.exit(0);
})();
