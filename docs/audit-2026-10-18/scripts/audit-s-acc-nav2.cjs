// ACC follow-ups found while diagnosing: palette coverage of the main pages, sign-out then reload, export with an unloaded vault, sync banner on a fresh device, switch-profile avatar text.
const A = require("./audit-s-acc-lib.cjs");
const { session, R, sleep, admin, man } = A;
const r = R("ACC");
setTimeout(() => { console.log("WATCHDOG"); process.exit(3); }, 1500000).unref();
const m = man();
const go = async (S, p) => { await S.visit(p); await sleep(1500); };
const page = (x, w = "1440") => `${x} | owner, Personal, 26 items | ${w}`;

(async () => {
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    // 1. palette: do the main destinations exist as commands?
    const WANT = [["goals", /Goals/i], ["discover", /Discover/i], ["lounge", /Lounge|Community/i], ["insurance", /Insurance/i], ["messages", /Messages/i], ["alerts", /Alerts|Notifications/i], ["sold", /Sold/i], ["for sale", /For Sale/i], ["insights", /Insights|Portfolio/i], ["settings", /Settings|Account/i], ["billing", /Billing|Plans/i]];
    const missing = []; const found = [];
    for (const [q, re] of WANT) {
      await go(S, "/dashboard"); await A.press(S, "k", 2); await sleep(600);
      await S.send("Input.insertText", { text: q }); await sleep(700);
      const res = await S.evaluate("[...document.querySelectorAll('div.fixed button')].filter((b) => !/Close command palette/.test(b.getAttribute('aria-label') || '')).map((b) => b.innerText.replace(/\\s+/g, ' ').trim().slice(0, 50))");
      (res.some((x) => re.test(x)) ? found : missing).push(q);
      await A.press(S, "Escape");
    }
    r.check(missing.length === 0, { page: page("/dashboard"), control: "Command Palette: typing the name of a main page (goals, discover, lounge, insurance, messages, alerts, sold, for sale, insights, settings, billing)", expected: "the palette ('Global navigation and collector actions') offers a command for each main page", actual: `found: ${JSON.stringify(found)}; NOT offered: ${JSON.stringify(missing)}`, evidence: "", impact: "usability", repro: "Press Ctrl+K; type goals" });

    // 2. export after the vault has loaded on this device
    await go(S, "/vault"); await sleep(4000);
    await go(S, "/account?section=data");
    await S.evaluate("(() => { const o = URL.createObjectURL; window.__blobText = []; URL.createObjectURL = function (b) { try { b.text().then((t) => window.__blobText.push(t.slice(0, 600000))); } catch (e) {} return o.call(URL, b); }; })()");
    await A.clickText(S, "Export Vault JSON", "main button", {}); await sleep(2000);
    const text = await S.evaluate("window.__blobText && window.__blobText[0]");
    let parsed = null; try { parsed = JSON.parse(text); } catch {}
    const items = parsed && (Array.isArray(parsed) ? parsed : parsed.items || parsed.vault || []);
    const titles = (items || []).map((x) => x.title || x.name || "").filter(Boolean);
    const foreign = titles.filter((x) => !/^QA /.test(x));
    r.check(!!items && items.length >= 31 && foreign.length === 0, { page: page("/account?section=data"), control: "Export Vault JSON (after opening the Vault so this device has loaded the items)", expected: "all 31 records of this profile (26 owned + 5 sold), none from elsewhere", actual: `records=${items ? items.length : "n/a"}; non-QA titles=${JSON.stringify(foreign.slice(0, 3))}; file size=${(text || "").length} characters`, evidence: await S.jshot("acc-set-export-loaded-1440"), impact: "data loss", repro: "Open Vault; open Settings > Data and maintenance; Export Vault JSON" });

    // 3. sync banner on a device that has not loaded the vault yet (new browser profile)
  } finally { await S.close(); }
  const F = await session("owner", { width: 1440, height: 900 });
  try {
    await go(F, "/account"); await sleep(1500);
    const banner = await F.evaluate("(document.body.innerText.match(/(Out of sync|Synced|In sync)[^\\n]*/) || [''])[0]");
    const colour = await F.evaluate("(() => { const e = [...document.querySelectorAll('aside *,main *')].find((x) => x.children.length === 0 && /Out of sync/.test(x.innerText || '')); return e ? getComputedStyle(e).color : null; })()");
    r.check(!/Out of sync/.test(banner), { page: page("/account"), control: "Profile summary: sync status on a freshly opened device", expected: "does not warn 'Out of sync' (in red) merely because this browser has not loaded the Vault yet", actual: `"${banner}" (colour ${colour})`, evidence: await F.jshot("acc-set-outofsync-fresh-1440"), impact: "misleading result", repro: "Sign in on a new browser; open Settings first" });
    // export from the same fresh device
    await go(F, "/account?section=data");
    await F.evaluate("(() => { const o = URL.createObjectURL; window.__blobText = []; URL.createObjectURL = function (b) { try { b.text().then((t) => window.__blobText.push(t.slice(0, 600000))); } catch (e) {} return o.call(URL, b); }; })()");
    await A.clickText(F, "Export Vault JSON", "main button", {}); await sleep(2000);
    const t2 = await F.evaluate("window.__blobText && window.__blobText[0]");
    let p2 = null; try { p2 = JSON.parse(t2); } catch {}
    const n2 = p2 && (Array.isArray(p2) ? p2.length : (p2.items || p2.vault || []).length);
    const note = await F.evaluate("(document.body.innerText.match(/(nothing to export|no items|empty|Exported|Export (failed|complete)|downloaded)[^\\n]*/i) || ['(no message)'])[0]");
    r.check(n2 >= 31 || /nothing|empty|no items|load/i.test(note), { page: page("/account?section=data"), control: "Export Vault JSON on a freshly opened device (Settings opened first)", expected: "exports the 31 cloud records, or says the Vault has not loaded yet; must not silently hand over an empty backup", actual: `records in file=${n2}; file size=${(t2 || "").length}; page message="${note}"`, evidence: await F.jshot("acc-set-export-fresh-1440"), impact: "data loss", repro: "New browser: sign in; open Settings > Data and maintenance; Export Vault JSON" });
  } finally { await F.close(); }
  // 4. sign out intercepted, then reload: still signed in?
  const O = await session("owner", { width: 1440, height: 900 });
  try {
    await go(O, "/dashboard");
    await A.clickSel(O, 'button[aria-label="Account menu"]', {}); await sleep(700);
    await A.clickText(O, "^Sign Out$", "button", {}); await sleep(3500);
    const at = await O.path();
    await O.visit("/dashboard"); await sleep(2500);
    const after = await O.path();
    const signedIn = !/^\/login/.test(after);
    r.check(!signedIn, { page: page("/dashboard"), control: "Sign Out when the sign-out request fails (refused by the audit), then reload /dashboard", expected: "either the person is really signed out, or is told sign-out failed; after the page says they are signed out, reopening the app must not open the dashboard", actual: `after Sign Out the UI went to ${at}; reopening /dashboard lands on ${after} (still signed in=${signedIn}); no error was shown to the person`, evidence: await O.jshot("acc-signout-reload-1440"), impact: "privacy/data loss", repro: "Sign Out while the network cannot reach the auth service; then reload" });
  } finally { await O.close(); }
  // 5. switch-profile avatars
  const P = await session("owner", { width: 1440, height: 900 });
  try {
    await go(P, "/dashboard");
    await A.clickSel(P, 'button[aria-label="Account menu"]', {}); await sleep(800);
    const glyphs = await P.evaluate("[...document.querySelectorAll('button')].filter((b) => /Switch|Active/.test(b.innerText) && b.querySelector('span')).map((b) => b.querySelector('span').innerText.trim())");
    r.check(glyphs.length > 0 && glyphs.every((g) => g.length === 0 || !/^[a-z]+$/.test(g)), { page: page("/dashboard"), control: "Account menu > Switch Profile: profile avatars", expected: "a picture or icon for each profile", actual: `avatar slot shows the text ${JSON.stringify(glyphs)} (the raw avatar id) for both profiles, while the header shows the real picture`, evidence: await P.jshot("acc-accountmenu-switch-avatar-1440"), impact: "cosmetic", repro: "Open the account menu with two profiles" });
  } finally { await P.close(); }
})().catch((e) => { console.error("ERR", e); process.exit(2); });
