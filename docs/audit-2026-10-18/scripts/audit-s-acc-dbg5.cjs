const A = require("./audit-s-acc-lib.cjs");
const { admin, man } = A;
(async () => {
  const m = man();
  await admin.from("profiles").update({ collection_interests: ["MUSIC", "SPORTS"] }).eq("id", m.personalId);
  const S = await A.session("owner", { width: 1440, height: 900 });
  try {
    await S.visit("/account"); await A.sleep(2500);
    await A.mouseClick(S, 5, 5);
    console.log(await S.evaluate(`JSON.stringify([...document.querySelectorAll('main button')].filter((b) => /^(Pop Culture|Sports|TCG & Non Sport Card|Music|Jewelry & Apparel|Games|Built, Botany & Bar|Misc|Gears & Gasoline|Art)$/.test(b.innerText.trim())).map((b) => ({ t: b.innerText.trim(), style: b.getAttribute('style'), bg: getComputedStyle(b).backgroundColor, bd: getComputedStyle(b).boxShadow.slice(0, 40), col: getComputedStyle(b).color })))`));
    await S.jshot("acc-dbg5-interests");
  } finally { await S.close(); await admin.from("profiles").update({ collection_interests: null }).eq("id", m.personalId); }
})();
