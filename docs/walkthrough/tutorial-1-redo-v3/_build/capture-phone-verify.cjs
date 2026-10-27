// Replacement for the phone "Name, then save" picture: the Verify sheet with item 3 (the toy) correctly classed as Pop Culture / Toys & Figures,
// matching the category fix taught earlier in the video. Same phone flow and checks as v2 (capture-phone.cjs); run against the deployed app with a synthetic collector.
//   AUDIT_MANIFEST=<manifest> TUT_WORK=<dir> node capture-phone-verify.cjs
const { start, T } = require("./lib.cjs");
const { admin } = T;
const sleep = T.sleep;
const finishedBtn = `[...document.querySelectorAll('button')].find((b) => /^Finished/.test(b.innerText.trim()) && b.getBoundingClientRect().width > 0)`;
const startsBtn = (t) => `[...document.querySelectorAll('button')].find((b) => b.innerText.trim().indexOf(${JSON.stringify(t)}) === 0 && b.getBoundingClientRect().width > 0)`;
const selects = `[...document.querySelectorAll('select')].filter((s) => s.getBoundingClientRect().width > 0)`;
(async () => {
  const R = await start({ scene: "q-phone-fix", phone: true });
  const { S, m } = R; const P = m.personalId;
  try {
    await R.goto("/dashboard");
    await R.click("Quick Add", 3500);
    const shoot = async (name) => { await R.waitFeed(name); await R.click("Take picture", 700); };
    await shoot("sports-card"); await shoot("tcg-card"); await shoot("toy-figure"); await shoot("accidental");
    await R.clickExpr(finishedBtn, 1500);
    const removeBtn = `[...document.querySelectorAll('button')].filter((b) => b.innerText.trim() === 'Remove' && b.getBoundingClientRect().width > 0)[3]`;
    await R.clickExpr(removeBtn, 1200);
    const setSel = (i, text) => R.js(`(() => { const s = (${selects})[${i}]; if (!s) return 'no select'; const o = [...s.options].find((x) => x.text.trim() === ${JSON.stringify(text)}); if (!o) return 'no option: ' + [...s.options].map((x) => x.text.trim()).join('|'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, o.value); s.dispatchEvent(new Event('change', { bubbles: true })); return 'ok'; })()`);
    const before = await R.js(`(${selects}).map((s) => s.options[s.selectedIndex].text.trim())`);
    console.log("selects before:", JSON.stringify(before));
    console.log("universe:", await setSel(4, "Pop Culture")); await sleep(600);
    console.log("category:", await setSel(5, "Toys & Figures")); await sleep(800);
    const after = await R.js(`(${selects}).map((s) => s.options[s.selectedIndex].text.trim())`);
    console.log("selects after:", JSON.stringify(after));
    if (!(after[4] === "Pop Culture" && after[5] === "Toys & Figures")) throw new Error("item 3 category not corrected: " + JSON.stringify(after));
    await R.clickExpr(startsBtn("Add 3 items"), 1800);
    await R.type(`document.querySelectorAll("input[placeholder='Item name']")[0]`, "1992 Hardwood Heroes Javier Alvarez Rookie #14");
    await R.type(`document.querySelectorAll("input[placeholder='Item name']")[1]`, "Aurora Dragon Holo Rare 045/200");
    await R.type(`document.querySelectorAll("input[placeholder='Item name']")[2]`, "Retro Robots Series 2 Action Figure (boxed)");
    await R.shot("verify", {
      title: "Name each item, then save", marks: [`document.querySelectorAll("input[placeholder='Item name']")[0]`, startsBtn("Save 3 items")],
      caption: "Type a name for each item. Then tap Save 3 items to Vault.",
      verify: async () => R.js(`(() => { const n = [...document.querySelectorAll("input[placeholder='Item name']")].map((i) => i.value); const h = [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && /^ITEM 3/i.test((e.innerText || '').trim())).map((e) => e.innerText.trim()); return { n, h, sel: (${selects}).slice(-3).map((s) => s.options[s.selectedIndex].text.trim()) }; })()`).then((v) => (v.n.length === 3 && v.n.every(Boolean) && !/TCG/i.test(JSON.stringify(v.h))) ? v : { ok: false, v }),
    });
    // nothing is saved: close the sheet without saving, then the collector is emptied by reset
    const rows = (await admin.from("vault_items").select("id").eq("profile_id", P)).data || [];
    console.log("vault rows for this collector (expect the standard fixture, none from this run):", rows.length);
  } catch (e) { console.log("SCRIPT ERROR:", e.message); await R.shot("zz-error", { title: "error" }).catch(() => {}); }
  finally { await R.close(); }
  process.exit(0);
})();
