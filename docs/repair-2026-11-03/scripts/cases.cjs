// node cases.cjs <tag> : the owner creates every test exhibition with the app's own controls; the Share panel's link is recorded.
const L = require("./shr-lib.cjs");
const { session, admin, sleep, fs, EVID } = L;
const field = (label) => `(() => { const l = [...document.querySelectorAll('label')].find(x => x.textContent.trim().startsWith(${JSON.stringify(label)})); return l ? (l.parentElement.querySelector('input,textarea,select')) : null; })()`;
const T = (n) => `QA Album ${n} - Original Motion Picture Soundtrack`;
const CASES = [
  { key: "public", title: "SHR Public Exhibit", mode: "public_gallery", items: [1, 2, 3] },
  { key: "guest", title: "SHR Guest View", mode: "guest_view", items: [1, 2, 3, 4], hideItem: 4 },
  { key: "registered", title: "SHR Registered Users", mode: "registered_users", items: [1, 2] },
  { key: "private", title: "SHR Private", mode: "private", items: [1, 2] },
  { key: "alias", title: "SHR Guest View Alias", mode: "guest_view", items: [1, 2], alias: "The Night Curator" },
  { key: "leak", title: "SHR Guest View Private Fields", mode: "guest_view", items: [5, 6] },
  { key: "draft", title: "SHR Draft In Storage", mode: "guest_view", items: [1] },
  { key: "adult", title: "SHR Guest View 18+", mode: "guest_view", items: [1], adult: true },
];
(async () => {
  const only = process.argv.slice(2);
  const O = await session("owner", { height: 1400 });
  const res = fs.existsSync(EVID + "/cases.json") ? JSON.parse(fs.readFileSync(EVID + "/cases.json", "utf8")) : {};
  try {
    for (const c of CASES) {
      if (only.length && !only.includes(c.key)) continue;
      const out = { ...c };
      await O.visit("/museum/new");
      await O.mclick(field("Exhibition Title"), 200); await O.send("Input.insertText", { text: c.title });
      await O.mclick(`[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Create Exhibition' && b.tagName === 'BUTTON')`, 1000);
      await O.waitFor("location.pathname !== '/museum/new'", 90000, "builder url").catch(async (e) => { await O.shotTo("fail-" + c.key); console.log(await O.evaluate("document.body.innerText.slice(0,400)")); throw e; });
      await O.waitFor("document.querySelector('#gallery-cover-upload')", 180000, "builder");
      await sleep(1500);
      out.gid = (await O.path()).split("/").pop();
      const sel = { private: "Private", public_gallery: "Public Exhibit", guest_view: "Guest View", registered_users: "Registered Users" }[c.mode];
      await O.mclick(O.byText(sel), 1200);
      if (c.mode === "public_gallery") await O.mclick(O.byText("Make public"), 1200);
      if (c.adult) await O.mclick(`document.querySelector('input[aria-label="Require 18+ confirmation"]')`, 800);
      if (c.alias) {
        await O.mclick(`document.querySelector('input[aria-label="Show a made-up curator identity instead of your real name"]')`, 800);
        await O.mclick(`document.querySelector('input[aria-label="Alias name"]')`, 300);
        await O.send("Input.insertText", { text: c.alias });
      }
      await sleep(3500);
      await O.mclick(O.byText("Edit/Add"), 2500);
      for (const n of c.items) {
        const t = T(n);
        const ok = await O.mclick(`[...document.querySelectorAll('[role=dialog] button, button, [role=button], div')].filter(e => e.textContent.trim() === ${JSON.stringify(t)} || (e.getAttribute('aria-label')||'').includes(${JSON.stringify(t)})).sort((a,b)=>a.textContent.length-b.textContent.length)[0]`, 450);
        if (!ok) console.log("could not pick", t);
      }
      await O.mclick(`[...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith('Add to Exhibit'))`, 3000);
      await sleep(5000);
      await O.mclick(O.byLabel("Share this exhibition"), 1500);
      out.shareText = await O.evaluate(`(document.querySelector('[role=dialog]')||{}).innerText`);
      out.link = await O.evaluate(`(document.querySelector('[role=dialog] input')||{}).value || null`);
      await O.shotTo("case-" + c.key + "-share");
      res[c.key] = out;
      const row = (await admin.from("galleries").select("visibility,state,alias_enabled,alias_name,layout").eq("id", out.gid).maybeSingle()).data;
      out.db = row && { vis: row.visibility, state: row.state, alias: row.alias_enabled, aliasName: row.alias_name, gvm: row.layout && row.layout.guestViewMode, adult: row.layout && row.layout.adultOnly, snaps: ((row.layout && row.layout.publicItemSnapshots) || []).length };
      console.log(c.key, out.gid, out.link, JSON.stringify(out.db));
      fs.writeFileSync(EVID + "/cases.json", JSON.stringify(res, null, 1));
    }
  } finally { await O.close(); }
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
