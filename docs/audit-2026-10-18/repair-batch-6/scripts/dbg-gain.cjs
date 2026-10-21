const path = require("path");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const { admin, sleep, session } = A; const m = A.man(); const P = m.personalId;
(async () => {
  const rows = (await admin.from("vault_items").select("id,title,status,current_value,purchase_price,purchase_tax,purchase_shipping,purchase_fees,estimated_value").eq("profile_id", P)).data.filter((i) => i.status !== "SOLD" && i.status !== "WISHLIST");
  const cost = (i) => Number(i.purchase_price || 0) + Number(i.purchase_tax || 0) + Number(i.purchase_shipping || 0) + Number(i.purchase_fees || 0);
  const all = rows.map((i) => ({ t: i.title.replace(/ - Original.*/, ""), v: i.current_value, c: cost(i), est: i.estimated_value, g: Number(i.current_value) > 0 && cost(i) > 0 ? Number(i.current_value) - cost(i) : null })).sort((a, b) => (a.g ?? 9e9) - (b.g ?? 9e9));
  console.log(JSON.stringify(all.slice(0, 6)));
  const S = await session("owner", { width: 1440, height: 900 });
  await S.visit("/vault"); await sleep(9000);
  await S.evaluate(`(() => { const e = document.querySelector('select[aria-label="Sort the vault"]'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(e, 'gain_asc'); e.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await sleep(2000);
  console.log(JSON.stringify(await S.evaluate("[...document.querySelectorAll('a[href^=\"/vault/item/\"]')].map((a) => (a.innerText||'').trim().split('\n')[0].replace(/ - Original.*/, '')).slice(0, 8)")));
  await S.close(); process.exit(0);
})();
