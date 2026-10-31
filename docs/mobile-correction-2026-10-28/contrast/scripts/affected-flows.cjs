// Flows touched by the button-colour fixes, run on the live app (phone emulation, synthetic collector, nothing paid):
//   Account security: set a (made-up) date of birth, tap Save, confirm the message, the database and a reload.
//   Saved: the "Open The Flip" link still goes to Discover's Flip view.
//   AUDIT_MANIFEST=<qa manifest> TUT_WORK=<dir> node affected-flows.cjs <outDir>
const fs = require("fs"), path = require("path");
const GUIDE = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/walkthrough/add-item-guide/_build";
const { start, btn, T } = require(GUIDE + "/lib.cjs");
const sharp = require("C:/Users/EK/VLTD/node_modules/sharp");
const sleep = T.sleep, admin = T.admin;
const OUT = process.argv[2]; const results = [];
const rec = (test, step, ok, detail) => { results.push({ test, step, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"} [${test}] ${step}${detail ? " :: " + (typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 260) : ""}`); };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const R = await start({ scene: "affected-flows", phone: true, camera: false });
  const { S, m } = R; const P = m.personalId;
  const shot = async (n) => { const png = await S.send("Page.captureScreenshot", { format: "png" }); await sharp(Buffer.from(png.data, "base64")).jpeg({ quality: 80 }).toFile(path.join(OUT, n + ".jpg")); };
  try {
    await S.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await R.goto("/account/security"); await sleep(3500);
    const DOB = "1990-05-15";
    const set = await S.evaluate(`(() => { const i = document.querySelector('input[type=date]'); if (!i) return false; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, ${JSON.stringify(DOB)}); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); return i.value; })()`);
    rec("account-security", "date of birth entered", set === DOB, set);
    await R.clickExpr(`[...document.querySelectorAll('button')].filter((b) => /^Save$/.test(b.innerText.trim()) && /gold-gradient/.test(b.getAttribute('style') || '')).pop()`, 2500);
    const msg = await S.evaluate(`document.body.innerText.includes('Saved.')`);
    rec("account-security", "Save shows the Saved. message", msg, msg);
    await shot("account-security-saved");
    let row = null; for (let i = 0; i < 8; i++) { row = (await admin.from("profiles").select("date_of_birth").eq("id", P).maybeSingle()).data; if (row && row.date_of_birth === DOB) break; await sleep(1200); }
    rec("account-security", "date of birth is in the database", !!row && row.date_of_birth === DOB, row);
    await S.evaluate("location.reload()"); await sleep(4000);
    const after = await S.evaluate(`(document.querySelector('input[type=date]') || {}).value || null`);
    rec("account-security", "after a reload the date of birth is still there", after === DOB, after);
    await R.goto("/saved"); await sleep(3000);
    await R.clickExpr(`[...document.querySelectorAll('a')].find((a) => /Open The Flip/.test(a.innerText))`, 3000);
    const p = await S.path();
    rec("saved", "Open The Flip goes to Discover's Flip view", /^\/discover/.test(p), p);
  } catch (e) { rec("affected-flows", "script error", false, e.message); }
  fs.writeFileSync(path.join(OUT, "affected-flows.json"), JSON.stringify(results, null, 1));
  console.log(`DONE ${results.filter((r) => r.ok).length}/${results.length}`);
  await R.close(); process.exit(0);
})();
