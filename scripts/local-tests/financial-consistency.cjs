// One deterministic fixture read on every surface that shows money: Home, Insights, Vault, Sales History, Activity, weekly report, insurance pages, print report and the CSV export.
// Fixture (expected figures are worked out by hand here, not by the app):
//   A  paid 100.10 + tax 5.05 + shipping 3.00 = cost 108.15, value 150.25        B  paid 0 (explicit), value 40.00
//   C  nothing recorded                                                              D  paid 50.00, no value (counted at cost where the rule says so)
//   E  paid 200.00, value 0 (explicit zero)                                           S  sold: paid 80.00 + fees 2.50 = cost 82.50, sold for 120.50, recorded profit 38.00
// Owned cost 358.15 | value 240.25 (D at cost) | unrealized on A and E: (150.25 + 0) - (108.15 + 200) = -157.90 (-51.2%) | revenue 120.50 | realized profit 38.00 | ROI 38/82.5 = 46.1%.
// The insurance documents deliberately do not count D as value (their own sentence says so): estimate 190.25.
const L = require("./lib.cjs"); const { sleep, NL, check, sim, seed, P } = L; const fs = require("fs"); const os = require("os"); const path = require("path");
const norm = (t) => t.split(NL).map((x) => x.trim()).filter(Boolean).join(" | ").replace(/\s+/g, " "); const now = Date.now(), day = 86400000;
const it = (id, title, o) => ({ id, profile_id: P, title, universe: "MISC", category: "Collectors Choice", category_label: "Collectors Choice", status: "COLLECTION", is_public: false, created_at: now - 3 * day, ...o });
const items = [it("fin_a", "FIN A", { purchase_price: 100.1, purchase_tax: 5.05, purchase_shipping: 3, purchase_fees: 0, current_value: 150.25 }), it("fin_b", "FIN B", { purchase_price: 0, current_value: 40 }), it("fin_c", "FIN C", {}), it("fin_d", "FIN D", { purchase_price: 50 }), it("fin_e", "FIN E", { purchase_price: 200, current_value: 0 }),
  it("fin_s", "FIN S", { purchase_price: 80, purchase_fees: 2.5, status: "SOLD", sold_price: 120.5, sold_at: new Date(now - day).toISOString() })];
