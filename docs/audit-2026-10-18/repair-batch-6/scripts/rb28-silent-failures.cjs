// RC-16 (camera / image / PSA controls failing silently), verified on PRODUCTION with the isolated QA fixture.
// AI requests are refused by the harness (nothing is sent to the AI, no credit spent); no item is saved; Chrome's synthetic camera is used for Quick Add.
//   AUDIT_MANIFEST=<manifest> node rb28-silent-failures.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { session, sleep, click, clickText, typeInto, rectOf, uploadFiles, chooseViaButton, mkPng, tmp, text, alertText, pickSelect } = T;
const LABEL = process.argv[2] || "run";
const r = T.R("RB28");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] }; let n = 0;
const FAKE = "--use-fake-device-for-media-stream --use-fake-ui-for-media-stream";
async function rec(S, ok, control, expected, actual, page) {
  let ev = ""; if (S) { try { await sleep(250); ev = path.join(T.AUD, await S.jshot(`rb28-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page, control, expected, actual, evidence: ev ? path.relative(T.AUD, ev).replace(/\\/g, "/") : "", impact: "RC-16", repro: "" });
}
const title = "document.getElementById('scan-title')";
const addFresh = async (S) => { await S.visit("/vault/add"); await S.waitFor("document.getElementById('scan-title')", 60000, "add form"); await sleep(900); };
const png = (name, w, h, rgb) => mkPng(tmp(name), w, h, rgb);
(async () => {
  const sessions = [];
  const open = async (opts, extra = "") => { process.env.CHROME_EXTRA = extra; const S = await session("owner", opts || { width: 1440, height: 900 }); sessions.push(S); return S; };
  try {
    const pic = png("rb28-a.png", 640, 480, [30, 160, 90]);
    fs.writeFileSync(tmp("rb28-notes.txt"), "not an image\n");
    fs.writeFileSync(tmp("rb28-doc.pdf"), "%PDF-1.4\n% not really a pdf\n");
    fs.writeFileSync(tmp("rb28-bad.png"), Buffer.from("this is not png data at all, just text pretending".repeat(5)));

    // ================= /vault/add
    const A = await open();
    await addFresh(A);
    await chooseViaButton(A, T.btnExpr("Upload a photo from a file"), tmp("rb28-notes.txt")); await sleep(2500);
    let t = await text(A); let al = await alertText(A);
    await rec(A, /not an image/i.test(t + al), "/vault/add: choose a .txt file as the photo", "a visible message that the file is not an image", `alert=${JSON.stringify(al)}; crop step opened=${/Use Full Photo/.test(t)}`, "/vault/add");
    await addFresh(A);
    await chooseViaButton(A, T.btnExpr("Upload a photo from a file"), pic); await sleep(3000);
    await clickText(A, "Use Full Photo"); await sleep(1800);
    t = await text(A);
    await rec(A, !/Use Full Photo/.test(t) && /Identify with AI/.test(t), "/vault/add: Use Full Photo in the crop step", "accepts the whole photo and closes the step; Identify with AI is available", `crop step still open=${/Use Full Photo/.test(t)}; Identify offered=${/Identify with AI/.test(t)}`, "/vault/add");
    await typeInto(A, title, "RB28 identify keep");
    const aiBefore = A.intercepted.filter((x) => /api\/ai/.test(x.url)).length;
    await clickText(A, "^Identify with AI$"); await sleep(11000);
    al = await alertText(A); t = await text(A);
    const nameKept = await A.evaluate(`(${title}).value`);
    await rec(A, /Image identify failed/i.test(al) && /by hand/i.test(al) && nameKept === "RB28 identify keep", "/vault/add: Identify with AI when the AI call is refused (simulated by the harness)", "a visible message that identify failed and the form can be filled by hand; typed name kept", `alert=${JSON.stringify(al.slice(0, 160))}; name kept=${nameKept === "RB28 identify keep"}; AI requests refused=${A.intercepted.filter((x) => /api\/ai/.test(x.url)).length - aiBefore}`, "/vault/add");
    await typeInto(A, "document.querySelector('input[placeholder=\"Certification number\"]')", "12345678");
    await clickText(A, "^Look up$"); await sleep(1500);
    al = await alertText(A);
    await rec(A, /PSA cert lookup is unavailable/i.test(al), "/vault/add: PSA Look up", "a visible message (the lookup is switched off), not silence", `alert=${JSON.stringify(al.slice(0, 160))}`, "/vault/add");
    await A.close();

    // ================= /capture
    const C = await open();
    const thumbCount = () => C.evaluate("document.querySelectorAll('[data-thumb-index]').length");
    for (const [label, file] of [[".txt", "rb28-notes.txt"], [".pdf", "rb28-doc.pdf"], ["corrupt .png", "rb28-bad.png"]]) {
      await C.visit("/capture"); await sleep(3500);
      await uploadFiles(C, "input[type=file]:not([capture])", tmp(file), 0); await sleep(2500);
      const pp = await C.evaluate("(() => { const e = document.querySelector('[data-testid=photo-problem]'); return e ? e.innerText : null; })()");
      await rec(C, !!pp && (await thumbCount()) === 0, `/capture: upload a ${label} file`, "refused when chosen with a plain message; no photo tile", `message=${JSON.stringify(pp)}; photo tiles=${await thumbCount()}`, "/capture");
    }
    await C.visit("/capture"); await sleep(3500);
    await uploadFiles(C, "input[capture]", tmp("rb28-a.png"), 0); await sleep(2500);
    const dlg = await C.evaluate("!!document.querySelector('[role=dialog][aria-label=\"Adjust photo\"]')");
    await clickText(C, "Use Full Photo"); await sleep(2000);
    const after = await C.evaluate("({ dialog: !!document.querySelector('[role=dialog][aria-label=\"Adjust photo\"]'), photo: !!document.querySelector('img[alt=\"Captured item\"]') })");
    await rec(C, dlg && !after.dialog && after.photo, "/capture: Use Full Photo in the crop step (native camera hand-off)", "accepts the whole photo: the step closes and the photo is attached", `crop step opened=${dlg}; after: ${JSON.stringify(after)}`, "/capture");
    // drag reorder with a real mouse
    await C.visit("/capture"); await sleep(3500);
    const big = png("rb28-big.png", 800, 600, [200, 60, 60]); const small = png("rb28-small.png", 400, 300, [60, 60, 200]);
    await uploadFiles(C, "input[type=file]:not([capture])", big, 0); await sleep(2500);
    await uploadFiles(C, "input[type=file]:not([capture])", small, 0); await sleep(2500);
    const widths = () => C.evaluate("[...document.querySelectorAll('[data-thumb-index] img')].map((i) => i.naturalWidth)");
    const w0 = await widths();
    const rc = (i) => C.evaluate(`(() => { const b = document.querySelectorAll('[data-thumb-index]')[${i}]; if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    const p1 = await rc(1), p0 = await rc(0);
    if (p1 && p0) {
      await C.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: p1.x, y: p1.y, button: "none" });
      await C.send("Input.dispatchMouseEvent", { type: "mousePressed", x: p1.x, y: p1.y, button: "left", buttons: 1, clickCount: 1 });
      for (let k = 1; k <= 8; k++) { await C.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: p1.x + (p0.x - p1.x) * k / 8, y: p1.y + (p0.y - p1.y) * k / 8, button: "left", buttons: 1 }); await sleep(60); }
      await C.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p0.x, y: p0.y, button: "left", buttons: 0, clickCount: 1 });
    }
    await sleep(1200);
    const w1 = await widths();
    await rec(C, w0.length === 2 && w0[0] !== w1[0] && w1[0] === w0[1], "/capture: press and drag the second thumbnail onto the first with a mouse", "the dragged photo becomes the cover (the order swaps)", `widths before=${JSON.stringify(w0)}; after=${JSON.stringify(w1)}`, "/capture");
    await C.close();

    // ================= Quick Add
    const N = await open({ width: 1440, height: 900 }, "");
    await N.visit("/vault/quick"); await sleep(7000);
    const cp = await N.evaluate("(() => { const e = document.querySelector('[data-testid=camera-problem]'); return e ? e.innerText : null; })()");
    await rec(N, !!cp, "/vault/quick: the camera cannot start (no camera in this browser)", "the screen says the camera is unavailable and why", `message=${JSON.stringify(cp)}`, "/vault/quick");
    await N.close();
    const Q = await open({ width: 1440, height: 900 }, FAKE);
    await Q.visit("/vault/quick"); await sleep(3000); await Q.waitFor("document.querySelector('button[aria-label=\"Take picture\"]')", 60000, "scanner"); await sleep(1500);
    const cpOk = await Q.evaluate("!!document.querySelector('[data-testid=camera-problem]')");
    for (let i = 0; i < 2; i++) { await click(Q, "document.querySelector('button[aria-label=\"Take picture\"]')"); await sleep(1400); }
    await click(Q, "document.querySelector('button[aria-label=\"Review captured items\"]')"); await sleep(1800);
    await click(Q, "[...document.querySelectorAll('button')].find((b) => /^Add \\d+ item/.test(b.textContent.trim()))"); await sleep(2800);
    const iB = Q.intercepted.filter((x) => /api\/ai/.test(x.url)).length;
    await clickText(Q, "^Identify \\d+ with AI"); await sleep(12000);
    t = await text(Q); al = await alertText(Q);
    await rec(Q, !cpOk && /couldn.t be identified/i.test(t + al), "/vault/quick: Identify 2 with AI when the AI call is refused (simulated by the harness)", "the sheet says how many could not be identified and to fill them in by hand; no camera warning when the camera works", `camera warning shown=${cpOk}; sheet: ${(t.match(/\d+ of \d+ couldn.t be identified[^.]*\./) || ["(none)"])[0]}; AI requests refused=${Q.intercepted.filter((x) => /api\/ai/.test(x.url)).length - iB}`, "/vault/quick");
    await Q.close();

    // ================= Bulk: per-card Scan with AI when the allowance cannot be read
    const B = await open();
    await B.visit("/vault/bulk"); await B.waitFor("document.querySelectorAll('select').length >= 1", 60000); await sleep(3000);
    await chooseViaButton(B, T.btnExpr("Choose photos"), tmp("rb28-a.png")); await sleep(1500);
    await pickSelect(B, "document.querySelectorAll('select')[0]", "Music"); await sleep(400);
    const cats = await B.evaluate("[...document.querySelectorAll('select')[1].options].map((o) => o.text.trim()).filter((x) => x && !/Select/.test(x))"); await pickSelect(B, "document.querySelectorAll('select')[1]", cats[0]);
    await clickText(B, "Skip — I.ll fill in by hand"); await sleep(2500);
    const aiB = B.intercepted.filter((x) => /api\/ai/.test(x.url)).length;
    const clicked = await clickText(B, "^Scan with AI$"); await sleep(3500);
    t = await text(B);
    await rec(B, clicked && /Couldn.t check your AI scan allowance/i.test(t) && B.intercepted.filter((x) => /api\/ai/.test(x.url)).length === aiB, "/vault/bulk: a card's own 'Scan with AI' when the allowance cannot be read", "clickable, and says the allowance could not be checked; no AI call", `clicked=${clicked}; message shown=${/Couldn.t check your AI scan allowance/i.test(t)}`, "/vault/bulk");
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    for (const S of sessions) { try { await S.close(); } catch {} }
    process.env.CHROME_EXTRA = "";
    fs.writeFileSync(path.join(EV, `rb28-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    for (const c of out.cases.filter((c) => !c.ok)) console.log("NOT OK:", c.control, "|", String(c.actual).slice(0, 400));
    process.exit(0);
  }
})();
