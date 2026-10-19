// ADD audit, suite 7c: where does an approved /ai/review draft go? (account row, queue, local list, other profile)
const T = require("./audit-s-add-lib.cjs");
const { session, sleep, man, admin, rec, click, typeInto, text, removeItems, poll } = T;
const KEY = "vltd_ai_drafts_v1";
const TITLE = "AUD ADD N3 Approved";
(async () => {
  const m = man(); const P = m.personalId, B = m.businessId;
  const S = await session("owner", { width: 1440, height: 900 });
  const where = async () => (await admin.from("vault_items").select("id,profile_id,title,added_via,purchase_price,current_value,created_at").like("title", TITLE + "%")).data || [];
  try {
    await S.visit("/ai/drafts"); await sleep(1000);
    await S.evaluate(`localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(JSON.stringify([{ id: "aud_n3_1", workspaceId: "w", createdByLabel: "audit seed", status: "READY_FOR_REVIEW", confidenceLabel: "Good", confidenceScore: 70, title: TITLE, subtitle: "sub", missingFields: [], createdAt: new Date().toISOString(), categoryLabel: "Comics" }]))}); true`);
    await S.visit("/ai/review?id=aud_n3_1"); await S.waitFor("document.querySelector('input[name=\"title\"]') && document.querySelector('input[name=\"title\"]').value.length > 0", 30000); await sleep(500);
    await typeInto(S, "document.querySelector('input[name=\"purchasePrice\"]')", "0");
    await click(S, T.btnExpr("Approve & save"));
    const seen = []; for (let i = 0; i < 6; i++) { await sleep(500); seen.push(await S.evaluate("(document.body.innerText.match(/✓ Saved to vault!/) || [''])[0]")); }
    await sleep(3000);
    const toast = seen.some(Boolean);
    const q = await S.evaluate("(() => { const o = {}; for (const k of Object.keys(localStorage)) if (/queue|sync|vltd_vault|drafts/i.test(k)) o[k] = (localStorage.getItem(k) || '').length; return o; })()");
    console.log("storage keys:", JSON.stringify(q));
    const rows = await poll(async () => { const r = await where(); return r.length ? r : null; }, 90000, 4000) || [];
    console.log("rows anywhere:", JSON.stringify(rows.map((r) => [r.profile_id === P ? "Personal" : r.profile_id === B ? "Business" : r.profile_id, r.added_via, r.purchase_price])));
    await S.visit("/vault"); await S.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 0", 60000).catch(() => {}); await sleep(2500);
    const local = (await text(S)).includes(TITLE);
    await S.visit("/vault/sync"); await sleep(3000);
    const sy = (await text(S)).match(/STATUS[^]{0,420}/);
    console.log("vault shows it:", local, "| sync page:", sy && sy[0].replace(/\n/g, " ").slice(0, 400));
    await rec(S, rows.length === 1 && rows[0].profile_id === P, { page: "/ai/review | owner (seeded draft)", control: "Approve & save to vault (reaches the account)", expected: "After '✓ Saved to vault!' the item exists in the account (so it also shows on a second device)", actual: `toast seen=${toast}; rows in the account (any profile) after up to 90 s: ${rows.length}; item visible in this browser's Vault: ${local}; sync page says: '${sy ? sy[0].replace(/\n/g, " ").slice(7, 90) : "-"}' (supersedes ADD-361)`, impact: "data loss", repro: "Seed a draft, Review, Approve & save to vault, wait 90 s, check the account and a second browser" });
    const S2 = await session("owner", { width: 1440, height: 900 });
    try {
      await S2.visit("/vault"); await S2.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 0", 60000).catch(() => {}); await sleep(2500);
      const shown2 = (await text(S2)).includes(TITLE);
      await rec(S2, shown2, { page: "/vault | owner, clean second browser", control: "Item approved from the AI draft queue, seen from a second browser", expected: "Shown", actual: shown2 ? "shown" : "not shown (only this device has it)", impact: "data loss", repro: "Approve a draft in browser 1, open /vault in a clean browser 2" });
    } finally { await S2.close(); }
    const r = await rows; await removeItems((await where()));
  } catch (e) { console.error("SUITE ERROR", e); try { await S.jshot("add-ai3-error"); } catch {} }
  finally { try { await S.evaluate(`localStorage.removeItem(${JSON.stringify(KEY)}); true`); } catch {} await S.close(); await removeItems(await where()); console.log("leftover", (await where()).length); }
})();
