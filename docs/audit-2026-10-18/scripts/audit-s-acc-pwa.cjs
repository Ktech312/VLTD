// ACC: PWA install banner. The browser only fires beforeinstallprompt on its own heuristics, so the audit dispatches a synthetic beforeinstallprompt event (browser-emulated).
const A = require("./audit-s-acc-lib.cjs");
const { session, R, sleep } = A;
const r = R("ACC");
setTimeout(() => { console.log("WATCHDOG"); process.exit(3); }, 600000).unref();

const FIRE = `(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = async () => { window.__pwaPrompted = (window.__pwaPrompted || 0) + 1; }; e.userChoice = Promise.resolve({ outcome: 'dismissed' }); window.dispatchEvent(e); return true; })()`;
const STATE = `(() => { const bs = [...document.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().width > 1); const i = bs.find((b) => (b.getAttribute('aria-label') || b.innerText).trim() === 'Install'); const d = bs.find((b) => (b.getAttribute('aria-label') || b.innerText).trim() === 'Dismiss'); const box = i && i.closest('[style*="fixed"]'); const rc = box && box.getBoundingClientRect(); return { install: !!i, dismiss: !!d, text: box ? box.innerText.replace(/\\s+/g, ' ').trim() : '', rect: rc ? { x: Math.round(rc.left), y: Math.round(rc.top), w: Math.round(rc.width), h: Math.round(rc.height) } : null, iw: innerWidth, ih: innerHeight, prompted: window.__pwaPrompted || 0, ls: { dismissed: localStorage.getItem('vltd_pwa_dismissed_until'), installed: localStorage.getItem('vltd_pwa_installed') } }; })()`;

async function run(width, mobile, kind) {
  const tag = (mobile ? "390 (browser-emulated touch)" : "1440") + (kind === "visitor" ? "" : ", signed in");
  const S = await session(kind, { width, height: mobile ? 844 : 900, mobile });
  const page = `/ | ${kind} | ${tag}`;
  try {
    await S.visit(kind === "visitor" ? "/" : "/dashboard"); await sleep(1500);
    await S.evaluate(FIRE); await sleep(800);
    let st = await S.evaluate(STATE);
    const shot = await S.jshot(`acc-pwa-${kind}-${width}`);
    const inside = st.rect && st.rect.x >= 0 && st.rect.x + st.rect.w <= st.iw && st.rect.y >= 0 && st.rect.y + st.rect.h <= st.ih;
    r.check(st.install && st.dismiss && /Add to Home Screen/.test(st.text) && inside, { page, control: "PWA install banner (appears when the browser offers installation)", expected: "small banner 'Add to Home Screen' with Install and Dismiss, fully on screen", actual: JSON.stringify(st), evidence: shot, impact: "usability", repro: "Open the app in a browser that fires beforeinstallprompt (audit dispatches a synthetic event)" });
    // does it sit on top of the persistent bottom controls (signed-in phone)?
    if (kind !== "visitor" && mobile) {
      const over = await S.evaluate(`(() => { const box = [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '').trim() === 'Install'); const bx = box && box.closest('[style*="fixed"]'); if (!bx) return null; const a = bx.getBoundingClientRect(); const hits = [...document.querySelectorAll('a,button')].filter((e) => !bx.contains(e) && e.getBoundingClientRect().width > 1).filter((e) => { const b = e.getBoundingClientRect(); return !(b.right < a.left || b.left > a.right || b.bottom < a.top || b.top > a.bottom); }).map((e) => (e.getAttribute('aria-label') || e.innerText || '').trim().slice(0, 30)); return hits; })()`);
      r.check(Array.isArray(over) && over.length === 0, { page, control: "PWA banner position vs other fixed controls (phone)", expected: "banner does not cover bottom nav / Add Item controls", actual: "overlapping controls: " + JSON.stringify(over), evidence: shot, impact: "usability", repro: "Signed in at 390px, trigger install offer on /dashboard" });
    }
    // Install: browser prompt is called, banner goes away
    await A.clickExpr(S, `[...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '').trim() === 'Install')`, { touch: mobile });
    await sleep(900);
    st = await S.evaluate(STATE);
    r.check(st.prompted === 1 && !st.install, { page, control: "Install (PWA banner)", expected: "asks the browser to install (prompt called once) and the banner closes", actual: `prompt calls=${st.prompted}; banner still shown=${st.install}; installed flag=${st.ls.installed} (outcome emulated as dismissed, so not remembered as installed)`, evidence: "", impact: "blocked workflow", repro: "Offer install, click Install" });
    // Dismiss: needs a fresh offer
    await S.evaluate(FIRE); await sleep(600);
    await A.clickExpr(S, `[...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || '').trim() === 'Dismiss')`, { touch: mobile });
    await sleep(700);
    st = await S.evaluate(STATE);
    const days = st.ls.dismissed ? Math.round((Number(st.ls.dismissed) - Date.now()) / 86400000) : null;
    await S.visit(kind === "visitor" ? "/" : "/dashboard"); await sleep(1200);
    await S.evaluate(FIRE); await sleep(800);
    const st2 = await S.evaluate(STATE);
    r.check(!st.install && days >= 6 && !st2.install, { page, control: "Dismiss (PWA banner)", expected: "banner closes now and is not offered again after a reload (7-day cooldown)", actual: `closed=${!st.install}; cooldown days=${days}; offered again after reload=${st2.install}`, evidence: "", impact: "usability", repro: "Offer install, click Dismiss, reload, offer again" });
  } finally { await S.close(); }
}

(async () => {
  await run(1440, false, "visitor");
  await run(390, true, "visitor");
  await run(390, true, "owner");
})().catch((e) => { console.error("ERR", e); process.exit(2); });
