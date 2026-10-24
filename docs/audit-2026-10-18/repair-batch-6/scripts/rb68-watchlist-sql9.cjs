// Wishlist after SQL package 9 (RB68), on PRODUCTION with an isolated QA owner, a second QA account and a visitor:
//   A. Following rules reach the account and a clean second browser shows them (state kept)
//   B. the sharing field switches: one at a time, default off, visitor sees only what is on, target price never, turning sharing off kills the link
//   C. account isolation: the second account and a visitor read/change nothing of the owner's (wishlist, rules, shares, watchlist)
//   D. acquisition retries: a repeated save never makes a second Vault record, copies number on across two browsers
//   AUDIT_MANIFEST=<manifest> node rb68-watchlist-sql9.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const J = require(path.join(SD, "journey-lib.cjs"));
const { sleep, session, admin, man } = T;
const m = man(); const P = m.personalId;
const LABEL = process.argv[2] || "run";
const r = T.R("RB68");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [], notes: {} };
const DIALOG = `(document.querySelector('[role="dialog"]'))`;

(async () => {
  let S, S2, V;
  const ck = (ok, control, expected, actual, page) => { out.cases.push({ ok: !!ok, control }); r.check(!!ok, { page: page || "/watchlist", control, expected, actual: String(actual).slice(0, 700), evidence: "", impact: "wishlist", repro: "" }); };
  const click = (X, text, scope = "document") => X.evaluate(`(() => { const root = ${scope} || document; const el = [...root.querySelectorAll('button,a,[role="menuitem"]')].find((x) => x.getBoundingClientRect().width > 0 && x.textContent.replace(/\\s+/g, ' ').trim() === ${JSON.stringify(text)}); if (!el) return false; el.click(); return true; })()`);
  const clickStart = (X, text, scope = "document") => X.evaluate(`(() => { const root = ${scope} || document; const el = [...root.querySelectorAll('button,a,[role="menuitem"]')].find((x) => x.getBoundingClientRect().width > 0 && x.textContent.replace(/\\s+/g, ' ').trim().startsWith(${JSON.stringify(text)})); if (!el) return false; el.click(); return true; })()`);
  const text = (X) => X.evaluate("document.body.innerText.replace(/\\s+/g, ' ')");
  const userClient = async (email, password) => { const c = J.createClient(J.env.NEXT_PUBLIC_SUPABASE_URL, J.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } }); const { error } = await c.auth.signInWithPassword({ email, password }); if (error) throw new Error("sign-in: " + error.message); return c; };
  const anon = () => J.createClient(J.env.NEXT_PUBLIC_SUPABASE_URL, J.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const gotoWatch = async (X, tab) => { await X.visit("/watchlist"); await sleep(5000); if (tab) { await clickStart(X, tab, `document.querySelector('[data-testid="watchlist-controls"]')`); await sleep(900); } };

  try {
    // ── seed one shareable want straight into the account (all new columns) ──
    await admin.from("wishlist").delete().eq("profile_id", P).eq("id", "qa_share_want");
    const seed = await admin.from("wishlist").insert({ id: "qa_share_want", profile_id: P, title: "QA Share Want", status: "want", edition: "Ed-X", quantity: 3, quantity_acquired: 1, expected_price: 12.34, shop: "QA Shop", notes: "QA private note", target_price: 99.99, release_date: "2027-03-03", category: "Comics", universe: "POP_CULTURE", priority: "high", source: "manual" });
    out.notes.seedError = seed.error && seed.error.message;
    ck(!seed.error, "the new wishlist columns accept a full want (SQL 9 is in place)", "insert works", seed.error ? seed.error.message : "ok", "database");

    // ── A. rules in the account, clean second browser ──
    const ruleRows = (await admin.from("pull_rules").select("*").eq("profile_id", P)).data || [];
    out.notes.ruleRowsBefore = ruleRows.length;
    S = await session("owner", { width: 1440, height: 900 });
    await gotoWatch(S, "Following");
    await click(S, "Follow", `document.querySelector('[data-testid="watchlist-controls"]')`); await sleep(600);
    await click(S, "Card product or set", DIALOG); await sleep(300);
    await S.evaluate(`(() => { const lab = [...document.querySelectorAll('[role="dialog"] label')].find((l) => /Product or set/i.test(l.innerText)); const el = lab.querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'Account Rule Manual'); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    await click(S, "Start following", DIALOG); await sleep(2500);
    await click(S, "Follow", `document.querySelector('[data-testid="watchlist-controls"]')`); await sleep(600);
    await click(S, "Comic series", DIALOG); await sleep(300);
    await S.evaluate(`(() => { const lab = [...document.querySelectorAll('[role="dialog"] label')].find((l) => /Series name/i.test(l.innerText)); const el = lab.querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'Absolute Batman'); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    await click(S, "Search", DIALOG); await sleep(6000);
    await S.evaluate(`(() => { const b = document.querySelector('[role="dialog"] ul li button'); if (b) b.click(); return !!b; })()`); await sleep(400);
    await click(S, "Start following", DIALOG); await sleep(9000);
    const dbRules = (await admin.from("pull_rules").select("*").eq("profile_id", P)).data || [];
    ck(dbRules.length === 2 && dbRules.some((x) => x.name === "Account Rule Manual" && x.source === "manual" && x.state === "following") && dbRules.some((x) => x.source === "metron" && x.source_key && x.state === "following"), "Following rules are saved to the account (a manual rule and a comic rule matched to a series key)", "2 rows", JSON.stringify(dbRules.map((x) => [x.name, x.source, x.state, x.source_key])));
    // pause the manual one, stop... then verify a second browser
    await S.evaluate(`(() => { const c = [...document.querySelectorAll('[data-testid="rule-card"]')].find((x) => x.innerText.includes('Account Rule Manual')); const b = c && [...c.querySelectorAll('button')].find((x) => x.textContent.trim().endsWith('Pause')); if (b) b.click(); return !!b; })()`); await sleep(2500);
    const paused = ((await admin.from("pull_rules").select("state").eq("profile_id", P).eq("name", "Account Rule Manual")).data || [])[0];
    ck(paused && paused.state === "paused", "pausing a rule reaches the account", "paused", JSON.stringify(paused));
    // following the same series a second time is refused (one rule per series), and nothing new reaches the account
    await click(S, "Follow", `document.querySelector('[data-testid="watchlist-controls"]')`); await sleep(600);
    await S.evaluate(`(() => { const lab = [...document.querySelectorAll('[role="dialog"] label')].find((l) => /Series name/i.test(l.innerText)); const el = lab.querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'Absolute Batman'); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    await click(S, "Search", DIALOG); await sleep(6000);
    await S.evaluate(`(() => { const b = document.querySelector('[role="dialog"] ul li button'); if (b) b.click(); return !!b; })()`); await sleep(400);
    await click(S, "Start following", DIALOG); await sleep(2500);
    const dupText = await S.evaluate(`((document.querySelector('[role="dialog"]') || {}).innerText || '').replace(/\\s+/g, ' ')`);
    const rulesAfterDup = (await admin.from("pull_rules").select("id").eq("profile_id", P)).data || [];
    ck(/already follow this series/i.test(dupText) && rulesAfterDup.length === 2, "following the same comic series again is refused ('You already follow this series') and no second rule is made", "refused, still 2 rules", `${dupText.slice(0, 160)} | rules=${rulesAfterDup.length}`);
    await click(S, "Cancel", DIALOG); await sleep(500);
    const wantsAfterRule = (await admin.from("wishlist").select("id,rule_id,source_identity,edition,quantity").eq("profile_id", P).not("rule_id", "is", null)).data || [];
    ck(wantsAfterRule.length >= 1 && wantsAfterRule.every((w) => /^metron:issue:/.test(w.source_identity || "") && w.edition === "Standard cover"), "the releases the comic rule added reached the account with their source identity and standard-cover edition", "rows with identity", JSON.stringify(wantsAfterRule.slice(0, 3)));
    await S.close(); S = null;
    S2 = await session("owner", { width: 1440, height: 900 }); // a clean second browser
    await gotoWatch(S2, "Following");
    const t2 = await text(S2);
    const states = await S2.evaluate(`[...document.querySelectorAll('[data-testid="rule-card"]')].map((c) => [c.querySelector('div div').innerText.split('\\n')[0], c.getAttribute('data-state')])`);
    ck(/Account Rule Manual/.test(t2) && states.some((x) => /Account Rule Manual/.test(x[0]) && x[1] === "paused") && states.some((x) => /Absolute Batman/.test(x[0]) && x[1] === "following"), "a clean second browser shows both rules with their states (manual rule paused, comic rule following)", "same rules and states", JSON.stringify(states));
    ck(!/saved on this device for now/i.test(t2), "the 'saved on this device' warning is gone now that rules live in the account", "no warning", t2.slice(0, 200));
    await S2.jshot(`rb68-${LABEL}-following-second-browser`);
    await S2.close(); S2 = null;

    // ── B. sharing field switches ──
    S = await session("owner", { width: 1440, height: 900 });
    await gotoWatch(S);
    await clickStart(S, "Checklist"); await sleep(1500);
    await S.evaluate(`(() => { const b = document.querySelector('[role="dialog"] [aria-label="Share a read-only link"]'); if (b) b.click(); return !!b; })()`); await sleep(3000);
    const token = await S.evaluate(`(() => { const c = [...document.querySelectorAll('[role="dialog"] code')].map((x) => x.innerText).find((x) => /\\/wishlist\\//.test(x)); return c ? c.split('/wishlist/')[1] : null; })()`);
    ck(!!token, "sharing turns on and shows a link", "a link", String(token));
    const shareRow = ((await admin.from("wishlist_shares").select("fields").eq("profile_id", P)).data || [])[0];
    ck(shareRow && shareRow.fields && shareRow.fields.titles === true && !shareRow.fields.prices && !shareRow.fields.notes && !shareRow.fields.shops && !shareRow.fields.quantities && !shareRow.fields.dates, "by default only titles are switched on in the account", "titles only", JSON.stringify(shareRow));
    const noWarn = await text(S);
    ck(!/not available yet on your account/i.test(noWarn), "the switches are available (no 'not available yet' notice)", "no notice", "check");
    V = await session("visitor", { width: 1440, height: 900 });
    const visit = async () => { await V.visit(`/wishlist/${token}`); await sleep(4500); return text(V); };
    const sees = (t, s) => t.includes(s);
    let pub = await visit();
    ck(sees(pub, "QA Share Want") && sees(pub, "Ed-X") && !sees(pub, "QA Shop") && !sees(pub, "QA private note") && !/12\.34/.test(pub) && !/99\.99/.test(pub) && !/x2/.test(pub) && !/Mar 3|2027/.test(pub), "default link: a visitor sees the title and edition and nothing else (no shop, note, price, target price, quantity or date)", "title + edition only", pub.slice(0, 300), "/wishlist/<link>");
    const switchOn = async (label) => { await S.visit("/watchlist"); await sleep(3500); await clickStart(S, "Checklist"); await sleep(1500); await S.evaluate(`(() => { const b = document.querySelector('[role="dialog"] [aria-label="Share ${label}"]'); if (b) b.click(); return !!b; })()`); await sleep(2500); };
    const probes = [["Quantities", /x2/, "x2 (copies still to get)"], ["Release dates", /Mar(ch)? 3, 2027|2027/, "the release date"], ["Expected prices", /\$12\.34/, "$12.34"], ["Shops", /QA Shop/, "QA Shop"], ["My notes", /QA private note/, "the note"]];
    const hidden = { Quantities: /x2/, "Release dates": /Mar(ch)? 3, 2027/, "Expected prices": /12\.34/, Shops: /QA Shop/, "My notes": /QA private note/ };
    for (const [label, re, what] of probes) {
      await switchOn(label);
      pub = await visit();
      const others = Object.entries(hidden).filter(([k]) => probes.findIndex((p) => p[0] === k) > probes.findIndex((p) => p[0] === label));
      ck(re.test(pub) && others.every(([, rx]) => !rx.test(pub)) && !/99\.99/.test(pub), `switching on ${label} shows ${what} to a visitor and nothing that is still off; the target price is never shown`, "that field only (plus earlier ones)", pub.slice(0, 260), "/wishlist/<link>");
    }
    const rpc = await anon().rpc("get_shared_wishlist", { p_token: token });
    const row = (rpc.data || []).find((x) => x.title === "QA Share Want");
    ck(row && row.quantity === 2 && Number(row.price) === 12.34 && row.shop === "QA Shop" && row.notes === "QA private note" && !("target_price" in row), "the public read returns the switched-on fields (copies left = 2) and has no target price column at all", "fields present, no target price", JSON.stringify(row));
    // switch everything back off in the page; the account and the visitor agree
    for (const [label] of probes) await switchOn(label);
    const off = ((await admin.from("wishlist_shares").select("fields").eq("profile_id", P)).data || [])[0];
    pub = await visit();
    ck(off && !off.fields.prices && !off.fields.notes && !off.fields.shops && !off.fields.quantities && !off.fields.dates && !sees(pub, "QA Shop") && !sees(pub, "QA private note") && !/12\.34/.test(pub), "switching them back off hides them again (account and visitor agree)", "titles only again", JSON.stringify(off && off.fields));
    // a skipped want and a fully acquired want are never shown
    await admin.from("wishlist").insert({ id: "qa_share_skipped", profile_id: P, title: "QA Skipped Want", status: "skipped", quantity: 1, source: "manual" });
    await admin.from("wishlist").insert({ id: "qa_share_got", profile_id: P, title: "QA Got Want", status: "acquired", quantity: 1, quantity_acquired: 1, source: "manual" });
    pub = await visit();
    ck(!sees(pub, "QA Skipped Want") && !sees(pub, "QA Got Want"), "skipped and fully acquired wants are never shown on the link", "hidden", pub.slice(0, 200));
    // turn sharing off
    await S.visit("/watchlist"); await sleep(3500); await clickStart(S, "Checklist"); await sleep(1500);
    await S.evaluate(`(() => { const b = document.querySelector('[role="dialog"] [aria-label="Share a read-only link"]'); if (b) b.click(); return !!b; })()`); await sleep(2500);
    pub = await visit();
    const dead = await anon().rpc("get_shared_wishlist", { p_token: token });
    ck(/isn't shared|isn&apos;t shared|not shared/i.test(pub) && (dead.data || []).length === 0, "turning sharing off kills the link (page and public read)", "not shared, 0 rows", `${pub.slice(0, 120)} | rows=${(dead.data || []).length}`);
    await V.close(); V = null;
    await S.close(); S = null;

    // ── C. isolation ──
    const owner = await userClient(m.email, m.password);
    const viewer = await userClient(m.k.email, m.k.password);
    const a = anon();
    const mine = await owner.from("wishlist").select("id").eq("profile_id", P);
    ck((mine.data || []).length >= 1, "control: the owner reads their own wants through the real account rules", "rows", String((mine.data || []).length), "database (RLS)");
    const vRead = await viewer.from("wishlist").select("id,title,notes").eq("profile_id", P);
    ck(!vRead.error && (vRead.data || []).length === 0, "a second account reads none of the owner's wants", "0 rows", JSON.stringify(vRead.data || vRead.error), "database (RLS)");
    const vRules = await viewer.from("pull_rules").select("id").eq("profile_id", P);
    ck(!vRules.error && (vRules.data || []).length === 0, "a second account reads none of the owner's Following rules", "0 rows", JSON.stringify(vRules.data || vRules.error), "database (RLS)");
    const vShares = await viewer.from("wishlist_shares").select("token").eq("profile_id", P);
    ck(!vShares.error && (vShares.data || []).length === 0, "a second account cannot read the owner's share link token", "0 rows", JSON.stringify(vShares.data || vShares.error), "database (RLS)");
    const vWatch = await viewer.from("watchlist").select("item_id").eq("owner_profile_id", P);
    ck(!vWatch.error && (vWatch.data || []).length === 0, "a second account reads none of the owner's watched items", "0 rows", JSON.stringify(vWatch.data || vWatch.error), "database (RLS)");
    const vIns = await viewer.from("wishlist").insert({ id: "qa_intruder", profile_id: P, title: "Intruder", source: "manual" });
    ck(!!vIns.error, "a second account cannot add a want into the owner's list", "refused", JSON.stringify(vIns.error && vIns.error.message));
    const vUpd = await viewer.from("wishlist").update({ title: "Hijacked" }).eq("id", "qa_share_want").select("id");
    const vDel = await viewer.from("wishlist").delete().eq("id", "qa_share_want").select("id");
    const still = ((await admin.from("wishlist").select("title").eq("id", "qa_share_want")).data || [])[0];
    ck((vUpd.data || []).length === 0 && (vDel.data || []).length === 0 && still && still.title === "QA Share Want", "a second account cannot change or delete the owner's want", "0 rows changed, want intact", JSON.stringify([vUpd.data, vDel.data, still]));
    const vRuleIns = await viewer.from("pull_rules").insert({ id: "qa_rule_intruder", profile_id: P, kind: "comic_series", name: "Intruder" });
    ck(!!vRuleIns.error, "a second account cannot create a rule in the owner's profile", "refused", JSON.stringify(vRuleIns.error && vRuleIns.error.message));
    const aRules = await a.from("pull_rules").select("id");
    ck(!!aRules.error || (aRules.data || []).length === 0, "a visitor with no account cannot read Following rules", "refused or empty", JSON.stringify(aRules.error ? aRules.error.message : aRules.data));
    const aWish = await a.from("wishlist").select("id").eq("profile_id", P);
    ck((aWish.data || []).length === 0, "a visitor with no account cannot read any wants", "0 rows", JSON.stringify(aWish.data || (aWish.error && aWish.error.message)));
    const aShares = await a.from("wishlist_shares").select("token");
    ck((aShares.data || []).length === 0, "a visitor cannot list share tokens", "0 rows", JSON.stringify(aShares.data || (aShares.error && aShares.error.message)));
    const aGuess = await a.rpc("get_shared_wishlist", { p_token: "not-a-real-token" });
    ck((aGuess.data || []).length === 0, "a guessed link returns nothing", "0 rows", JSON.stringify(aGuess.data || (aGuess.error && aGuess.error.message)));
    // the second account's own page shows none of the owner's wants
    const VS = await session("viewer", { width: 1440, height: 900 });
    await gotoWatch(VS);
    const vt = await text(VS);
    ck(!/QA Share Want|Account Rule Manual|Night Courier|Starlight/.test(vt), "the second account's own Watchlist page shows none of the owner's wants or rules", "none", vt.slice(0, 200));
    await VS.close();

    // ── D. acquisition retries across two browsers ──
    await admin.from("wishlist").insert({ id: "qa_retry_want", profile_id: P, title: "QA Retry Want", status: "want", quantity: 2, quantity_acquired: 0, expected_price: 9, source: "manual" });
    const vaultFor = async () => (await admin.from("vault_items").select("id,purchase_price").eq("profile_id", P).like("id", "vault_acq_qa_retry_want_%")).data || [];
    S = await session("owner", { width: 1440, height: 900 });
    await gotoWatch(S);
    const rowBtn = (X, title, btn) => X.evaluate(`(() => { const r = [...document.querySelectorAll('[data-testid="want-row"]')].find((x) => x.innerText.includes(${JSON.stringify(title)})); if (!r) return 'norow'; const b = [...r.querySelectorAll('button')].find((x) => x.getBoundingClientRect().width > 0 && x.textContent.trim() === ${JSON.stringify(btn)}); if (!b) return 'nobtn'; b.click(); return 'ok'; })()`);
    ck(await rowBtn(S, "QA Retry Want", "Acquired") === "ok", "the want from the account is on the page with an Acquired button", "ok", "check"); await sleep(700);
    // receive ONE of the two (the sheet offers all of them by default), pressing Save twice in the same instant: one record is made
    await S.evaluate(`(() => { const lab = [...document.querySelectorAll('[role="dialog"] label')].find((l) => /Received now/i.test(l.innerText)); const el = lab.querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '1'); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`); await sleep(300);
    await S.evaluate(`(() => { const b = [...document.querySelectorAll('[role="dialog"] button')].find((x) => x.textContent.trim() === 'Save to my Vault'); const f = b.closest('form'); b.click(); b.click(); return !!f; })()`); await sleep(3500);
    ck((await vaultFor()).length === 1, "pressing Save twice at once makes ONE Vault record", "1 record", JSON.stringify((await vaultFor()).map((x) => x.id)));
    await click(S, "Done", DIALOG); await sleep(1500);
    const afterOne = ((await admin.from("wishlist").select("status,quantity_acquired,acquired_item_ids").eq("id", "qa_retry_want")).data || [])[0];
    ck(afterOne && afterOne.quantity_acquired === 1 && afterOne.status === "want" && (afterOne.acquired_item_ids || []).length === 1, "the account shows 1 of 2 received with the record's id kept (status still open)", "1 of 2, one id", JSON.stringify(afterOne));
    // a stale second browser (opened before the sync landed) acquires the SAME copy number: no second record
    await S.close(); S = null;
    S2 = await session("owner", { width: 1440, height: 900 });
    await gotoWatch(S2);
    await S2.evaluate(`(() => { const key = Object.keys(localStorage).find((k) => k.startsWith('vltd_wishlist:')); const items = JSON.parse(localStorage.getItem(key) || '[]'); const next = items.map((w) => w.id === 'qa_retry_want' ? { ...w, quantityAcquired: 0, acquiredItemIds: [], status: 'want' } : w); localStorage.setItem(key, JSON.stringify(next)); window.dispatchEvent(new Event('vltd:wishlist-updated')); return true; })()`); await sleep(800);
    await rowBtn(S2, "QA Retry Want", "Acquired"); await sleep(700);
    await S2.evaluate(`(() => { const lab = [...document.querySelectorAll('[role="dialog"] label')].find((l) => /Received now/i.test(l.innerText)); const el = lab.querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '1'); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    await click(S2, "Save to my Vault", DIALOG); await sleep(3500);
    ck((await vaultFor()).length === 1, "a retry of the same copy from a browser with an out-of-date list creates no second Vault record", "still 1 record", JSON.stringify((await vaultFor()).map((x) => x.id)));
    await click(S2, "Done", DIALOG); await sleep(500);
    await S2.close(); S2 = null;
    // a fresh browser sees 1 of 2 and the second copy numbers on
    S2 = await session("owner", { width: 1440, height: 900 });
    await gotoWatch(S2);
    const rowT = await S2.evaluate(`(() => { const r = [...document.querySelectorAll('[data-testid="want-row"]')].find((x) => x.innerText.includes('QA Retry Want')); return r ? r.innerText.replace(/\\s+/g, ' ') : null; })()`);
    ck(rowT && /1 of 2/.test(rowT), "a clean browser shows the want as 1 of 2", "1 of 2", String(rowT));
    await rowBtn(S2, "QA Retry Want", "Acquired"); await sleep(700);
    await S2.evaluate(`(() => { const lab = [...document.querySelectorAll('[role="dialog"] label')].find((l) => /What I paid/i.test(l.innerText)); const el = lab.querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '8.5'); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    await click(S2, "Save to my Vault", DIALOG); await sleep(3500);
    const two = await vaultFor();
    const final = ((await admin.from("wishlist").select("status,quantity_acquired").eq("id", "qa_retry_want")).data || [])[0];
    ck(two.length === 2 && new Set(two.map((x) => x.id)).size === 2 && final && final.status === "acquired" && final.quantity_acquired === 2, "the second copy numbers on (2 records, unique ids) and the want becomes Acquired in the account", "2 unique records, acquired", JSON.stringify([two.map((x) => [x.id, x.purchase_price]), final]));
    await S2.close(); S2 = null;
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String((e && e.stack) || e).slice(0, 900); }
  finally {
    for (const X of [S, S2, V]) { try { if (X) await X.close(); } catch {} }
    try { await admin.from("wishlist").delete().eq("profile_id", P).in("id", ["qa_share_want", "qa_share_skipped", "qa_share_got", "qa_retry_want", "qa_intruder"]); } catch {}
    fs.writeFileSync(path.join(EV, `rb68-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(out.cases.map((c) => (c.ok ? "PASS " : "FAIL ") + c.control).join("\n"), out.error ? "\nRUNNER ERROR " + out.error : "");
    process.exit(0);
  }
})();
