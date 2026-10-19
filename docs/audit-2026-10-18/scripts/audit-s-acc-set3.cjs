// ACC: Personal <-> Business switching (state isolation), business-only settings pages (workspace/team/roles), viewer account pages. --w=1440|390
const A = require("./audit-s-acc-lib.cjs");
const { session, R, sleep, admin, man } = A;
const r = R("ACC");
setTimeout(() => { console.log("WATCHDOG"); process.exit(3); }, 1700000).unref();
const W = Number((process.argv.find((a) => a.startsWith("--w=")) || "--w=1440").slice(4));
const MOBILE = W < 500; const touch = MOBILE;
const tag = MOBILE ? "390 (browser-emulated touch)" : "1440";
const PART = (process.argv.find((a) => a.startsWith("--part=")) || "").slice(7);
const m = man();
const go = async (S, p) => { await S.visit(p); await sleep(1500); };
const cards = (S) => S.evaluate("[...document.querySelectorAll('a[href^=\"/vault/item/\"]')].map((a) => a.innerText.replace(/\\s+/g, ' ').slice(0, 50))");
const activeId = (S) => S.evaluate("localStorage.getItem('vltd_active_profile_id_v1')");

async function switching() {
  const cloneIds = [];
  // give the Business profile two items and a goal so isolation is observable
  const { data: tpl } = await admin.from("vault_items").select("*").eq("profile_id", m.personalId).limit(1).single();
  for (let i = 1; i <= 2; i++) {
    const row = { ...tpl, id: `qa_biz_${m.stamp}_${i}`, profile_id: m.businessId, title: `QA Biz Item ${i}`, is_public: false };
    delete row.internal_id; delete row.item_code;
    const ins = await admin.from("vault_items").insert(row);
    if (ins.error) { r.nt({ page: "profile switch", control: "seeding Business items", expected: "", actual: "could not seed: " + ins.error.message, impact: "none", repro: "" }); break; }
    cloneIds.push(row.id);
  }
  const S = await session("owner", { width: W, height: MOBILE ? 844 : 900, mobile: MOBILE });
  const page = (x, who = "owner, Personal") => `${x} | ${who} | ${tag}`;
  try {
    await go(S, "/vault"); await sleep(2500);
    const perCards = await cards(S);
    const keysP = await S.evaluate("Object.keys(localStorage).sort()");
    r.check(perCards.length >= 20 && (await activeId(S)) === m.personalId, { page: page("/vault"), control: "Start: Personal profile active", expected: "Personal items shown (26) and Personal is the stored active profile", actual: `cards=${perCards.length}; active=${(await activeId(S) || "").slice(0, 8)}`, evidence: "", impact: "misleading result", repro: "" });
    // open account menu and switch
    await A.clickSel(S, 'button[aria-label="Account menu"]', { touch }); await sleep(700);
    const sw = await A.clickText(S, "QA Journey Business", "button", { touch }); await sleep(5000);
    await S.settle().catch(() => {}); await sleep(2500);
    const aid = await activeId(S);
    const hdr = await S.evaluate("document.body.innerText.slice(0, 400)");
    const bizCards = await cards(S);
    r.check(sw && aid === m.businessId && bizCards.length === 2 && bizCards.every((c) => /QA Biz Item/.test(c)), { page: page("/vault", "owner, Business, 2 items"), control: "Account menu > Switch Profile > Business", expected: "page reloads on the Business profile: only its 2 items, none of the 26 Personal items", actual: `clicked=${sw}; stored active=${(aid || "").slice(0, 8)} (business=${aid === m.businessId}); cards=${JSON.stringify(bizCards)}`, evidence: await S.jshot(`acc-switch-biz-vault-${W}`), impact: "privacy/data loss", repro: "Open account menu; choose the business profile" });
    const keysB = await S.evaluate("Object.keys(localStorage).sort()");
    // other pages isolation
    const checks = [];
    for (const [p, re] of [["/dashboard", /QA Biz Item|2 items/], ["/museum", /Sports Slabs|Guitars|Vinyl Wall|Movie Posters/], ["/goals", /Spider-Man|Complete the|Reach \$2,000/], ["/vault/sold", /QA Sold Poster/], ["/insurance", /QA Album/], ["/activity", /QA Album/], ["/portfolio", /QA Album/]]) {
      await go(S, p); await sleep(1800);
      const t = await A.bodyText(S);
      const leaked = p === "/dashboard" ? false : re.test(t);
      checks.push([p, p === "/dashboard" ? (t.match(/WELCOME BACK,?\s*([^\n]{0,40})/i) || [])[0] : leaked ? "LEAK " + (t.match(re) || [""])[0] : "clean"]);
      if (p === "/dashboard") { r.check(/QA Journey Business/.test(t) && !/QA Visual Collection/.test(t.slice(0, 600)), { page: page(p, "owner, Business"), control: "Home while Business is active", expected: "greets the business profile; no Personal profile name or 26-item totals", actual: `${(t.match(/WELCOME BACK[^\n]{0,60}/i) || [""])[0]}; ${(t.match(/\d+ items[^\n]{0,30}/) || [""])[0]}`, evidence: await S.jshot(`acc-switch-biz-home-${W}`), impact: "privacy/data loss", repro: "Switch to Business; open Home" }); }
      else r.check(!leaked, { page: page(p, "owner, Business"), control: `${p} while Business is active`, expected: "shows nothing that belongs to the Personal profile", actual: leaked ? "Personal data present: " + (t.match(re) || [""])[0] : "no Personal records on the page", evidence: leaked ? await S.jshot(`acc-switch-biz-leak-${p.replace(/\W+/g, "_")}-${W}`) : "", impact: "privacy/data loss", repro: `Switch to Business; open ${p}` });
    }
    // settings show business identity
    await go(S, "/account");
    const biz = await S.evaluate("({ fields: [...document.querySelectorAll('main input[placeholder]')].filter((e) => e.getBoundingClientRect().width > 1).map((e) => e.placeholder + '=' + e.value), cats: [...document.querySelectorAll('a')].map((a) => a.innerText.trim()).filter((t) => /Workspace and team|Billing|Profile|Preferences|Privacy|Data/.test(t)) })");
    r.check(biz.fields.some((x) => /QA Journey Business/.test(x)) && biz.cats.some((c) => /Workspace and team/.test(c)), { page: page("/account", "owner, Business"), control: "Settings while Business is active", expected: "shows the business profile's own name/handle and adds the 'Workspace and team' category", actual: JSON.stringify(biz), evidence: await S.jshot(`acc-switch-biz-settings-${W}`), impact: "misleading result", repro: "Switch to Business; open Settings" });
    // reload keeps the choice; direct URL keeps it
    await S.visit("/vault"); await sleep(2500);
    r.check((await activeId(S)) === m.businessId && (await cards(S)).length === 2, { page: page("/vault", "owner, Business"), control: "Reload / direct URL keeps the chosen profile", expected: "still Business after a reload", actual: `active=${((await activeId(S)) || "").slice(0, 8)}; cards=${(await cards(S)).length}`, evidence: "", impact: "usability", repro: "Switch; reload" });
    // Back / Forward does not flip profile
    await S.evaluate("history.back()"); await sleep(2500);
    r.check((await activeId(S)) === m.businessId, { page: page("/vault", "owner, Business"), control: "Browser Back after switching", expected: "profile stays Business", actual: `${((await activeId(S)) || "").slice(0, 8)} on ${await S.path()}`, evidence: "", impact: "usability", repro: "" });
    // storage keys: anything bound to the personal id lingering?
    const perId = m.personalId; const lingering = await S.evaluate(`Object.keys(localStorage).filter((k) => k.includes(${JSON.stringify(perId)}) || k.includes(${JSON.stringify(perId.slice(0, 8))}))`);
    r.pass({ page: page("(browser storage)", "owner, Business"), control: "Browser storage keys while Business is active (informational)", expected: "(informational) per-profile data is keyed by profile", actual: `keys naming the Personal profile: ${JSON.stringify(lingering)}; total keys ${keysB.length} (Personal: ${keysP.length})`, evidence: "", impact: "improvement", repro: "Inspect localStorage after switching" });
    // /account/workspace etc as Business
    for (const p of ["/account/workspace", "/account/team", "/account/roles"]) {
      await go(S, p); await sleep(2000);
      const fin = await S.path(); const t = await A.bodyText(S);
      const info = await S.evaluate("[...document.querySelectorAll('main button,main a,main input,main select')].filter((e) => e.getBoundingClientRect().width > 1 && !e.closest('header,nav')).map((e) => (e.getAttribute('aria-label') || e.innerText || e.placeholder || '').replace(/\\s+/g, ' ').trim().slice(0, 28)).filter(Boolean).slice(0, 25)");
      r.check(fin === p && t.length > 120, { page: page(p, "owner, Business"), control: `Open ${p} as the Business owner`, expected: "page opens with its own content (workspace / team members / role table)", actual: `landed ${fin}; controls=${JSON.stringify(info)}; text="${t.replace(/^.*SETTINGS/, "").slice(0, 200)}"`, evidence: await S.jshot(`acc-biz-${p.split("/").pop()}-${W}`), impact: "blocked workflow", repro: `Switch to Business; open ${p}` });
    }
    // roles page content: what the owner role allows/denies
    await go(S, "/account/roles");
    const roleText = await A.bodyText(S);
    r.pass({ page: page("/account/roles", "owner, Business"), control: "Roles (what each role can do) (informational)", expected: "(informational) role definitions", actual: roleText.replace(/^.*SETTINGS/, "").slice(0, 600), evidence: "", impact: "improvement", repro: "" });
    // switch back to Personal
    await A.clickSel(S, 'button[aria-label="Account menu"]', { touch }); await sleep(700);
    await A.clickText(S, "QA Visual Collection", "button", { touch }); await sleep(5000); await S.settle().catch(() => {}); await sleep(2000);
    await go(S, "/vault"); await sleep(2000);
    const back = await cards(S);
    r.check((await activeId(S)) === m.personalId && back.length >= 20 && !back.some((c) => /QA Biz/.test(c)), { page: page("/vault"), control: "Switch back to Personal", expected: "26 Personal items again, no Business items", actual: `active personal=${(await activeId(S)) === m.personalId}; cards=${back.length}; business items present=${back.some((c) => /QA Biz/.test(c))}`, evidence: "", impact: "privacy/data loss", repro: "" });
  } finally { await S.close(); await admin.from("vault_items").delete().in("id", cloneIds); }
}

