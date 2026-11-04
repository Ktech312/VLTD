// Reproduce with the normal controls: owner creates an exhibition, opens Share, turns on public sharing; visitor opens the link.
const L = require("./shr-lib.cjs");
const { session, admin, sleep, man, fs, EVID } = L;
const field = (label) => `(() => { const l = [...document.querySelectorAll('label')].find(x => x.textContent.trim().startsWith(${JSON.stringify(label)})); return l ? (l.parentElement.querySelector('input,textarea,select')) : null; })()`;
(async () => {
  const m = man();
  const O = await session("owner");
  const out = {};
  try {
    await O.visit("/museum/new");
    await O.mclick(field("Exhibition Title"), 200); await O.send("Input.insertText", { text: "SHR1 Guest View Test" });
    await O.mclick(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Create Exhibition' && b.tagName === 'BUTTON')`, 6000);
    out.afterCreate = await O.path();
    await O.shotTo("r1-owner-after-create");
    const gid = out.afterCreate.split("/").pop();
    out.gid = gid;
    await O.mclick(O.byLabel("Share this exhibition"), 1200);
    out.dialogBefore = await O.evaluate(`(document.querySelector('[role=dialog]')||{}).innerText`);
    await O.shotTo("r1-owner-share-before");
    await O.mclick(`[...document.querySelectorAll('[role=dialog] button')].find(b => /^Yes/.test(b.textContent.trim()))`, 6000);
    out.dialogAfter = await O.evaluate(`(document.querySelector('[role=dialog]')||{}).innerText`);
    out.link = await O.evaluate(`(document.querySelector('[role=dialog] input')||{}).value`);
    await O.shotTo("r1-owner-share-after");
    const row = (await admin.from("galleries").select("id,visibility,state,public_token,profile_id,title").eq("id", gid).maybeSingle()).data;
    out.row = row && { vis: row.visibility, state: row.state, hasToken: !!row.public_token };
    console.log(JSON.stringify(out, null, 1));
    if (out.link) {
      const V = await session("visitor");
      try {
        const p = out.link.replace(/^https?:\/\/[^/]+/, "");
        await V.visit(p);
        console.log("VISITOR PATH", p);
        console.log("VISITOR TEXT:", (await V.text()).replace(/\s+/g, " ").slice(0, 400));
        console.log("VISITOR NET:", JSON.stringify(V.net.map((r) => ({ s: r.status, u: r.url, b: (r.body || "").slice(0, 150) })), null, 1));
        await V.shotTo("r1-visitor-link");
      } finally { await V.close(); }
    }
    fs.writeFileSync(EVID + "/r1.json", JSON.stringify(out, null, 1));
  } finally { await O.close(); }
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
