// Screens matching the seven annotated images, for before (production, old code) and after (new code).
//   node ui-shots.cjs <label> --base=https://vltd.app
const fs = require("fs");
const { session, qa, sleep } = require("./ui-lib.cjs");
const args = Object.fromEntries(process.argv.slice(3).map((a) => { const m = a.replace(/^--/, "").split("="); return [m[0], m[1] ?? true]; }));
const label = process.argv[2] || "shots";
const BASE = args.base || "http://localhost:3100";
const OUT = __dirname + "/shots-ui-" + label; fs.mkdirSync(OUT, { recursive: true });
const batman = `qa_ui_${qa.stamp}_1`;
const log = (...a) => console.log(...a);

(async () => {
  // ---- desktop ----
  const S = await session(BASE, { width: 1440, height: 900 });
  try {
    await S.go("/vault/item/" + batman);
    await S.waitFor(`document.querySelector('h1') && /Batman/.test(document.body.innerText)`, 120000, "item page");
    await sleep(1500);
    await S.shot(OUT + "/1-item-header.png", { x: 0, y: 0, width: 1440, height: 520 });
    log("1 header");
    // Share dialog
    await S.click('button[aria-label="Share this item"]'); await sleep(900);
    await S.shot(OUT + "/2-share-dialog.png");
    log("2 share dialog");
    // Export for social
    const exported = await S.click("text:Export for social");
    if (exported) {
      await sleep(2500);
      await S.shot(OUT + "/3a-export-1x1.png");
      await S.click("text:4:5\\s*Portrait Feed"); await sleep(250);
      await S.shot(OUT + "/3b-export-4x5-immediately.png");
      await sleep(2500);
      await S.shot(OUT + "/3c-export-4x5-settled.png");
    }
    log("3 export");
    await S.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})); true`);
    await S.go("/vault/item/" + batman);
    await S.waitFor(`/Batman/.test(document.body.innerText)`, 60000);
    await sleep(1200);
    // Title edit
    await S.click('button[aria-label="Edit title and category"]'); await sleep(700);
    await S.shot(OUT + "/4-item-edit.png", { x: 0, y: 0, width: 1440, height: 520 });
    log("4 edit");
    // Cost to sell + listing copy
    const box = await S.reveal("^cost to sell$", 800);
    if (box) { await sleep(800); await S.shot(OUT + "/5-cost-to-sell.png"); log("5 cost to sell, panel height", Math.round(box.height)); } else log("5 cost to sell not found");
    // Home
    await S.go("/");
    await S.waitFor(`/Welcome back/i.test(document.body.innerText) && /Your exhibitions/i.test(document.body.innerText)`, 120000, "home");
    await sleep(2500);
    await S.shot(OUT + "/6-home-top.png", { x: 0, y: 0, width: 1440, height: 900 });
    const hero = await S.evaluate(`(() => { const s = document.querySelector('section[aria-label="Collection overview"]'); const r = s.getBoundingClientRect(); return { height: Math.round(r.height), top: Math.round(r.top) }; })()`);
    log("6 home hero", JSON.stringify(hero));
    const ex = await S.reveal("^your exhibitions$", 600);
    if (ex) { await sleep(1500); await S.shot(OUT + "/7-home-exhibitions.png"); log("7 exhibitions block height", Math.round(ex.height)); }
  } finally { await S.close(); }

  // ---- phone ----
  const P = await session(BASE, { width: 390, height: 844, mobile: true });
  try {
    await P.go("/vault/item/" + batman);
    await P.waitFor(`/Batman/.test(document.body.innerText)`, 120000, "item page phone");
    await sleep(1500);
    await P.shot(OUT + "/m1-item-header.png");
    await P.click('button[aria-label="Share this item"]'); await sleep(900);
    await P.shot(OUT + "/m2-share.png");
    await P.go("/");
    await P.waitFor(`/Welcome back/i.test(document.body.innerText)`, 120000, "home phone");
    await sleep(2500);
    await P.shot(OUT + "/m3-home.png");
  } finally { await P.close(); }
  log("done", OUT);
})().catch((e) => { console.error("SHOTS ERROR", e.message || e); process.exit(2); });
