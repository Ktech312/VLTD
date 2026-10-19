const C = require("./audit-s-dis-common.cjs");
const { R, sleep, clean, admin, man } = C; const r = R("DIS"); const m = man(); const st = m.stamp;
(async () => {
  const S = await C.session("owner");
  await S.visit("/watchlist"); await sleep(3500);
  await C.click(S, `([...document.querySelectorAll('main button')].find((b) => /Current Value/.test(b.innerText) && b.querySelector('.font-serif')?.textContent.trim() === 'QA dis Wish Alpha'))`); await sleep(400);
  await C.click(S, `document.querySelector('aside button[aria-label="Set target price"]')`); await sleep(300);
  await C.typeInto(S, "aside input[placeholder='Target price']", "150");
  await C.click(S, `([...document.querySelectorAll('aside button')].find((b) => b.textContent.trim() === 'Save'))`);
  let toast = false; for (let i = 0; i < 14 && !toast; i++) { await sleep(250); toast = /Target price set to \$150/.test(clean(await S.text())); }
  await sleep(1500);
  const db = (await admin.from("wishlist").select("target_price").eq("id", `qa_dis_w1_${st}`).single()).data;
  r.check(toast && Number(db.target_price) === 150, { page: "/watchlist | owner, Personal", control: "Target price: pencil -> 150 -> Save (toast polled)", expected: "toast 'Target price set to $150' and database target_price = 150", actual: `toast seen=${toast}, db=${db.target_price}`, evidence: "n/a", impact: "misleading result", repro: "Select a wishlist item; pencil; 150; Save" });
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
