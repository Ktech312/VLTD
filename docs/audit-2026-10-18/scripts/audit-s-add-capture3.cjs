// ADD audit, suite 2b: /capture wrong-type / corrupt photo (the first run's assertion was too weak), the 'photos or video' promise, and removal as the way out.
const fs = require("fs");
const T = require("./audit-s-add-lib.cjs");
const { alertText, session, sleep, man, admin, rec, click, clickText, typeInto, text, rowsByTitle, removeItems, mine, rectOf, chooseViaButton, mkPng, tmp } = T;
const PG = "/capture | owner, Personal, 26 items";
const PREFIX = "AUD ADD W ";
const created = [];
const nameSel = "document.getElementById('capture-item-name')";
(async () => {
  const P = man().personalId;
  await T.removeByPrefix(PREFIX);
  fs.writeFileSync(tmp("w-notes.txt"), "this is not an image\n");
  fs.writeFileSync(tmp("w-fake.pdf"), "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
  fs.writeFileSync(tmp("w-corrupt.png"), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from("garbage bytes that are not a png")]));
  const good = mkPng(tmp("w-good.png"), 500, 400, [120, 80, 160]);
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    for (const [label, file] of [["a .txt text file", tmp("w-notes.txt")], ["a .pdf file", tmp("w-fake.pdf")], ["a corrupt .png (garbage bytes)", tmp("w-corrupt.png")]]) {
      await S.visit("/capture"); await S.waitFor("document.getElementById('capture-item-name')", 60000); await sleep(500);
      await chooseViaButton(S, T.btnExpr("^Upload$"), file); await sleep(3000);
      const info = await S.evaluate("({ thumbs: document.querySelectorAll('[aria-label=\"Remove photo\"]').length, broken: [...document.querySelectorAll('img')].filter((i) => /^blob:/.test(i.src) && i.complete && i.naturalWidth === 0).length })");
      const msgAtPick = await alertText(S);
      const t = PREFIX + label.replace(/\W+/g, "").slice(0, 8);
      await typeInto(S, nameSel, t); await click(S, T.btnExpr("^Save to Vault$")); await sleep(9000);
      const saveMsg = await alertText(S); const rows = await rowsByTitle(P, t); created.push(...rows);
      const body = await text(S);
      const photoNamed = /photo|image|picture/i.test(saveMsg);
      await rec(S, (info.thumbs === 0) || (rows.length === 1) || photoNamed, { page: PG, control: `Upload (${label})`, expected: "Refused when chosen, or the problem is named when saving ('that file is not a photo') - the person is not left with a broken thumbnail and a generic error", actual: `after choosing: ${info.thumbs} photo tile(s), ${info.broken} that decode to nothing; message at choosing: '${msgAtPick || "none"}'; Save result: row created=${rows.length === 1}; message: '${saveMsg}'`, impact: "blocked workflow", repro: `/capture, Upload, choose ${label}, type a name, Save to Vault` });
      // way out: remove the photo, save works and keeps the typed name
      if (info.thumbs > 0 && rows.length === 0) {
        await click(S, "document.querySelector('[aria-label=\"Remove photo\"]')"); await sleep(800);
        const kept = await S.evaluate(`(${nameSel}).value`);
        await click(S, T.btnExpr("^Save to Vault$"));
        const ok = await S.waitFor("location.pathname === '/vault'", 40000).then(() => true).catch(() => false);
        const r2 = await T.poll(async () => { const r = await rowsByTitle(P, t); return r.length ? r : null; }, 30000, 2000) || []; created.push(...r2);
        await rec(S, kept === t && ok && r2.length === 1, { page: PG, control: `Remove photo, then Save (after ${label})`, expected: "Typed name kept; removing the bad photo lets the save through", actual: `name kept=${kept === t}; redirected=${ok}; rows=${r2.length}`, impact: "data loss", repro: "Remove the bad photo tile, press Save to Vault again" });
      }
    }
    // video promise
    await S.visit("/capture"); await S.waitFor("document.getElementById('capture-item-name')", 60000);
    const accepts = await S.evaluate("[...document.querySelectorAll('input[type=file]')].map((e) => e.accept)");
    const tile = await text(S);
    await rec(S, !/video/i.test(tile) || accepts.some((a) => /video/.test(a)), { page: PG, control: "'+ Add photos or video' tile", expected: "If the label offers video, the file chooser accepts video", actual: `label text mentions video=${/video/i.test(tile)}; file inputs accept: ${JSON.stringify(accepts)}`, impact: "misleading result", repro: "Look at the tile label and the accepted file types" });
    // video file offered anyway through the input
    fs.writeFileSync(tmp("w-clip.mp4"), Buffer.alloc(2048, 7));
    await T.uploadFiles(S, "input[type=file]", tmp("w-clip.mp4"), 0); await sleep(2500);
    const vInfo = await S.evaluate("({ thumbs: document.querySelectorAll('[aria-label=\"Remove photo\"]').length, broken: [...document.querySelectorAll('img')].filter((i) => /^blob:/.test(i.src) && i.complete && i.naturalWidth === 0).length })");
    await rec(S, vInfo.thumbs === 0 || vInfo.broken === 0, { page: PG, control: "A video file given to '+ Add photos or video'", expected: "Accepted as a video clip, or refused with a message - never shown as a broken photo", actual: JSON.stringify(vInfo) + "; message: '" + (await alertText(S) || "none") + "'", impact: "misleading result", repro: "Give /capture an .mp4 through the add-photos tile" });
  } catch (e) { console.error("SUITE ERROR", e); try { await S.jshot("add-capture3-error"); } catch {} }
  finally { await S.close(); await T.removeByPrefix(PREFIX); await removeItems(created.filter(Boolean)); for (const p of mine()) console.log("leftover AUD ADD W rows", (await rowsByTitle(p, PREFIX)).length); }
})();
