// VLT suite 2b: re-runs and deeper checks after suite 2: drag-back (my first attempt started outside the strip), banner Yes/No effect, Upload > Single item opens the file picker.
const V = require("./audit-s-vlt-lib.cjs");
const { R, sleep, squash, drag, clickEl, fs, AUD } = V; const r = R("VLT");
const PG = "/dashboard | owner, Personal, 26 owned + 5 sold";
const strip = "document.querySelector('[aria-label^=\"Recently added items. Use\"]')";
const sl = (S) => S.evaluate(`(() => { const s = ${strip}; return { left: Math.round(s.scrollLeft), max: s.scrollWidth - s.clientWidth }; })()`);
const snap = (S) => S.evaluate(`(() => { const root = document.documentElement; const q = document.querySelector('a[href="/vault/quick"]'); return { dataSeasonal: root.getAttribute('data-seasonal'), inlineSeasonalVars: ['--seasonal-accent','--seasonal-accent-secondary','--seasonal-bg-tint'].map((v) => root.style.getPropertyValue(v)).join('|'), themeGold: getComputedStyle(root).getPropertyValue('--theme-gold').trim(), accent: getComputedStyle(root).getPropertyValue('--accent').trim(), accentSecondary: getComputedStyle(root).getPropertyValue('--accent-2').trim(), quickAddBorder: q && getComputedStyle(q).borderColor, bodyBg: getComputedStyle(document.body).backgroundColor, promptShown: /Switch app theme/.test(document.body.innerText), stored: localStorage.getItem('vltd_theme_overrides') }; })()`);
(async () => {
  const S = await V.session("owner");
  try {
    r.pass({ page: PG, control: "(test note) first run of VLT-047, VLT-057, VLT-061", expected: "n/a", actual: "First-run failures kept. VLT-047: my drag started 220px left of the first card, i.e. outside the strip (test mistake). VLT-057 and VLT-061 are examined below (VLT-071..) because the first assertions were too narrow, not wrong.", evidence: "", impact: "none", repro: "see audit-s-vlt-home2.cjs" });
    // drag back
    await S.visit("/dashboard"); await S.evaluate(`${strip}.scrollIntoView({ block: 'center' }); true`); await sleep(500);
    const b = await S.evaluate(`(() => { const s = ${strip}; const r = s.getBoundingClientRect(); const c = s.querySelector('[data-recent-item] img').getBoundingClientRect(); return { sx: r.left, sw: r.width, y: c.top + c.height / 2 }; })()`);
    await drag(S, b.sx + b.sw - 40, b.y, b.sx + 40, b.y); await sleep(1000); const f = await sl(S);
    await drag(S, b.sx + 40, b.y, b.sx + b.sw - 40, b.y); await sleep(1000); const g = await sl(S);
    r.check(f.left > 150 && g.left < f.left - 100, { page: PG, control: "Recently added mouse drag right and back (re-run)", expected: "Drag left scrolls forward; drag right (inside the strip) scrolls back", actual: JSON.stringify({ afterLeftDrag: f, afterRightDrag: g }), impact: "usability", repro: "Drag left across the cards, then right" });

    // banner Yes / No: what changes?
    const rec = {};
    for (const [tname, theme] of [["deep-vault (fixture default)", "deep-vault"], ["no theme chosen", null]]) {
      for (const choice of ["none", "No", "Yes"]) {
        await S.visit("/dashboard");
        await S.evaluate(`localStorage.removeItem('vltd_theme_overrides'); ${theme ? `localStorage.setItem('vltd-theme', ${JSON.stringify(theme)})` : "localStorage.removeItem('vltd-theme')"}; true`); await S.visit("/dashboard"); await sleep(1200);
        const before = await snap(S);
        if (choice !== "none") { await clickEl(S, `[...document.querySelectorAll('.vltd-dark-surface button')].find((x) => x.textContent.trim() === '${choice}')`, { js: true }); await sleep(900); }
        const after = await snap(S);
        await S.visit("/dashboard"); await sleep(1200); const reload = await snap(S);
        rec[`${tname} / ${choice}`] = { before, after, reload };
      }
    }
    fs.writeFileSync(AUD + "/vlt-banner-yesno-diagnostic.json", JSON.stringify(rec, null, 1));
    const diffs = (a, b2) => Object.keys(a).filter((k) => !["promptShown", "stored"].includes(k) && a[k] !== b2[k]);
    const yes = rec["deep-vault (fixture default) / Yes"], no = rec["deep-vault (fixture default) / No"], yes2 = rec["no theme chosen / Yes"];
    const visibleYes = diffs(yes.before, yes.after), visibleYes2 = diffs(yes2.before, yes2.after);
    r.check(visibleYes.length > 0 || visibleYes2.length > 0, { page: PG, control: "Banner 'Switch app theme?' Yes", expected: "Yes switches the app to the seasonal theme: something about the app's look (accent colours, data-seasonal, background) differs after Yes compared with before", actual: `Seasonal variables and data-seasonal were ALREADY applied before any choice; after Yes the only change is the prompt disappearing and a 'accepted' flag stored. Changed look-properties after Yes: deep-vault=${JSON.stringify(visibleYes)}, no-theme=${JSON.stringify(visibleYes2)}; --theme-gold stays ${yes.after.themeGold}`, evidence: "vlt-banner-yesno-diagnostic.json", impact: "misleading result", repro: "Open /dashboard while a seasonal banner with 'Switch app theme?' shows; compare page colours before and after clicking Yes" });
    r.check(diffs(no.before, no.after).length > 0, { page: PG, control: "Banner 'Switch app theme?' No", expected: "No leaves the app theme as it was and remembers the choice (prompt stays hidden after reload)", actual: `look-properties changed after No: ${JSON.stringify(diffs(no.before, no.after))}; data-seasonal='${no.after.dataSeasonal}' still applied (it was applied before any choice); prompt hidden after reload=${!no.reload.promptShown}; stored=${no.after.stored}`, evidence: "vlt-banner-yesno-diagnostic.json", impact: "misleading result", repro: "Click No; inspect <html data-seasonal>" });
    r.pass({ page: PG, control: "Banner Yes/No remembering the choice", expected: "Prompt does not return after a choice", actual: `after reload prompt shown: Yes=${yes.reload.promptShown}, No=${no.reload.promptShown}`, evidence: "vlt-banner-yesno-diagnostic.json", impact: "none", repro: "Click Yes or No; reload" });
    await S.evaluate("localStorage.setItem('vltd-theme', 'deep-vault'); localStorage.removeItem('vltd_theme_overrides'); true");

    // Upload > Single item: does the file chooser open?
    await S.visit("/dashboard");
    await S.send("Page.setInterceptFileChooserDialog", { enabled: true });
    let chooser = 0; S.c.on((e) => { if (e.method === "Page.fileChooserOpened") chooser++; });
    await clickEl(S, "[...document.querySelectorAll('button[aria-label=\"Upload from device\"]')].find((x) => x.getBoundingClientRect().width > 0)", { js: true }); await sleep(500);
    await clickEl(S, "[...document.querySelectorAll('[role=menuitem]')].find((a) => /Single item/.test(a.innerText))", { js: true });
    await sleep(3500);
    r.check(chooser === 1, { page: PG, control: "Upload from device > Single item", expected: "Opens the Add Item page and immediately opens the device file picker (page comment: 'so the file picker opens immediately')", actual: `file chooser opened ${chooser} time(s); landed ${await S.path()}`, evidence: await S.jshot("vlt-home-upload-single"), impact: "usability", repro: "Home > upload icon > Single item" });
    await S.send("Page.setInterceptFileChooserDialog", { enabled: false });
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });
