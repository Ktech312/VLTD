// VLT suite 6b: Tools-menu exports re-run (first run VLT-203..205/209: the Tools menu was still open from the previous check so my click closed it; and the audit stub only sees anchors clicked inside the document, not detached anchors, so downloads were read from in-page blobs and anchor.click calls instead).
const X = require("./audit-s-vlt-vlib.cjs");
const { R, sleep, squash, clickEl, admin, fs, AUD } = X; const r = R("VLT");
const PG = (x) => `/vault | owner, Personal, 44 records incl. 6 sold | ${x}`;
const INIT = `(() => { if (window.__vltBlobs) return; window.__vltBlobs = []; window.__vltDl = []; const c = URL.createObjectURL; URL.createObjectURL = function (b) { try { window.__vltBlobs.push(b); } catch (e) {} return c.call(URL, b); }; const ac = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { try { if (this.download) window.__vltDl.push(this.download); } catch (e) {} return ac.call(this); }; })();`;
(async () => {
  const m = X.man(); const P = m.personalId;
  const db = await X.rows(P);
  const S = await X.session("owner");
  try {
    r.pass({ page: PG("Tools"), control: "(test note) first run of VLT-203..205, VLT-209", expected: "n/a", actual: "First-run FAILs were my test's fault: the Tools menu was left open by the previous check so the next click closed it (no export ran), and the library's download stub does not see detached <a download> clicks. JSON/ZIP blobs were in fact produced (44 items; application/zip 4.5 MB). Re-run below with an in-page blob/anchor recorder.", evidence: "", impact: "none", repro: "audit-s-vlt-vault3.cjs vs 3b" });
    await S.send("Page.addScriptToEvaluateOnNewDocument", { source: INIT });
    await S.visit("/vault");
    const tool = async (re) => { await clickEl(S, "[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Tools')", { js: true }); await sleep(500); await clickEl(S, `[...document.querySelectorAll('[role=menuitem]')].find((a) => ${re}.test(a.innerText))`, { js: true }); await sleep(3000); };
    const last = () => S.evaluate("(async () => { const b = (window.__vltBlobs || []).slice(-1)[0]; return { dl: window.__vltDl.slice(), blob: b ? { type: b.type, size: b.size, text: b.size < 900000 && /text|json|csv/.test(b.type) ? await b.text() : '' } : null }; })()");
    await S.evaluate("window.__vltBlobs.length = 0; window.__vltDl.length = 0; true");
    await tool(/Export CSV/); let o = await last();
    const text = (o.blob && o.blob.text) || ""; const lines = text.split(/\n/).filter(Boolean);
    const quoted = text.includes('"QA VLT O\'Brien ""Quote"" (50%) [x] \\ Item"');
    r.check(o.dl.includes("vltd-vault-export.csv") && lines.length - 1 === db.length && quoted, { page: PG("Tools > Export CSV"), control: "Export CSV", expected: `vltd-vault-export.csv with a header and one row per record (${db.length}); the title containing a quote, comma-free punctuation and backslash is escaped correctly`, actual: `file names=${JSON.stringify(o.dl)}; data rows=${lines.length - 1}; escaped title present=${quoted}; type=${o.blob && o.blob.type}`, impact: "data loss", repro: "Tools > Export CSV (download read in-page)" });
    const header = (lines[0] || "").split(",");
    const zline = lines.find((l) => l.includes("QA VLT Zebra Comic")) || "";
    const idx = (n) => header.indexOf(n);
    const cells = zline.split(","); // zebra row has no commas inside fields
    r.check(zline && cells[idx("grade")] === "CGC 9.8" && cells[idx("currentValue")] === "50" && cells[idx("purchasePrice")] === "10" && cells[idx("status")] === "COLLECTION", { page: PG("Tools > Export CSV"), control: "Export CSV: field values", expected: "Zebra row: grade CGC 9.8, currentValue 50, purchasePrice 10, status COLLECTION in the right columns", actual: JSON.stringify({ grade: cells[idx("grade")], currentValue: cells[idx("currentValue")], purchasePrice: cells[idx("purchasePrice")], status: cells[idx("status")] }), impact: "data loss", repro: "Open the exported CSV" });
    const soldLine = lines.find((l) => l.includes("QA VLT Sold Zebra Print")) || "";
    const sc = soldLine.split(",");
    r.check(sc[idx("status")] === "SOLD" && sc[idx("soldPrice")] === "80", { page: PG("Tools > Export CSV"), control: "Export CSV: sold record", expected: "Sold items are exported with status SOLD and soldPrice 80", actual: JSON.stringify({ status: sc[idx("status")], soldPrice: sc[idx("soldPrice")] }), impact: "data loss", repro: "see CSV" });
    fs.writeFileSync(AUD + "/vlt-export-sample.csv", lines.slice(0, 4).join("\n"));
    await S.evaluate("window.__vltBlobs.length = 0; window.__vltDl.length = 0; true");
    await tool(/Export JSON/); o = await last(); let j = null; try { j = JSON.parse(o.blob.text); } catch {}
    const jz = j && j.items.find((x) => x.title === "QA VLT Zebra Comic");
    r.check(o.dl.includes("vltd-vault-export.json") && j && j.items.length === db.length && jz && jz.currentValue === 50 && jz.grade === "CGC 9.8", { page: PG("Tools > Export JSON"), control: "Export JSON", expected: `vltd-vault-export.json with all ${db.length} records and correct fields`, actual: `names=${JSON.stringify(o.dl)}; items=${j && j.items.length}; zebra currentValue=${jz && jz.currentValue}; grade=${jz && jz.grade}`, impact: "data loss", repro: "Tools > Export JSON" });
    const ids = new Set(j.items.map((x) => x.id)); const missing = db.filter((x) => !ids.has(x.id)).map((x) => x.id);
    r.check(missing.length === 0, { page: PG("Tools > Export JSON"), control: "Export JSON: every record present", expected: "No record from the database is missing from the file", actual: `missing: ${missing.join(",") || "none"}`, impact: "data loss", repro: "compare ids" });
    await S.evaluate("window.__vltBlobs.length = 0; window.__vltDl.length = 0; true");
    await tool(/Download photos/); await sleep(6000); o = await last();
    r.check(o.dl.some((d) => /\.zip$/i.test(d)) && o.blob && o.blob.size > 1000 && /zip/.test(o.blob.type), { page: PG("Tools > Download photos (ZIP)"), control: "Download photos (ZIP)", expected: "A .zip with the item photos is produced", actual: `names=${JSON.stringify(o.dl)}; blob=${o.blob && o.blob.type + " " + o.blob.size + " bytes"}`, impact: "blocked workflow", repro: "Tools > Download photos (ZIP)" });
    // Insurance PDF dialog: what opens, and cancel
    await clickEl(S, "[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Tools')", { js: true }); await sleep(500);
    await clickEl(S, "[...document.querySelectorAll('[role=menuitem]')].find((a) => /Insurance PDF/.test(a.innerText))", { js: true }); await sleep(1500);
    const dlg = await S.evaluate("(() => { const d = [...document.querySelectorAll('[role=dialog], dialog, .fixed')].filter((x) => /insurance/i.test(x.innerText) && getComputedStyle(x).position === 'fixed'); return d.length ? { text: d[0].innerText.replace(/\\s+/g, ' ').slice(0, 400), buttons: [...d[0].querySelectorAll('button')].map((b) => b.innerText.trim()) } : null; })()");
    r.check(!!dlg, { page: PG("Tools > Insurance PDF"), control: "Insurance PDF (dialog)", expected: "Opens a dialog describing the insurance PDF with a way to make it and to cancel", actual: JSON.stringify(dlg), evidence: await S.jshot("vlt-vault-insurance-dialog"), impact: "blocked workflow", repro: "Tools > Insurance PDF" });
  } finally { console.log("errors", S.consoleErrors.slice(0, 4)); await S.close(); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });
