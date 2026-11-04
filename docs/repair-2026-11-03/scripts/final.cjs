// node final.cjs [--base=...] [--label=...]: remaining cases. Owner clicks; visitor / unrelated collector open links in their own browsers.
const L = require("./shr-lib.cjs");
const { session, admin, sleep, man, fs, EVID } = L;
const label = (process.argv.find((a) => a.startsWith("--label=")) || "--label=local").slice(8);
const cases = JSON.parse(fs.readFileSync(EVID + "/cases.json", "utf8"));
const out = { label };
const peek = async (kind, path, shot) => {
  const S = await session(kind, { height: 1200 });
  try { await S.visit(path); await sleep(2500); const text = (await S.text()).replace(/\s+/g, " "); const bodies = S.net.map((r) => r.body || "").join("\n"); if (shot) await S.shotTo(shot); return { text, bodies, net: S.net.map((r) => r.status + " " + r.url.slice(0, 90)) }; }
  finally { await S.close(); }
};
const head = (t) => t.slice(t.indexOf("SHARED EXHIBITION") >= 0 ? t.indexOf("SHARED EXHIBITION") : 0, 400).slice(0, 220);
(async () => {
  const m = man();
  const prof = (await admin.from("profiles").select("id,username,display_name").eq("id", m.personalId).maybeSingle()).data;
  // 1. hidden item
  { const r = await peek("visitor", "/museum/share/" + cases.guest.link.split("/").pop(), `final-${label}-hidden`);
    out.hidden = { shownAsHidden: /Hidden Item/.test(r.text), realTitleInPage: r.text.includes("QA Album 4"), realTitleInResponses: r.bodies.includes("QA Album 4"), otherItemsShown: r.text.includes("QA Album 1") }; console.log("hidden", JSON.stringify(out.hidden)); }
  // 2. profile pages stay private
  for (const kind of ["visitor", "viewer"]) {
    for (const p of ["/u/" + prof.username, "/v/" + prof.id]) { const r = await peek(kind, p, `final-${label}-${kind}-${p.replace(/\W+/g, "_")}`); const key = `profile ${kind} ${p.slice(0, 3)}`; out[key] = { text: r.text.slice(r.text.indexOf("Help") + 4, r.text.indexOf("Help") + 200), realNameShown: r.text.includes(prof.display_name) }; console.log(key, JSON.stringify(out[key])); }
  }
  // 3. owner turns sharing on for the Private exhibition from the Share panel, then off again
  const O = await session("owner", { height: 1300 });
  try {
    const pc = cases.private;
    await O.visit("/museum/" + pc.gid);
    await O.waitFor("document.querySelector('#gallery-cover-upload')", 180000, "builder");
    await O.mclick(O.byLabel("Share this exhibition"), 1500);
    out.privatePanelBefore = (await O.evaluate(`(document.querySelector('[role=dialog]')||{}).innerText`)).replace(/\n+/g, " | ").slice(0, 400);
    await O.mclick(`[...document.querySelectorAll('[role=dialog] button')].find(b => /^Yes/.test(b.textContent.trim()))`, 7000);
    const link = await O.evaluate(`(document.querySelector('[role=dialog] input')||{}).value||null`);
    out.privateLinkAfterYes = link;
    out.privatePanelAfter = (await O.evaluate(`(document.querySelector('[role=dialog]')||{}).innerText`)).replace(/\n+/g, " | ").slice(0, 600);
    await O.shotTo(`final-${label}-private-yes-panel`);
    console.log("private panel before:", out.privatePanelBefore); console.log("link after Yes:", link);
    if (link) {
      const tok = link.split("/").pop();
      for (const kind of ["visitor", "viewer"]) { const r = await peek(kind, "/museum/share/" + tok, `final-${label}-${kind}-private-yes`); out["afterYes " + kind] = head(r.text); console.log("afterYes", kind, head(r.text)); }
      // share off: Private pill
      await O.mclick(O.byLabel("Close"), 600);
      await O.mclick(O.byText("Private"), 1500);
      await sleep(5000);
      out.dbAfterOff = (await admin.from("galleries").select("visibility,state").eq("id", pc.gid).maybeSingle()).data;
      for (const kind of ["visitor", "viewer"]) { const r = await peek(kind, "/museum/share/" + tok, `final-${label}-${kind}-private-off`); out["afterOff " + kind] = head(r.text); console.log("afterOff", kind, head(r.text)); }
    }
  } finally { await O.close(); }
  fs.writeFileSync(`${EVID}/final-${label}.json`, JSON.stringify(out, null, 1));
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
