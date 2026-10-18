const { browser, admin, sleep, man } = require("./journey-lib.cjs");
const dl = (S) => S.evaluate("Object.fromEntries([...document.querySelectorAll('section[aria-label=\"Cost to sell\"] dl > div')].map((d) => [d.querySelector('dt').textContent.trim(), d.querySelector('dd').textContent.trim()]))");
const n = (s) => Number(String(s).replace(/[^0-9.]/g, ""));
(async () => {
  const m = man(); const ctrl = (await admin.from("vault_items").select("id").eq("profile_id", m.personalId).eq("title", "QA Owned Control")).data[0];
  const S = await browser("https://vltd.app");
  try {
    await S.go("/vault/item/" + ctrl.id); await S.waitFor("document.querySelector('section[aria-label=\"Cost to sell\"] dl')", 120000); await sleep(2500);
    const a = await dl(S); await S.setVal('input[aria-label="Override fee percent (optional)"]', "5"); await sleep(800); const b = await dl(S);
    console.log("table:", JSON.stringify(a), "\noverride 5%:", JSON.stringify(b));
    const g = n(a.Gross), fT = n(a.Fees), fO = n(b.Fees);
    console.log(((g > 0 && Math.abs(fO - 0.05 * g) < 0.011) ? "PASS" : "FAIL") + " override fee = exactly 5% of the price: " + fO + " vs " + (0.05 * g).toFixed(2));
    console.log(((g > 0 && Math.abs(fT - (g * 0.136 + 0.4)) < 0.02) ? "PASS" : "FAIL") + " table fee = 13.6% + $0.40 per order (eBay general rate): " + fT + " vs " + (g * 0.136 + 0.4).toFixed(2));
  } finally { await S.close(); }
})().catch((e) => { console.error(e.message); process.exit(2); });
