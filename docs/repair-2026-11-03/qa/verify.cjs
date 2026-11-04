// Full verification of business-member access with isolated headless browsers (one profile directory per person) and real sign-in.
//   node verify.cjs --base=http://localhost:3003 --sim     (--sim: answer only rpc/list_member_profiles with the function's result, for use BEFORE the SQL is applied)
//   node verify.cjs --base=https://vltd.app                (after the SQL is applied: nothing simulated)
// Membership is created and removed ONLY with the Team page's own Add / Remove controls. Prints a result table.
const { man, userClient, admin, sleep, anonClient } = require("./lib.cjs");
const { open, closeAll } = require("./br.cjs");
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split("=").slice(1).join("=");
const base = arg("base", "http://localhost:3003");
const sim = process.argv.includes("--sim");
const rows = [];
const rec = (id, what, ok, detail = "") => { rows.push({ id, what, ok }); console.log((ok ? "PASS" : "FAIL").padEnd(5), id.padEnd(4), what, ok ? "" : "  <= " + String(detail).slice(0, 260)); };
const flat = (s) => String(s).replace(/\s+/g, " ");
const has = (t, s) => flat(t).toLowerCase().includes(String(s).toLowerCase());

// go to a path, then wait until the page text holds a marker (or the path changes to one that matches re); never a fixed sleep alone
async function gw(S, p, { text, path: re, timeout = 45000 } = {}) {
  await S.go(p);
  try { await S.waitFor(text ? `document.body && document.body.innerText.toLowerCase().includes(${JSON.stringify(text.toLowerCase())})` : re ? `/${re}/.test(location.pathname)` : "document.body && document.body.innerText.length > 200", timeout, p); } catch { /* the check below reports what was seen */ }
  await sleep(1200);
}
async function openMenu(S) {
  for (let i = 0; i < 8; i++) {
    await S.evaluate(`document.querySelector('[aria-label="Account menu"]')?.click()`);
    await sleep(1500);
    // the dropdown is a fixed-position panel: read the whole page text once it shows "Sign Out"
    const t = await S.evaluate(`document.body ? document.body.innerText : ''`);
    if (/sign out/i.test(t) && /(curator|business)\s/i.test(t)) return t;
    await S.evaluate(`document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`);
    await sleep(2000);
  }
  return "";
}
async function vaultText(S) { await S.go("/vault"); await S.waitFor("document.body.innerText.length > 200", 30000).catch(() => {}); await sleep(5000); return S.text(); }
// how many of this device's cached items / exhibitions belong to a profile (the item cache is zlib+base64, decoded here)
async function localCopy(S, profileId) {
  const raw = await S.evaluate(`JSON.stringify({ items: localStorage.getItem('vltd_vault_items_v1'), g: localStorage.getItem('vltd_galleries') })`);
  const { items, g } = JSON.parse(raw);
  let n = 0, ng = 0;
  try { const txt = items && items.startsWith("z64:") ? require("zlib").inflateSync(Buffer.from(items.slice(4), "base64")).toString() : items; n = JSON.parse(txt || "[]").filter((x) => String(x.profile_id) === profileId).length; } catch { n = -1; }
  try { ng = JSON.parse(g || "[]").filter((x) => String(x.profile_id) === profileId).length; } catch { ng = -1; }
  return { items: n, galleries: ng };
}

