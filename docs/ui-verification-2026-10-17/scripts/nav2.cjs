// LIVE: Home drill-downs, direct links, refresh, Back, missing/invalid ids; ONE idle cold load of the Vault with diagnostics. Synthetic account only.
//   node nav2.cjs [--base=https://vltd.app] [--idle=80]
const crypto = require("crypto");
const { browser, admin, sleep, man } = require("./journey-lib.cjs");
const arg = (n, d) => (process.argv.find((a) => a.startsWith("--" + n + "=")) || "--" + n + "=" + d).split("=")[1];
const BASE = arg("base", "https://vltd.app"); const IDLE = Number(arg("idle", 80));
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 500)); };
const info = (n, d) => console.log("INFO", n, JSON.stringify(d ?? "").slice(0, 700));
const classify = `(() => { const t = document.body ? document.body.innerText.trim() : ''; const links = document.querySelectorAll('a[href^="/vault/item/"]').length; if (/^\\/login/.test(location.pathname)) return 'signed-out (login page)'; if (links > 0) return 'loaded (' + links + ' item links)'; if (/No items|nothing here|Your vault is empty|Add your first/i.test(t)) return 'genuinely empty'; if (/could not load|couldn.t load|try again|failed/i.test(t)) return 'failed load (message shown)'; if (document.querySelector('[aria-busy="true"], .animate-pulse, [class*=skeleton]')) return 'loading skeleton'; if (t.length < 60) return 'BLANK (almost no text)'; return 'other (' + t.length + ' chars, no items yet)'; })()`;
const USEFUL = /not found|isn.t available|isn.t here|couldn.t find|could not find|doesn.t exist|does not exist|no longer|not available|unavailable|removed|try again|expired|invalid/i;