async function viewer() {
  const S = await session("viewer", { width: W, height: MOBILE ? 844 : 900, mobile: MOBILE });
  const page = (x) => `${x} | unrelated viewer, Personal, 0 items | ${tag}`;
  try {
    for (const p of ["/account/workspace", "/account/team", "/account/roles"]) {
      await go(S, p); await sleep(1500);
      r.check((await S.path()) === "/account", { page: page(p), control: `Open ${p} (business-only page) as a Personal-only account`, expected: "sent back to Settings (business only) and shows nothing of any workspace", actual: await S.path(), evidence: "", impact: "privacy/data loss", repro: "" });
    }
    await go(S, "/account");
    const f = await S.evaluate("[...document.querySelectorAll('main input[placeholder=\"Display name\"],main input[placeholder=\"Username\"]')].map((e) => e.value)");
    const t = await A.bodyText(S);
    r.check(!/QA Visual Collection|QA Journey Business|qa_jr_/.test(t) && f.length === 2, { page: page("/account"), control: "Settings for a different account", expected: "shows only this account's own profile; no trace of the other QA owner", actual: `fields=${JSON.stringify(f)}; mentions owner's names=${/QA Visual Collection|qa_jr_/.test(t)}`, evidence: await S.jshot(`acc-viewer-settings-${W}`), impact: "privacy/data loss", repro: "Sign in as a second account; open Settings" });
    // viewer opens the owner's public/private profile pages
    const ownerUser = (await admin.from("profiles").select("username,id").eq("id", m.personalId).single()).data;
    for (const p of [`/u/${ownerUser.username}`, `/v/${m.personalId}`]) {
      await go(S, p); await sleep(1500);
      const t2 = await A.bodyText(S);
      r.check(/could not be found|404|private|not available/i.test(t2.slice(0, 300)) && !/QA Album/.test(t2), { page: page(p), control: "Another person's profile page (profile is private)", expected: "not found/private page; no items or name leaked", actual: t2.replace(/^Home Vault Exhibitions Lounge Discover \? Help ⌘K (COLLECTOR|NOVICE) Level \d+ /, "").slice(0, 200), evidence: "", impact: "privacy/data loss", repro: `Open ${p} as another signed-in user` });
    }
    // visitor on same
    const V = await session("visitor", { width: W, height: MOBILE ? 844 : 900, mobile: MOBILE });
    try {
      for (const p of [`/u/${ownerUser.username}`, `/v/${m.personalId}`]) {
        await go(V, p); await sleep(1200);
        const t3 = await A.bodyText(V);
        r.check(/could not be found|404|private|not available/i.test(t3.slice(0, 300)) && !/QA Album/.test(t3), { page: `${p} | visitor | ${tag}`, control: "Private profile page for a signed-out visitor", expected: "not found/private; no private data", actual: t3.slice(0, 200), evidence: "", impact: "privacy/data loss", repro: `Signed out, open ${p}` });
      }
    } finally { await V.close(); }
  } finally { await S.close(); }
}

(async () => {
  if (!PART || PART === "switch") await switching();
  if (!PART || PART === "viewer") await viewer();
})().catch((e) => { console.error("ERR", e); process.exit(2); });
