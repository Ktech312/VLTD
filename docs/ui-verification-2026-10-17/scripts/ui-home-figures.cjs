// Queue C: Home's four financial figures against figures computed independently from the account's rows (synthetic QA account).
//   node ui-home-figures.cjs [--base=http://localhost:3000]
const { session, qa, admin, sleep } = require("./ui-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=http://localhost:3000").slice(7);
let pass = 0, fail = 0;
const check = (name, ok, detail) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", name, ok ? "" : JSON.stringify(detail ?? "").slice(0, 700)); };
const info = (n, d) => console.log("INFO", n, JSON.stringify(d ?? "").slice(0, 700));
const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
async function figures(S) {
  await S.go("/dashboard"); await S.waitFor("/Collection overview/i.test(document.body.innerText) && /Purchase cost/i.test(document.body.innerText)", 120000, "home figures"); await sleep(3500);
  return S.evaluate("document.querySelector('section[aria-label=\"Collection overview\"]').innerText.split(String.fromCharCode(10)).map((x) => x.trim()).filter(Boolean)");
}
const tile = (lines, label) => { const i = lines.findIndex((l) => l.toLowerCase() === label.toLowerCase()); return i < 0 ? null : lines.slice(i + 1, i + 5); };
(async () => {
  const S = await session(BASE, { width: 1440, height: 900 });
  try {
    const rows = (await admin.from("vault_items").select("*").eq("profile_id", qa.profileId)).data;
    const held = rows.filter((r) => r.status !== "SOLD");
    const sold = rows.filter((r) => r.status === "SOLD");
    const cost = held.reduce((s, r) => s + (num(r.purchase_price) || 0), 0);
    const costedCount = held.filter((r) => num(r.purchase_price) !== null).length;
    const valuedCostedHeld = held.filter((r) => num(r.current_value) !== null && num(r.purchase_price) !== null);
    const unreal = valuedCostedHeld.reduce((s, r) => s + num(r.current_value) - num(r.purchase_price), 0);
    const revenue = sold.reduce((s, r) => s + (num(r.sold_price) || 0), 0);
    info("expected from the rows", { held: held.length, sold: sold.length, cost, costedCount, unreal, unrealOn: valuedCostedHeld.length, revenue });

    let L = await figures(S);
    info("Home tiles as shown", L.slice(0, 40));
    const joined = L.join(" | ");
    check("[C1] Purchase cost = sum of the held items' purchase prices (" + money(cost) + ")", joined.includes(money(cost)), joined);
    check("[C2] Sales revenue = sum of sold prices (" + money(revenue) + ") and says how many sold", joined.includes(money(revenue)) && new RegExp(String(sold.length) + " sold", "i").test(joined), joined);
    check("[C3] Unrealized change = value minus cost on items that have BOTH (" + (unreal >= 0 ? "+" : "-") + money(Math.abs(unreal)) + " on " + valuedCostedHeld.length + ")", joined.includes(money(Math.abs(unreal))) && new RegExp("On " + valuedCostedHeld.length + " of", "i").test(joined), joined);
    check("[C4] the four figures stay distinct tiles: Purchase cost, Estimated value, Unrealized change, Sales revenue", ["purchase cost", "estimated value", "unrealized change", "sales revenue"].every((x) => joined.toLowerCase().includes(x)), joined);

    // basis switch must not change unrealized change; the item whose cost is blank must not be counted as $0
    const before = tile(L, "Unrealized change");
    await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => /Show priced only/i.test(x.textContent)); if (b) b.click(); return !!b; })()"); await sleep(1200);
    const L2 = await S.evaluate("document.querySelector('section[aria-label=\"Collection overview\"]').innerText.split(String.fromCharCode(10)).map((x) => x.trim()).filter(Boolean)");
    check("[C5] switching the value basis (priced only) does not change Unrealized change", JSON.stringify(tile(L2, "Unrealized change")) === JSON.stringify(before), { before, after: tile(L2, "Unrealized change") });

    // known zero profit vs missing: add a sold item with price == cost and one with no cost, check both read differently
    const id1 = "qa_ui_" + qa.stamp + "_c1", id2 = "qa_ui_" + qa.stamp + "_c2";
    const now = Date.now();
    const base = { profile_id: qa.profileId, created_at: now, is_public: false, status: "SOLD", universe: "SPORTS", category: "SPORTS_CARDS", category_label: "Sports Cards", sold_at: now - 86400e3, sold_platform: "eBay" };
    await admin.from("vault_items").insert([{ ...base, id: id1, title: "QA Sold Even", purchase_price: 50, sold_price: 50 }, { ...base, id: id2, title: "QA Sold No Cost", purchase_price: null, sold_price: 70 }]);
    try {
      await S.go("/vault/sold"); await S.waitFor("/QA Sold Even/.test(document.body.innerText)", 120000, "sold list"); await sleep(2500);
      const t = await S.evaluate("document.body.innerText");
      const around = (title) => { const i = t.indexOf(title); return i < 0 ? "" : t.slice(i, i + 220).split(String.fromCharCode(10)).join(" | "); };
      info("sold list: even item", around("QA Sold Even")); info("sold list: no-cost item", around("QA Sold No Cost"));
      const even = around("QA Sold Even"), nocost = around("QA Sold No Cost");
      const head = (s) => s.split("Return")[0];
      check("[C6] a sale at exactly cost has a KNOWN result (after fees, so -$7 here), shown with a proper minus sign", /-\$7/.test(head(even)) && !/unknown/i.test(head(even)), even);
      check("[C7] a sale with no recorded cost says 'Profit unknown (no cost)' and does NOT show +$60", /Profit unknown \(no cost\)/.test(head(nocost)) && !/\+\$60/.test(head(nocost)), nocost);
      await S.go("/dashboard"); await S.waitFor("/Sales revenue/i.test(document.body.innerText)", 120000); await sleep(3500);
      const home2 = await S.evaluate("document.querySelector('section[aria-label=\"Collection overview\"]').innerText.split(String.fromCharCode(10)).join(' | ')");
      info("Home after adding two sales (one with no cost)", home2.slice(home2.indexOf("SALES REVENUE"), home2.indexOf("SALES REVENUE") + 260));
      check("[C8] Home: revenue counts all 4 sales ($360), profit is the costed sales only, and it says one was not counted", /\$360/.test(home2) && /4 sold/.test(home2) && /Profit [+-]\$\d+ after estimated fees/.test(home2) && /Not counted: 1 sold without a recorded cost/.test(home2), home2);
      const p1 = /Profit ([+-])\$(\d+) after estimated fees/.exec(home2);
      check("[C9] and the profit did not grow because of the no-cost sale (the costed sales' $111 plus the at-cost sale's -$7 = $104)", p1 && p1[1] === "+" && Number(p1[2]) === 104, p1 && p1[0]);
    } finally { await admin.from("vault_items").delete().in("id", [id1, id2]); }

    // long name / huge totals / empty collection
    const empty = await admin.from("vault_items").select("id").eq("profile_id", qa.profileId);
    info("account rows now", empty.data.length);
  } finally { await S.close(); }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
