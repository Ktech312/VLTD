// node make.cjs <title> <mode: private|public_gallery|guest_view|registered_users|share_yes>
// Owner creates an exhibition with the app's own controls, picks the access mode, opens Share, reads the panel and link.
const L = require("./shr-lib.cjs");
const { session, admin, sleep, fs, EVID } = L;
const field = (label) => `(() => { const l = [...document.querySelectorAll('label')].find(x => x.textContent.trim().startsWith(${JSON.stringify(label)})); return l ? (l.parentElement.querySelector('input,textarea,select')) : null; })()`;
(async () => {
  const [title, mode] = process.argv.slice(2);
  const O = await session("owner");
  const out = { title, mode };
  try {
    await O.visit("/museum/new");
    await O.mclick(field("Exhibition Title"), 200); await O.send("Input.insertText", { text: title });
    const pillsNew = await O.evaluate(`[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(t=>/Private|Public Exhibit|Guest View|Registered/.test(t))`);
    out.pillsOnNew = pillsNew;
    await O.mclick(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Create Exhibition' && b.tagName === 'BUTTON')`, 6000);
    out.afterCreate = await O.path();
    const gid = out.afterCreate.split("/").pop(); out.gid = gid;
    const sel = { private: "Private", public_gallery: "Public Exhibit", guest_view: "Guest View", registered_users: "Registered Users" }[mode];
    if (sel) {
      await O.mclick(O.byText(sel), 1500);
      if (mode === "public_gallery") await O.mclick(O.byText("Make public"), 1500);
      await sleep(4000); // autosave
    }
    await O.mclick(O.byLabel("Share this exhibition"), 1200);
    out.dialog = await O.evaluate(`(document.querySelector('[role=dialog]')||{}).innerText`);
    if (mode === "share_yes") {
      await O.mclick(`[...document.querySelectorAll('[role=dialog] button')].find(b => /^Yes/.test(b.textContent.trim()))`, 6000);
      out.dialogAfterYes = await O.evaluate(`(document.querySelector('[role=dialog]')||{}).innerText`);
    }
    out.link = await O.evaluate(`(document.querySelector('[role=dialog] input')||{}).value || null`);
    await O.shotTo("make-" + title.replace(/\W+/g, "-") + "-share");
    const row = (await admin.from("galleries").select("id,visibility,state,public_token,layout").eq("id", gid).maybeSingle()).data;
    out.row = row && { vis: row.visibility, state: row.state, token: row.public_token, guestViewMode: row.layout && row.layout.guestViewMode };
    console.log(JSON.stringify(out, null, 1));
    fs.writeFileSync(EVID + "/make-" + title.replace(/\W+/g, "-") + ".json", JSON.stringify(out, null, 1));
  } finally { await O.close(); }
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
