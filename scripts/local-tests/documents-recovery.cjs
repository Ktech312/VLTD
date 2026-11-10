// Documents: recovery after partial failures. (1) a batch where the first file is saved and the second is refused, WHILE the list cannot be re-read: the saved file stays visible and the message says
// which was saved; (2) retrying the refused file adds exactly one record (no duplicates), also after a refused record save; (3) a failed removal stays recoverable, and a delete the database silently
// refuses is not reported as removed; (4) a reload shows each document once; (5) another account on the same browser never sees (or has stored locally) the first account's documents.
const L = require("./lib.cjs"); const { sleep, check, sim, seed } = L; const fs = require("fs"); const os = require("os"); const path = require("path");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vltd-docrec-")); const mk = (name, bytes) => { const f = path.join(tmp, name); fs.writeFileSync(f, bytes); return f; };
const A = mk("receipt.pdf", Buffer.from("%PDF-1.4\n%%EOF\n")), B = mk("appraisal.pdf", Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF\n"));
const ITEM = "sim_item_3"; const recs = async () => (await L.dump("vault_documents")).filter((d) => d.item_id === ITEM);
const rawMsg = (s) => s.evaluate(`(() => { const b = [...document.querySelectorAll("button")].find((x) => (x.innerText || "").trim() === "Upload file"); if (!b) return ""; const n = b.parentElement && b.parentElement.nextElementSibling; return n && n.tagName === "DIV" ? n.innerText.trim() : ""; })()`);
const msg = async (s) => { let t = ""; for (let i = 0; i < 40; i++) { t = await rawMsg(s); if (t && !/^Working/.test(t)) return t; await sleep(500); } return t; }; /* wait for the busy label to clear */
const listed = (s) => s.evaluate(`JSON.stringify([...document.querySelectorAll("button[title='View document'] span.truncate")].map((e) => e.innerText.trim()))`).then(JSON.parse);
async function pick(s, files) { const doc = await s.send("DOM.getDocument", { depth: 0 }); const n = await s.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "input[type=file][accept*='.pdf']" }); await s.send("DOM.setFileInputFiles", { nodeId: n.nodeId, files: Array.isArray(files) ? files : [files] }); await sleep(3000); }
(async () => {
  await sim("/__sim/reset"); const s = await L.open({ width: 1280, height: 1800, accept: true });
  try {
    await s.go("/vault/item/" + ITEM, 9000); await s.dismiss();
    // 1. partial failure while the list cannot be read
    await sim("/__sim/fail?storageAfter=1&docsRead=1"); await pick(s, [A, B]); let m = await msg(s); await sim("/__sim/fail?storageAfter=-1&docsRead=0");
    let rows = await recs(); check("partial failure: the first file is saved, the second is not", rows.length === 1 && rows[0].name === "receipt.pdf", rows.map((r) => r.name));
    check("partial failure while the list cannot be re-read: the saved file is STILL shown (not an empty list)", (await listed(s)).includes("receipt.pdf"), await listed(s));
    check("partial failure: the message says which file was saved and why the other was not, and does not say everything saved", /"receipt\.pdf" was saved/.test(m) && !/^Saved — private/.test(m) && m.length > 30, m);
    // 2. retry only the refused file: no duplicates
    await pick(s, B); rows = await recs(); m = await msg(s); check("retry of the refused file: exactly one record for each file (no duplicates), both listed", rows.length === 2 && rows.filter((r) => r.name === "receipt.pdf").length === 1 && rows.filter((r) => r.name === "appraisal.pdf").length === 1 && (await listed(s)).length === 2, [rows.map((r) => r.name), await listed(s)]);
    check("retry: success message shown", /Saved — private/.test(m), m);
    // refused record save, then retry: the failed attempt leaves nothing behind, the retry adds one
    const C = mk("certificate.pdf", Buffer.from("%PDF-1.4\n2 0 obj<<>>endobj\n%%EOF\n")); await sim("/__sim/fail?write=1"); await pick(s, C); await sim("/__sim/fail?write=0");
    check("refused record save: no record and the file is not listed", (await recs()).length === 2 && !(await listed(s)).includes("certificate.pdf"), await listed(s));
    await pick(s, C); check("retry after a refused record save: exactly one certificate.pdf", (await recs()).filter((r) => r.name === "certificate.pdf").length === 1 && (await recs()).length === 3, (await recs()).map((r) => r.name));
    // 3. removal: refused write, silent refusal, then a real removal
    await sim("/__sim/fail?write=1"); await s.mclick("Remove", true); await sleep(2500); m = await msg(s); await sim("/__sim/fail?write=0");
    check("removal refused by the database: says so, nothing removed, still listed (recoverable)", !/Document removed/.test(m) && /Couldn.t remove/.test(m) && (await recs()).length === 3 && (await listed(s)).length === 3, [m, await listed(s)]);
    await sim("/__sim/fail?docsDeleteIgnored=1"); await s.mclick("Remove", true); await sleep(2500); m = await msg(s); await sim("/__sim/fail?docsDeleteIgnored=0");
    check("a delete the database silently refuses (no error, row still there) is NOT reported as removed", !/Document removed/.test(m) && /still on your account/.test(m) && (await listed(s)).length === 3, [m, await listed(s)]);
    await s.mclick("Remove", true); await sleep(2500); m = await msg(s); check("then a real removal works once", /Document removed/.test(m) && (await recs()).length === 2 && (await listed(s)).length === 2, [m, (await recs()).length]);
    // 4. reload shows each once
    await s.go("/vault/item/" + ITEM, 9000); const names = await listed(s); check("after a reload each document is listed exactly once", names.length === 2 && new Set(names).size === 2, names);
    // 5. another account on the same browser
    const second = await L.registerSecond(); await s.switchTo(second); await s.go("/vault/item/" + ITEM, 9000); const t = await s.text(); const ls = await s.evaluate(`JSON.stringify(Object.entries(localStorage))`);
    check("another account on the same browser: the first account's document names appear nowhere on the page and are not stored locally", !/receipt\.pdf|appraisal\.pdf|certificate\.pdf/.test(t) && !/receipt\.pdf|appraisal\.pdf|certificate\.pdf/.test(ls), t.slice(0, 160));
    await s.switchTo({ userId: L.U, profileId: L.P, email: process.env.SIM_USER_EMAIL || "sim@example.com" }); await s.go("/vault/item/" + ITEM, 9000); check("back on the first account the documents are listed once each", (await listed(s)).length === 2, await listed(s));
  } finally { await s.close(); }
  fs.rmSync(tmp, { recursive: true, force: true }); console.log(JSON.stringify(L.results())); process.exit(0);
})();
