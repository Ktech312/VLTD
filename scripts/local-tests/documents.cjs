// Item documents: supported / unsupported / oversized / empty files, failed upload, failed record save (no orphan file), failed removal, replacement, missing file, a mixed batch,
// and that public pages never read documents. Simulated storage and database; no real files leave this machine.
const L = require("./lib.cjs"); const { sleep, NL, check, sim, seed, P } = L; const fs = require("fs"); const os = require("os"); const path = require("path");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vltd-docs-")); const mk = (name, bytes) => { const f = path.join(tmp, name); fs.writeFileSync(f, bytes); return f; };
const GOOD = mk("receipt.pdf", Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n")), EXE = mk("tool.exe", Buffer.from("MZ....")), EMPTY = mk("empty.pdf", Buffer.alloc(0)), BIG = mk("huge.pdf", Buffer.alloc(16 * 1024 * 1024, 1)), GOOD2 = mk("appraisal.pdf", Buffer.from("%PDF-1.4\n%%EOF\n"));
const ITEM = "sim_item_3"; const docs = async () => (await L.dump("vault_documents")).filter((d) => d.item_id === ITEM);
const msg = (s) => s.evaluate(`(() => { const e = [...document.querySelectorAll("p,div,span")].find((x) => /^(Uploading|Saved — private|Document removed|Couldn.t|Failed|.*can.t be attached|.*larger than|.*is empty)/.test((x.innerText || "").trim()) && x.children.length === 0); return e ? e.innerText.trim() : ""; })()`);
const listed = (s) => s.evaluate(`JSON.stringify([...document.querySelectorAll("button[title='View document'] span.truncate")].map((e) => e.innerText.trim()))`).then(JSON.parse);
async function pick(s, files) { const doc = await s.send("DOM.getDocument", { depth: 0 }); const n = await s.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "input[type=file][accept*='.pdf']" }); await s.send("DOM.setFileInputFiles", { nodeId: n.nodeId, files: Array.isArray(files) ? files : [files] }); await sleep(2500); }
(async () => {
  await sim("/__sim/reset"); const s = await L.open({ width: 1280, height: 1800, accept: true });
  try {
    await s.go("/vault/item/" + ITEM, 9000); await s.dismiss();
    await pick(s, EXE); let m = await msg(s); check("unsupported file: plain message naming the file, nothing stored", /tool\.exe.*can't be attached/.test(m) && (await docs()).length === 0 && (await sim("/__sim/uploads")).length === 0, m);
    await pick(s, EMPTY); m = await msg(s); check("empty file: 'is empty' message, nothing stored", /empty\.pdf.*is empty/.test(m) && (await docs()).length === 0, m);
    await pick(s, BIG); m = await msg(s); check("oversized file (16 MB): says it is larger than 15 MB, nothing stored", /huge\.pdf.*larger than 15 MB/.test(m) && (await docs()).length === 0, m);
    await pick(s, GOOD); m = await msg(s); let rows = await docs(); check("supported PDF: saved, listed by name, private message shown", /Saved — private/.test(m) && rows.length === 1 && (await listed(s)).includes("receipt.pdf"), [m, await listed(s)]);
    const up = (await sim("/__sim/uploads")).filter((u) => u.path.startsWith("vault-documents/")); check("the stored file is under the signed-in user and this item", up.length === 1 && up[0].user === L.U && up[0].path.includes("/" + ITEM + "/"), up);
    // failed upload
    await sim("/__sim/fail?storage=1&msg=" + encodeURIComponent("Bucket not found")); await pick(s, GOOD2); m = await msg(s); await sim("/__sim/fail?storage=0");
    check("failed upload: a visible message, no record, list unchanged", /Bucket not found|Couldn|Failed/i.test(m) && (await docs()).length === 1 && (await listed(s)).length === 1, [m, (await docs()).length]);
    // failed record save: no orphan file
    const del0 = ((await sim("/__sim/counts")).counts["DELETE /storage/v1/object/vault-documents"] || 0); await sim("/__sim/fail?write=1"); await pick(s, GOOD2); m = await msg(s); await sim("/__sim/fail?write=0");
    const delta = Object.entries((await sim("/__sim/counts")).counts).filter(([k]) => /^DELETE \/storage/.test(k)).reduce((a, [, v]) => a + v, 0);
    check("failed record save: a visible message, no record, and the uploaded file is cleaned up (storage delete issued)", /Couldn|Failed|simulated|503|write/i.test(m) && (await docs()).length === 1 && delta >= 1, [m, delta]);
    // failed removal: must not claim removal
    await s.go("/vault/item/" + ITEM, 9000); await sim("/__sim/fail?write=1"); await s.mclick("Remove", true); await sleep(2500); m = await msg(s); await sim("/__sim/fail?write=0");
    check("failed removal: does NOT say 'Document removed' and the document is still listed", !/Document removed/.test(m) && (await listed(s)).includes("receipt.pdf") && (await docs()).length === 1, [m, await listed(s)]);
    // removal then replacement with the same name
    await s.mclick("Remove", true); await sleep(2500); m = await msg(s); check("removal: says removed; record gone", /Document removed/.test(m) && (await docs()).length === 0, [m, (await docs()).length]);
    await pick(s, GOOD); check("replacement (remove, then add the same file name again): exactly one record", (await docs()).length === 1 && (await listed(s)).filter((x) => x === "receipt.pdf").length === 1, await docs());
    // mixed batch: first good, second not allowed
    await pick(s, [GOOD2, EXE]); m = await msg(s); check("mixed batch (valid + unsupported): the valid one is stored AND shown in the list, the other is named in the message", (await docs()).some((d) => d.name === "appraisal.pdf") && (await listed(s)).includes("appraisal.pdf") && /tool\.exe/.test(m), [m, await listed(s), (await docs()).map((d) => d.name)]);
    // missing file
    await seed({ vault_documents: [...(await L.dump("vault_documents")), { id: "doc_missing", profile_id: P, item_id: ITEM, storage_path: L.U + "/" + ITEM + "/missing-file.pdf", name: "ghost.pdf", content_type: "application/pdf", added_at: new Date().toISOString() }] });
    await s.go("/vault/item/" + ITEM, 9000); await s.mclick("ghost.pdf", false); await sleep(1500); m = await msg(s); check("missing file: 'Couldn't open that document', no crash", /Couldn.t open that document/.test(m), m);
  } finally { await s.close(); }
  // public pages never read documents
  await sim("/__sim/reset"); await seed({ vault_items: [{ id: "pub_doc_item", profile_id: "33333333-3333-4333-8333-333333333333", title: "Public with private doc", universe: "MISC", category: "Collectors Choice", status: "COLLECTION", is_public: true, created_at: 1790000000000, image_front_url: "/collectibles/guitar.png" }], vault_documents: [{ id: "doc_priv", profile_id: "33333333-3333-4333-8333-333333333333", item_id: "pub_doc_item", storage_path: "x/pub_doc_item/doc_priv.pdf", name: "PRIVATE-receipt.pdf", content_type: "application/pdf", added_at: new Date().toISOString() }], public_profiles: [{ profile_id: "33333333-3333-4333-8333-333333333333", display_name: "Other Collector", username: "other_collector" }] });
  const v = await L.open({ width: 1280, height: 1200, signedIn: false }); const seen = []; v.c.on((m) => { if (m.method === "Network.requestWillBeSent") seen.push(m.params.request.url); });
  try { for (const r of ["/share/pub_doc_item", "/u/other_collector"]) { await v.go(r, 8000); } const t = await v.text(); const body = await v.evaluate("document.documentElement.outerHTML");
    check("public item/profile pages never request documents or the documents bucket", seen.every((u) => !/vault_documents|vault-documents/.test(u)), seen.filter((u) => /document/.test(u)));
    check("the private document's name appears nowhere in the public pages", !/PRIVATE-receipt/.test(t + body), 0); } finally { await v.close(); }
  fs.rmSync(tmp, { recursive: true, force: true }); console.log(JSON.stringify(L.results())); process.exit(0);
})();
