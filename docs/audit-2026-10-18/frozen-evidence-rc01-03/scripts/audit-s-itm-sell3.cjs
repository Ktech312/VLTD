// ITM rerun of the Listing Copy marketplace buttons / Copy Listing with the card selected correctly (deepest matching element).
const X = require("./audit-s-itm-lib.cjs");
const { mclick, text, mkItem, sleep, dismissBanner } = X;
(async () => {
  const S = await X.S_("owner", { width: 1440, height: 900 });
  const PG = (e = "") => `/vault/item/[id] | owner, Personal, desktop 1440${e ? ", " + e : ""}`;
  const { ck, out } = X.makeCk(() => S, {});
  try {
    const id = await mkItem("sl3", { title: "QA ITM sell item 3", purchase_price: 40, current_value: 120, asking_price: 99, status: "FOR_SALE", grade: "CGC 9.4", cert_number: "CERT-SELL-3" });
    await X.openItem(S, id); await dismissBanner(S);
    const LC = `[...document.querySelectorAll('div')].filter(x => /Paste-ready text for each marketplace/.test(x.innerText || '') && x.querySelector('textarea[readonly]')).pop()`;
    const copyText = () => S.evaluate(`(() => { const c = ${LC}; return c ? c.querySelector('textarea[readonly]').value : null; })()`);
    const labels = await S.evaluate(`(() => { const c = ${LC}; return c ? [...c.querySelectorAll('button')].map(b=>b.innerText.trim()) : null; })()`);
    const seen = {};
    for (const p of ["eBay", "Mercari", "Facebook", "Etsy", "Whatnot"]) {
      if (!labels || !labels.includes(p)) continue;
      await mclick(S, `(() => { const c = ${LC}; return [...c.querySelectorAll('button')].find(b => b.innerText.trim() === ${JSON.stringify(p)}); })()`); await sleep(300);
      const tx = await copyText(); seen[p] = (tx.match(/Platform: (\S+)/) || [])[1];
    }
    await ck(Object.keys(seen).length >= 3 && new Set(Object.values(seen)).size === Object.keys(seen).length, { page: PG("for sale"), control: "Listing Copy marketplace buttons [rerun]", expected: "Each marketplace button writes text for that marketplace (Platform line changes)", actual: `buttons=${(labels || []).join(",")}; platform lines=${JSON.stringify(seen)}`, repro: "Listing Copy card: click each marketplace" });
    await mclick(S, `(() => { const c = ${LC}; return [...c.querySelectorAll('button')].find(b => b.innerText.trim() === 'Copy Listing'); })()`); await sleep(400);
    const look = await S.look(); const last = (look.clip || []).slice(-1)[0] || ""; const shown = await copyText();
    await ck(last === (shown || "").slice(0, 120) && last.length === 120, { page: PG("for sale"), control: "Copy Listing copies exactly the text shown [rerun]", expected: "The clipboard text equals the text box for the chosen marketplace", actual: `first 120 chars equal=${last === (shown || "").slice(0, 120)} (the audit clipboard stub keeps only the first 120 characters); clip length=${last.length} vs box ${shown && shown.length}`, repro: "Pick Etsy; Copy Listing" });
    const t = await text(S);
    await ck(/(eBay|Mercari|Facebook|Etsy|Whatnot) listing copied\./.test(t), { page: PG(), control: "Copy Listing confirmation [rerun]", expected: "A visible confirmation names the marketplace", actual: (t.match(/\w+ listing copied\./) || ["none"])[0], repro: "Copy Listing" });
  } catch (e) { console.error(e); await ck(false, { page: "suite", control: "sell3 runner", expected: "completes", actual: "script error: " + String(e.message).slice(0, 200), impact: "none" }); }
  finally { console.log(JSON.stringify(X.sumRows(out))); await S.close(); process.exit(0); }
})();
