// A signed-out visitor opens a public exhibition on the live site: does the page still get its Vibe counts after the restriction?
// Synthetic QA data only (one public item with one Vibe, in one exhibition); restored afterwards.
process.env.CHROME_PROFILE_ROOT = process.env.CHROME_PROFILE_ROOT || "C:/qa-chrome";
const { launch } = require("./cdp.cjs");
const { qa, admin, sleep } = require("./ui-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=https://vltd.app").slice(7);
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 400)); };
(async () => {
  const g1 = qa.galleryIds[1], item = `qa_ui_${qa.stamp}_2`;
  const orig = (await admin.from("galleries").select("visibility,state,layout,exhibition_layout,public_token").eq("id", g1).maybeSingle()).data;
  const origItem = (await admin.from("vault_items").select("is_public").eq("id", item).maybeSingle()).data;
  // a private profile's items are hidden from the public item view, so the profile is made public for this check and restored after
  const origProfile = (await admin.from("profiles").select("is_public").eq("id", qa.profileId).maybeSingle()).data;
  await admin.from("profiles").update({ is_public: true }).eq("id", qa.profileId);
  await admin.from("vault_items").update({ is_public: true }).eq("id", item);
  const lay = { itemIds: [item], themePack: "classic", displayMode: "grid", guestViewMode: "public" };
  await admin.from("galleries").update({ visibility: "PUBLIC", state: "ACTIVE", layout: lay, exhibition_layout: { itemIds: [item] } }).eq("id", g1);
  await admin.from("gallery_items").delete().eq("gallery_id", g1);
  await admin.from("gallery_items").insert({ gallery_id: g1, position: 1, artifact_id: item });
  await admin.from("appreciations").delete().eq("item_id", item);
  await admin.from("appreciations").insert({ item_id: item, profile_id: qa.profileId });
  const V = await launch(9993);
  try {
    await V.send("Page.enable"); await V.send("Network.enable"); await V.send("Runtime.enable");
    const reqs = new Map();
    V.on((m) => {
      if (m.method === "Network.requestWillBeSent" && /\/rest\/v1\/appreciations/.test(m.params.request.url)) reqs.set(m.params.requestId, { url: m.params.request.url.replace(/^https:\/\/[^/]+/, "").slice(0, 120), method: m.params.request.method });
      if (m.method === "Network.responseReceived" && reqs.has(m.params.requestId)) reqs.get(m.params.requestId).status = m.params.response.status;
    });
    await V.send("Page.navigate", { url: BASE + "/museum/" + g1 + "/guest" }); await sleep(15000);
    const list = [...reqs.values()];
    console.log("appreciations requests the page made:", JSON.stringify(list));
    check("[page] the exhibition page asked for the Vibe counts (select item_id ...)", list.some((r) => /select=item_id/.test(r.url)), list);
    check("[page] and every one of those requests was accepted (no 401/403)", list.length > 0 && list.every((r) => r.status === 200), list);
    const text = await V.evaluate("document.body.innerText");
    check("[page] the exhibition itself loaded for the visitor (title shown)", /QA Exhibition 2/.test(text), text.slice(0, 200));
    const vibes = await V.evaluate("[...document.querySelectorAll('button, span')].map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim()).filter((t) => /vibe/i.test(t)).slice(0, 6)");
    console.log("Vibe wording on the page:", JSON.stringify(vibes));
  } finally {
    await V.close();
    await admin.from("appreciations").delete().eq("item_id", item);
    await admin.from("gallery_items").delete().eq("gallery_id", g1);
    await admin.from("galleries").update({ visibility: orig.visibility, state: orig.state, layout: orig.layout, exhibition_layout: orig.exhibition_layout }).eq("id", g1);
    await admin.from("vault_items").update({ is_public: origItem.is_public }).eq("id", item);
    await admin.from("profiles").update({ is_public: origProfile.is_public }).eq("id", qa.profileId);
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
