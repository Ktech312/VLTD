// VIS-06 (local, simulated seasonal theme row active now): the Home 'Seasonal theme' switch with dark/light and Classic/Simple Glass.
const L = require("./lib.cjs"); const { check, sleep } = L;
(async () => { const s = await L.open({ width: 1280, height: 1000 });
  try {
    const st = async () => JSON.parse(await s.evaluate(`JSON.stringify({ on: !!document.querySelector('[aria-label="Seasonal theme"][aria-checked="true"]'), has: !!document.querySelector('[aria-label="Seasonal theme"]'), accent: document.documentElement.style.getPropertyValue("--accent"), theme: document.documentElement.getAttribute("data-vltd-theme"), icon: document.documentElement.getAttribute("data-vltd-icon-style"), seasonal: document.documentElement.getAttribute("data-seasonal"), lights: getComputedStyle(document.querySelector(".vltd-seasonal-lights") || document.body).display, bg: getComputedStyle(document.body).backgroundColor, fg: getComputedStyle(document.body).color, pref: localStorage.getItem("vltd_theme_overrides") })`));
    await s.go("/dashboard", 9000); await s.dismiss(); let a = await st(); console.log("   initial:", JSON.stringify(a));
    check("VIS-06: with a seasonal theme active, Home offers the 'Seasonal theme' switch, off by default, base colours unchanged", a.has && !a.on && !/ff4058/i.test(a.accent), a);
    check("VIS-06: turning the switch on applies the seasonal accent and remembers the Yes", (await s.mclick("Seasonal theme")) && (await sleep(1500), true)); let b = await st(); console.log("   on:", JSON.stringify(b));
    check("VIS-06: seasonal on => accent colour and string lights applied, choice stored", b.on && /ff4058/i.test(b.accent) && /accepted/.test(b.pref || ""), b);
    await s.go("/dashboard", 8000); await s.dismiss(); const c = await st(); check("VIS-06: seasonal stays on after a reload and across another page", c.on && /ff4058/i.test(c.accent), c);
    await s.go("/account?section=preferences", 8000); await s.dismiss();
    await s.mclick("LIGHT"); await sleep(900); await s.mclick("Simple Glass"); await sleep(900); const d = await st(); console.log("   light+glass while seasonal on:", JSON.stringify(d));
    check("VIS-06: Light + Simple Glass apply together with the seasonal accent still on", /simplified-glass/.test(d.icon || "") && /ff4058/i.test(d.accent) && d.theme !== "deep-vault", d);
    await s.go("/dashboard", 8000); await s.dismiss(); const e = await st(); check("VIS-06: the combination survives navigating to Home", /simplified-glass/.test(e.icon || "") && /ff4058/i.test(e.accent) && e.on, e);
    check("VIS-06: turning the switch off removes the seasonal accent and keeps Light + Simple Glass", (await s.mclick("Seasonal theme")) && (await sleep(1500), true)); const f = await st(); console.log("   off:", JSON.stringify(f));
    check("VIS-06: seasonal off => base accent restored, appearance choices kept, 'dismissed' stored", !f.on && !/ff4058/i.test(f.accent) && /simplified-glass/.test(f.icon || "") && f.theme === d.theme && /dismissed/.test(f.pref || ""), f);
    await s.go("/dashboard", 8000); await s.dismiss(); const g = await st(); check("VIS-06: off also survives a reload", !g.on && !/ff4058/i.test(g.accent), g);
    await s.go("/account?section=preferences", 8000); await s.dismiss(); await s.mclick("DARK"); await s.mclick("Classic"); await sleep(900);
  } finally { await s.close(); } console.log(JSON.stringify(L.results())); process.exit(0); })();
