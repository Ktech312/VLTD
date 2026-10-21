const path = require("path");
const X = require(path.join(__dirname, "..", "..", "scripts", "audit-s-itm-lib.cjs"));
const { sleep, admin, P, ST, mclick, byText } = X;
(async () => {
  const items = (await admin.from("vault_items").select("id").eq("profile_id", P).eq("status", "COLLECTION").like("id", "qa_vz_%").limit(5)).data.map((x) => x.id);
  const id = require("crypto").randomUUID();
  const sec = { id: "s1", title: "Exhibit 1", description: "", itemIds: items, slotLayout: [...items, null] };
  await admin.from("galleries").insert({ id, profile_id: P, title: `QA RB12 dbg ${ST}`, description: "synthetic", visibility: "LOCKED", state: "ACTIVE", cover_image: "/collectibles/comic-slab.png", layout: { itemIds: items, themePack: "classic", displayMode: "grid", guestViewMode: "public", sections: [sec] }, exhibition_layout: { itemIds: items, sections: [sec] }, public_token: `qarb12dbg${ST}`, alias_enabled: false });
  const S = await X.S_("owner", { width: 1440, height: 900 });
  try {
    await S.visit(`/museum/${id}`); await sleep(7000);
    await mclick(S, byText("^Public Exhibit$", "button")); await sleep(800);
    await mclick(S, byText("^Make public$", "button"));
    for (const ms of [1000, 1500, 2000, 3000]) {
      await sleep(ms);
      console.log(ms, "notice:", JSON.stringify(await S.evaluate("document.querySelector('[data-testid=\"follower-notice-problem\"]')?.textContent || ''")), "| banner:", JSON.stringify(await S.evaluate("document.body.innerText.includes('Exhibition published')")));
    }
    console.log("events rows:", JSON.stringify((await admin.from("exhibition_events").select("id,type").eq("gallery_id", id)).data));
    console.log("bad responses:", JSON.stringify((S.badResponses || []).filter((b) => /exhibition_events/.test(JSON.stringify(b))).slice(0, 3)));
    console.log("console errors:", JSON.stringify((S.consoleErrors || []).slice(-4)).slice(0, 400));
  } catch (e) { console.log("ERR", e.message); } finally { await S.close(); await admin.from("exhibition_events").delete().eq("gallery_id", id); await admin.from("galleries").delete().eq("id", id); process.exit(0); }
})();
