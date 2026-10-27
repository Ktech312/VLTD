// Sample sequence on the Quick Add camera screen (deployed app, synthetic collector, test camera). One action at a time: Universe, Category, shutter, Finished.
// Each screenshot is taken at the moment the narration refers to, with the on-screen rectangle of the control being taught; every claim in the narration is checked against the live app.
//   AUDIT_MANIFEST=<manifest> node capture-sample.cjs
const fs = require("fs");
const path = require("path");
const { start, T } = require("./lib.cjs");
const sleep = T.sleep;
const VIS = `(e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 4 && r.height > 4 && cs.visibility !== 'hidden' && cs.display !== 'none'; }`;
// The toolbar is tagged once, before anything changes its labels: Universe, Category, Frame, Camera, barcode, Finished (left to right, one row).
const TAG = `(() => { const vis = ${VIS}; const u = [...document.querySelectorAll('button')].find((e) => vis(e) && e.innerText.trim() === 'Universe'); if (!u) return 'no universe'; const ur = u.getBoundingClientRect(); const row = [...document.querySelectorAll('button')].filter((e) => vis(e) && Math.abs(e.getBoundingClientRect().top - ur.top) < 4 && e.getBoundingClientRect().left >= ur.left - 1).sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left).slice(0, 5); const fin = [...document.querySelectorAll('button')].find((e) => vis(e) && /^Finished/.test(e.innerText.trim())); if (fin) row.push(fin); row.forEach((e, i) => e.setAttribute('data-tb', String(i))); return row.map((e) => e.innerText.trim() || e.getAttribute('aria-label')); })()`;
const tb = (i) => `document.querySelector('[data-tb="${i}"]')`;
const menuLeaves = `[...document.querySelectorAll('button,[role=menuitem],[role=option],li,div,span')].filter((e) => (${VIS})(e) && e.children.length === 0 && e.getBoundingClientRect().top > 45 && e.getBoundingClientRect().top < 420 && e.getBoundingClientRect().left > 440 && e.getBoundingClientRect().left < 1000)`;
const menuOption = (label) => `${menuLeaves}.filter((e) => e.innerText.trim() === ${JSON.stringify(label)}).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0]`;
const SHUTTER = `document.querySelector('button[aria-label="Take picture"]')`;
const report = [];
const note = (claim, ok, evidence) => { report.push({ claim, ok, evidence }); console.log(ok ? "ok  " : "FAIL", claim, "|", String(evidence).slice(0, 160)); };

(async () => {
  const R = await start({ scene: "sample", feedFile: "feed-sports-card.mjpeg" });
  const { S } = R;
  try {
    await R.goto("/vault/quick"); await sleep(2500);
    await R.waitFeed("sports-card");
    const names0 = await R.js(TAG);
    note("the camera screen's toolbar runs Universe, Category, Frame, Camera, barcode, Finished (left to right)", Array.isArray(names0) && names0[0] === "Universe" && names0[1] === "Category" && /^Frame/.test(names0[2]) && /^Camera/.test(names0[3]) && /^Finished/.test(names0[5]), JSON.stringify(names0));
    await R.shot("idle", { marks: [tb(0)], settle: 600 });

    // 1. Universe
    await R.clickExpr(tb(0), 900);
    await R.shot("menu-universe", { marks: [menuOption("Sports")], settle: 500 });
    const universeMenu = await R.js(`${menuLeaves}.map((e) => e.innerText.trim()).filter(Boolean)`);
    note("choosing Universe opens a list of collectible types (Pop Culture, Sports, TCG & Non Sport Card, Music, ...)", ["Pop Culture", "Sports", "Music"].every((x) => universeMenu.includes(x)), JSON.stringify(universeMenu));
    await R.clickExpr(menuOption("Sports"), 1100);
    const afterU = await R.js(`(${tb(0)}).innerText.trim()`);
    note("the Universe button keeps its name after a choice (the choice shows later, on the review screen)", afterU === "Universe", afterU);
    await R.shot("after-universe", { marks: [tb(1)], settle: 500 });

    // 2. Category
    await R.clickExpr(tb(1), 900);
    await R.shot("menu-category", { marks: [menuOption("Sports Cards")], settle: 500 });
    const catMenu = await R.js(`${menuLeaves}.map((e) => e.innerText.trim()).filter(Boolean)`);
    note("Category then lists the categories for that type (Sports Cards, Apparel, Memorabilia)", ["Sports Cards", "Apparel", "Memorabilia"].every((x) => catMenu.includes(x)), JSON.stringify(catMenu));
    await R.clickExpr(menuOption("Sports Cards"), 1100);
    const afterC = await R.js(`(${tb(1)}).innerText.trim()`);
    note("the Category button keeps its name after a choice, and Category is optional", afterC === "Category", afterC);
    await R.waitFeed("sports-card");
    await R.shot("after-category", { marks: [SHUTTER], settle: 500 });

    // 3. Shutter
    const before = await R.text();
    await R.clickExpr(SHUTTER, 1400);
    const t3 = await R.text();
    note("tapping the round button takes a photo: the counter goes to 1 and Finished reads Finished (1)", /Finished \(1\)/.test(t3) && !/Finished \(1\)/.test(before), (t3.match(/Finished \(\d+\)/) || ["none"])[0]);
    await sleep(3200);
    const COUNTER = `[...document.querySelectorAll('div,span')].find((e) => (${VIS})(e) && e.children.length === 0 && e.innerText.trim() === '1' && e.getBoundingClientRect().top > 60 && e.getBoundingClientRect().top < 140 && e.getBoundingClientRect().left > 450 && e.getBoundingClientRect().left < 540)`;
    await R.shot("after-photo", { marks: [`document.querySelector('button[aria-label="Review captured items"]')`, tb(5), COUNTER], settle: 600 });

    // 4. Finished
    await R.clickExpr(tb(5), 1800);
    const t4 = await R.text();
    note("Finished opens the review screen (Review your Drop) where the photos can be checked", /Review your Drop/.test(t4) && /1 item/.test(t4), (t4.match(/Review your Drop[^.]{0,60}/) || ["none"])[0]);
    const sel = await R.js(`[...document.querySelectorAll('select')].filter((e) => (${VIS})(e)).map((s) => s.options[s.selectedIndex].text.trim())`);
    note("the review screen shows the choices made before shooting: Item 1 is Sports / Sports Cards", sel[0] === "Sports" && sel[1] === "Sports Cards", JSON.stringify(sel));
    const selX = (i) => `[...document.querySelectorAll('select')].filter((e) => (${VIS})(e))[${i}]`;
    await R.shot("review", { marks: [selX(0), selX(1)], settle: 600 });
  } catch (e) { note("sample capture completed", false, e.message); }
  finally {
    R.save();
    fs.writeFileSync(path.join(R.dir, "claims.json"), JSON.stringify(report, null, 1));
    await S.close().catch(() => {});
    process.exit(report.some((r) => !r.ok) ? 1 : 0);
  }
})();
