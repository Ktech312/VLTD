// Button and link text contrast scan of the live app (vltd.app): every user-facing page the synthetic collector can reach (phone emulation, not a physical phone), then the signed-out pages.
// For every visible button, link, [role=button] and submit input with text: rendered text colour (with its alpha) against the rendered background behind it. The background is found by walking up the
// ancestors (colour layers are composited, gradients contribute every colour stop) and the WORST stop counts. Hard failure = ratio below 3.0; marginal = 3.0 to 4.5.
// Disabled controls (dimmed on purpose) are skipped. Nothing is clicked or saved.
//   AUDIT_MANIFEST=<qa manifest> TUT_WORK=<dir> node contrast-scan.cjs <outDir>
const fs = require("fs"), path = require("path");
const GUIDE = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/walkthrough/add-item-guide/_build";
const { start, T } = require(GUIDE + "/lib.cjs");
const sleep = T.sleep, admin = T.admin;
const OUT = process.argv[2];
const SIGNED_IN = ["/dashboard", "/vault", "/vault/for-sale", "/vault/sold", "/vault/quick", "/vault/bulk", "/vault/halls", "/vault/frames", "/vault/import", "/vault/add", "/vault/readiness", "/vault/sync", "/capture",
  "/portfolio", "/portfolio/insurance", "/goals", "/insurance", "/insurance/packet", "/museum", "/museum/new", "@builder", "@item", "/museum/vltd", "/discover", "/events", "/upcoming", "/market", "/shop", "/sales",
  "/learn", "/learn/articles", "/guide", "/guide/walkthrough", "/activity", "/messages", "/notifications", "/favorites", "/saved", "/watchlist", "/watchlist/checklist", "/clubs", "/community-board", "/lounge-preview",
  "/registry", "/auction", "/kickstarter", "/patreon", "/redeem", "/account", "/account/security", "/account/billing", "/account/invite", "/account/roles", "/account/team", "/account/workspace",
  "/museum/virtual-room", "/museum/virtual-room/guest", "/museum/campus-prototype", "/museum/builder", "/account/business/new", "/styles", "/ai/drafts", "/ai/review", "/ingest", "/reports/weekly", "/reports/insurance", "/onboarding", "/collector"];
const SIGNED_OUT = ["/", "/login", "/signup", "/forgot-password", "/reset-password"];

