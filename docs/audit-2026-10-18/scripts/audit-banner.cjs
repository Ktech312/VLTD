// Does the "Add to Home Screen" banner's Dismiss button dismiss it (and stay dismissed after a reload)? The generic probe saw no effect on 100+ pages.
const { session, R, sleep } = require("./audit-lib.cjs");
const r = R("CRW");
(async () => {
  for (const [kind, w, mobile] of [["owner", 390, true], ["owner", 1440, false], ["visitor", 390, true]]) {
    const S = await session(kind, { width: w, height: mobile ? 800 : 900, mobile });
    const path = kind === "visitor" ? "/" : "/dashboard";
    await S.visit(path); await S.waitFor("[...document.querySelectorAll('button')].some((x) => x.textContent.trim() === 'Dismiss')", 25000, "banner").catch(() => {}); await sleep(1000);
    const find = `(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Dismiss'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), w: Math.round(r.width), h: Math.round(r.height) }; })()`;
    const pos = await S.evaluate(find);
    const present = () => S.evaluate("/Add to Home Screen/.test(document.body.innerText)");
    const before = await present(); await S.jshot(`crw-banner-before-${kind}-${w}`);
    if (!pos) { r.nt({ page: `${path} | ${kind} ${w}px`, control: "Add to Home Screen banner: Dismiss", expected: "banner dismisses and stays dismissed", actual: "no Dismiss button on this load", impact: "none", repro: "" }); await S.close(); continue; }
    await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: pos.x, y: pos.y, button: "none" });
    await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x: pos.x, y: pos.y, button: "left", clickCount: 1, buttons: 1 });
    await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: pos.x, y: pos.y, button: "left", clickCount: 1, buttons: 0 });
    await sleep(1500);
    const afterClick = await present();
    await S.visit(path); await sleep(2500);
    const afterReload = await present(); const shot1 = await S.jshot(`crw-banner-after-reload-${kind}-${w}`);
    r.check(before && !afterClick && !afterReload, { page: `${path} | ${kind} ${w}px`, control: "Add to Home Screen banner: Dismiss", expected: "the banner disappears when Dismiss is pressed and does not return on reload", actual: `banner present before: ${before}; right after Dismiss: ${afterClick}; after reload: ${afterReload}; Dismiss button ${pos.w}x${pos.h}px`, evidence: shot1, impact: "usability", repro: "Open the page, press Dismiss on the Add to Home Screen banner, reload." });
    await S.close();
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
