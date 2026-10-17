// Capture the blank Vault load. ONE browser at a time, sequential. For every load the page is watched every 500 ms and classified:
//   blank | checking-account | skeleton | false-empty | signed-out | error | loaded
// until it is loaded or 60 s have passed (a visible timeout, not a fixed wait). Everything that could explain a slow or blank load is kept.
//   node blankload.cjs <label> [--base=https://vltd.app] [--n=10]
const fs = require("fs");
const { launch } = require("./cdp.cjs");
const env = require("../qa/env.cjs");
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const args = Object.fromEntries(process.argv.slice(3).map((a) => { const m = a.replace(/^--/, "").split("="); return [m[0], m[1] ?? true]; }));
const label = process.argv[2] || "blank";
const BASE = args.base || "https://vltd.app";
const N = Number(args.n || 10);
const qa2 = JSON.parse(fs.readFileSync(__dirname + "/qa_perf2.json", "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const stamp = Date.now().toString(36);
const P2 = qa2.profileId2;
const COUNT = Number(args.items || 30);

const CLASSIFY = `(() => {
  const body = document.body; const t = body ? body.innerText.trim() : '';
  const path = location.pathname;
  const has = (re) => re.test(t);
  let a = null; try { a = JSON.parse(localStorage.getItem('vltd-auth') || 'null'); } catch {}
  const items = document.querySelectorAll('main a[href^="/vault/item/"]').length;
  const search = !!document.querySelector('[aria-label="Search the vault"]');
  let stage = 'other';
  if (path.startsWith('/login')) stage = 'signed-out';
  else if (has(/Sign in to see your Vault/i)) stage = 'signed-out';
  else if (has(/Your vault is empty/i)) stage = 'false-empty';
  else if (has(/could not load/i)) stage = 'error';
  else if (search && items > 0) stage = 'loaded';
  else if (document.querySelector('[aria-label="Loading your vault"]')) stage = 'skeleton';
  else if (document.querySelector('[aria-label="Checking your account"]')) stage = 'checking-account';
  else if (t === '' ) stage = 'blank';
  return JSON.stringify({ stage, path, textLen: t.length, items, search, ready: document.readyState, hasSession: !!(a && a.access_token), profile: String(localStorage.getItem('vltd_active_profile_id_v1') || '').slice(0, 8), deviceCopy: localStorage.getItem('vltd_vault_items_v1') !== null, mark: localStorage.getItem('vltd_vault_items_repaired_v1') !== null, commit: (document.querySelector('meta[name="vltd-commit"]') || {}).content ? document.querySelector('meta[name="vltd-commit"]').content.slice(0, 7) : null });
})()`;

async function watch(c, label, maxMs = 60000) {
  const t0 = Date.now(); const timeline = []; let last = "";
  while (Date.now() - t0 < maxMs) {
    let s; try { s = JSON.parse(await Promise.race([c.evaluate(CLASSIFY), new Promise((r) => setTimeout(() => r('{"stage":"page-not-answering"}'), 4000))])); } catch { s = { stage: "page-not-answering" }; }
    if (s.stage !== last) { timeline.push({ atMs: Date.now() - t0, stage: s.stage, path: s.path, textLen: s.textLen }); last = s.stage; }
    if (s.stage === "loaded") return { label, result: "loaded", ms: Date.now() - t0, timeline, final: s };
    await sleep(500);
  }
  return { label, result: "TIMEOUT (60 s)", ms: maxMs, timeline, final: null };
}

(async () => {
  await admin.from("vault_items").delete().eq("profile_id", P2);
  const rows = Array.from({ length: COUNT }, (_, i) => ({ id: `qa_bl_${stamp}_${i}`, profile_id: P2, title: `QA Blank Check ${i}`, universe: "SPORTS", category: "SPORTS_CARDS", category_label: "Sports Cards", is_public: false, created_at: 1790000000000 + i, current_value: 10 + i, purchase_price: 5, status: "COLLECTION" }));
  await admin.from("vault_items").insert(rows);
  const out = []; let bad = 0;
  try {
    for (let k = 0; k < N; k++) {
      const c = await launch();
      const rec = { iter: k, port: c.port };
      try {
        await c.send("Page.enable"); await c.send("Network.enable"); await c.send("Runtime.enable");
        await c.send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
        if (args.fetchpause) { // the same request interception the empty-state suite uses (every request to the account service is paused and let through)
          await c.send("Fetch.enable", { patterns: [{ urlPattern: "*supabase.co*", requestStage: "Request" }] });
          c.on((m) => { if (m.method === "Fetch.requestPaused") c.send("Fetch.continueRequest", { requestId: m.params.requestId }).catch(() => {}); });
        }
        const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
        const { data, error } = await sb.auth.signInWithPassword({ email: qa2.email2, password: qa2.password2 });
        if (error) { rec.signIn = "FAILED " + error.message.slice(0, 60); out.push(rec); bad++; continue; }
        await c.send("Page.navigate", { url: BASE + "/robots.txt" }); await sleep(600);
        await c.evaluate(`localStorage.setItem('vltd-auth', ${JSON.stringify(JSON.stringify(data.session))}); localStorage.setItem('vltd_active_profile_id_v1', ${JSON.stringify(P2)}); true`);
        rec.sessionExpiresInSec = data.session.expires_at - Math.floor(Date.now() / 1000);
        const loads = [];
        for (const kind of ["cold", "repeat", "repeat"]) {
          c.diag.requests.clear(); c.diag.failures.length = 0; c.diag.errors.length = 0; c.diag.navigations.length = 0;
          await c.send("Page.navigate", { url: BASE + "/vault" });
          const w = await watch(c, kind);
          w.requests = [...c.diag.requests.values()].map((r) => `${r.method} ${r.table} ${r.status ?? "?"} ${r.auth}`);
          w.failures = [...c.diag.failures]; w.errors = [...c.diag.errors]; w.navigations = [...c.diag.navigations];
          const long = (x, i) => x.stage === "blank" ? ((w.timeline[i + 1] ? w.timeline[i + 1].atMs : w.ms) - x.atMs) > 3000 : true; // the empty page before the app starts (a few ms) is not a blank screen; one that lasts over 3 s is
          if (w.result !== "loaded" || w.timeline.some((x, i) => ["blank", "false-empty", "signed-out", "error", "page-not-answering"].includes(x.stage) && long(x, i))) { w.evidence = await c.captureDiag("load-" + kind + "-" + w.result, "diag-blank"); bad++; }
          loads.push(w);
        }
        rec.loads = loads;
      } catch (e) { rec.harnessError = String(e).slice(0, 200); bad++; }
      finally { await c.close(); }
      out.push(rec);
      console.log(`#${k}`, (rec.loads || []).map((l) => `${l.label}: ${l.result} ${l.result === "loaded" ? l.ms + "ms" : ""} [${l.timeline.map((x) => x.stage + "@" + x.atMs).join(" > ")}]`).join(" | "), rec.harnessError || rec.signIn || "");
    }
  } finally { await admin.from("vault_items").delete().eq("profile_id", P2); }
  fs.writeFileSync(__dirname + `/blankload-${label}.json`, JSON.stringify(out, null, 1));
  const commits = new Set(out.flatMap((r) => (r.loads || []).map((l) => l.final?.commit)).filter(Boolean));
  console.log(`\n${out.length} browsers, ${out.reduce((s, r) => s + (r.loads || []).length, 0)} loads, ${bad} with anything other than a clean load. Deployed commit(s) seen by the page: ${[...commits].join(", ")}`);
  process.exit(0);
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2); });
