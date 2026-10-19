// EXH suite 5: who can open an exhibition in each visibility state (rendered AND network/database), Guest View data, hidden items, invite links, view counter, /gallery redirect.
const X = require("./audit-s-exh-lib.cjs");
const { session, admin, sleep, man, rows, mclick, byLabel, byLabelRe, key, gdb, gItemIds, itemsOf } = X;
const { env, createClient } = require("./journey-lib.cjs");
const R = rows();
const m = man();
const ex = JSON.parse(require("fs").readFileSync(__dirname + "/exh-created.json", "utf8"));
const A = ex.A;
const PUB = m.audit.publicGalleryId;
const MARK = 7777.77;
const id = (n) => `qa_vz_${m.stamp}_${n}`;
const anon = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
async function asUser(c) { const sb = anon(); const { error } = await sb.auth.signInWithPassword({ email: c.email, password: c.password }); if (error) throw error; return sb; }
const classify = (t, title) => {
  t = t.replace(/\s+/g, " ");
  if (/Link not available/.test(t)) return "link-not-available";
  if (/Exhibition not found/.test(t)) return "exhibition-not-found";
  if (/Private Exhibition/.test(t) && /cannot be viewed from a shared link/.test(t)) return "private-notice";
  if (/Owner only allows registered users/.test(t)) return "registered-gate";
  if (/Please confirm you are 18|18 or older/.test(t) && !t.includes(title)) return "adult-gate";
  if (t.includes(title)) return "renders";
  return "other:" + t.slice(0, 80);
};
async function readPage(S, path, wait = 7000) { await S.visit(path); await sleep(wait); return { path: await S.path(), text: (await S.text()).replace(/\s+/g, " ") }; }

