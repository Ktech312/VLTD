// ITM rerun at phone width: the status message after a photo upload, read after the upload has finished.
const X = require("./audit-s-itm-lib.cjs");
const { mclick, byText, text, dbWait, mkItem, sleep, admin, dismissBanner } = X;
const pathx = require("path");
(async () => {
  const S = await X.S_("owner", { width: 390, height: 800, mobile: true });
  const { ck, out } = X.makeCk(() => S, {});
  try {
    const id = await mkItem("upm", { title: "QA ITM upload message", images_json: [], image_front_url: null, image_front_storage_path: null });
    await X.openItem(S, id); await dismissBanner(S);
    const doc = await S.send("DOM.getDocument", {}); const q = await S.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "input[type=file][multiple]" });
    await S.send("DOM.setFileInputFiles", { nodeId: q.nodeId, files: [pathx.join(__dirname, "itm-up-1.png")] }); await sleep(1500);
    await mclick(S, byText("^Use Photo$", "button"));
    const d = await dbWait(id, (r) => (r.images_json || []).length === 1, 40000);
    // wait until the page stops saying Uploading
    let msg = ""; for (let i = 0; i < 60; i++) { msg = await S.evaluate(`document.querySelector('#media')?.innerText.match(/Uploading\\.\\.\\.|Images saved\\.|[^\\n]*Saved locally[^\\n]*/)?.[0] || ''`); if (msg && msg !== "Uploading...") break; await sleep(500); }
    await ck(d.ok && /Images saved/.test(msg), { page: "/vault/item/[id] | owner, Personal, phone 390 (browser-emulated)", control: "Upload status message after the upload finished", expected: "'Images saved.' once the upload is done (it first says Uploading...)", actual: `db images=${(d.row.images_json || []).length}; message after finishing: "${msg}"`, repro: "Upload a photo at 390 px and wait" });
    const keys = (d.row.images_json || []).map((i) => i.storageKey);
    for (const k of keys) { const dir = k.split("/").slice(0, -1).join("/"); try { await admin.storage.from("vault-images").remove([k]); } catch {} }
  } catch (e) { console.error(e); await ck(false, { page: "suite", control: "upmsg runner", expected: "completes", actual: "script error: " + String(e.message).slice(0, 200), impact: "none" }); }
  finally { console.log(JSON.stringify(X.sumRows(out))); await S.close(); process.exit(0); }
})();
