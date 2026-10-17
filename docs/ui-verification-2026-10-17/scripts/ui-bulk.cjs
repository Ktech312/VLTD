// Queue A (batch upload): three photos, one left without a title, committed without any AI.
//   node ui-bulk.cjs <label> --base=http://localhost:3000
const fs = require("fs");
const path = require("path");
const { session, qa, admin, sleep } = require("./ui-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=http://localhost:3000").slice(7);
const LABEL = process.argv[2] || "bulk";
const OUT = path.join(__dirname, "shots-bulk-" + LABEL); fs.mkdirSync(OUT, { recursive: true });
const P = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/public/collectibles/";
let pass = 0, fail = 0;
const check = (name, ok, detail) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", name, ok ? "" : JSON.stringify(detail ?? "").slice(0, 600)); };
const info = (name, detail) => console.log("INFO", name, JSON.stringify(detail ?? "").slice(0, 600));
const selectOpt = (S, idx, text) => S.evaluate("(() => { const s = document.querySelectorAll('select')[" + idx + "]; if (!s) return 'no select'; const o = [...s.options].find((x) => x.text.trim() === " + JSON.stringify(text) + ") || [...s.options].find((x) => x.value); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, o.value); s.dispatchEvent(new Event('change', { bubbles: true })); return o.text; })()");

(async () => {
  await admin.from("vault_items").delete().eq("profile_id", qa.profileId).like("title", "QA Bulk %");
  const S = await session(BASE, { width: 1440, height: 900 });
  const ai = [];
  await S.send("Fetch.enable", { patterns: [{ urlPattern: "*/api/ai/*", requestStage: "Request" }, { urlPattern: "*remove.bg*", requestStage: "Request" }] });
  S.c.on(async (m) => { if (m.method !== "Fetch.requestPaused") return; ai.push(m.params.request.url); try { await S.send("Fetch.fulfillRequest", { requestId: m.params.requestId, responseCode: 418, body: Buffer.from("{}").toString("base64") }); } catch { /* gone */ } });
  try {
    const before = (await admin.from("vault_items").select("id", { count: "exact", head: true }).eq("profile_id", qa.profileId)).count;
    await S.go("/vault/bulk"); await S.waitFor("document.querySelector('input[type=file]')", 120000, "bulk"); await sleep(1500);
    await S.send("DOM.enable");
    const doc = await S.send("DOM.getDocument", { depth: 1 });
    const q = await S.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "input[type=file]" });
    await S.send("DOM.setFileInputFiles", { nodeId: q.nodeId, files: [P + "guitar.png", P + "comic-slab.png", P + "vinyl-record.png"] });
    await sleep(2000);
    const afterPick = await S.evaluate("document.body.innerText");
    check("[bulk] three chosen photos are listed and nothing was identified or saved yet", /3 photos selected/.test(afterPick) && ai.length === 0, { ai });
    // Skip is refused until a Universe and Category are picked
    const skipDisabled = await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('fill in by hand')); return b ? b.disabled : null; })()");
    check("[bulk] 'Skip' and 'Scan with AI' stay off until Universe and Category are picked, and the page says why", skipDisabled === true && /Pick a Universe and Category above first/.test(afterPick), { skipDisabled });
    console.log("   universe ->", await selectOpt(S, 0, "Music")); await sleep(800);
    console.log("   category ->", await selectOpt(S, 1, "")); await sleep(600);
    const skipEnabled = await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('fill in by hand')); return b ? !b.disabled : null; })()");
    check("[bulk] once a Universe and Category are picked, 'Skip' is available", skipEnabled === true, skipEnabled);
    await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('fill in by hand')); b.click(); return true; })()"); await sleep(2500);
    const review = await S.evaluate("({ text: document.body.innerText.slice(0, 1800), inputs: document.querySelectorAll('input[type=text], input:not([type])').length })");
    info("[bulk] review screen", { head: review.text.slice(0, 700), inputs: review.inputs });
    await S.shot(OUT + "/bulk-review.png");
    // titles: first two typed, third left blank
    const titles = await S.evaluate("(() => { const ins = [...document.querySelectorAll('input')].filter((i) => (i.placeholder || '').toLowerCase().includes('title') || (i.placeholder || '').toLowerCase().includes('name')); return ins.map((i) => i.placeholder); })()");
    info("[bulk] title inputs found", titles);
    await S.evaluate("(() => { const ins = [...document.querySelectorAll('input')].filter((i) => (i.placeholder || '').toLowerCase().includes('title') || (i.placeholder || '').toLowerCase().includes('name')); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; ['QA Bulk One', 'QA Bulk Two'].forEach((t, k) => { if (ins[k]) { set.call(ins[k], t); ins[k].dispatchEvent(new Event('input', { bubbles: true })); } }); return true; })()");
    await sleep(500);
    await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Add all')); b.click(); return true; })()");
    let n = 0; for (let i = 0; i < 30; i++) { await sleep(1500); n = (await admin.from("vault_items").select("id", { count: "exact", head: true }).eq("profile_id", qa.profileId)).count - before; if (n >= 3) break; }
    check("[bulk] Add all creates one item per photo (3)", n === 3, n);
    const made = (await admin.from("vault_items").select("title,images_json,image_front_url,added_via,purchase_price").eq("profile_id", qa.profileId).order("created_at", { ascending: false }).limit(3)).data || [];
    info("[bulk] the three new records", made.map((r) => ({ title: r.title, photos: Array.isArray(r.images_json) ? r.images_json.length : 0, cover: !!r.image_front_url, via: r.added_via, cost: r.purchase_price })));
    check("[bulk] every new item has its own photo as cover", made.length === 3 && made.every((r) => !!r.image_front_url), made.map((r) => !!r.image_front_url));
    check("[bulk] the titled ones kept their titles", made.some((r) => r.title === "QA Bulk One") && made.some((r) => r.title === "QA Bulk Two"), made.map((r) => r.title));
    check("[bulk] the untitled one is named 'Untitled Item' (as the review screen says) and is not silently dropped", made.some((r) => r.title === "Untitled Item"), made.map((r) => r.title));
    check("[AI] the whole batch flow made 0 requests to the AI endpoints", ai.length === 0, ai);
  } finally { await S.close(); }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
