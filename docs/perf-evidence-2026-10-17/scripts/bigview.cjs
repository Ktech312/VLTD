// Gallery / Wall long-task measurement with a large synthetic collection.
//   node bigview.cjs <label> [--base=http://localhost:3100] [--n=1500] [--view=gallery|wall] [--imgbase=https://...] [--cpu=4]
const fs = require("fs");
const { launch } = require("./cdp.cjs");
const env = require("../qa/env.cjs");
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const args = Object.fromEntries(process.argv.slice(3).map((a) => { const m = a.replace(/^--/, "").split("="); return [m[0], m[1] ?? true]; }));
const label = process.argv[2] || "big";
const BASE = args.base || "http://localhost:3100";
const N = Number(args.n || 1500);
const VIEW = args.view || "gallery";
const CPU = Number(args.cpu || 1);
const qa = JSON.parse(fs.readFileSync(__dirname + "/qa_perf.json", "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const stamp = Date.now().toString(36);
const P1 = qa.profileId;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const UNIS = [["MISC", "COLLECTORS_CHOICE", "Collectors Choice"], ["SPORTS", "SPORTS_CARDS", "Sports Cards"], ["MUSIC", "AUDIO_FORMATS", "Audio Formats"]];
const rows = Array.from({ length: N }, (_, i) => {
  const [u, c, cl] = UNIS[i % 3];
  const row = { id: `qa_big_${stamp}_${String(i).padStart(4, "0")}`, profile_id: P1, title: `${LETTERS[i % 26]} QA Item ${String(i).padStart(4, "0")} with a longer realistic title`, subtitle: `Set ${i % 40} #${i}`, universe: u, category: c, category_label: cl, is_public: false, created_at: 1790000000000 + i * 1000, current_value: 10 + ((i * 37) % 500), purchase_price: 5 + (i % 90), grade: i % 5 === 0 ? "PSA 9" : null, status: "COLLECTION", image_front_url: null };
  if (i < Number(args.photos || 300)) {
    const url = args.imgbase ? `${args.imgbase}/${i % 3 === 0 ? "m" : "s"}.jpg?i=${i}` : `http://127.0.0.1:8899/img/${i % 3 === 0 ? "l" : "m"}/b-${i}.jpg`;
    Object.assign(row, { image_front_url: url, primary_image_key: url, images_json: [{ id: url, storageKey: url, url, order: 0, localOnly: false, role: "primary", isPrivateStorage: false }] });
  }
  return row;
});

(async () => {
  await admin.from("vault_items").delete().eq("profile_id", P1);
  for (let i = 0; i < rows.length; i += 400) { const r = await admin.from("vault_items").insert(rows.slice(i, i + 400)); if (r.error) throw new Error(r.error.message); }
  const c = await launch(9700 + Math.floor(Math.random() * 250));
  const { send, evaluate } = c;
  try {
    await send("Page.enable"); await send("Network.enable"); await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
    if (CPU > 1) await send("Emulation.setCPUThrottlingRate", { rate: CPU });
    const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data, error } = await sb.auth.signInWithPassword({ email: qa.email, password: qa.password });
    if (error) throw error;
    await send("Page.navigate", { url: BASE + "/robots.txt" }); await sleep(1000);
    await evaluate(`localStorage.setItem('vltd-auth', ${JSON.stringify(JSON.stringify(data.session))}); localStorage.setItem('vltd_active_profile_id_v1', ${JSON.stringify(P1)}); localStorage.setItem('vltd_vault_view_mode', ${JSON.stringify(VIEW)}); true`);
    await send("Page.addScriptToEvaluateOnNewDocument", { source: "window.__lt=[]; try{ new PerformanceObserver((l)=>{for(const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]);}).observe({type:'longtask',buffered:true}); }catch(e){} true;" });
    await send("Page.navigate", { url: BASE + "/vault" });
    // wait for the first cards
    let n = 0;
    for (let i = 0; i < 80; i++) { await sleep(500); n = await evaluate(`document.querySelectorAll('main a[href^="/vault/item/"]').length`); if (n > 0) break; }
    await sleep(2500);
    const out = { label, base: BASE, n: N, view: VIEW, cpu: CPU, firstCards: n, clicks: [] };
    out.loadTasks = await evaluate("window.__lt.slice()");
    if (args.warm) {
      // a second visit on the same device: the saved copy is there, so no full download
      await send("Page.navigate", { url: BASE + "/vault" });
      for (let i = 0; i < 80; i++) { await sleep(500); n = await evaluate("document.querySelectorAll('main a[href^=\"/vault/item/\"]').length"); if (n > 0) break; }
      await sleep(3000);
      out.warmLoadTasks = await evaluate("window.__lt.slice()");
      // a third visit: by now the saved copy has been through one full repair
      await send("Page.navigate", { url: BASE + "/vault" });
      for (let i = 0; i < 80; i++) { await sleep(500); n = await evaluate("document.querySelectorAll('main a[href^=\"/vault/item/\"]').length"); if (n > 0) break; }
      await sleep(3000);
      out.thirdLoadTasks = await evaluate("window.__lt.slice()");
      console.log("thirdLoadTasks", JSON.stringify(out.thirdLoadTasks.map((t) => t[1])));
      console.log("warmLoadTasks", JSON.stringify(out.warmLoadTasks.map((t) => t[1])));
    }
    for (let k = 0; k < 40; k++) {
      await evaluate("window.__lt.length = 0; true");
      const before = await evaluate(`new Set([...document.querySelectorAll('main a[href^="/vault/item/"]')].map((a) => a.getAttribute('href'))).size`);
      const clicked = await evaluate(`(() => { window.__t0 = performance.now(); const m = [...document.querySelectorAll('main button')].find((b) => /^Show \\d+ more/.test(b.textContent.trim())); if (m) { m.click(); return true; } const sc = document.querySelector('.vltd-content-wrap') || document.scrollingElement; sc.scrollTop = sc.scrollHeight; window.scrollTo(0, document.body.scrollHeight); return false; })()`);
      // time until the page has painted twice after the click (rough "responsive again")
      const settle = await evaluate(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(Math.round(performance.now() - window.__t0)))))`);
      await sleep(1200);
      const after = await evaluate(`new Set([...document.querySelectorAll('main a[href^="/vault/item/"]')].map((a) => a.getAttribute('href'))).size`);
      const lt = await evaluate("window.__lt.slice()");
      out.clicks.push({ k, clicked, before, after, settleMs: settle, longest: lt.reduce((m, t) => Math.max(m, t[1]), 0), total: lt.reduce((s, t) => s + t[1], 0), tasks: lt.length });
      if (!clicked && after === before) break;
      if (after >= N) break;
    }
    const longs = out.clicks.map((x) => x.longest).sort((a, b) => a - b);
    out.summary = { clicks: out.clicks.length, worstLongTask: Math.max(0, ...longs), p50: longs[Math.floor(longs.length / 2)] || 0, worstSettle: Math.max(0, ...out.clicks.map((x) => x.settleMs)), reached: out.clicks.at(-1)?.after };
    console.log(JSON.stringify(out.summary), "loadTasks", JSON.stringify(out.loadTasks.map((t) => t[1])));
    for (const x of out.clicks.slice(0, 40)) console.log(JSON.stringify(x));
    fs.writeFileSync(__dirname + `/bigview-${label}.json`, JSON.stringify(out, null, 1));
  } finally {
    await c.close();
    await admin.from("vault_items").delete().eq("profile_id", P1);
  }
  process.exit(0);
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2); });