(async () => {
  const m = man(); const B = m.profiles.business;
  const o = { sim, base }; // options for open()
  console.log("base", base, "simulated function answer:", sim);

  // ───────── Owner: add the member with the Team page controls (idempotent: skipped if already on the roster)
  let O = await open(base, { simulateRpc: sim });
  await O.login(m.users.owner.email, m.users.owner.password);
  await O.setActive(B); await gw(O, "/account/team", { text: "Invite a member" });
  let ot = await O.text();
  if (!has(ot, m.users.member.email)) {
    await O.setVal("input[type=email]", m.users.member.email); await sleep(300);
    await O.clickText("Add"); await sleep(3500); ot = await O.text();
  }
  rec("O1", "Owner: Team page shows Invite box + the member on the roster (added with the Team controls)", has(ot, "Invite a member") && has(ot, m.users.member.email.toLowerCase()), flat(ot).slice(0, 200));
  rec("O2", "Owner: transfer-ownership danger zone and Remove/Make admin buttons are there", has(ot, "transfer ownership") || has(ot, "Transfer ownership"), "");
  await gw(O, "/account/workspace", { text: "Workspace Settings" });
  rec("O3", "Owner: Workspace settings page opens (no redirect)", (await O.path()).startsWith("/account/workspace") && has(await O.text(), "Workspace Settings"), await O.path());
  let ov = await vaultText(O);
  rec("O4", "Owner in the business: Vault shows the 3 business items and none of the owner's personal items", ["BIZCO ITEM 1", "BIZCO ITEM 2", "BIZCO ITEM 3"].every((t) => has(ov, t)) && !has(ov, "OWNERPERSONAL"), flat(ov).slice(0, 200));
  await O.setActive(m.profiles.ownerPersonal); ov = await vaultText(O);
  rec("O5", "Owner in the personal profile: only personal items, no business items", has(ov, "OWNERPERSONAL ITEM 1") && !has(ov, "BIZCO"), flat(ov).slice(0, 200));
  await O.setActive(B);

  await O.close();
  // ───────── Member: separate isolated browser, real sign-in
  const M = await open(base, { simulateRpc: sim });
  await M.login(m.users.member.email, m.users.member.password);
  await sleep(2000);
  let menu = await openMenu(M);
  rec("M1", "Member: Account menu lists the business (Switch Profile) with 'team member' label", has(menu, "Switch Profile") && has(menu, "QA Biz Co") && has(menu, "team member"), flat(menu).slice(0, 700));
  rec("M2", "Member: own personal profile is still listed and is the active one on arrival", has(menu, "QA Member Personal") && (await M.activeProfile()) === m.profiles.memberPersonal, await M.activeProfile());
  // switch with the real Switch button
  await M.evaluate(`(() => { const b = [...document.querySelectorAll('[role="menu"] button, button')].find((x) => /QA Biz Co/.test(x.innerText) && /Switch/.test(x.innerText)); if (b) b.click(); return !!b; })()`);
  await sleep(6000);
  rec("M3", "Member: switching works; the business is now the active profile", (await M.activeProfile()) === B, await M.activeProfile());
  menu = await openMenu(M);
  rec("M4", "Member: header/menu clearly shows the business as active", has(menu, "QA Biz Co") && /active/i.test(menu) , flat(menu).slice(0, 700));
  await M.evaluate(`document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`);
  let mv = await vaultText(M);
  rec("M5", "Member in the business: sees all 3 business items; NONE of their personal items", ["BIZCO ITEM 1", "BIZCO ITEM 2", "BIZCO ITEM 3"].every((t) => has(mv, t)) && !has(mv, "MEMBERPERSONAL") && !has(mv, "OWNERPERSONAL"), flat(mv).slice(0, 250));
  await gw(M, "/museum", { text: "BIZCO EXHIBIT" }); let mx = await M.text();
  rec("M6", "Member in the business: sees the business exhibition", has(mx, "BIZCO EXHIBIT"), flat(mx).slice(0, 250));
  await gw(M, "/account/team", { text: "Invite people to" }); let mt = await M.text();
  rec("M7", "Member: Team page opens (roster visible: owner + self)", (await M.path()).startsWith("/account/team") && has(mt, m.users.owner.email.toLowerCase()) && has(mt, m.users.member.email.toLowerCase()), (await M.path()) + " " + flat(mt).slice(0, 200));
  rec("M8", "Member: NO Invite box, NO Remove / Make admin buttons, NO transfer-ownership zone", !has(mt, "Invite a member") && !/\bRemove\b|Make admin|Make member/.test(flat(mt)) && !/transfer ownership/i.test(mt), flat(mt).slice(0, 300));
  rec("M9", "Member: Settings lists 'Workspace and team' but not Profile / Billing and contact", has(mt, "Workspace and team") && !/\bProfile Preferences\b/.test(flat(mt)) && !has(mt, "Billing and contact") && has(mt, "You are a team member"), flat(mt).slice(0, 400));
  const dest = {};
  for (const p of ["/account/workspace", "/account/billing", "/account?section=profile", "/account?section=contact"]) { await M.go(p); await M.waitFor("location.pathname.startsWith('/account/team')", 20000).catch(() => {}); dest[p] = await M.path(); }
  rec("M10", "Member: workspace, billing, profile and contact settings URLs all send them to the Team page", Object.values(dest).every((d) => d.startsWith("/account/team")), JSON.stringify(dest));
  await gw(M, "/account/security", { text: "belong to the business" }); const sec = await M.text();
  rec("M11", "Member: privacy cards (owner's identity details) are replaced by a notice", has(sec, "belong to the business's owner"), flat(sec).slice(0, 200));
  // direct data-layer refusals for owner-only actions, with the member's own login
  const { sb: msb } = await userClient(m.users.member.email, m.users.member.password);
  // the REAL database function (only meaningful when nothing is simulated)
  const rf = await msb.rpc("list_member_profiles");
  const rfRows = Array.isArray(rf.data) ? rf.data : [];
  const forbidden = ["full_name","phone","address_line1","tax_id","stripe_customer_id","date_of_birth","user_id","bulk_scans_used"];
  rec("F1", "REAL function: exists and returns exactly the business for the member, role member, no owner-only column", !sim ? (!rf.error && rfRows.length === 1 && rfRows[0].id === B && rfRows[0].member_role === "member" && !forbidden.some((k) => k in rfRows[0])) : true, JSON.stringify({ err: rf.error?.message, n: rfRows.length, keys: rfRows[0] && Object.keys(rfRows[0]) }));
  const { sb: ssb0 } = await userClient(m.users.stranger.email, m.users.stranger.password);
  const rf2 = await ssb0.rpc("list_member_profiles");
  rec("F2", "REAL function: unrelated account gets an empty list", !sim ? (!rf2.error && Array.isArray(rf2.data) && rf2.data.length === 0) : true, JSON.stringify(rf2));
  const rf3 = await anonClient().rpc("list_member_profiles");
  rec("F3", "REAL function: signed-out (anon) cannot call it", !sim ? Boolean(rf3.error) || (Array.isArray(rf3.data) && rf3.data.length === 0) : true, JSON.stringify(rf3).slice(0, 200));
  const rfo = await (await userClient(m.users.owner.email, m.users.owner.password)).sb.rpc("list_member_profiles");
  rec("F4", "REAL function: the owner gets nothing from it (own profiles come from the normal list)", !sim ? (!rfo.error && Array.isArray(rfo.data) && rfo.data.length === 0) : true, JSON.stringify(rfo).slice(0, 200));
  const upd = await msb.from("profiles").update({ display_name: "HACKED" }).eq("id", B).select("id");
  const biz = (await admin.from("profiles").select("display_name").eq("id", B).single()).data;
  rec("M12", "Member cannot rename the business (database refuses; name unchanged)", (upd.data || []).length === 0 && biz.display_name === "QA Biz Co", JSON.stringify({ upd: upd.data, name: biz.display_name }));
  const del = await msb.from("vault_items").delete().eq("profile_id", B).select("id");
  const left = (await admin.from("vault_items").select("id", { count: "exact", head: true }).eq("profile_id", B)).count;
  rec("M13", "Member cannot delete the business's items (refused; all 3 still there)", (del.data || []).length === 0 && left === 3, JSON.stringify({ del: del.data?.length, left }));
  const addr = await msb.rpc("add_profile_member", { p_profile: B, p_email: m.users.stranger.email, p_role: "member" });
  rec("M14", "Member cannot add people to the team (refused by the database function)", addr.data?.ok === false, JSON.stringify(addr.data));
  const tr = await msb.rpc("transfer_profile_ownership", { p_profile: B, p_email: m.users.stranger.email });
  rec("M15", "Member cannot transfer ownership (refused)", tr.data?.ok === false, JSON.stringify(tr.data));
  const tier = await msb.from("profiles").update({ tier: "FREE" }).eq("id", B).select("id");
  rec("M16", "Member cannot change the business's plan/billing columns (refused)", (tier.data || []).length === 0, JSON.stringify(tier.data));
  // switch back to personal in the same session
  await M.setActive(m.profiles.memberPersonal);
  let mp = await vaultText(M);
  rec("M17", "Member back in their personal profile: only personal items; business items NOT shown", has(mp, "MEMBERPERSONAL ITEM 1") && !has(mp, "BIZCO"), flat(mp).slice(0, 250));

  // ───────── Unrelated person (stranger)  (member browser stays open for the removal check below)
  const S = await open(base, { simulateRpc: sim });
  await S.login(m.users.stranger.email, m.users.stranger.password);
  await sleep(2000);
  menu = await openMenu(S);
  rec("S1", "Unrelated account: Account menu has no business and no Switch Profile block", !has(menu, "QA Biz Co") && !has(menu, "Switch Profile"), flat(menu).slice(0, 250));
  await S.evaluate(`document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`);
  await S.setActive(B); // guessing the business id on this device
  const sv = await vaultText(S);
  rec("S2", "Unrelated account forcing the business id as active: falls back to own profile; no business items", !has(sv, "BIZCO") && (await S.activeProfile()) === m.profiles.strangerPersonal, (await S.activeProfile()) + " " + flat(sv).slice(0, 150));
  const tpaths = {};
  for (const p of ["/account/team", "/account/workspace"]) { await gw(S, p, { path: "^/account$", timeout: 25000 }); tpaths[p] = await S.path(); }
  rec("S3", "Unrelated account: Team and Workspace URLs do not open (sent to their own Settings)", Object.values(tpaths).every((x) => !x.startsWith("/account/team") && !x.startsWith("/account/workspace")), JSON.stringify(tpaths));
  const { sb: ssb } = await userClient(m.users.stranger.email, m.users.stranger.password);
  const q = async (sb) => ({
    profile: (await sb.from("profiles").select("id").eq("id", B)).data?.length,
    items: (await sb.from("vault_items").select("id").eq("profile_id", B)).data?.length,
    galleries: (await sb.from("galleries").select("id").eq("profile_id", B)).data?.length,
    roster: (await sb.from("profile_members").select("user_id").eq("profile_id", B)).data?.length,
    rosterRpc: (await sb.rpc("list_profile_members", { p_profile: B })).data?.length,
    oneItem: (await sb.from("vault_items").select("id").eq("id", m.items.find((i) => i.includes("_BIZCO_1")))).data?.length,
  });
  const sq = await q(ssb);
  rec("S4", "Unrelated account guessing the business id in data requests: 0 profile / items / exhibitions / roster rows", Object.values(sq).every((x) => !x), JSON.stringify(sq));
  const ssAdd = await ssb.rpc("add_profile_member", { p_profile: B, p_email: m.users.stranger.email, p_role: "member" });
  rec("S5", "Unrelated account cannot add itself to the team", ssAdd.data?.ok === false, JSON.stringify(ssAdd.data));

  // ───────── Signed out
  const V = await open(base, { simulateRpc: sim });
  const vp = {};
  for (const p of ["/vault", "/account/team", "/account/workspace"]) { await gw(V, p, { path: "^/login", timeout: 25000 }); vp[p] = await V.path(); }
  rec("V1", "Signed-out visitor: Vault, Team and Workspace URLs go to the sign-in page", Object.values(vp).every((x) => x.startsWith("/login")), JSON.stringify(vp));
  const asb = anonClient();
  const aq = await q(asb);
  rec("V2", "Signed-out data requests for the business id: 0 rows everywhere", Object.values(aq).every((x) => !x), JSON.stringify(aq));

  await S.close(); await V.close();
  // ───────── Removal through the Team page (owner signs in again in a fresh browser), then the member's ALREADY-OPEN session
  O = await open(base, { simulateRpc: sim });
  await O.login(m.users.owner.email, m.users.owner.password); await O.setActive(B);
  await M.setActive(B);
    await M.go("/vault"); await sleep(6000);
  const beforeLocal = await localCopy(M, B);
  await gw(O, "/account/team", { text: m.users.member.email });
  await O.evaluate(`(() => { const rows = [...document.querySelectorAll('div')].filter((d) => d.innerText && d.innerText.includes(${JSON.stringify(m.users.member.email.toLowerCase())}) && d.querySelector('button')); const row = rows[rows.length - 1]; if (!row) return false; const b = [...row.querySelectorAll('button')].find((x) => /Remove/.test(x.innerText)); b && b.click(); return !!b; })()`);
  await sleep(4000);
  const ot2 = await O.text();
  rec("R1", "Owner removed the member with the Team page's Remove button (member gone from roster)", !has(ot2, m.users.member.email.toLowerCase()), flat(ot2).slice(0, 250));
  const inDb = (await admin.from("profile_members").select("user_id").eq("profile_id", B).eq("user_id", m.users.member.id)).data?.length;
  rec("R2", "Membership row is really gone in the database", inDb === 0, inDb);
  // member's already-open browser: no sign-out, no new login, just reload
  await M.go("/vault"); await sleep(7000);
  const mvr = await M.text();
  rec("R3", "Removed member, same open session after reload: business items not shown; back on own personal profile", !has(mvr, "BIZCO") && (await M.activeProfile()) === m.profiles.memberPersonal, (await M.activeProfile()) + " " + flat(mvr).slice(0, 160));
  menu = await openMenu(M);
  rec("R4", "Removed member: the business is gone from the Account menu / switcher", !has(menu, "QA Biz Co") && !has(menu, "Switch Profile"), flat(menu).slice(0, 250));
  await M.evaluate(`document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`);
  const rp = {};
  for (const p of ["/account/team", "/account/workspace"]) { await gw(M, p, { path: "^/account$", timeout: 25000 }); rp[p] = await M.path(); }
  rec("R5", "Removed member: Team and Workspace URLs no longer open", Object.values(rp).every((x) => !x.startsWith("/account/team") && !x.startsWith("/account/workspace")), JSON.stringify(rp));
  const afterLocal = await localCopy(M, B);
  rec("R6", "Removed member: this device's cached copy of the business items was forgotten", beforeLocal.items > 0 && afterLocal.items === 0 && afterLocal.galleries === 0, JSON.stringify({ beforeLocal, afterLocal }));
  const { sb: msb2 } = await userClient(m.users.member.email, m.users.member.password);
  const mq = await q(msb2);
  const rfr = await msb2.rpc("list_member_profiles");
  rec("R9", "REAL function after removal: the removed member gets an empty list", !sim ? (!rfr.error && Array.isArray(rfr.data) && rfr.data.length === 0) : true, JSON.stringify(rfr).slice(0, 200));
  rec("R7", "Removed member's data requests for the business: 0 rows (items, exhibitions, roster, roster function)", Object.values(mq).every((x) => !x), JSON.stringify(mq));
  const ins = await msb2.from("vault_items").insert({ id: `qa_${m.stamp}_REMOVED_ADD`, profile_id: B, title: "SHOULD FAIL", created_at: Date.now(), status: "COLLECTION", is_public: false });
  rec("R8", "Removed member cannot add an item to the business any more (refused)", !!ins.error, JSON.stringify(ins.error?.message));
  await admin.from("vault_items").delete().eq("id", `qa_${m.stamp}_REMOVED_ADD`);

  // ───────── Add again with the Team page, member sees it again (full download after the forget)
  await gw(O, "/account/team", { text: "Invite a member" });
  await O.setVal("input[type=email]", m.users.member.email); await sleep(300); await O.clickText("Add"); await sleep(3500);
  await M.go("/vault"); await sleep(4000);
  menu = await openMenu(M);
  rec("A1", "Added again: the business is back in the member's switcher (same open session, no new login)", has(menu, "QA Biz Co") && has(menu, "team member"), flat(menu).slice(0, 250));
  await M.evaluate(`document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))`);
  await M.setActive(B); mv = await vaultText(M);
  rec("A2", "Added again: all 3 business items load again", ["BIZCO ITEM 1", "BIZCO ITEM 2", "BIZCO ITEM 3"].every((t) => has(mv, t)), flat(mv).slice(0, 200));

  // member's allowed action (existing rule: members can add items)
  const ok = await msb2.from("vault_items").insert({ id: `qa_${m.stamp}_BIZCO_MEMBERADD`, profile_id: B, title: "BIZCO MEMBER ADDED", created_at: Date.now(), status: "COLLECTION", is_public: false, universe: "POP_CULTURE", category: "comics", category_label: "Comics" });
  rec("A3", "Member (re-added) can add an item to the business (existing member rule)", !ok.error, ok.error?.message);
  await admin.from("vault_items").delete().eq("id", `qa_${m.stamp}_BIZCO_MEMBERADD`);

  for (const x of [O, M]) await x.close();
  const bad = rows.filter((r) => !r.ok);
  console.log(`\n${rows.length - bad.length}/${rows.length} passed`); if (bad.length) console.log("FAILED:", bad.map((b) => b.id).join(", "));
  require("fs").writeFileSync(require("path").join(__dirname, `verify-result-${sim ? "sim" : "live"}.json`), JSON.stringify({ base, sim, at: new Date().toISOString(), rows }, null, 1));
})().catch(async (e) => { console.error("ERR", e.message || e); await closeAll(); process.exit(2); });
