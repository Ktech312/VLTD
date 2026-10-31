// The eight remaining button-contrast checks, on the live app (vltd.app), phone emulation, synthetic collector. Nothing is saved or clicked.
// Real pages (measured as rendered): Account security Save, Insurance item Print, Insurance packet "Open Printable Page", Saved "Open The Flip", Onboarding check mark (if the page shows it).
// Admin pages cannot be opened by a test account (no admin permission is granted): their nine buttons are REPRODUCED on a live page by building the same element (same tag, classes and inline style as the source) and measuring it, once without and once with the inline colour.
//   AUDIT_MANIFEST=<qa manifest> TUT_WORK=<dir> node contrast-eight.cjs <outDir>
const fs = require("fs"), path = require("path");
const GUIDE = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/walkthrough/add-item-guide/_build";
const { start, T } = require(GUIDE + "/lib.cjs");
const sharp = require("C:/Users/EK/VLTD/node_modules/sharp");
const sleep = T.sleep, admin = T.admin;
const OUT = process.argv[2];
const LIGHT = "rgb(200, 205, 210)", DARK = "rgb(140, 146, 152)"; // the two ends of the silver gradient (#C8CDD2, #8C9298)
// colours are normalised through a canvas, so rgb(), color(srgb ...) and anything else the browser reports are read the same way
const ratioFn = `(c1, c2) => { const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true }); const rgb = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; }; const L = (c) => { const m = rgb(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; }; const a = L(c1), b = L(c2); return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100; }`;
const results = [];
const rec = (name, kind, colour, extra) => { results.push({ name, kind, colour, ...extra }); console.log(`${(extra && extra.pass === false) ? "FAIL" : (extra && extra.pass ? "PASS" : "INFO")} [${kind}] ${name} :: colour ${colour}${extra ? " " + JSON.stringify(extra) : ""}`); };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const R = await start({ scene: "contrast-eight", phone: true, camera: false });
  const { S, m } = R;
  const measure = async (expr) => S.evaluate(`(() => { const e = ${expr}; if (!e) return null; const cs = getComputedStyle(e); const c = cs.color; const r = (${ratioFn}); return { color: c, onLight: r(c, ${JSON.stringify(LIGHT)}), onDark: r(c, ${JSON.stringify(DARK)}), tag: e.tagName, text: (e.innerText || '').trim().slice(0, 30) }; })()`);
  const verdict = (x) => !!x && x.onLight >= 4.5 && x.onDark >= 3;
  try {
    await S.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    // 1 Account security Save (PrivacyIdentityCards)
    await R.goto("/account/security"); await sleep(3500);
    const save = await measure(`[...document.querySelectorAll('button')].filter((b) => /^Save$/.test(b.innerText.trim()) && /gold-gradient/.test(b.getAttribute('style') || '') ).pop()`);
    rec("Account security: Save (PrivacyIdentityCards)", "real page", save && save.color, { ...save, pass: verdict(save) });
    const png = await S.send("Page.captureScreenshot", { format: "png" }); await sharp(Buffer.from(png.data, "base64")).jpeg({ quality: 80 }).toFile(path.join(OUT, "account-security.jpg"));
    // 2 Insurance item Print
    const items = (await admin.from("vault_items").select("id").eq("profile_id", m.personalId).limit(1)).data || [];
    await R.goto(items[0] ? `/insurance/item?id=${items[0].id}` : "/insurance"); await sleep(3500);
    const pr = await measure(`[...document.querySelectorAll('button')].find((b) => /print/i.test(b.innerText))`);
    rec("Insurance item: Print", "real page", pr && pr.color, { ...pr, pass: verdict(pr) });
    // 3 Insurance packet link
    await R.goto("/insurance/packet"); await sleep(3500);
    const pk = await measure(`[...document.querySelectorAll('a')].find((a) => /Open Printable Page/.test(a.innerText))`);
    rec("Insurance packet: Open Printable Page (link)", "real page", pk && pk.color, { ...pk, pass: verdict(pk) });
    // 4 Saved page link
    await R.goto("/saved"); await sleep(3500);
    const sv = await measure(`[...document.querySelectorAll('a')].find((a) => /Open The Flip/.test(a.innerText))`);
    rec("Saved: Open The Flip (link)", "real page", sv && sv.color, { ...sv, pass: sv ? verdict(sv) : undefined, note: sv ? undefined : "link not shown (the saved list is not empty or the page differs)" });
    // 5 Onboarding check mark (a div, not a button)
    await R.goto("/onboarding"); await sleep(3500);
    const ob = await measure(`[...document.querySelectorAll('div')].find((d) => d.innerText.trim() === '✓' && /text-\\[#0B0B0B\\]/.test(String(d.className)))`);
    rec("Onboarding: check mark (div)", ob ? "real page" : "not reachable", ob && ob.color, { ...ob, pass: ob ? verdict(ob) : undefined, path: await S.path() });
    // 6-8 Admin pages: reproduced on a live page
    await R.goto("/dashboard"); await sleep(2500);
    const repro = [
      ["Admin waitlist: Approve & Invite (1 button)", 'inline-flex h-9 items-center rounded-full px-4 text-xs font-black text-[#0B0B0B] transition hover:brightness-105 disabled:opacity-50', 'background: var(--theme-gold-gradient); box-shadow: var(--theme-gold-glow)'],
      ["Admin spotlights: New / Save (2 buttons)", 'rounded-full px-5 py-2.5 text-sm font-black text-[#0B0B0B] transition hover:brightness-110', 'background: linear-gradient(135deg, #8C9298, #C8CDD2)'],
      ["Admin museum campus: 5 buttons", 'shrink-0 rounded-xl px-4 text-sm font-black text-[#0B0B0B] transition hover:brightness-110 disabled:opacity-50', 'background: linear-gradient(135deg, #8C9298, #C8CDD2)'],
    ];
    for (const [name, cls, style] of repro) {
      const before = await S.evaluate(`(() => { const b = document.createElement('button'); b.type = 'button'; b.className = ${JSON.stringify(cls)}; b.setAttribute('style', ${JSON.stringify(style)}); b.textContent = 'Save'; (document.querySelector('main') || document.body).appendChild(b); const cs = getComputedStyle(b); const c = cs.color; const r = (${ratioFn}); const out = { color: c, onLight: r(c, ${JSON.stringify(LIGHT)}), onDark: r(c, ${JSON.stringify(DARK)}), tag: 'BUTTON', text: 'Save' }; b.remove(); return out; })()`);
      const after = await S.evaluate(`(() => { const b = document.createElement('button'); b.type = 'button'; b.className = ${JSON.stringify(cls)}; b.setAttribute('style', ${JSON.stringify(style + '; color: #0B0B0B')}); b.textContent = 'Save'; (document.querySelector('main') || document.body).appendChild(b); const cs = getComputedStyle(b); const c = cs.color; const r = (${ratioFn}); const out = { color: c, onLight: r(c, ${JSON.stringify(LIGHT)}), onDark: r(c, ${JSON.stringify(DARK)}), tag: 'BUTTON', text: 'Save' }; b.remove(); return out; })()`);
      rec(name + " — as the source was (reproduced)", "reproduced", before && before.color, { ...before, pass: undefined, expectedDefect: !verdict(before) });
      rec(name + " — with the fix (reproduced)", "reproduced", after && after.color, { ...after, pass: verdict(after) });
    }
    // Onboarding check mark: a div with the same classes and style, reproduced (the onboarding page itself redirects an account that has finished onboarding)
    const dv = await measure(`(() => { const d = document.createElement('div'); d.className = 'rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#0B0B0B]'; d.setAttribute('style', 'background: var(--theme-gold-gradient)'); d.textContent = '✓'; (document.querySelector('main') || document.body).appendChild(d); window.__d = d; return d; })()`);
    await S.evaluate(`window.__d.remove()`);
    rec("Onboarding: check mark (div) — reproduced", "reproduced", dv && dv.color, { ...dv, pass: verdict(dv) });
  } catch (e) { console.log("SCRIPT ERROR:", e.message); }
  fs.writeFileSync(path.join(OUT, "contrast-eight.json"), JSON.stringify(results, null, 1));
  await R.close(); process.exit(0);
})();
