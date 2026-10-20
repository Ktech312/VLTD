// Generates ACTUAL PDFs (Chrome print-to-PDF, print media) of every Insurance document and measures what is really in them, not what is in the DOM.
//   AUDIT_MANIFEST=<manifest> node ins-print-capture.cjs <label> [theme=deep-vault] [only=name,name]
const { session, sleep, admin, man, fs, AUD } = require("./audit-lib.cjs");
const { spawnSync } = require("child_process");
const LABEL = process.argv[2] || "run";
const THEME = process.argv[3] || "deep-vault";
const ONLY = (process.argv[4] || "").split(",").filter(Boolean);
const DIR = AUD + "/insurance-batch2/" + LABEL; fs.mkdirSync(DIR, { recursive: true });
(async () => {
  const m = man(); const st = m.stamp;
  const id = (k) => `qa_ins_${st}_${k}`;
  const soldId = (await admin.from("vault_items").select("id").eq("profile_id", m.personalId).eq("status", "SOLD").limit(1)).data[0].id;
  const docs = [
    { name: "inventory", path: "/insurance", wait: "document.querySelectorAll('tbody tr').length > 3" },
    { name: "packet-screen", path: "/insurance/packet", wait: "document.querySelectorAll('tbody tr').length > 3" },
    { name: "packet-print-p1", path: "/insurance/packet/print?page=0&images=0", wait: "document.querySelectorAll('tbody tr').length > 3" },
    { name: "packet-print-p2", path: "/insurance/packet/print?page=1&images=0", wait: "document.querySelectorAll('tbody tr').length > 0" },
    { name: "item-sheet", path: `/insurance/item?id=${id("allin")}`, wait: "/Insurance Item Sheet/i.test(document.body.innerText)" },
    { name: "item-sheet-sold", path: `/insurance/item?id=${soldId}`, wait: "/Insurance Item Sheet/i.test(document.body.innerText)" },
    { name: "report", path: "/reports/insurance", wait: "document.body.innerText.length > 400" },
    { name: "schedule", path: "/portfolio/insurance", wait: "document.body.innerText.length > 300" },
  ].filter((d) => !ONLY.length || ONLY.includes(d.name));
  const S = await session("owner", { width: 1440, height: 900 });
  await S.evaluate(`localStorage.setItem('vltd-theme', ${JSON.stringify(THEME)}); true`);
  const out = { label: LABEL, theme: THEME, docs: [] };
  for (const d of docs) {
    const rec = { name: d.name, path: d.path };
    try {
      await S.visit(d.path); await S.waitFor(d.wait, 120000, d.name).catch(() => {}); await sleep(4000);
      // DOM facts in PRINT media (what the printer will see)
      await S.send("Emulation.setEmulatedMedia", { media: "print" }); await sleep(800);
      rec.dom = await S.evaluate(`(() => {
        const lum = (rgb) => { const m = rgb.match(/[\\d.]+/g).map(Number); const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
        const bgOf = (el) => { let e = el; while (e) { const c = getComputedStyle(e).backgroundColor; const m = c.match(/[\\d.]+/g); if (m && (m.length < 4 || Number(m[3]) > 0.5)) return c; e = e.parentElement; } return 'rgb(255,255,255)'; };
        const ratio = (el) => { const a = lum(getComputedStyle(el).color), b = lum(bgOf(el)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
        const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 1 && r.height > 1 && cs.display !== 'none' && cs.visibility !== 'hidden'; };
        const chrome = [...document.querySelectorAll('[data-site-chrome], body > div, body > nav, body > header')].filter((e) => vis(e) && getComputedStyle(e).position === 'fixed' && e.getBoundingClientRect().width > innerWidth * 0.8 && e.getBoundingClientRect().top < 5).length;
        const texts = [...document.querySelectorAll('h1,h2,h3,td,th,.item-title,[class*=font-black],[class*=font-semibold]')].filter((e) => vis(e) && (e.innerText || '').trim().length > 0 && e.children.length === 0);
        const ratios = texts.map(ratio); const worst = ratios.length ? Math.min(...ratios) : 0;
        const money = [...document.querySelectorAll('td,div,span')].filter((e) => vis(e) && e.children.length === 0 && /^\\s*-?\\$[\\d,]+\\*?\\s*$/.test(e.innerText || '')).map(ratio);
        return { htmlDisplay: getComputedStyle(document.documentElement).display, bodyHeight: document.body.getBoundingClientRect().height, tableRows: document.querySelectorAll('tbody tr').length, topChromeDisplayed: chrome, textElements: texts.length, worstTextContrast: Number(worst.toFixed(2)), moneyCells: money.length, worstMoneyContrast: money.length ? Number(Math.min(...money).toFixed(2)) : null };
      })()`);
      const pdf = await S.send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true });
      const pdfPath = `${DIR}/${THEME}-${d.name}.pdf`; fs.writeFileSync(pdfPath, Buffer.from(pdf.data, "base64"));
      rec.pdf = pdfPath.replace(AUD + "/", ""); rec.pdfBytes = fs.statSync(pdfPath).size;
      const txt = spawnSync("pdftotext", ["-layout", pdfPath, "-"], { encoding: "utf8" }).stdout || "";
      fs.writeFileSync(pdfPath.replace(/\.pdf$/, ".txt"), txt);
      rec.pdfPages = (txt.match(/\f/g) || []).length || (txt.trim() ? 1 : 0);
      rec.pdfTextChars = txt.replace(/\s+/g, "").length;
      rec.pdfRows = (txt.match(/QA (Album|INS|Sold)/g) || []).length;
      rec.pdfHasSiteBar = /Home\s+Vault\s+Exhibitions\s+Lounge\s+Discover/.test(txt);
      rec.pdfHasTitle = /Inventory Report|Policy Packet|Item Sheet|Insurance/i.test(txt);
      rec.pdfFirstLines = txt.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 4);
      await S.send("Emulation.setEmulatedMedia", { media: "" });
    } catch (e) { rec.error = String(e.message).slice(0, 120); try { await S.send("Emulation.setEmulatedMedia", { media: "" }); } catch {} }
    out.docs.push(rec);
    console.log(d.name.padEnd(16), JSON.stringify({ pages: rec.pdfPages, chars: rec.pdfTextChars, rows: rec.pdfRows, siteBar: rec.pdfHasSiteBar, htmlDisplay: rec.dom?.htmlDisplay, chromeTop: rec.dom?.topChromeDisplayed, textContrast: rec.dom?.worstTextContrast, moneyContrast: rec.dom?.worstMoneyContrast, err: rec.error }));
  }
  fs.writeFileSync(`${DIR}/${THEME}-summary.json`, JSON.stringify(out, null, 1));
  await S.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
