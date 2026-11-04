// node sharelink.cjs <galleryId> [regen]: fresh owner browser opens the exhibition, reads the Share link; optionally regenerates.
const L = require("./shr-lib.cjs");
(async () => {
  const [gid, regen] = process.argv.slice(2);
  const O = await L.session("owner", { height: 1200 });
  try {
    const db = async () => (await L.admin.from("galleries").select("public_token,visibility,state").eq("id", gid).maybeSingle()).data;
    console.log("db before:", JSON.stringify(await db()));
    await O.visit("/museum/" + gid);
    await O.waitFor("document.querySelector('#gallery-cover-upload')", 180000, "builder");
    await O.mclick(O.byLabel("Share this exhibition"), 1500);
    console.log("panel link:", await O.evaluate(`(document.querySelector('[role=dialog] input')||{}).value||null`));
    await O.mclick(O.byLabel("Close"), 500);
    if (regen) {
      await O.mclick(O.byText("Regenerate link"), 800);
      await O.mclick(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Regenerate')`, 5000);
      await O.mclick(O.byLabel("Share this exhibition"), 1500);
      console.log("panel link after regenerate:", await O.evaluate(`(document.querySelector('[role=dialog] input')||{}).value||null`));
      await new Promise((r) => setTimeout(r, 4000));
    }
    console.log("db after:", JSON.stringify(await db()));
  } finally { await O.close(); }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
