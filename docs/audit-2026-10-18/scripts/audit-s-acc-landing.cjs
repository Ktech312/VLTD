// ACC: signed-out landing page, every link/CTA (real mouse at 1440, browser-emulated touch at 390), anchors, vault animation close, PWA banner.
const A = require("./audit-s-acc-lib.cjs");
const { session, R, sleep } = A;
const r = R("ACC");
const FROM = Number((process.argv.find((a) => a.startsWith("--from=")) || "--from=0").slice(7));
const FROM390 = Number((process.argv.find((a) => a.startsWith("--from390=")) || "--from390=0").slice(10));
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7);
setTimeout(() => { console.log("WATCHDOG"); process.exit(3); }, 900000).unref();

const LINKS_JS = `[...document.querySelectorAll('a[href]')].filter((a) => { const b = a.getBoundingClientRect(); const cs = getComputedStyle(a); return b.width > 1 && b.height > 1 && cs.visibility !== 'hidden'; }).map((a, i) => ({ i, label: (a.getAttribute('aria-label') || a.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 60), href: a.getAttribute('href'), region: (a.closest('footer') ? 'footer' : a.closest('header') ? 'header' : 'main') }))`;

async function linkSuite(width, mobile) {
  const tag = mobile ? "390 (browser-emulated touch)" : "1440";
  let S = await session("visitor", { width, height: mobile ? 844 : 900, mobile });
  try {
    await S.visit("/");
    const links = await S.evaluate(LINKS_JS);
    console.log(tag, "links", links.length);
    for (let li = 0; li < links.length; li++) {
      const l = links[li];
      if (!mobile && l.i < FROM) continue;
      if (mobile && l.i < FROM390) continue;
      try { await oneLink(S, l, tag, width, mobile); } catch (e) { console.log("retry after", String(e.message).slice(0, 60)); try { await S.close(); } catch {} S = await session("visitor", { width, height: mobile ? 844 : 900, mobile }); await oneLink(S, l, tag, width, mobile); }
    }
  } finally { try { await S.close(); } catch {} }
}
async function oneLink(S, l, tag, width, mobile) {
  {
    {
      await S.visit("/");
      // ensure the vault animation overlay (if any) is not covering: record only
      const clicked = await A.clickExpr(S, `[...document.querySelectorAll('a[href]')].filter((a) => { const b = a.getBoundingClientRect(); const cs = getComputedStyle(a); return b.width > 1 && b.height > 1 && cs.visibility !== 'hidden'; })[${l.i}]`, { touch: mobile });
      await sleep(1600);
      const p = await S.path(); const hash = await S.evaluate("location.hash");
      const page = `/ | visitor | ${tag} | ${l.region}`;
      const control = `${l.label || "(icon link)"} -> ${l.href}`;
      if (!clicked) { r.fail({ page, control, expected: "link can be clicked", actual: "could not click (not found)", impact: "blocked workflow", repro: "Open / signed out; click the link" }); return; }
      if (l.href.startsWith("#")) {
        const id = l.href.slice(1);
        const info = await S.evaluate(`(() => { const e = document.getElementById(${JSON.stringify(id)}); if (!e) return { exists: false }; const t = e.getBoundingClientRect().top; return { exists: true, top: Math.round(t), sy: Math.round(scrollY) }; })()`);
        const ok = info.exists && p === "/" && Math.abs(info.top) < 250 && info.sy > 100;
        const shot = ok ? "" : await S.jshot(`acc-landing-${width}-anchor-${id}`);
        r.check(ok, { page, control, expected: `scrolls to the on-page section "${id}" (exists, near top of viewport)`, actual: `hash=${hash} path=${p} target exists=${info.exists} top=${info.top} scrollY=${info.sy}`, evidence: shot, impact: ok ? "none" : "misleading result", repro: `Open / signed out; click "${l.label}"` });
      } else {
        const want = l.href.replace(/[?#].*/, "");
        const text = await A.bodyText(S);
        const ok = p.startsWith(want) && !/^404|This page could not be found/i.test(text.slice(0, 200)) && text.length > 60;
        const shot = ok ? "" : await S.jshot(`acc-landing-${width}-dest-${want.replace(/\W+/g, "_")}`);
        r.check(ok, { page, control, expected: `opens ${want} with real content`, actual: `landed on ${p}; text starts: ${text.slice(0, 90)}`, evidence: shot, impact: ok ? "none" : "blocked workflow", repro: `Open / signed out; click "${l.label}"` });
      }
    }
  }
}

async function extras(width, mobile) {
  const tag = mobile ? "390 (browser-emulated touch)" : "1440";
  const S = await session("visitor", { width, height: mobile ? 844 : 900, mobile });
  const page = `/ | visitor | ${tag}`;
  try {
    await S.visit("/");
    // responsive: no horizontal scroll, headline + primary CTA visible without scrolling
    const lay = await S.evaluate("({ sw: document.documentElement.scrollWidth, iw: innerWidth, cta: (() => { const a = [...document.querySelectorAll('a')].find((x) => /claim a free spot/i.test(x.innerText) && x.getBoundingClientRect().width > 1); if (!a) return null; const b = a.getBoundingClientRect(); return { top: Math.round(b.top), h: Math.round(b.height), w: Math.round(b.width), left: Math.round(b.left), right: Math.round(b.right) }; })() })");
    const okLay = lay.sw <= lay.iw + 1 && lay.cta && lay.cta.left >= 0 && lay.cta.right <= lay.iw;
    const shot0 = await S.jshot(`acc-landing-${width}-top`);
    r.check(okLay, { page, control: "Responsive layout (whole page)", expected: "no horizontal scrolling; primary CTA fully inside the viewport", actual: JSON.stringify(lay), evidence: okLay ? "" : shot0, impact: okLay ? "none" : "usability", repro: `Open / at ${width}px wide` });
    if (mobile) {
      const small = await S.evaluate("[...document.querySelectorAll('a[href],button')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 1 && b.height > 1 && (b.height < 32 || b.width < 32) && e.innerText.trim().length > 0 && !e.closest('footer') && b.top < 3000; }).map((e) => (e.innerText || '').trim().slice(0, 30) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height))");
      r.check(small.length === 0, { page, control: "Tap targets (main area, text links/buttons)", expected: "controls are at least 32px tall/wide (comfortable to tap)", actual: small.length ? "small targets: " + small.slice(0, 8).join("; ") : "all >= 32px", evidence: small.length ? shot0 : "", impact: small.length ? "usability" : "none", repro: "Open / at 390px; measure link heights" });
    }
    // vault animation close
    const animBefore = await S.evaluate("(() => { const b = document.querySelector('button[aria-label=\"Close VLTD vault animation\"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top) }; })()");
    if (!animBefore) {
      r.fail({ page, control: "Close VLTD vault animation", expected: "close button exists", actual: "not found", impact: "usability", repro: "Open /" });
    } else {
      const heroBefore = await S.evaluate("(() => { const b = document.querySelector('button[aria-label=\"Close VLTD vault animation\"]'); const box = b.closest('section,div'); let p = b; for (let i = 0; i < 4 && p.parentElement; i++) p = p.parentElement; return { parentH: Math.round(p.getBoundingClientRect().height), vis: getComputedStyle(b).visibility, bodyH: document.body.scrollHeight, canvases: document.querySelectorAll('canvas,video').length }; })()");
      const shotA = await S.jshot(`acc-landing-${width}-anim-before`);
      await A.clickSel(S, 'button[aria-label="Close VLTD vault animation"]', { touch: mobile });
      await sleep(1500);
      const after = await S.evaluate("(() => { const b = document.querySelector('button[aria-label=\"Close VLTD vault animation\"]'); return { btn: !!b && b.getBoundingClientRect().width > 1, bodyH: document.body.scrollHeight, canvases: document.querySelectorAll('canvas,video').length, path: location.pathname }; })()");
      const shotB = await S.jshot(`acc-landing-${width}-anim-after`);
      const ok = !after.btn && after.path === "/";
      r.check(ok, { page, control: "Close VLTD vault animation (button)", expected: "animation overlay closes, page stays on /", actual: `before ${JSON.stringify(heroBefore)} ${JSON.stringify(animBefore)}; after ${JSON.stringify(after)}`, evidence: shotB, impact: ok ? "none" : "usability", repro: "Open /; click the close button on the vault animation" });
      // does it stay closed after reload? (informational)
      await S.visit("/");
      const again = await S.evaluate("!!document.querySelector('button[aria-label=\"Close VLTD vault animation\"]') && document.querySelector('button[aria-label=\"Close VLTD vault animation\"]').getBoundingClientRect().width > 1");
      r.pass({ page, control: "Vault animation after reload", expected: "(informational) whether the closed animation returns after a reload", actual: again ? "animation shows again after a reload (not remembered)" : "stays closed after reload", evidence: "", impact: "improvement", repro: "Close the animation, reload /" });
    }
    // PWA banner
    await S.visit("/");
    const ban = await S.evaluate("(() => { const i = [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Install'); const d = [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Dismiss'); return { install: !!i, dismiss: !!d, text: (i && i.parentElement && i.parentElement.parentElement ? i.parentElement.parentElement.innerText : '').replace(/\\s+/g, ' ').slice(0, 120) }; })()");
    console.log("pwa banner", JSON.stringify(ban));
    if (!ban.install) {
      r.nt({ page, control: "PWA banner Install / Dismiss", expected: "banner shows with Install and Dismiss", actual: "banner not present in this width/state: " + JSON.stringify(ban), impact: "none", repro: "Open / fresh profile" });
    } else {
      const shotP = await S.jshot(`acc-landing-${width}-pwa-banner`);
      // Install without a captured install event
      await A.clickText(S, "^Install$", "button", { touch: mobile });
      await sleep(1200);
      const afterInstall = await S.evaluate("(() => { const t = document.body.innerText; return { stillThere: [...document.querySelectorAll('button')].some((b) => b.innerText.trim() === 'Install' && b.getBoundingClientRect().width > 1), dialog: !!document.querySelector('[role=dialog]'), tip: (t.match(/(Add to Home|Share|Install)[^\\n]{0,100}/g) || []).slice(0, 3) }; })()");
      r.nt({ page, control: "Install (PWA banner)", expected: "Install prompt or instructions", actual: `no real beforeinstallprompt in this automated browser; click result: ${JSON.stringify(afterInstall)} opens=${JSON.stringify((await S.look()).opens)}`, evidence: shotP, impact: "none", repro: "Open / in a browser that offers install; click Install (not verifiable in the audit browser)" });
      // Dismiss
      await S.visit("/");
      await A.clickText(S, "^Dismiss$", "button", { touch: mobile });
      await sleep(900);
      const gone = await S.evaluate("![...document.querySelectorAll('button')].some((b) => b.innerText.trim() === 'Dismiss' && b.getBoundingClientRect().width > 1)");
      await S.visit("/");
      const staysGone = await S.evaluate("![...document.querySelectorAll('button')].some((b) => b.innerText.trim() === 'Dismiss' && b.getBoundingClientRect().width > 1)");
      r.check(gone && staysGone, { page, control: "Dismiss (PWA banner)", expected: "banner closes and does not come back on reload", actual: `closed immediately=${gone}; absent after reload=${staysGone}`, evidence: await S.jshot(`acc-landing-${width}-pwa-dismiss`), impact: gone && staysGone ? "none" : "usability", repro: "Open /; click Dismiss; reload" });
    }
  } finally { await S.close(); }
}

(async () => {
  if (!ONLY || ONLY === "l1440") await linkSuite(1440, false);
  if (!ONLY || ONLY === "e1440") await extras(1440, false);
  if (!ONLY || ONLY === "l390") await linkSuite(390, true);
  if (!ONLY || ONLY === "e390") await extras(390, true);
})().catch((e) => { console.error("ERR", e); process.exit(2); });