(async () => {
  const m = man(); const P = m.personalId;
  const control = (await admin.from("vault_items").select("id,title").eq("profile_id", P).eq("title", "QA Owned Control")).data[0];
  const sold = (await admin.from("vault_items").select("id,title").eq("profile_id", P).eq("title", "QA Sale Full")).data[0];
  // an exhibition (service insert; the UI creation path was verified in the collector journey) and an item that is then deleted
  const gid = crypto.randomUUID();
  await admin.from("galleries").delete().eq("profile_id", P).like("title", "QA Nav %");
  const g = await admin.from("galleries").insert({ id: gid, profile_id: P, title: "QA Nav Exhibition", description: "synthetic", visibility: "LOCKED", state: "ACTIVE", layout: { itemIds: [control.id], themePack: "classic", displayMode: "grid", guestViewMode: "public", sections: [{ id: "s1", title: "Exhibit 1", description: "", itemIds: [control.id], slotLayout: [control.id, null, null, null, null, null] }] }, exhibition_layout: { itemIds: [control.id] }, public_token: "qanav" + m.stamp, alias_enabled: false });
  if (g.error) throw new Error("gallery: " + g.error.message);
  const delId = "qa_nav_" + m.stamp + "_gone";
  await admin.from("vault_items").insert({ id: delId, profile_id: P, title: "QA Nav Deleted", status: "COLLECTION", created_at: Date.now() });
  await admin.from("vault_items").delete().eq("id", delId);

  // ---- ONE idle cold load, running alongside the other checks ----
  const I = await browser(BASE, { width: 1440, height: 900 });
  const idleP = (async () => {
    await sleep(IDLE * 1000);
    const t0 = Date.now(); const timeline = []; let last = "";
    await I.go("/vault");
    let done = false;
    while (Date.now() - t0 < 60000 && !done) { await sleep(500); let c; try { c = await I.evaluate(classify); } catch { c = "page busy"; } if (c !== last) { timeline.push({ ms: Date.now() - t0, state: c }); last = c; } if (/^loaded|genuinely empty|failed|signed-out/.test(c)) done = true; }
    const diag = await I.c.captureDiag("idle cold load (nav2)", "blank-idle");
    return { timeline, last, failures: diag.failures, errors: diag.errors, reqs: (diag.supabaseRequests || []).length };
  })();

  const S = await browser(BASE, { width: 1440, height: 900 });
  const diagOn = async (label) => { const d = await S.c.captureDiag(label, "nav2-diag"); return { failures: d.failures.length, errors: d.errors.length }; };
  try {
    info("deployed commit", ((await (await fetch(BASE + "/")).text()).match(/name="vltd-commit" content="([^"]+)"/) || [])[1]);
    // ---- 1. Home's financial cards and their drill-downs ----
    const cards = [
      ["Cost breakdown", "/portfolio", "cost-breakdown"],
      ["Value history", "/portfolio", "value-history"],
      ["Biggest movers", "/portfolio", "movers"],
      ["Sales analytics", "/vault/sold", "sales-analytics"],
      ["Insights", "/portfolio", ""],
    ];
    for (const [label, path, hash] of cards) {
      await S.go("/dashboard"); await S.waitFor("/COLLECTION OVERVIEW/.test(document.body.innerText) && /QA Owned Control/.test(document.body.innerText)", 120000, "Home"); await sleep(2500);
      const wantHref = path + (hash ? "#" + hash : "");
      const clicked = await S.evaluate(`(() => { const as = [...document.querySelectorAll('a')].filter((x) => x.getAttribute('href') === ${JSON.stringify(wantHref)}); const a = as.find((x) => ${JSON.stringify(label)} !== 'Insights' || /Insights/.test(x.textContent)) || as[0]; if (!a) return false; a.scrollIntoView({ block: 'center' }); a.click(); return true; })()`);
      await S.waitFor(`location.pathname === ${JSON.stringify(path)}`, 60000, "drill-down " + label); await sleep(4000);
      const landed = await S.evaluate(`({ path: location.pathname, hash: location.hash, anchor: ${hash ? `!!document.getElementById(${JSON.stringify(hash)})` : "true"}, len: document.body.innerText.length })`);
      check(`[home card] "${label}" opens ${path}${hash ? "#" + hash : ""} with its section present`, clicked && landed.path === path && (!hash || (landed.hash === "#" + hash && landed.anchor)) && landed.len > 400, landed);
      await S.evaluate("history.back(); true"); await S.waitFor("location.pathname.startsWith('/dashboard')", 30000, "Back to Home"); await S.waitFor("/COLLECTION OVERVIEW/.test(document.body.innerText)", 60000, "Home after Back"); await sleep(1000);
      check(`[home card] Back from "${label}" returns to Home with the figures still there`, /PURCHASE COST/.test(await S.text()));
    }
    // ---- 2. direct links, refresh, Back ----
    const direct = [
      ["item", "/vault/item/" + control.id, "QA Owned Control"],
      ["sold item", "/vault/item/" + sold.id, "QA Sale Full"],
      ["exhibition", "/museum/" + gid, "QA Nav Exhibition"],
      ["saved content", "/saved", "Your Saves"],
    ];
    for (const [name, path, mark] of direct) {
      await S.go("/dashboard"); await S.waitFor("/PURCHASE COST/.test(document.body.innerText)", 120000); await sleep(1500);
      await S.go(path); await S.waitFor(`document.body.innerText.includes(${JSON.stringify(mark)})`, 120000, name + " direct"); await sleep(2500);
      check(`[direct] ${name}: opens straight from its link`, (await S.path()).startsWith(path));
      await S.evaluate("location.reload(); true"); await S.waitFor(`document.body.innerText.includes(${JSON.stringify(mark)})`, 120000, name + " after refresh"); await sleep(1500);
      check(`[direct] ${name}: still there after a refresh (not blank, still signed in)`, true);
      await S.evaluate("history.back(); true"); await S.waitFor("location.pathname.startsWith('/dashboard')", 30000, name + " back");
      check(`[direct] ${name}: Back returns to where we came from (Home)`, (await S.path()).startsWith("/dashboard"));
    }
    // ---- 3. missing / invalid destinations: a useful state, not a blank page ----
    const ghost = crypto.randomUUID();
    const bad = [
      ["deleted item id", "/vault/item/" + delId],
      ["unknown item id", "/vault/item/not-a-real-item"],
      ["unknown exhibition id", "/museum/" + ghost],
      ["malformed exhibition id", "/museum/not-a-uuid"],
      ["unknown share link", "/museum/share/not-a-real-token-" + m.stamp],
      ["unknown public profile id", "/v/" + ghost],
      ["unknown username", "/u/qa_no_such_user_" + m.stamp],
      ["unknown public item", "/share/not-a-real-item"],
    ];
    for (const [name, path] of bad) {
      await S.go(path); await sleep(9000);
      const out = await S.evaluate("({ path: location.pathname, text: document.body.innerText.split('\\n').join(' | ') })");
      const body = out.text.replace(/^.*?(Level \d+|Help \| ⌘K)\s*\|?/, "");
      const hasWay = await S.evaluate("[...document.querySelectorAll('a,button')].some((x) => /^(home|vault|back|go to|exhibitions|discover|sign in|log in)/i.test(x.textContent.trim()))");
      info("missing: " + name, { path: out.path, text: body.slice(0, 160) });
      check(`[missing] ${name}: shows a plain explanation and a way out, not a blank page`, (USEFUL.test(out.text) || /^\/login/.test(out.path)) && hasWay, { path: out.path, text: body.slice(0, 200), hasWay });
    }
    info("diagnostics on during the navigation checks", await diagOn("nav2 end"));
    const idle = await idleP;
    info("IDLE COLD LOAD (idle " + IDLE + "s, then /vault): timeline", idle.timeline);
    check("[idle cold load] the Vault loaded with its items after an idle period (no blank state)", /^loaded/.test(idle.last), idle);
    info("idle cold load: supabase requests / failures / console errors", { requests: idle.reqs, failures: idle.failures, errors: idle.errors });
  } catch (e) { console.log("STOPPED", e.message); try { await S.shot("nav2-stop.png"); await S.c.captureDiag(String(e.message), "nav2-diag"); } catch { /* ignore */ } fail++; }
  finally { await S.close(); try { await I.close(); } catch { /* ignore */ } await admin.from("galleries").delete().eq("id", gid); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });
