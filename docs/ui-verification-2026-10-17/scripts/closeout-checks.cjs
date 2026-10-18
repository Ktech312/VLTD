// The five closeout claims about selling tools and exhibition sharing, re-written after the first short script
// wrongly reported 4 failures: it cleaned the page text with a character class that also deleted the letter "s",
// so words like "Mercari"/"Whatnot"/"estimated" could never match. Here the only clean-up is collapsing white space.
//   node closeout-checks.cjs <label> --base=http://localhost:3000
const { session, qa, admin, sleep } = require("./ui-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=http://localhost:3000").slice(7);
const ID = (n) => `qa_ui_${qa.stamp}_${n}`;
let pass = 0, fail = 0;
const check = (name, ok, detail) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", name, ok ? "" : JSON.stringify(detail ?? "").slice(0, 600)); };
const panelText = (S) => S.evaluate(`document.querySelector('section[aria-label="Cost to sell"]').innerText.replace(/\\s+/g, ' ').trim()`);
const setInput = (S, idx, v) => S.evaluate(`(() => { const s = document.querySelector('section[aria-label="Cost to sell"]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; const el = s.querySelectorAll('input')[${idx}]; set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
const pick = (S, label) => S.evaluate(`(() => { const s = document.querySelector('section[aria-label="Cost to sell"]'); const b = [...s.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(label)}); if (!b) return false; b.click(); return true; })()`);

(async () => {
  const S = await session(BASE, { width: 1440, height: 900 });
  try {
    // ---- comic item ----
    await S.go("/vault/item/" + ID(1));
    await S.waitFor(`document.querySelector('section[aria-label="Cost to sell"]')`, 120000, "cost to sell");
    await sleep(800);
    const chips = await S.evaluate(`[...document.querySelector('section[aria-label="Cost to sell"]').querySelectorAll('button')].map((b) => b.textContent.trim())`);
    check("1 comic offers eBay, Mercari, Whatnot, Custom (no Fanatics Collect, no Discogs)", JSON.stringify(chips) === JSON.stringify(["eBay", "Mercari", "Whatnot", "Custom"]), chips);
    await setInput(S, 0, "100"); await sleep(300);
    await pick(S, "eBay"); await sleep(300);
    const ebay = await panelText(S);
    check("2a eBay: fees line says it was read from the marketplace's own page", /Read from .*eBay.*October 2026/i.test(ebay) && !/Unverified in part/.test(ebay), ebay);
    await pick(S, "Mercari"); await sleep(300);
    const merc = await panelText(S);
    check("2b Mercari: fees line says it was read from the marketplace's own page", /Fees used: 10%/i.test(merc) && /Read from .*Mercari.*October 2026/i.test(merc) && !/Unverified in part/.test(merc), merc);
    await pick(S, "Whatnot"); await sleep(300);
    const wn = await panelText(S);
    check("3 Whatnot: shows 'Unverified in part' with the reason and points to Override fee %", /Unverified in part:/.test(wn) && /Override fee %/.test(wn), wn);
    await setInput(S, 2, "5"); await sleep(300);
    const ov = await panelText(S);
    check("4 Override fee % = 5 on $100: Fees $5.00, says it is your own rate", /Fees \$5\.00/i.test(ov) && /5% of the sale price \(your own rate\)/.test(ov) && /This is your own rate; nothing here was checked/.test(ov), ov);
    const more = [];
    for (const [v, re, name] of [["0", /Fees \$0\.00/i, "zero"], ["2.5", /Fees \$2\.50/i, "decimal"], ["", /Unverified in part/, "cleared (back to the table)"], ["abc", /Unverified in part/, "invalid text (ignored, table used)"], ["-3", /Unverified in part/, "negative (ignored, table used)"]]) {
      await setInput(S, 2, v); await sleep(300); const t = await panelText(S); more.push([name, re.test(t)]);
    }
    check("4b Override edge cases (zero, decimal, cleared, invalid, negative) behave as described", more.every((m) => m[1]), more);

    // ---- exhibition share wording (private exhibition; nothing is saved: the question is only read) ----
    const gid = qa.galleryIds[0];
    await admin.from("galleries").update({ visibility: "LOCKED" }).eq("id", gid);
    await S.go("/museum/" + gid);
    await S.waitFor(`document.querySelector('button[aria-label="Share this exhibition"]')`, 120000, "exhibition page"); await sleep(1200);
    await S.evaluate(`document.querySelector('button[aria-label="Share this exhibition"]').click(); true`);
    await S.waitFor(`document.querySelector('[role="dialog"][aria-label="Share exhibition"]')`, 20000, "share dialog"); await sleep(900);
    const dlg = await S.evaluate(`document.querySelector('[role="dialog"][aria-label="Share exhibition"]').innerText.replace(/\\s+/g, ' ').trim()`);
    check("5 exhibition question says anyone with the link can view it, not in public discovery (and no promise that a collector name stays hidden)", /Turn on public sharing\?/.test(dlg) && /Anyone with the link can view this exhibition\. It is not added to public discovery\./.test(dlg), dlg);
    const vis = (await admin.from("galleries").select("visibility").eq("id", gid).maybeSingle()).data;
    check("5b merely opening the Share panel left the exhibition private", vis && vis.visibility === "LOCKED", vis);
  } finally { await S.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