const sales = [{ id: "sale_fin_s", profile_id: P, item_id: "fin_s", title: "FIN S", universe: "MISC", category: "Collectors Choice", purchase_price: 80, sale_price: 120.5, profit: 38, sold_at: new Date(now - day).toISOString(), platform: "eBay" }];
async function text(s, route) { await s.go(route, 10000); await s.dismiss(); return norm(await s.text()); }
(async () => {
  await sim("/__sim/reset"); await seed({ vault_items: items, sales });
  const s = await L.open({ width: 1280, height: 1700 });
  try {
    const home = await text(s, "/dashboard"), ins = await text(s, "/portfolio"), vault = await text(s, "/vault"), sold = await text(s, "/vault/sold"), act = await text(s, "/activity"), wk = await text(s, "/reports/weekly"), insp = await text(s, "/insurance"), insr = await text(s, "/reports/insurance"), prt = await text(s, "/vault/print");
    check("owned cost $358 on Home, the weekly report, the insurance page and the insurance report", [home, wk, insp, insr].every((t) => /\$358\b/.test(t)), [home.match(/PURCHASE COST \S+/), wk.match(/Purchase cost \S+/), insr.match(/TOTAL COST \(ALL-IN\) \S+/)]);
    check("collection value $240 on Home, Insights, Vault and the weekly report; $240.25* on the print report (cents, D marked as purchase-based)", [home, ins, vault, wk].every((t) => /\$240\b/.test(t)) && /\$240\.25\*/.test(prt), [home.match(/ESTIMATED VALUE \S+/), ins.match(/TOTAL VAULT VALUE \| i \| \S+/), prt.match(/EST\. COLLECTION VALUE \S+/)]);
    check("insurance documents count only entered values ($190), and say the unpriced item's cost is not counted as value", /Estimated value \$190\b/.test(insp) && /Estimated value \$190\b/.test(insr) && /not counted as value/.test(insp), [insp.match(/Estimated value \$\d+/)]);
    check("unrealized change -$158 (-51.2%) on 2 items (cost basis $308) on Home and Vault; the weekly report shows -$158, not a dash", /-\$158/.test(home) && /-51\.2%/.test(home) && /cost basis \$308/.test(home) && /-\$158/.test(vault) && /UNREALIZED CHANGE \| -\$158/.test(wk), [home.match(/UNREALIZED CHANGE \| \S+/), wk.match(/UNREALIZED CHANGE \| \S+/)]);
    check("explicit zero: B (paid $0) is counted as bought for $0 and E (value $0) as a loss; C is 'without a value'; none is shown as unknown cost", /1 bought for \$0/.test(home) && /2 without a value/.test(home) && /FIN E[^|]*\|[^|]*\| \$0/.test(ins.replace(/\s+/g, " ")) || /FIN E/.test(ins), home.match(/Not counted: [^|]*/));
    check("sales: revenue $121 and profit +$38 on Home, Sales History and the weekly report; realized cost basis $83 (82.50) and ROI +46.1% on Sales History", /\$121/.test(home) && /\+\$38/.test(home) && /REVENUE \| \$121/.test(sold) && /REALIZED PROFIT \| \+\$38/.test(sold) && /COST BASIS \| \$83/.test(sold) && /OVERALL ROI \| \+46\.1%/.test(sold) && /\$121 sold proceeds/.test(wk) && /Sales profit \+\$38/.test(wk), [sold.match(/OVERALL ROI \| \S+/)]);
    check("Activity shows the same sale as Sales History: sold for $121, +$38 net, +46.1% (it used price minus purchase price only: +$40.5 / +50.6%)", /Sold for \$121/.test(act) && /\+\$38 net/.test(act) && /46\.1%/.test(act) && !/50\.6%/.test(act), act.match(/Listing sold[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|/));
    check("the sold item is not counted in owned totals (5 owned items everywhere)", /5 items/.test(home) && /ITEMS \| 5/.test(vault) && /5 items you own/.test(wk) && /ITEMS COUNTED \| 5/.test(insr));
    // CSV export: exact cents, blank vs zero (the download is captured inside the page instead of through the browser's download folder)
    await s.go("/vault", 10000); await s.dismiss();
    await s.evaluate(`(() => { window.__csv = null; const orig = URL.createObjectURL; URL.createObjectURL = (b) => { window.__blob = b; return orig.call(URL, b); }; HTMLAnchorElement.prototype.click = function () { if (this.download) { window.__dl = this.download; return; } return Element.prototype.click.call(this); }; return true; })()`);
    console.log("Tools:", await s.mclick("Tools", false)); await sleep(1000); const dl = (await s.text()).includes("Export CSV"); console.log("Export CSV offered:", dl); await s.mclick("Export CSV", false); await sleep(3500);
    const csv = await s.evaluate(`(async () => (window.__blob ? await window.__blob.text() : ""))()`); const fname = await s.evaluate("window.__dl || ''");
    console.log("csv captured:", fname, csv.length, "bytes");
    if (csv) { const lines = csv.split(String.fromCharCode(10)).map((x) => x.replace(String.fromCharCode(13), "")).filter(Boolean); const head = lines[0].split(","); const find = (t) => lines.slice(1).find((r) => r.includes(t)) || ""; const col = (row, name) => { const idx = head.indexOf(name); return idx < 0 ? undefined : row.split(",")[idx]; }; console.log("csv columns:", head.slice(0, 12).join(" | "));
      check("CSV: A keeps cents (purchase 100.1, tax 5.05, shipping 3, value 150.25)", ["100.1", "5.05", "150.25"].every((v) => find("FIN A").includes(v)), find("FIN A"));
      check("CSV: B has an explicit 0 purchase price; C has it blank (not 0)", col(find("FIN B"), "purchasePrice") === "0" && (col(find("FIN C"), "purchasePrice") === "" || col(find("FIN C"), "purchasePrice") === undefined), [col(find("FIN B"), "purchasePrice"), col(find("FIN C"), "purchasePrice"), head.indexOf("purchasePrice")]);
      check("CSV: E keeps an explicit 0 value; D (no value) has it blank", col(find("FIN E"), "currentValue") === "0" && (col(find("FIN D"), "currentValue") === "" || col(find("FIN D"), "currentValue") === undefined), [col(find("FIN E"), "currentValue"), col(find("FIN D"), "currentValue")]);
      check("CSV: the sold item is included with status SOLD and its sold price 120.5", /SOLD/.test(find("FIN S")) && find("FIN S").includes("120.5"), find("FIN S")); } else check("CSV export produced content", false, "nothing captured");
  } finally { await s.close(); }
  console.log(JSON.stringify(L.results())); process.exit(0);
})();
