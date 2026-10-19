// GIN export: Vault Tools > Insurance PDF (iframe print), the only insurance export outside the insurance routes. iframe print is intercepted to capture the generated document.
const L = require("./audit-s-gin-lib.cjs");
const { R, sleep, man, clickEl, X } = L;
(async () => {
  const m = man(); const P = m.personalId, st = m.stamp;
  const all = await L.rows(P);
  const isSupply = (r) => String(r.universe || "").toUpperCase() === "MISC" && String(r.category_label || "").trim() === "Supplies & Display";
  const S = await L.session("owner");
  try {
    await S.visit("/vault"); await S.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 3", 90000); await sleep(2000);
    await S.evaluate(`(() => { window.__ifr = { prints: 0, html: null, name: null }; const mo = new MutationObserver((muts) => { for (const mu of muts) for (const n of mu.addedNodes) if (n.tagName === 'IFRAME') { const w = n.contentWindow; w.print = () => { window.__ifr.prints++; window.__ifr.html = n.contentWindow.document.documentElement.outerHTML; }; } }); mo.observe(document.body, { childList: true }); return true; })()`);
    // open Vault tools menu
    const tools = await S.evaluate(`[...document.querySelectorAll('button')].filter((b) => /Tools/i.test(b.textContent) || /Tools/i.test(b.getAttribute('aria-label') || '')).map((b) => b.textContent.trim().slice(0, 30) + '|' + (b.getAttribute('aria-label') || ''))`);
    console.log("tool buttons:", tools);
    await clickEl(S, `[...document.querySelectorAll('button')].find((b) => /Tools/i.test(b.textContent) || /Tools/i.test(b.getAttribute('aria-label') || ''))`, { js: true }); await sleep(600);
    const ok = await clickEl(S, `[...document.querySelectorAll('button, a, [role=menuitem]')].find((b) => /Insurance PDF/.test(b.textContent))`, { js: true }); await sleep(800);
    const dlg = L.squash(await S.evaluate("document.body.innerText")).match(/Export Insurance Documentation.{0,160}/)?.[0];
    const shot = await L.SHOT(S, "export-insurance-dialog");
    const expItems = all.length - 0; // dialog is passed every loaded item
    R.check(ok && /Export Insurance Documentation/.test(dlg || ""), { page: "/vault | owner, Personal, 26 owned + 5 sold + 1 supply", control: "Vault Tools > Insurance PDF", expected: "Opens the export dialog", actual: dlg || "dialog not found", evidence: shot, impact: "blocked workflow", repro: "Vault > Tools > Insurance PDF." });
    const countClaim = Number((dlg || "").match(/(\d+) items?/)?.[1]);
    R.check(countClaim === 26, { page: "/vault | Insurance PDF dialog", control: "Item count in 'Export Insurance Documentation'", expected: "26 (the items you own; the same set as the insurance report pages)", actual: `Dialog says ${countClaim} items (database: ${all.filter((r) => !isSupply(r)).length} collectibles, ${all.filter((r) => X.isActive(r) && !isSupply(r)).length} owned, ${all.length} rows incl. supply and sold)`, evidence: shot, impact: "misleading result", repro: "Open Insurance PDF and read the count." });
    await L.typeInto(S, `document.querySelector('input[placeholder="Your name or business"]')`, "QA Collector");
    await clickEl(S, `[...document.querySelectorAll('button')].find((b) => /Include item notes/.test(b.textContent))`, { js: true }); await sleep(300);
    const noteState = L.squash(await S.evaluate("[...document.querySelectorAll('button')].find((b) => /Include item notes/.test(b.textContent)).textContent"));
    R.check(/Off$/.test(noteState), { page: "/vault | Insurance PDF dialog", control: "'Include item notes' toggle", expected: "Toggles On to Off", actual: noteState, evidence: "", impact: "usability", repro: "Click the toggle." });
    await clickEl(S, `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Generate PDF')`, { js: true }); await sleep(2500);
    const ifr = await S.evaluate("window.__ifr");
    const html = ifr.html || "";
    const text = html.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    R.check(ifr.prints === 1 && html.length > 1000, { page: "/vault | Insurance PDF", control: "Generate PDF", expected: "Builds the insurance document and opens the print dialog once (iframe print intercepted in the audit)", actual: `iframe print calls ${ifr.prints}; document length ${html.length}`, evidence: "", impact: "blocked workflow", repro: "Generate PDF." });
    if (html) {
      const owned = all.filter((r) => X.isActive(r) && !isSupply(r));
      const missing = owned.filter((r) => !text.includes(r.title));
      const soldIn = all.filter((r) => r.status === "SOLD" && text.includes(r.title)).length;
      const supIn = text.includes("QA Supply Box");
      R.check(missing.length === 0 && soldIn === 0 && !supIn, { page: "/vault | Insurance PDF content (captured document)", control: "Items inside the generated insurance PDF", expected: "The 26 owned items; no sold items, no supplies", actual: `owned items missing: ${missing.length}; sold items included: ${soldIn} of 5; supply included: ${supIn}`, evidence: "", impact: "misleading result", repro: "Generate PDF and read the captured document." });
      R.check(/QA Collector/.test(text), { page: "/vault | Insurance PDF content", control: "Collector name in the PDF", expected: "'QA Collector' appears", actual: text.includes("QA Collector") ? "present" : "missing", evidence: "", impact: "usability", repro: "Type a name, Generate." });
      R.check(!/Line1 Line2 with/.test(text), { page: "/vault | Insurance PDF content", control: "'Include item notes' Off", expected: "Item notes not printed when Off", actual: /Line1/.test(text) ? "notes printed" : "notes omitted", evidence: "", impact: "misleading result", repro: "Turn notes off, Generate." });
      const inv = text.match(/Total (?:Value|Insured)[^$]{0,30}\$[\d,]+\*?/i)?.[0];
      console.log("pdf totals:", inv, "| head:", text.slice(0, 400));
      R.check(!/\$NaN|undefined|null/.test(text), { page: "/vault | Insurance PDF content", control: "No broken values (NaN/undefined/null) in the document", expected: "None", actual: (text.match(/.{20}(\$NaN|undefined|null).{20}/) || ["none"])[0], evidence: "", impact: "misleading result", repro: "Search the generated document." });
    }
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e); process.exit(2); });