(async () => {
  const sbAnon = anon();
  const pubIds = [6, 7, 8, 9, 10, 11].map(id);
  await admin.from("vault_items").update({ purchase_price: MARK }).in("id", pubIds.concat([1, 3, 4, 5].map(id)));
  await admin.from("vault_items").update({ is_public: true, current_value: 111 }).eq("id", id(6));
  await admin.from("vault_items").update({ is_public: true, current_value: 222 }).eq("id", id(7));
  const gA0 = await gdb(A); const tokA = gA0.public_token; const titleA = gA0.title;
  const setA = (patch, guestMode = "public") => admin.from("galleries").update({ ...patch, layout: { ...gA0.layout, guestViewMode: guestMode } }).eq("id", A);
  // ---------- invite links
  // The invites are created here (admin, on this agent's own exhibition) so this suite does not depend on earlier runs.
  const inv = { token1: "inv_audit_valid_" + m.stamp, disabledToken: "inv_audit_disabled_" + m.stamp };
  await admin.from("gallery_invites").delete().eq("gallery_id", A);
  const mk = await admin.from("gallery_invites").insert([
    { token: inv.token1, gallery_id: A, label: "QA VIP preview", disabled: false, expires_at: new Date(Date.now() + 24 * 3600e3).toISOString(), permissions: { images: true, descriptionPage: true, financialHistory: false } },
    { token: inv.disabledToken, gallery_id: A, label: "QA to disable", disabled: true, permissions: { images: true } },
  ]);
  if (mk.error) console.log("invite insert:", mk.error.message);
  await admin.from("gallery_items").delete().eq("gallery_id", A);
  await admin.from("gallery_items").insert(gItemIds(await gdb(A)).map((aid, i) => ({ gallery_id: A, position: i, artifact_id: aid }))); // the exhibition's item links, as the app saves them
  await setA({ visibility: "INVITE", state: "ACTIVE" }, "public");
  const invRows = (await admin.from("gallery_invites").select("*").eq("gallery_id", A)).data;
  const valid = invRows.find((r) => r.token === inv.token1);
  await admin.from("galleries").update({ visibility: "LOCKED" }).eq("id", A);
  const lockedInvite = await sbAnon.rpc("get_gallery_by_invite_token", { p_token: inv.token1 });
  await admin.from("galleries").update({ visibility: "INVITE" }).eq("id", A);
  R.check((lockedInvite.data || []).length === 0, { page: "database | invite link on a Private exhibition", control: "Invite lookup after the exhibition was made Private", expected: "Nothing returned", actual: `${(lockedInvite.data || []).length} row(s)`, impact: "privacy/data loss", repro: "Switch to Private, call get_gallery_by_invite_token with an old invite" });
  const cases = [
    { label: "valid invite (financial history OFF/ON as set)", token: inv.token1, expect: "renders" },
    { label: "disabled invite", token: inv.disabledToken, expect: "link-not-available" },
    { label: "unknown invite token", token: "inv_does_not_exist", expect: "link-not-available" },
  ];
  // expired: make the second (valid) invite expire in the past via the owner's own row
  const expTok = "inv_audit_expired_" + m.stamp;
  const insExp = await admin.from("gallery_invites").insert({ token: expTok, gallery_id: A, label: "QA expired", disabled: false, expires_at: new Date(Date.now() - 3600e3).toISOString(), permissions: { images: true } });
  if (insExp.error) console.log("expired invite insert:", insExp.error.message);
  cases.push({ label: "expired invite", token: expTok, expect: "expired" });
  await admin.from("gallery_invites").update({ permissions: { images: true, descriptionPage: true, financialHistory: false } }).eq("token", inv.token1);
  const invShow = async (S, token) => { const p = await readPage(S, `/museum/invite/${token}`, 8000); const t = p.text; if (/Link expired/.test(t)) return { k: "expired", t }; if (/Link not available/.test(t)) return { k: "link-not-available", t }; if (t.includes(titleA)) return { k: "renders", t }; return { k: "other:" + t.slice(0, 80), t }; };
  { // signed-out visitor: where does an invite link lead?
    const SVv = await session("visitor");
    try {
      const p = await readPage(SVv, `/museum/invite/${inv.token1}`, 6000);
      R.check(p.path.startsWith("/login?next=%2Fmuseum%2Finvite%2F"), { page: "/museum/invite/[token] | signed-out visitor | valid invite", control: "Invite link opened signed out", expected: "A clear next step: sign-in with a way back to the invite (return address kept)", actual: p.path, evidence: await SVv.jshot("exh-access-invite-visitor-login"), impact: "usability", repro: "Open a valid /museum/invite/<token> signed out" });
      R.nt({ page: "/museum/invite/[token] | signed-out visitor", control: "Invite links need an account while share links do not", expected: "Product decision: should an invite link work for someone without an account (Guest View and Public links do)?", actual: "Signed-out visitors are sent to the login page for invite links; Guest View / Public share links open without an account. Returning to the invite after login not exercised (passwords may not be typed on production).", impact: "improvement" });
    } finally { await SVv.close(); }
  }
  for (const kind of ["viewer"]) {
    const S = await session(kind);
    try {
      for (const c of cases) {
        const r = await invShow(S, c.token);
        R.check(r.k === c.expect, { page: `/museum/invite/[token] | ${kind} | Guest View exhibition`, control: `Invite link: ${c.label}`, expected: c.expect, actual: r.k, evidence: r.k !== c.expect ? await S.jshot(`exh-access-invite-${c.expect}-${kind}`) : "", impact: "privacy/data loss", repro: "Open /museum/invite/<token>" });
        if (r.k === "renders") R.check(!/7,?777|\bPaid\b/i.test(r.t) && /INVITE ACCESS/.test(r.t), { page: `/museum/invite/[token] | ${kind} | financial history OFF`, control: "Invite page content without the financial permission", expected: "No purchase cost, no 'Paid'", actual: /7,?777|\bPaid\b/.test(r.t) ? "cost visible" : "no cost", impact: "privacy/data loss", repro: "Open a valid invite without financial permission" });
      }
    } finally { await S.close(); }
  }
  // financial permission ON: cost only for PUBLIC items
  await admin.from("gallery_invites").update({ permissions: { images: true, descriptionPage: true, financialHistory: true } }).eq("token", inv.token1);
  await admin.from("vault_items").update({ is_public: true, current_value: 55 }).eq("id", id(1)); // item 1 is public; items 3-5 stay private
  await admin.from("profiles").update({ is_public: true }).eq("id", m.personalId); // public items only show for a public profile
  {
    const S = await session("viewer");
    try {
      const r = await invShow(S, inv.token1);
      const paidCount = (r.t.match(/Paid/g) || []).length;
      R.check(r.k === "renders", { page: "/museum/invite/[token] | signed-in viewer | financial history ON", control: "Invite with 'Financial History' permission", expected: "Page renders", actual: r.k, impact: "blocked workflow", repro: "Open the invite" });
      const S2txt = r.t;
      // open a public item's detail to see the 'Paid' tile (items 6/7 are public)
      const clicked = await mclick(S, `[...document.querySelectorAll('button')].find(b => /QA Album 1 - /.test(b.getAttribute('aria-label') || b.textContent))`, { wait: 1500 });
      const modal = await S.evaluate(`(() => { const d = document.querySelector('[role=dialog]'); return d ? d.innerText.replace(/\\s+/g,' ') : null; })()`);
      R.check(!!modal && /Paid/i.test(modal) && /7,?777|7,?778/.test(modal), { page: "/museum/invite/[token] | signed-in viewer | financial history ON | public item 'QA Album 1'", control: "Item detail with the financial permission", expected: "Shows what was paid for a PUBLIC item (permission granted by the owner)", actual: String(modal).slice(0, 200), evidence: await S.jshot("exh-access-invite-financial"), impact: "misleading result", repro: "Open the invite; open a public item" });
      const privModal = await (async () => { await S.evaluate(`document.querySelector('[role=dialog] [aria-label="Close"]')?.click(); true`); await sleep(500); await mclick(S, `[...document.querySelectorAll('button')].find(b => /QA Album 3 - /.test(b.getAttribute('aria-label') || b.textContent))`, { wait: 1500 }); return S.evaluate(`(() => { const d = document.querySelector('[role=dialog]'); return d ? d.innerText.replace(/\\s+/g,' ') : null; })()`); })();
      R.check(!!privModal && !/Paid|7,?777/i.test(privModal), { page: "/museum/invite/[token] | signed-in viewer | financial history ON | private item 'QA Album 3'", control: "Item detail for an item that is NOT public, with the financial permission", expected: "No cost shown (only public items' prices are released)", actual: String(privModal).slice(0, 200), impact: "privacy/data loss", repro: "Open the invite; open a private item" });
    } finally { await S.close(); }
  }
  await admin.from("vault_items").update({ is_public: false, current_value: 120 }).eq("id", id(1));
  await admin.from("profiles").update({ is_public: false }).eq("id", m.personalId);
  await admin.from("galleries").update({ visibility: "LOCKED" }).eq("id", A);
  await admin.from("gallery_invites").delete().eq("token", expTok);
  // invite uses recorded
  const used = (await admin.from("gallery_invites").select("token,last_used_at").eq("token", inv.token1)).data;
  R.check(used[0] && used[0].last_used_at, { page: "/museum/invite/[token] | after visits", control: "Invite 'last used' bookkeeping", expected: "last_used_at set after a valid visit", actual: JSON.stringify(used[0]), impact: "usability", repro: "Open a valid invite; read the invite row" });
  console.log("DONE invites");
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
