// probe: do Number / Issue and Serial # reach the saved row? (Music vs Pop Culture / Comics)
const T = require("./audit-s-add-lib.cjs");
const { session, sleep, fieldInput, typeInto, click, rowsByTitle, man, pickSelect } = T;
const saveBtn = T.btnExpr("^Save$|^Saving");
(async () => {
  const P = man().personalId;
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    for (const [uni, tag] of [["Music", "MusicX"], ["Pop Culture", "PopX"], ["Misc", "MiscX"]]) {
      await S.visit("/vault/add"); await S.waitFor("document.getElementById('scan-title')", 60000); await sleep(800);
      await pickSelect(S, "document.querySelectorAll('select')[0]", uni); await sleep(400);
      const t = "AUD ADD Probe " + tag;
      await typeInto(S, "document.getElementById('scan-title')", t);
      const labs = await S.evaluate("[...document.querySelectorAll('label')].map((l) => l.textContent.trim()).filter(Boolean).join(' | ')");
      console.log(tag, "labels:", labs.slice(0, 500));
      await typeInto(S, fieldInput("Number / Issue"), "No-77"); await typeInto(S, fieldInput("Serial #"), "Ser-Token");
      console.log(tag, "values in form:", await S.evaluate(`[(${fieldInput("Number / Issue")}), (${fieldInput("Serial #")})].map((e) => e && e.value)`));
      await click(S, saveBtn); await sleep(6000);
      const r = (await T.admin.from("vault_items").select("title,number,serial_number,universe").eq("profile_id", P).eq("title", t)).data;
      console.log(tag, "row:", JSON.stringify(r));
    }
  } finally { await S.close(); await T.removeByPrefix("AUD ADD Probe"); }
})().catch((e) => { console.error(e); process.exit(2); });
