// On-screen Insurance check: every Insurance page in dark and light themes at desktop and phone width, with settled screenshots and measured facts.
//   AUDIT_MANIFEST=<manifest> node ins-screens.cjs [widths=1440,390] [themes=deep-vault,pearl-light]
const { session, sleep, man, fs, AUD } = require("./audit-lib.cjs");
const WIDTHS = (process.argv[2] || "1440,390").split(",").map(Number);
const THEMES = (process.argv[3] || "deep-vault,pearl-light").split(",");
const DIR = AUD + "/insurance-batch2/screens"; fs.mkdirSync(DIR, { recursive: true });
const FACTS = `JSON.stringify((() => {
  const dark = document.documentElement.getAttribute("data-vltd-theme") !== "pearl-light" && !document.documentElement.classList.contains("theme-light");
  const fallback = dark ? [20, 22, 26] : [245, 240, 232];
  const rgb = (s) => (s.match(/[\\d.]+/g) || []).map(Number);
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length >= 3 && (c.length < 4 || c[3] > 0.6)) return c; } return fallback; };
  const vis = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 1 && r.height > 1 && cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0.05; };
  const texts = [...document.querySelectorAll("main h1, main h2, main td, main th, main label, main button, main a, main p, main span, main div")].filter((e) => vis(e) && e.children.length === 0 && (e.innerText || "").trim().length > 1);
  const ratios = texts.map((e) => { const a = lum(rgb(getComputedStyle(e).color)), b = lum(bgOf(e)); return { r: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), t: (e.innerText || "").trim().slice(0, 40) }; }).sort((x, y) => x.r - y.r);
  const ctrls = [...document.querySelectorAll("main button, main a[href], main input, main label")].filter(vis).map((e) => { const r = e.getBoundingClientRect(); const x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1), y = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1); const top = document.elementFromPoint(x, y); return { t: ((e.innerText || e.getAttribute("aria-label") || e.getAttribute("placeholder") || "") + "").trim().slice(0, 28), w: Math.round(r.width), h: Math.round(r.height), y: Math.round(r.top), onScreen: r.top >= 0 && r.top < innerHeight, covered: r.top >= 0 && r.top < innerHeight && top && !(e === top || e.contains(top) || top.contains(e)) ? (top.getAttribute("data-site-chrome") ? "site-chrome" : top.tagName) : null }; });
  return { loadingText: /loading/i.test(document.body.innerText.slice(0, 600)), overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth), worstContrast: ratios.slice(0, 4), textCount: texts.length, controlsSmallerThan44: ctrls.filter((c) => c.h < 44 && c.onScreen).length, controlCount: ctrls.length, coveredControls: ctrls.filter((c) => c.covered), docHeight: document.documentElement.scrollHeight };
})())`;
(async () => {
  const m = man(); const st = m.stamp;
  const soldId = null;
  const out = [];
  for (const width of WIDTHS) {
    const phone = width < 600;
    const S = await session("owner", { width, height: phone ? 844 : 900, mobile: phone });
    const admin = require("./audit-lib.cjs").admin;
    const sid = (await admin.from("vault_items").select("id").eq("profile_id", m.personalId).eq("status", "SOLD").limit(1)).data[0].id;
    const pages = [
      ["inventory", "/insurance", `document.querySelectorAll("tbody tr").length > 3`],
      ["packet", "/insurance/packet", `document.querySelectorAll("tbody tr").length > 3`],
      ["packet-print", "/insurance/packet/print?page=0&images=0", `document.querySelectorAll("tbody tr").length > 3`],
      ["item-sheet", `/insurance/item?id=qa_ins_${st}_allin`, `/Insurance Item Sheet/i.test(document.body.innerText)`],
      ["item-sheet-sold", `/insurance/item?id=${sid}`, `/Insurance Item Sheet/i.test(document.body.innerText)`],
      ["schedule", "/portfolio/insurance", `document.body.innerText.length > 300`],
      ["report", "/reports/insurance", `document.body.innerText.length > 400`],
    ];
    for (const theme of THEMES) {
      await S.evaluate(`localStorage.setItem("vltd-theme", ${JSON.stringify(theme)}); true`);
      for (const [name, path, wait] of pages) {
        const rec = { width, theme, page: name };
        try {
          await S.visit(path); await S.waitFor(wait, 120000, name).catch(() => {}); await sleep(4000);
          await S.evaluate(`window.scrollTo(0, 0); true`); await sleep(500);
          rec.facts = JSON.parse(await S.evaluate(FACTS));
          const h = Math.min(rec.facts.docHeight, 2600);
          const file = `${theme}-${width}-${name}`;
          const top = await S.send("Page.captureScreenshot", { format: "png" });
          fs.writeFileSync(`${DIR}/${file}-top.png`, Buffer.from(top.data, "base64"));
          if (rec.facts.docHeight > (phone ? 900 : 950)) {
            const full = await S.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: h, scale: 1 } });
            fs.writeFileSync(`${DIR}/${file}-full.png`, Buffer.from(full.data, "base64"));
          }
          rec.file = file;
        } catch (e) { rec.error = String(e.message).slice(0, 140); }
        out.push(rec);
        console.log(`${theme} ${width} ${name}`.padEnd(40), JSON.stringify({ err: rec.error, loading: rec.facts?.loadingText, overflowX: rec.facts?.overflowX, worst: rec.facts?.worstContrast?.[0] && Number(rec.facts.worstContrast[0].r.toFixed(2)), small: rec.facts?.controlsSmallerThan44, covered: rec.facts?.coveredControls?.map((c) => c.t + ">" + c.covered) }));
      }
    }
    await S.close();
  }
  fs.writeFileSync(`${DIR}/screens-summary.json`, JSON.stringify(out, null, 1));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
