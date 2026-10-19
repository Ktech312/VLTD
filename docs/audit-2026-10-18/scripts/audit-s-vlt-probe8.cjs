const X = require("./audit-s-vlt-vlib.cjs");
const { sleep, squash, clickEl, admin } = X;
(async () => {
  const m = X.man(); const P = m.personalId;
  const S = await X.session("owner");
  try {
    await S.visit("/vault"); await S.visit("/vault/halls"); await sleep(1500);
    const addTerm = async (t) => { await clickEl(S, 'input[placeholder*="Search by name"], input[placeholder="Add another term…"]'); await S.send("Input.insertText", { text: t }); await S.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" }); await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 }); await sleep(800); };
    await addTerm("needle42"); await clickEl(S, "[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Save as Hall')", { js: true }); await sleep(600);
    await clickEl(S, 'input[placeholder^="e.g. Spider"]'); await S.send("Input.insertText", { text: "QA VLT Hall Probe" }); await clickEl(S, "[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Save Hall')", { js: true }); await sleep(2500); await S.settle({ max: 20000 });
    console.log("path", await S.path());
    for (let i = 0; i < 6; i++) { const rows = (await admin.from("galleries").select("id,title,profile_id,created_at,layout").ilike("title", "%QA VLT Hall%")).data; console.log(i, JSON.stringify(rows.map((x) => ({ id: x.id.slice(0, 8), t: x.title, p: x.profile_id === P ? "P" : x.profile_id, items: (x.layout?.itemIds || []).length })))); await sleep(5000); }
    console.log(await S.evaluate("JSON.stringify(Object.keys(localStorage).filter((k) => /galler/i.test(k)).map((k) => k + ':' + localStorage.getItem(k).length))"));
    console.log(squash(await S.text()).slice(0, 500));
    console.log("reqs", JSON.stringify(S.reqs.filter((x) => /galler/i.test(x.url)).slice(-8)));
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });
