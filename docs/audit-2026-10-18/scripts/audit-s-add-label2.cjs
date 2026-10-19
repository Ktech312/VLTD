// ADD audit: what label does the item page give to the 'Set / Series' value typed on /capture (corrects ADD-022, which only checked that the value appears)?
const T = require("./audit-s-add-lib.cjs");
const { session, sleep, man, rec, click, typeInto, text, rowsByTitle, removeItems, mine, poll } = T;
const PREFIX = "AUD ADD L ";
(async () => {
  const P = man().personalId;
  await T.removeByPrefix(PREFIX);
  const S = await session("owner", { width: 1440, height: 900 });
  const created = [];
  try {
    await S.visit("/capture"); await S.waitFor("document.getElementById('capture-item-name')", 60000); await sleep(800);
    const t = PREFIX + Date.now().toString(36);
    await typeInto(S, "document.getElementById('capture-item-name')", t);
    await typeInto(S, "[...document.querySelectorAll('input')].find((i) => i.placeholder === 'e.g. 1986 Fleer Basketball')", "SetSeries-Token");
    await click(S, T.btnExpr("^Save to Vault$"));
    const r = await poll(async () => { const x = await rowsByTitle(P, t); return x.length ? x : null; }, 45000, 2500) || []; created.push(...r);
    await S.visit("/vault/item/" + r[0].id); await sleep(2500);
    const body = await S.text();
    const i = body.indexOf("SetSeries-Token");
    const around = body.slice(Math.max(0, i - 200), i + 40).split("\n").map((x) => x.trim()).filter(Boolean).join(" | ");
    console.log('AROUND:', around); await rec(S, /Set|Series/i.test(body.slice(Math.max(0, i - 40), i)), { page: "/vault/item/<id> | owner, Personal", control: "Value typed under 'Set / Series' on /capture, as the item page shows it", expected: "Shown under a label that matches what was typed into (Set / Series)", actual: `the value is stored in the item's Number column and the item page shows it as: '${around}'`, impact: "misleading result", repro: "/capture, type SetSeries-Token in Set / Series, Save, open the item" });
  } catch (e) { console.error(e); } finally { await S.close(); await T.removeByPrefix(PREFIX); await removeItems(created); }
})();
