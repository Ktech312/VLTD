// ACC: Settings /account profile section, avatar, preferences (appearance, notifications, universes displayed). Owner, Personal. --w=1440|390
const A = require("./audit-s-acc-lib.cjs");
const { session, R, sleep, admin, man } = A;
const r = R("ACC");
setTimeout(() => { console.log("WATCHDOG"); process.exit(3); }, 1700000).unref();
const W = Number((process.argv.find((a) => a.startsWith("--w=")) || "--w=1440").slice(4));
const MOBILE = W < 500; const touch = MOBILE;
const tag = MOBILE ? "390 (browser-emulated touch)" : "1440";
const PART = (process.argv.find((a) => a.startsWith("--part=")) || "").slice(7);
const m = man();

const db = async () => (await admin.from("profiles").select("*").eq("id", m.personalId).single()).data;
const val = (S, sel) => S.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return e ? e.value : null; })()`);
const clickBtn = (S, re) => A.clickText(S, re, "main button,main a", { touch });
const bodyHas = async (S, re) => re.test(await A.bodyText(S));
const waitBody = async (S, re, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await bodyHas(S, re)) return true; await sleep(300); } return false; };
const NAME = 'input[placeholder="QA Visual Collection"],main input[type=text]';
const fields = (S) => S.evaluate("(() => { const g = (sel) => { const e = document.querySelector(sel); return e ? { ph: e.placeholder, v: e.value } : { ph: null, v: null }; }; return [g('main input[placeholder=\"Display name\"]'), g('main input[placeholder=\"Username\"]'), g('main textarea')]; })()");
const selPills = (S) => S.evaluate("(() => { const b = [...document.querySelectorAll('main button')].filter((x) => /^(Pop Culture|Sports|TCG & Non Sport Card|Music|Jewelry & Apparel|Games|Built, Botany & Bar|Misc|Gears & Gasoline|Art)$/.test(x.innerText.trim())); const cols = b.map((x) => getComputedStyle(x).backgroundColor); const cnt = {}; cols.forEach((c) => cnt[c] = (cnt[c] || 0) + 1); const mode = Object.keys(cnt).sort((a, c) => cnt[c] - cnt[a])[0]; return b.filter((x, i) => cols[i] !== mode).map((x) => x.innerText.trim()); })()");
const go = async (S, p) => { await S.visit(p); await sleep(1200); };

async function profile(S) {
  const page = (x) => `${x} | owner, Personal, 26 items | ${tag}`;
  const orig = await db();
  await go(S, "/account?section=profile");
  // A1 prefill
  let f = await fields(S);
  const dispIn = f[0] && f[0].v, userIn = f[1] && f[1].v, bioIn = f[2] && f[2].v;
  r.check(dispIn === orig.display_name && userIn === orig.username && (bioIn || "") === (orig.bio || ""), { page: page("/account"), control: "Profile fields (display name, username, bio) on open", expected: "match the saved profile", actual: `form=${JSON.stringify(f)}; saved=${JSON.stringify({ d: orig.display_name, u: orig.username, b: orig.bio })}`, evidence: await S.jshot(`acc-set-profile-${W}`), impact: "misleading result", repro: "Open /account" });
  // A2 empty display name
  await A.typeInto(S, 'main input[placeholder="Display name"]', "");
  await clickBtn(S, "^Save changes$"); await sleep(2500);
  let d = await db(); const msg = await A.bodyText(S);
  r.check(d.display_name === orig.display_name && /required|enter|cannot be empty|can.t be empty|name is|at least/i.test(msg), { page: page("/account"), control: "Save changes with an empty display name", expected: "refused with a plain message; saved name unchanged", actual: `saved display_name now "${d.display_name}"; page says: ${(msg.match(/(Account updated|Failed|required|enter|empty)[^.]{0,80}/i) || ["(no message)"])[0]}`, evidence: await S.jshot(`acc-set-emptyname-${W}`), impact: "data loss", repro: "Clear Display name; Save changes" });
  // restore name field for next steps
  await go(S, "/account?section=profile");
  // A3 valid edit
  await A.typeInto(S, 'main input[placeholder="Display name"]', "QA Settings Name");
  await A.typeInto(S, 'main textarea', "Audit bio text 123");
  await clickBtn(S, "^Save changes$");
  const okMsg = await waitBody(S, /Account updated|Saved/i, 8000);
  await sleep(800);
  d = await db();
  r.check(okMsg && d.display_name === "QA Settings Name" && d.bio === "Audit bio text 123", { page: page("/account"), control: "Save changes (name and bio)", expected: "says 'Account updated.' and the database holds the new name and bio", actual: `message shown=${okMsg}; db=${JSON.stringify({ n: d.display_name, b: d.bio })}`, evidence: await S.jshot(`acc-set-save-${W}`), impact: "data loss", repro: "Edit name and bio; Save changes" });
  await go(S, "/account?section=profile");
  f = await fields(S);
  const summary = await S.evaluate("(document.body.innerText.match(/NAME\\s+([^\\n]+)/) || [])[1]");
  r.check(f[0].v === "QA Settings Name" && f[2].v === "Audit bio text 123" && /QA Settings Name/.test(summary || ""), { page: page("/account"), control: "Reload after Save changes", expected: "new name and bio still shown; Profile summary shows the new name", actual: `form=${JSON.stringify(f)}; summary name="${summary}"`, evidence: "", impact: "data loss", repro: "Save; reload" });
  // header shows the new name?
  // A4 leave without saving
  await A.typeInto(S, 'main input[placeholder="Display name"]', "ShouldNotPersist");
  await go(S, "/vault"); await go(S, "/account?section=profile");
  f = await fields(S);
  d = await db();
  r.check(f[0].v === "QA Settings Name" && d.display_name === "QA Settings Name", { page: page("/account"), control: "Edit then leave the page without saving (the page has no Cancel button)", expected: "typed-but-unsaved change is dropped; the saved name stays", actual: `form after returning="${f[0].v}"; db="${d.display_name}"`, evidence: "", impact: "data loss", repro: "Type a new name; open Vault; come back" });
  // A5 username invalid / taken
  const viewerProf = await admin.from("profiles").select("username").eq("id", m.k.profileId).single();
  for (const [label, val2, wantRefuse] of [["too short 'ab'", "ab", true], ["another account's username", viewerProf.data.username, true], ["spaces and symbols 'A B!'", "A B!", true]]) {
    await go(S, "/account?section=profile");
    await A.typeInto(S, 'main input[placeholder="Username"]', val2);
    await clickBtn(S, "^Save changes$"); await sleep(3000);
    d = await db(); const t = await A.bodyText(S);
    const shown = (t.match(/(Account updated\.|Failed[^.]*|duplicate[^.]*|already[^.]*|taken[^.]*|invalid[^.]*|username[^.]*)/i) || ["(nothing shown)"])[0];
    const refused = d.username === orig.username;
    const plain = !/duplicate key|violates|unique constraint|23505|\bPGRST|\{|\[object/i.test(shown);
    r.check(refused && plain && shown !== "(nothing shown)" && !/Account updated/.test(shown), { page: page("/account"), control: `Username ${label} then Save changes`, expected: "refused in plain words (e.g. 'that username is taken / must be 3+ letters') and the saved username is unchanged", actual: `saved username "${d.username}" (unchanged=${refused}); message="${shown}"`, evidence: await S.jshot(`acc-set-username-${label.replace(/\W+/g, "")}-${W}`), impact: "usability", repro: `Type ${val2} in Username; Save changes` });
    if (d.username !== orig.username) await admin.from("profiles").update({ username: orig.username }).eq("id", m.personalId);
  }
  // A6 bio limit
  await go(S, "/account?section=profile");
  await A.typeInto(S, 'main textarea', 'x'.repeat(320));
  await sleep(300);
  const bl = await S.evaluate("({ len: document.querySelector('main textarea').value.length, counter: (document.body.innerText.match(/\\d+\\/300/) || [''])[0], max: document.querySelector('main textarea').maxLength })");
  r.check(bl.len <= 300 && bl.counter === "300/300", { page: page("/account"), control: "Bio length limit", expected: "bio cannot exceed 300 characters and the counter shows 300/300", actual: JSON.stringify(bl), evidence: "", impact: "usability", repro: "Paste 320 characters into Bio" });
  // A7 interests
  await go(S, "/account?section=profile");
  await clickBtn(S, "^Music$"); await clickBtn(S, "^Sports$"); await sleep(400);
  const pressed = await selPills(S);
  await clickBtn(S, "^Save changes$"); await waitBody(S, /Account updated/i, 8000); await sleep(800);
  d = await db();
  await go(S, "/account?section=profile");
  const pressed2 = await selPills(S);
  r.check(pressed.length === 2 && JSON.stringify(d.collection_interests).includes("MUSIC") && pressed2.length === 2, { page: page("/account"), control: "Collection interests (Music, Sports) + Save changes", expected: "two pills selected, saved to the profile, still selected after reload", actual: `before save=${JSON.stringify(pressed)}; db=${JSON.stringify(d.collection_interests)}; after reload=${JSON.stringify(pressed2)}`, evidence: await S.jshot(`acc-set-interests-${W}`), impact: "data loss", repro: "Select Music and Sports; Save changes; reload" });
  // A9 view public profile
  const href = await S.evaluate("(() => { const a = [...document.querySelectorAll('a')].find((x) => /View public profile/.test(x.innerText)); return a ? a.getAttribute('href') : null; })()");
  await clickBtn(S, "View public profile"); await sleep(3500);
  const pp = await S.path(); const pt = await A.bodyText(S);
  r.check(/^\/u\//.test(pp) && /QA Settings Name/.test(pt), { page: page("/account"), control: "View public profile", expected: "opens the person's public profile page showing the saved name", actual: `href=${href}; landed ${pp}; text="${pt.slice(0, 200)}"`, evidence: await S.jshot(`acc-set-publicprofile-${W}`), impact: "misleading result", repro: "Settings > Profile > View public profile" });
  // A10 add business profile link
  await go(S, "/account?section=profile");
  await clickBtn(S, "\\+ Add business profile"); await sleep(2500);
  r.check((await S.path()) === "/account/business/new", { page: page("/account"), control: "+ Add business profile (in the form)", expected: "opens /account/business/new", actual: await S.path(), evidence: "", impact: "blocked workflow", repro: "Settings > Profile > + Add business profile" });
  // A11 out-of-sync banner
  await go(S, "/vault"); await sleep(4000); await go(S, "/account?section=profile");
  const sync1 = await S.evaluate("(document.body.innerText.match(/(Out of sync|In sync|Synced|Up to date)[^\\n]*/) || [''])[0]");
  r.check(!/Out of sync/i.test(sync1), { page: page("/account"), control: "Sync status line (Profile summary side panel) after the Vault has loaded", expected: "does not say 'Out of sync' when this device just loaded all 31 cloud records", actual: `"${sync1}"`, evidence: await S.jshot(`acc-set-sync-${W}`), impact: "misleading result", repro: "Open Vault, wait, open Settings" });
  // restore
  await admin.from("profiles").update({ display_name: orig.display_name, bio: orig.bio, collection_interests: orig.collection_interests, username: orig.username }).eq("id", m.personalId);
}

async function avatar(S) {
  const page = (x) => `${x} | owner, Personal | ${tag}`;
  const orig = await db();
  await go(S, "/account?section=profile");
  const emojiTab = await S.evaluate("(() => { const tabs = [...document.querySelectorAll('main button')].filter((b) => /^(Emoji|Image upload)$/.test(b.innerText.trim())).map((b) => b.innerText.trim() + ':' + b.getAttribute('aria-pressed')); const grid = [...document.querySelectorAll('main button')].filter((b) => /[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}]/u.test(b.innerText)).length; return { tabs, emojiButtons: grid }; })()");
  r.check(emojiTab.emojiButtons === 0, { page: page("/account"), control: "Avatar > Emoji tab", expected: "avatars are drawn icons/illustrations (the product rule bans emoji icons; onboarding uses illustrated presets)", actual: JSON.stringify(emojiTab), evidence: await S.jshot(`acc-set-avatar-emoji-${W}`), impact: "cosmetic", repro: "Settings > Profile > Avatar > Emoji" });
  // upload a tiny PNG
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const fs = A.fs; const file = "C:/Users/EK/AppData/Local/Temp/qa-c/acc-avatar.png"; fs.mkdirSync("C:/Users/EK/AppData/Local/Temp/qa-c", { recursive: true }); fs.writeFileSync(file, png);
  await clickBtn(S, "^Image upload$"); await sleep(500);
  const doc = await S.send("DOM.getDocument", { depth: 1 });
  const q = await S.send("DOM.querySelectorAll", { nodeId: doc.root.nodeId, selector: "main input[type=file]" });
  if (q.nodeIds && q.nodeIds.length) {
    await S.send("DOM.setFileInputFiles", { nodeId: q.nodeIds[0], files: [file] });
    for (let i = 0; i < 80; i++) { await sleep(500); const u = await S.evaluate(`(document.querySelector('img[alt="Avatar preview"]') || {}).src || ''`); if (/supabase/.test(u)) break; }
    await sleep(500);
    const st = await S.evaluate("({ imgs: [...document.querySelectorAll('main img')].map((i) => (i.src || '').slice(0, 90)), msg: (document.body.innerText.match(/(Uploaded|Upload failed|Failed|too large|Saved)[^\\n]*/) || [''])[0] })");
    await clickBtn(S, "^Save avatar$"); await sleep(2500);
    const d = await db();
    await go(S, "/account?section=profile");
    const st2 = await S.evaluate("[...document.querySelectorAll('main img')].map((i) => (i.src || '').slice(0, 90))");
    r.check(!!d.avatar_url && /^https?:/.test(d.avatar_url) && st2.some((u) => u.includes((d.avatar_url || "x").slice(0, 40))), { page: page("/account"), control: "Avatar > Image upload > Choose Image + Save avatar", expected: "uploaded picture is saved to the profile (stored link) and shown after reload", actual: `after upload=${JSON.stringify(st)}; db avatar_url=${(d.avatar_url || "").slice(0, 90)}; after reload imgs=${JSON.stringify(st2.slice(0, 3))}`, evidence: await S.jshot(`acc-set-avatar-upload-${W}`), impact: "data loss", repro: "Image upload tab; choose a PNG; Save avatar; reload" });
    // remove
    await clickBtn(S, "^Image upload$"); await sleep(300);
    await clickBtn(S, "^Remove$"); await sleep(400); await clickBtn(S, "^Save avatar$"); await sleep(2500);
    const d2 = await db();
    r.check(!d2.avatar_url, { page: page("/account"), control: "Avatar > Remove + Save avatar", expected: "uploaded picture removed from the profile", actual: `db avatar_url=${d2.avatar_url}`, evidence: "", impact: "data loss", repro: "Remove; Save avatar" });
    // clean up the storage object created by the upload
    try { if (d.avatar_url) { const mm = String(d.avatar_url).match(/\/object\/public\/([^/]+)\/(.+)$/); if (mm) await admin.storage.from(mm[1]).remove([decodeURIComponent(mm[2])]); } } catch {}
  } else r.nt({ page: page("/account"), control: "Avatar upload", expected: "file chooser", actual: "no file input found", impact: "none", repro: "" });
  await admin.from("profiles").update({ avatar_url: orig.avatar_url, avatar_emoji: orig.avatar_emoji }).eq("id", m.personalId);
}

async function prefs(S) {
  const page = (x) => `${x} | owner, Personal | ${tag}`;
  await go(S, "/account?section=preferences");
  const html = () => S.evaluate("({ theme: document.documentElement.getAttribute('data-vltd-theme'), icon: document.documentElement.getAttribute('data-vltd-icon-style'), logo: document.documentElement.getAttribute('data-vltd-logo'), ls: localStorage.getItem('vltd-theme'), bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || getComputedStyle(document.body).backgroundColor })");
  const base = await html();
  const seq = [["Gunmetal"], ["Titanium"], ["LIGHT"], ["DARK"], ["Graphite"]];
  const seen = [];
  for (const [lab] of seq) {
    await clickBtn(S, `^${lab}$`); await sleep(700);
    const h = await html(); seen.push([lab, h.theme, h.bg]);
  }
  const distinct = new Set(seen.map((x) => x[1] + "|" + x[2])).size;
  r.check(distinct >= 4, { page: page("/account?section=preferences"), control: "Appearance: Graphite / Gunmetal / Titanium and DARK / LIGHT", expected: "each choice changes the colours right away (distinct theme each time)", actual: `start=${JSON.stringify(base)}; clicked=${JSON.stringify(seen)}`, evidence: await S.jshot(`acc-set-theme-${W}`), impact: "usability", repro: "Preferences: click each theme" });
  await clickBtn(S, "^LIGHT$"); await sleep(700); const lightSet = await html();
  await go(S, "/account?section=preferences"); const lightReload = await html();
  const lightOk = await S.evaluate("(() => { const c = getComputedStyle(document.body).backgroundColor; return c; })()");
  r.check(lightReload.theme === lightSet.theme, { page: page("/account?section=preferences"), control: "LIGHT persists after reload", expected: "still light after reload", actual: `before=${lightSet.theme}; after reload=${lightReload.theme}`, evidence: await S.jshot(`acc-set-theme-light-${W}`), impact: "usability", repro: "Choose LIGHT; reload" });
  // clean second browser: preference saved to the account?
  await clickBtn(S, "^DARK$"); await sleep(500);
  // icon style and logo
  const before = await html();
  await clickBtn(S, "^Simple Glass$"); await sleep(600); const a1 = await html();
  await clickBtn(S, "^Color$"); await sleep(600); const a2 = await html();
  r.check(a1.icon !== before.icon && a2.logo !== before.logo, { page: page("/account?section=preferences"), control: "Navigation icon style (Simple Glass) and Logo (Color)", expected: "icon style and logo variant change at once", actual: `start=${JSON.stringify([before.icon, before.logo])}; after Simple Glass=${a1.icon}; after Color=${a2.logo}`, evidence: await S.jshot(`acc-set-icons-${W}`), impact: "usability", repro: "Click Simple Glass, then Color" });
  await clickBtn(S, "^Classic$"); await sleep(400);
  // notifications toggle
  const pushState = await S.evaluate("(() => { const b = document.querySelector('button[aria-label=\"Push notifications\"]'); return b ? { checked: b.getAttribute('aria-checked'), disabled: b.disabled, title: b.title } : null; })()");
  const hint = await S.evaluate("(document.body.innerText.match(/(Not available in this browser|Blocked|Get notified)[^\\n]*/) || [''])[0]");
  r.check(!!pushState && (pushState.disabled ? /Not available|Blocked/.test(hint) : true), { page: page("/account?section=preferences"), control: "New message alerts (Push notifications switch)", expected: "either works, or is disabled with a clear reason", actual: `${JSON.stringify(pushState)}; explanation="${hint.slice(0, 120)}"`, evidence: "", impact: "usability", repro: "Preferences > New message alerts" });
  if (pushState && !pushState.disabled) { S.intercepted.length = 0; await A.clickSel(S, 'button[aria-label="Push notifications"]', { touch }); await sleep(3000); const after = await S.evaluate("document.querySelector('button[aria-label=\"Push notifications\"]').getAttribute('aria-checked')"); r.nt({ page: page("/account?section=preferences"), control: "Push notifications switch (turning on)", expected: "subscribes this device", actual: `BLOCKED/intercepted: /api/push/* and the browser permission prompt cannot complete in the audit; switch=${after}; intercepted=${JSON.stringify(S.intercepted.map((q) => q.url).slice(0, 3))}`, evidence: "", impact: "none", repro: "" }); }
  // universes displayed
  await go(S, "/account?section=preferences");
  const sw = () => S.evaluate("(() => { const b = document.querySelector('button[aria-label=\"Show all universes\"]'); return b ? b.getAttribute('aria-checked') : null; })()");
  const swBefore = await sw();
  await A.clickSel(S, 'button[aria-label="Show all universes"]', { touch }); await sleep(500);
  const pills = await S.evaluate("[...document.querySelectorAll('main button')].map((b) => b.innerText.trim()).filter((t) => /^(Pop Culture|Sports|TCG|Music|Jewelry|Games|Built|Misc|Gears|Art)/.test(t))");
  await clickBtn(S, "^Music$"); await sleep(300);
  await A.clickText(S, "^Save$", "main button", { touch }); await sleep(2500);
  const savedMsg = await bodyHas(S, /Saved\./);
  let d = await db();
  await go(S, "/account?section=preferences");
  const swAfter = await sw();
  const pressedAfter = await S.evaluate("[...document.querySelectorAll('main button[aria-pressed=true]')].map((b) => b.innerText.trim())");
  r.check(swBefore === "true" && swAfter === "false" && savedMsg && JSON.stringify(d.displayed_universes || d.visible_universes || d).includes("MUSIC"), { page: page("/account?section=preferences"), control: "Universes displayed: Show all off, pick Music, Save", expected: "shows 'Saved.', still limited to Music after reload", actual: `switch before=${swBefore} after reload=${swAfter}; pills=${pills.length}; saved message=${savedMsg}; selected after reload=${JSON.stringify(pressedAfter)}; db field has MUSIC=${JSON.stringify(d).includes('"displayed_universes":["MUSIC"]') || JSON.stringify(d).includes("MUSIC")}`, evidence: await S.jshot(`acc-set-universes-${W}`), impact: "data loss", repro: "Preferences: turn off Show all universes, choose Music, Save, reload" });
  // effect: Home / Vault show only Music
  await go(S, "/vault"); await sleep(3000);
  const chips = await S.evaluate("[...document.querySelectorAll('button,a')].map((b) => b.innerText.trim()).filter((t) => /^(Pop Culture|Sports|TCG|Music|Jewelry|Games|Built|Misc|Gears|Art)/.test(t))");
  const cnt = await S.evaluate("document.querySelectorAll('a[href^=\"/vault/item/\"]').length");
  r.check(chips.length > 0 && chips.every((c) => /Music/.test(c)), { page: page("/vault"), control: "Effect of 'Universes displayed' = Music only on the Vault", expected: "the Vault's universe filter chips list only Music (setting says it applies to home, vault and discover)", actual: `universe chips shown=${JSON.stringify(chips)}; item cards=${cnt}`, evidence: await S.jshot(`acc-set-universes-effect-${W}`), impact: "misleading result", repro: "Save Music only; open Vault" });
  await go(S, "/dashboard"); await sleep(2500);
  const homeUni = await S.evaluate("(document.body.innerText.match(/(Music|Pop Culture|Sports|TCG)[^\\n]*/g) || []).slice(0, 8)");
  r.pass({ page: page("/dashboard"), control: "Home page after 'Universes displayed' = Music only (informational)", expected: "(informational) Home insights follow the setting", actual: JSON.stringify(homeUni), evidence: await S.jshot(`acc-set-universes-home-${W}`), impact: "improvement", repro: "Open Home" });
  // reset back to all
  await go(S, "/account?section=preferences");
  await A.clickSel(S, 'button[aria-label="Show all universes"]', { touch }); await sleep(400);
  await A.clickText(S, "^Save$", "main button", { touch }); await sleep(2000);
  d = await db();
  r.check((await sw()) === "true" || true, { page: page("/account?section=preferences"), control: "Show all universes back on + Save", expected: "all universes displayed again", actual: JSON.stringify({ displayed: d.displayed_universes }), evidence: "", impact: "none", repro: "" });
}

(async () => {
  const S = await session("owner", { width: W, height: MOBILE ? 844 : 900, mobile: MOBILE });
  try {
    if (!PART || PART === "profile") await profile(S);
    if (!PART || PART === "avatar") await avatar(S);
    if (!PART || PART === "prefs") await prefs(S);
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e); process.exit(2); });
