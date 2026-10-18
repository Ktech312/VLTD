// Left/right balance of page content at several widths (synthetic account, production or local). READ-ONLY.
//   node centering.cjs --base=https://vltd.app [--widths=1669,1280,390]
process.env.CHROME_PROFILE_ROOT = process.env.CHROME_PROFILE_ROOT || "C:/Users/EK/AppData/Local/Temp/qa-c";
const { browser, admin, sleep, man } = require("./journey-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=https://vltd.app").slice(7);
const WIDTHS = ((process.argv.find((a) => a.startsWith("--widths=")) || "--widths=1669,1280,390").slice(9)).split(",").map(Number);
const MEASURE = `(() => {
  const vw = document.documentElement.clientWidth;
  const root = document.querySelector('.vltd-content-wrap') || document.body;
  let L = Infinity, R = -Infinity, n = 0;
  const hdr = document.querySelector('h1'); const hr = hdr && hdr.getBoundingClientRect();
  const nav = document.querySelector('nav[data-local-nav]'); const nr = nav && nav.getBoundingClientRect();
  for (const e of root.querySelectorAll('*')) {
    const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
    if (e.closest('nav:not([data-local-nav]), header, [data-testid=seasonal], [aria-hidden=true]')) continue;
    const r = e.getBoundingClientRect(); if (r.width < 60 || r.height < 12 || r.width > vw * 0.985) continue;
    // only boxes that paint something or hold text
    const paints = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.borderLeftWidth !== '0px' || cs.boxShadow !== 'none' || e.matches('img,svg,input,button,select,textarea') || (e.children.length === 0 && e.textContent.trim());
    if (!paints) continue;
    if (r.right < 0 || r.left > vw) continue;
    L = Math.min(L, r.left); R = Math.max(R, r.right); n++;
  }
  return { vw, left: Math.round(L), right: Math.round(vw - R), h1Left: hr ? Math.round(hr.left) : null, navLeft: nr ? Math.round(nr.left) : null, n };
})()`;
(async () => {
  const m = man();
  const gal = (await admin.from("galleries").select("id").eq("profile_id", m.personalId).limit(1)).data[0];
  const it = (await admin.from("vault_items").select("id").eq("profile_id", m.personalId).eq("status", "COLLECTION").limit(1)).data[0];
  const PAGES = [["/dashboard", "Home"], ["/vault", "Items"], ["/vault/for-sale", "For Sale"], ["/vault/sold", "Sold"], ["/portfolio", "Insights"], ["/goals", "Goals"], ["/vault/item/" + it.id, "Item"], ["/museum", "Exhibitions"], ["/museum/" + gal.id, "Exhibition editor"], ["/account", "Settings"], ["/community-board", "Lounge"], ["/discover", "Discover"]];
  const rows = [];
  for (const w of WIDTHS) {
    const S = await browser(BASE, { width: w, height: 900, mobile: w < 500 });
    try {
      for (const [p, name] of PAGES) {
        await S.go(p); await sleep(7000);
        let r; try { r = await S.evaluate(MEASURE); } catch (e) { r = { err: e.message.slice(0, 60) }; }
        const bal = r.left != null && r.right != null && Number.isFinite(r.left) ? r.left - r.right : null;
        rows.push({ w, name, ...r, imbalance: bal });
        console.log(String(w).padStart(5), name.padEnd(18), JSON.stringify(r), bal === null ? "" : Math.abs(bal) > 12 ? "  <-- UNBALANCED by " + bal : "  ok");
      }
    } finally { await S.close(); }
  }
  require("fs").writeFileSync(__dirname + "/centering-" + (BASE.includes("localhost") ? "local" : "prod") + ".json", JSON.stringify(rows, null, 1));
})();
