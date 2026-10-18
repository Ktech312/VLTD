// LIVE: valuation seen/edited/cleared on the item page for a value typed on the Add page; unrelated pricing save keeps it; zero-denominator displays.
const { browser, admin, sleep, man } = require("./journey-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=https://vltd.app").slice(7);
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 500)); };
const info = (n, d) => console.log("INFO", n, JSON.stringify(d ?? "").slice(0, 700));
const row = async (pid, title) => (await admin.from("vault_items").select("*").eq("profile_id", pid).eq("title", title)).data?.[0];
(async () => {
  const m = man(); const P = m.personalId;
  const S = await browser(BASE);
  try {
    const cc = await row(P, "QA Edge CostChange");
    await S.go("/vault/item/" + cc.id); await S.waitFor("document.querySelector('[aria-label=\"Edit pricing\"]')", 120000); await sleep(2500);
    const shownText = (await S.text()).split("\n").join(" | "); const shown = shownText.slice(shownText.indexOf("VALUE RANGE"), shownText.indexOf("VALUE RANGE") + 40);
    const z = await row(P, "QA Edge ZeroCostValue50");
    await S.go("/vault/item/" + z.id); await S.waitFor("document.querySelector('[aria-label=\"Edit pricing\"]')", 120000); await sleep(2500);
    await S.clickSel('[aria-label="Edit pricing"]'); await sleep(900);
    const boxVal = await S.evaluate("(document.querySelector('input[aria-label=\"Value\"]') || {}).value");
    check("[item page] a value typed on the Add page ($50) is SHOWN in the Pricing card's Value box when editing", String(boxVal) === "50", boxVal);
    await S.evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true"); await sleep(500);
    await S.go("/vault/item/" + cc.id); await S.waitFor("document.querySelector('[aria-label=\"Edit pricing\"]')", 120000); await sleep(2500);
    // an unrelated pricing save (open, change nothing, save) keeps the value
    await S.clickSel('[aria-label="Edit pricing"]'); await sleep(700); await S.clickSel('[aria-label="Save pricing"]'); await sleep(3500);
    let r = await row(P, "QA Edge CostChange");
    check("[item page] saving the Pricing card without touching the value keeps it (45)", Number(r.current_value) === 45, [r.current_value, r.value_median]);
    // edit it
    await S.go("/vault/item/" + cc.id); await S.waitFor("document.querySelector('[aria-label=\"Edit pricing\"]')", 120000); await sleep(2000);
    await S.clickSel('[aria-label="Edit pricing"]'); await sleep(700); await S.setVal('input[aria-label="Value"]', "55"); await S.clickSel('[aria-label="Save pricing"]'); await sleep(3500);
    r = await row(P, "QA Edge CostChange");
    check("[item page] editing it to 55 saves 55", Number(r.current_value) === 55, [r.current_value, r.value_median]);
    // clear it
    await S.go("/vault/item/" + cc.id); await S.waitFor("document.querySelector('[aria-label=\"Edit pricing\"]')", 120000); await sleep(2000);
    await S.clickSel('[aria-label="Edit pricing"]'); await sleep(700); await S.setVal('input[aria-label="Value"]', ""); await S.clickSel('[aria-label="Save pricing"]'); await sleep(3500);
    r = await row(P, "QA Edge CostChange");
    check("[item page] clearing it leaves the item unvalued", r.current_value === null && r.value_median === null, [r.current_value, r.value_median]);
    // zero denominators
    const texts = {};
    for (const [k, title] of [["zeroCostValue50", "QA Edge ZeroCostValue50"], ["cost50ValueZero", "QA Edge Cost50ValueZero"], ["blank", "QA Edge Blank"]]) {
      const x = await row(P, title); await S.go("/vault/item/" + x.id); await S.waitFor("document.querySelector('[aria-label=\"Edit pricing\"]')", 120000); await sleep(3000);
      texts[k] = (await S.text()).replace(/\n+/g, " | ");
    }
    for (const k of Object.keys(texts)) check(`[item page: ${k}] no NaN / Infinity anywhere`, !/NaN|Infinity/.test(texts[k]), texts[k].match(/.{0,30}(NaN|Infinity).{0,30}/)?.[0]);
    const mk = (k) => (texts[k].match(/MARKET[\s\S]{0,330}/i) || [""])[0];
    info("item page, cost $0 / value $50: MARKET area", mk("zeroCostValue50"));
    info("item page, cost $50 / value $0: MARKET area", mk("cost50ValueZero"));
    info("item page, blank / blank: MARKET area", mk("blank"));
    const roi0 = (texts.zeroCostValue50.match(/ROI \| ([^|]*)\|/i) || [])[1];
    check("[zero denominator] cost $0 with value $50: the item page shows ROI as unavailable (a dash), not a percentage, not Infinity", roi0 !== undefined && /^\s*[—–-]\s*$/.test(roi0), roi0);
    check("[zero denominator] cost $0 is shown as a recorded $0 (Total cost $0), not as unknown", /Total cost \| \$0\b/i.test(texts.zeroCostValue50), texts.zeroCostValue50.match(/Total cost[^|]*\|[^|]*/i)?.[0]);
    check("[zero denominator] a blank cost is shown as unknown (a dash), not $0", /Total cost \| [—–-]/i.test(texts.blank) || !/Total cost \| \$0\b/i.test(texts.blank), texts.blank.match(/Total cost[^|]*\|[^|]*/i)?.[0]);
  } catch (e) { console.log("STOPPED", e.message); fail++; }
  finally { await S.close(); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
