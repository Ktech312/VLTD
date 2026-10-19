// ITM selling rerun: the Listing Copy marketplace buttons, Generate listing copy + Accept (it is a local template, not an AI call), and Cost to Sell maths derived from the fee rule the panel itself states.
// (First run clicked the Cost to Sell buttons instead of the Listing Copy buttons because both have eBay/Mercari/Whatnot.)
const X = require("./audit-s-itm-lib.cjs");
const { mclick, byText, byLabel, typeIn, ENTER, ESC, text, dbItem, dbWait, mkItem, sleep, admin, dismissBanner, m } = X;
const WIDTH = Number(process.argv[2] || 1440);
const MOBILE = WIDTH < 500;
const BASE = X.BASE;
(async () => {
  const S = await X.S_("owner", { width: WIDTH, height: MOBILE ? 800 : 900, mobile: MOBILE });
  const dev = MOBILE ? "phone 390 (browser-emulated)" : "desktop 1440";
  const PG = (extra = "") => `/vault/item/[id] | owner, Personal, ${dev}${extra ? ", " + extra : ""}`;
  const { ck, nt, out } = X.makeCk(() => S, {});
  const tg = (MOBILE ? "m" : "d") + "2";
  const NOTE = "PRIVATE-NOTE-GEN-QA never publish this";
  const LC = `[...document.querySelectorAll('div')].find(x => /Paste-ready text for each marketplace/.test(x.innerText || '') && x.querySelector('textarea[readonly]') && x.innerText.length < 4000)`;
  try {
    const id = await mkItem("sl" + tg, { title: "QA ITM sell item 2", purchase_price: 40, purchase_tax: 4, current_value: 120, asking_price: 99, status: "FOR_SALE", grade: "CGC 9.4", cert_number: "CERT-SELL-2", notes: NOTE });
    await X.openItem(S, id); await dismissBanner(S);
    const copyText = () => S.evaluate(`(() => { const c = ${LC}; return c ? c.querySelector('textarea[readonly]').value : null; })()`);
    const lcLabels = await S.evaluate(`(() => { const c = ${LC}; return c ? [...c.querySelectorAll('button')].map(b=>b.innerText.trim()) : null; })()`);
    const seen = {};
    for (const p of ["eBay", "Mercari", "Facebook", "Etsy", "Whatnot"]) {
      if (!lcLabels || !lcLabels.includes(p)) continue;
      await mclick(S, `(() => { const c = ${LC}; return [...c.querySelectorAll('button')].find(b => b.innerText.trim() === ${JSON.stringify(p)}); })()`); await sleep(300);
      const tx = await copyText(); seen[p] = (tx.match(/Platform: (\S+)/) || [])[1] + "|" + ((tx.match(/Title: .*/) || [""])[0]).slice(0, 60);
    }
    await ck(Object.keys(seen).length >= 3 && new Set(Object.values(seen).map((v) => v.split("|")[0])).size === Object.keys(seen).length, { page: PG("for sale"), control: "Listing Copy marketplace buttons", expected: "Each marketplace button writes text for that marketplace (Platform line changes)", actual: `buttons=${(lcLabels || []).join(",")}; ${JSON.stringify(seen)}`, repro: "Listing Copy card: click eBay, Mercari, Facebook, Etsy, Whatnot" });
    await mclick(S, `(() => { const c = ${LC}; return [...c.querySelectorAll('button')].find(b => b.innerText.trim() === 'Copy Listing'); })()`); await sleep(400);
    const look = await S.look(); const last = (look.clip || []).slice(-1)[0] || ""; const shownCopy = await copyText();
    await ck(last === shownCopy && last.length > 50, { page: PG("for sale"), control: "Copy Listing copies exactly the text shown", expected: "Clipboard text equals the text box for the chosen marketplace", actual: `equal=${last === shownCopy}; clip length=${last.length}`, repro: "Choose Whatnot; Copy Listing" });
    // ---- Generate listing copy + Accept ----
    const gen = `[...document.querySelectorAll('button')].find(b => /Generate listing copy/i.test(b.innerText))`;
    await mclick(S, gen); await sleep(1800);
    const review = await S.evaluate(`(() => { const t = document.body.innerText; return { has: /Accept|Use this|Discard/i.test(t), snippet: (t.match(/(Accept|Use this|Discard).{0,60}/i)||[''])[0] }; })()`);
    const draftBox = await S.evaluate(`(() => { const t=[...document.querySelectorAll('textarea')].find(x=>!x.readOnly); return t ? t.value : ''; })()`);
    const draftText = draftBox || (await S.evaluate(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/^Accept/i.test(x.innerText.trim())); const p = b && b.closest('div').parentElement; return p ? p.innerText : ''; })()`));
    await ck(review.has, { page: PG("for sale; local template, no AI call"), control: "Generate listing copy", expected: "A draft appears with Accept/Discard (the generator is a local template: no AI request is made)", actual: `review controls: ${review.snippet}; AI requests intercepted=${S.intercepted.filter((x) => /\/api\/ai\//.test(x.url)).length}; draft: ${(draftText || "").slice(0, 200)}`, repro: "Click Generate listing copy" });
    const draftHasNote = (draftText || "").includes("PRIVATE-NOTE-GEN-QA");
    await ck(!draftHasNote, { page: PG("internal note set"), control: "Generated listing copy content", expected: "The draft is built from public facts; the internal note ('ONLY YOU SEE THESE') must not be copied into buyer-facing text", actual: `draft contains the private note: ${draftHasNote}; draft: ${(draftText || "").slice(0, 260)}`, impact: "privacy/data loss", repro: "Add an internal note; Generate listing copy; read the draft" });
    await mclick(S, byText("^Accept", "button")); await sleep(2000);
    const dd = await dbWait(id, (r) => !!r.description, 20000);
    await ck(dd.ok && !String(dd.row.description).includes("PRIVATE-NOTE-GEN-QA"), { page: PG(), control: "Generate listing copy -> Accept (saves as the item's public description)", expected: "Accepting stores buyer-facing text as the public description without the private note", actual: `db description="${String(dd.row.description || "").slice(0, 200)}"; contains private note=${String(dd.row.description || "").includes("PRIVATE-NOTE-GEN-QA")}`, impact: "privacy/data loss", repro: "Generate listing copy -> Accept; read the item's description (it is what /share shows)" });
    // end to end: public item + public profile, signed-out visitor
    await admin.from("vault_items").update({ is_public: true }).eq("id", id);
    await admin.from("profiles").update({ is_public: true, onboarding_completed: true }).eq("id", X.P); await sleep(1500);
    const r = await fetch(`${BASE}/share/${id}`); const html = await r.text();
    await admin.from("profiles").update({ is_public: false }).eq("id", X.P);
    await ck(!html.includes("PRIVATE-NOTE-GEN-QA"), { page: `/share/[itemId] | signed out, item public after Accept`, control: "Public share page after Generate -> Accept", expected: "The public page never shows the internal note", actual: `public page contains the private note=${html.includes("PRIVATE-NOTE-GEN-QA")}; description shown=${/Asking|now available/.test(html)}`, impact: "privacy/data loss", repro: "After Accept, open /share/<id> signed out (profile public)" });
    await admin.from("vault_items").update({ is_public: false }).eq("id", id);

    // ---- Cost to Sell maths from the panel's own rule ----
    await X.openItem(S, id); await dismissBanner(S);
    const CTS = `document.querySelector('section[aria-label="Cost to sell"]')`;
    const cts = () => S.evaluate(`(() => { const s=${CTS}; return s ? s.innerText.replace(/\\s+/g,' ') : ''; })()`);
    const setC = async (sel, v) => { await mclick(S, sel); await typeIn(S, v, { clear: true }); await sleep(250); };
    const money = (s) => Number((s || "").replace(/[^0-9.\-]/g, ""));
    const parse = (c) => ({ gross: money((c.match(/GROSS \$[\d,.]+/) || [""])[0]), fees: money((c.match(/FEES \$[\d,.]+/) || [""])[0]), net: money((c.match(/NET \$[\d,.\-]+/) || [""])[0]), gain: money((c.match(/NET GAIN \/ LOSS ([+\-]?\$[\d,.]+)/) || ["", ""])[1].replace("+", "")) * (/NET GAIN \/ LOSS -/.test(c) ? 1 : 1), rule: (c.match(/Fees used: [^.]*\.\d*[^.]*/) || [""])[0] });
    await mclick(S, `[...document.querySelectorAll('section[aria-label="Cost to sell"] button')].find(b=>b.innerText.trim()==='eBay')`); await sleep(300);
    await setC(`document.querySelector('section[aria-label="Cost to sell"] input[inputmode=decimal]')`, "200");
    let c = await cts(); let p = parse(c);
    const rm = c.match(/Fees used: ([\d.]+)%[^+]*\+ \$([\d.]+) per order/);
    const expectFees = rm ? Math.round((200 * Number(rm[1]) / 100 + Number(rm[2])) * 100) / 100 : null;
    await ck(rm && Math.abs(p.fees - expectFees) < 0.011, { page: PG("eBay, comics, sale price 200"), control: "Cost to Sell fee equals the rule the panel states", expected: "Fees = 200 x stated % + stated per-order fee", actual: `panel says "${(c.match(/Fees used:.{0,90}/) || [""])[0]}" -> expected $${expectFees}; panel FEES $${p.fees}`, repro: "Cost to Sell: eBay, sale price 200" });
    await ck(Math.abs(p.net - (200 - p.fees)) < 0.011, { page: PG(), control: "Cost to Sell NET = gross - fees (no shipping entered)", expected: "NET = 200 - fees", actual: `fees ${p.fees}, net ${p.net}`, repro: "As above" });
    await ck(/Cost basis \$44\.00/.test(c) && Math.abs((p.net - 44) - Number((c.match(/NET GAIN \/ LOSS \+?(\-?\$?[\d,.]+)/) || ["", "0"])[1].replace("$", ""))) < 0.011, { page: PG("cost 40 + tax 4"), control: "Cost to Sell net gain = net - cost basis", expected: "Cost basis $44.00 (price + tax) and gain = net - 44", actual: (c.match(/NET GAIN.{0,70}/) || [""])[0], repro: "As above" });
    await setC(`document.querySelector('section[aria-label="Cost to sell"] input[aria-label="Estimated outbound shipping"]')`, "10");
    c = await cts(); const p2 = parse(c);
    await ck(Math.abs(p2.net - (200 - p.fees - 10)) < 0.011, { page: PG(), control: "Cost to Sell outbound shipping", expected: "Shipping 10 lowers net by 10", actual: `net ${p.net} -> ${p2.net}`, repro: "Type 10 in Estimated outbound shipping" });
    await setC(`document.querySelector('section[aria-label="Cost to sell"] input[aria-label="Estimated outbound shipping"]')`, "-10");
    c = await cts(); const p3 = parse(c);
    await ck(Math.abs(p3.net - (200 - p.fees)) < 0.011, { page: PG(), control: "Cost to Sell negative shipping (-10)", expected: "Negative postage is treated as 0 (net unchanged)", actual: `net ${p3.net} (expected ${(200 - p.fees).toFixed(2)})`, repro: "Type -10 in shipping" });
    await setC(`document.querySelector('section[aria-label="Cost to sell"] input[aria-label="Estimated outbound shipping"]')`, "");
    await setC(`document.querySelector('section[aria-label="Cost to sell"] input[aria-label="Override fee percent (optional)"]')`, "10");
    c = await cts();
    await ck(parse(c).fees === 20, { page: PG(), control: "Cost to Sell override fee percent", expected: "10% override: fees $20.00", actual: `FEES $${parse(c).fees}`, repro: "Override fee percent 10" });
    await setC(`document.querySelector('section[aria-label="Cost to sell"] input[aria-label="Override fee percent (optional)"]')`, "");
    const feesBy = {};
    for (const ch of ["eBay", "Mercari", "Whatnot"]) { await mclick(S, `[...document.querySelectorAll('section[aria-label="Cost to sell"] button')].find(b=>b.innerText.trim()===${JSON.stringify(ch)})`); await sleep(250); feesBy[ch] = parse(await cts()).fees; }
    await ck(new Set(Object.values(feesBy)).size >= 2, { page: PG("sale price 200"), control: "Cost to Sell marketplace buttons", expected: "Different marketplaces give different fees", actual: JSON.stringify(feesBy), repro: "Click eBay, Mercari, Whatnot" });
    await setC(`document.querySelector('section[aria-label="Cost to sell"] input[inputmode=decimal]')`, "0");
    c = await cts();
    await ck(/Enter a sale price|no price|add a price/i.test(c) || parse(c).net === 0 || /NET \$0\.00/.test(c) || true, { page: PG("sale price 0"), control: "Cost to Sell with a $0 sale price", expected: "Observation: " + c.slice(60, 220), actual: c.slice(60, 260), repro: "Sale price 0", impact: "none" });
  } catch (e) { console.error("SUITE ERROR", e); try { await ck(false, { page: "suite", control: "sell2 suite runner", expected: "completes", actual: "script error (test mistake candidate): " + String(e.message).slice(0, 200), impact: "none" }); } catch {} }
  finally { try { await admin.from("profiles").update({ is_public: false }).eq("id", X.P); } catch {} console.log(JSON.stringify(X.sumRows(out))); await S.close(); process.exit(0); }
})();
