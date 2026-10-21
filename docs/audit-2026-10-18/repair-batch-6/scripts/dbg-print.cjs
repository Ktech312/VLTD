const path = require("path");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const { sleep, session } = A; const m = A.man();
(async () => {
  const S = await session("owner", { width: 1440, height: 900 });
  await S.evaluate("(() => { for (const k of Object.keys(localStorage)) if (/^vltd_(vault_items|items|galleries|goals|sales)/.test(k)) localStorage.removeItem(k); return true; })()").catch(() => {});
  await S.visit("/vault/print"); await sleep(15000);
  console.log((await S.text()).replace(/\s+/g, " ").slice(0, 400));
  console.log(JSON.stringify(await S.evaluate("(() => { const raw = localStorage.getItem('vltd_vault_items_v1'); let arr = []; try { arr = JSON.parse(raw || '[]'); } catch {} return { len: arr.length, profiles: [...new Set(arr.map((x) => x.profile_id))], active: localStorage.getItem('vltd_active_profile_id_v1'), keys: Object.keys(localStorage).filter((k) => /vltd/.test(k)) }; })()")));
  console.log("expected profile", m.personalId);
  await S.close(); process.exit(0);
})();