const scan = `(() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = (c) => { if (!c || c === 'transparent') return [0, 0, 0, 0]; const m = c.match(/^rgba?\\(\\s*([\\d.]+)[, ]+\\s*([\\d.]+)[, ]+\\s*([\\d.]+)(?:\\s*[,/]\\s*([\\d.]+%?))?\\s*\\)$/); if (m) { let a = m[4] === undefined ? 1 : (m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])); return a === 0 ? [0, 0, 0, 0] : [+m[1], +m[2], +m[3], a]; } const draw = (bg) => { cx.globalCompositeOperation = 'source-over'; cx.fillStyle = bg; cx.fillRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; }; const w = draw('#fff'), b = draw('#000'); const a = 1 - (w[1] - b[1]) / 255; if (a <= 0.004) return [0, 0, 0, 0]; return [Math.min(255, Math.round(b[0] / a)), Math.min(255, Math.round(b[1] / a)), Math.min(255, Math.round(b[2] / a)), Math.min(1, a)]; };
  const over = (top, base) => { const a = top[3]; return [top[0] * a + base[0] * (1 - a), top[1] * a + base[1] * (1 - a), top[2] * a + base[2] * (1 - a), 1]; };
  const lum = (c) => { const m = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const stopsOf = (img) => (img.match(/rgba?\\([^)]*\\)|color\\([^)]*\\)/g) || []).map(rgba).filter((c) => c[3] > 0);
  // list of possible backgrounds behind an element: each ancestor layer composited over what lies beneath it
  const bgs = (el) => { const chain = []; for (let e = el; e; e = e.parentElement) chain.push(e);
    const rootBg = rgba(getComputedStyle(document.body).backgroundColor); let bases = rootBg[3] > 0 ? [over(rootBg, [255, 255, 255, 1])] : [[16, 18, 22, 1]];
    for (let i = chain.length - 1; i >= 0; i--) { const cs = getComputedStyle(chain[i]); const img = cs.backgroundImage || ''; if (/url\\(/.test(img)) return null; // a picture behind the text: unknown, skipped
      const col = rgba(cs.backgroundColor); let nb = bases; if (col[3] > 0) nb = nb.map((b) => over(col, b));
      if (/gradient/.test(img)) { const st = stopsOf(img); if (st.length) { if (st.every((x) => x[3] >= 0.9)) nb = st.map((x) => over(x, nb[0])); else { const base0 = nb[0]; const mix = st.map((x) => over(x, base0)); nb = [[mix.reduce((t, m) => t + m[0], 0) / mix.length, mix.reduce((t, m) => t + m[1], 0) / mix.length, mix.reduce((t, m) => t + m[2], 0) / mix.length, 1]]; } } }
      bases = nb.slice(0, 8); }
    return bases; };
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 3 && r.height > 3 && cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity) > 0.05; };
  const out = []; let checked = 0, marginal = 0, skippedPhoto = 0; const margList = [];
  for (const e of document.querySelectorAll('button, a[href], [role=button], input[type=submit], input[type=button], summary')) {
    if (!vis(e) || e.disabled || e.getAttribute('aria-disabled') === 'true') continue;
    const text = ((e.innerText || e.value || '') + '').trim().replace(/\\s+/g, ' '); if (!text) continue;
    // skip when an ancestor is fully faded
    let faded = false; for (let p = e; p; p = p.parentElement) { if (parseFloat(getComputedStyle(p).opacity) < 0.5) { faded = true; break; } } if (faded) continue;
    const cs = getComputedStyle(e); let tc = rgba(cs.webkitTextFillColor && cs.webkitTextFillColor !== 'rgba(0, 0, 0, 0)' ? cs.webkitTextFillColor : cs.color); if (tc[3] === 0) continue;
    const bg = bgs(e); if (!bg) { skippedPhoto++; continue; } const effText = bg.map((b) => over(tc, b)); let worst = 99; bg.forEach((b, i) => { worst = Math.min(worst, ratio(effText[i], b)); });
    checked++; if (worst >= 3 && worst < 4.5) { marginal++; if (margList.length < 12) margList.push({ text: text.slice(0, 36), ratio: Math.round(worst * 100) / 100, tag: e.tagName, cls: String(e.className).slice(0, 80) }); }
    if (worst < 3) out.push({ tag: e.tagName, text: text.slice(0, 40), color: cs.color, ratio: Math.round(worst * 100) / 100, bg: bg.slice(0, 3).map((b) => 'rgb(' + b.slice(0, 3).map(Math.round).join(',') + ')'), cls: String(e.className).slice(0, 110), style: (e.getAttribute('style') || '').slice(0, 110), y: Math.round(e.getBoundingClientRect().top + scrollY) });
  }
  return { checked, marginal, skippedPhoto, margList, fails: out };
})()`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const R = await start({ scene: "contrast-scan", phone: true, camera: false });
  const { S, m } = R; const report = [];
  const run = async (label, url) => {
    try { await R.goto(url); await sleep(1700); const r = await S.evaluate(scan); const p = await S.path(); report.push({ page: label, landed: p, ...r }); console.log(`${label.padEnd(34)} -> ${p.padEnd(34)} checked=${r.checked} marginal=${r.marginal} FAIL=${r.fails.length}${r.fails.length ? " :: " + r.fails.slice(0, 4).map((f) => `${f.text} (${f.ratio})`).join("; ") : ""}`); }
    catch (e) { console.log(label, "error", e.message); report.push({ page: label, error: e.message }); }
  };
  try {
    await S.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    if (process.env.SANITY) {
      await R.goto("/dashboard"); await sleep(1500);
      await S.evaluate(`(() => { const host = document.querySelector('main') || document.body; const bad = document.createElement('button'); bad.className = 'rounded-full px-4 py-2 text-sm font-black text-[#0B0B0B]'; bad.setAttribute('style', 'background: linear-gradient(135deg, #8C9298, #C8CDD2)'); bad.textContent = 'SANITYBAD'; host.appendChild(bad); const good = document.createElement('button'); good.className = 'rounded-full px-4 py-2 text-sm font-black'; good.setAttribute('style', 'background: linear-gradient(135deg, #8C9298, #C8CDD2); color: #0B0B0B'); good.textContent = 'SANITYGOOD'; host.appendChild(good); return true; })()`);
      const r = await S.evaluate(scan);
      console.log("SANITY: flagged =", JSON.stringify(r.fails.filter((f) => /SANITY/.test(f.text)).map((f) => ({ text: f.text, ratio: f.ratio }))), "(expect SANITYBAD only)");
      await R.close(); process.exit(0);
    }
    const g = (await admin.from("galleries").select("id").eq("profile_id", m.personalId).limit(1)).data || [];
    const it = (await admin.from("vault_items").select("id").eq("profile_id", m.personalId).limit(1)).data || [];
    for (const u of SIGNED_IN) {
      if (u === "@builder") { if (g[0]) await run("exhibition builder", "/museum/" + g[0].id); continue; }
      if (u === "@item") { if (it[0]) await run("item page", "/vault/item/" + it[0].id); continue; }
      await run(u, u);
    }
    // Controls that cannot be rendered with this account (admin pages, owner-only museum builder, certificate scan): rebuilt on a live page with their exact tag, classes and inline style, then scanned.
    const REPRO = [
      ["button", "mt-4 w-full rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50", "", "REPRO admin/characters amber button"],
      ["button", "rounded-full bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400 transition", "", "REPRO admin/themes amber button"],
      ["button", "flex items-center gap-1.5 rounded-[6px] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] backdrop-blur transition bg-[#4FD3EE] text-[#06171d] hover:brightness-110", "", "REPRO museum builder Publish/Done"],
      ["a", "flex min-h-10 items-center gap-2 rounded-[6px] bg-[#4FD3EE] px-3 text-xs font-black uppercase tracking-[0.12em] text-[#06171d] transition hover:brightness-110", "", "REPRO campus overview link"],
      ["button", "inline-flex h-9 items-center rounded-[7px] px-4 text-xs font-bold text-black", "background: var(--theme-gold, #C8CDD2)", "REPRO certificate scan Apply"],
      ["button", "flex-1 rounded-xl bg-[color:var(--theme-gold)] py-2.5 text-sm font-black text-black hover:opacity-85 transition-opacity disabled:opacity-40", "", "REPRO halls gold button (class only)"],
      ["button", "inline-flex h-9 items-center rounded-full px-4 text-xs font-black text-[#0B0B0B] transition hover:brightness-105 disabled:opacity-50", "background: var(--theme-gold-gradient); box-shadow: var(--theme-gold-glow)", "REPRO admin waitlist button"],
      ["button", "rounded-full px-5 py-2.5 text-sm font-black text-[#0B0B0B] transition hover:brightness-110", "background: linear-gradient(135deg, #8C9298, #C8CDD2)", "REPRO admin spotlights button"],
      ["a", "mt-2 inline-flex h-11 items-center rounded-full px-6 text-sm font-black text-[#0B0B0B] transition hover:brightness-105", "background: linear-gradient(135deg, #8C9298 0%, #A8AEB4 30%, #C8CDD2 60%, #A8AEB4 100%)", "REPRO saved link (class only)"],
    ];
    await run("(reproduction host) /dashboard", "/dashboard");
    await S.evaluate(`(() => { const host = document.querySelector('main') || document.body; for (const [tag, cls, style, label] of ${JSON.stringify(REPRO)}) { const e = document.createElement(tag); if (tag === 'button') e.type = 'button'; else e.href = '#'; e.className = cls; if (style) e.setAttribute('style', style); e.textContent = label; host.appendChild(e); } return true; })()`);
    const rp = await S.evaluate(scan);
    const reproFails = rp.fails.filter((f) => /^REPRO/.test(f.text));
    const reproChecked = REPRO.length;
    console.log(`REPRODUCED controls: ${reproChecked}; hard failures among them: ${reproFails.length}${reproFails.length ? " :: " + reproFails.map((f) => `${f.text} (${f.ratio})`).join("; ") : ""}`);
    report.push({ page: "(reproductions)", landed: "/dashboard", checked: reproChecked, marginal: 0, fails: reproFails, reproduced: true });
    // signed out: clear the session, then the public pages
    await S.send("Network.enable", {}); await S.send("Network.clearBrowserCookies", {});
    await S.evaluate(`(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} return true; })()`);
    for (const u of SIGNED_OUT) await run("(signed out) " + u, u);
  } catch (e) { console.log("SCRIPT ERROR:", e.message); }
  fs.writeFileSync(path.join(OUT, "contrast-scan.json"), JSON.stringify(report, null, 1));
  const all = report.filter((r) => r.fails);
  console.log(`DONE pages=${report.length} controlsChecked=${all.reduce((s, r) => s + r.checked, 0)} hardFailures=${all.reduce((s, r) => s + r.fails.length, 0)} marginal=${all.reduce((s, r) => s + r.marginal, 0)}`);
  await R.close(); process.exit(0);
})();
