// One isolated browser, 1,500 synthetic items, CPU slowed 4x: visit 1 (first, downloads and repairs), then visits 2..K. Every visit is
// profiled (Profiler) and its long tasks recorded; the raw profiles are saved for analysis.
//   node visits.cjs <label> [--base=https://vltd.app] [--cpu=4] [--visits=5] [--n=1500]
const fs = require("fs");
const { launch } = require("./cdp.cjs");
const env = require("../qa/env.cjs");
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const args = Object.fromEntries(process.argv.slice(3).map((a) => { const m = a.replace(/^--/, "").split("="); return [m[0], m[1] ?? true]; }));
const label = process.argv[2] || "visits";
const BASE = args.base || "https://vltd.app";
const CPU = Number(args.cpu || 4), K = Number(args.visits || 5), N = Number(args.n || 1500);
const qa = JSON.parse(fs.readFileSync(__dirname + "/qa_perf.json", "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const stamp = Date.now().toString(36); const P1 = qa.profileId;
const rows = Array.from({ length: N }, (_, i) => ({ id: `qa_vis_${stamp}_${i}`, profile_id: P1, title: `QA Item ${i} with a longer realistic title`, subtitle: `Set ${i % 40} #${i}`, universe: ["MISC", "SPORTS", "MUSIC"][i % 3], category: "SPORTS_CARDS", category_label: "Sports Cards", is_public: false, created_at: 1790000000000 + i * 1000, current_value: 10 + ((i * 37) % 500), purchase_price: 5 + (i % 90), grade: i % 5 === 0 ? "PSA 9" : null, status: "COLLECTION" }));

(async () => {
  await admin.from("vault_items").delete().eq("profile_id", P1);
  for (let i = 0; i < rows.length; i += 400) await admin.from("vault_items").insert(rows.slice(i, i + 400));
  const c = await launch();
  const out = { label, base: BASE, cpu: CPU, n: N, visits: [] };
  try {
    const { send, evaluate } = c;
    await send("Page.enable"); await send("Network.enable"); await send("Runtime.enable"); await send("Profiler.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
    const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data } = await sb.auth.signInWithPassword({ email: qa.email, password: qa.password });
    await send("Page.navigate", { url: BASE + "/robots.txt" }); await sleep(900);
    await evaluate(`localStorage.setItem('vltd-auth', ${JSON.stringify(JSON.stringify(data.session))}); localStorage.setItem('vltd_active_profile_id_v1', ${JSON.stringify(P1)}); localStorage.setItem('vltd_vault_view_mode', 'gallery'); true`);
    await send("Page.addScriptToEvaluateOnNewDocument", { source: "window.__lt=[]; try{ new PerformanceObserver((l)=>{for(const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]);}).observe({type:'longtask',buffered:true}); }catch(e){} true;" });
    // --css=strip: the stylesheet is rewritten on its way to the page without the rules that use :has(.vltd-ins-light); --css=base lets it through
    // unchanged (the same interception, so both conditions pay the same overhead). Same build, same fixture.
    const cssMode = args.css || "off"; let stripped = 0, cssSeen = 0;
    if (cssMode !== "off") {
      await send("Fetch.enable", { patterns: [{ urlPattern: "*/_next/static/*.css*", requestStage: "Response" }] });
      c.on(async (m) => {
        if (m.method !== "Fetch.requestPaused") return;
        const id = m.params.requestId;
        try {
          if (m.params.responseStatusCode !== 200) return await send("Fetch.continueRequest", { requestId: id });
          const b = await send("Fetch.getResponseBody", { requestId: id });
          let text = Buffer.from(b.body, b.base64Encoded ? "base64" : "utf8").toString("utf8"); cssSeen++;
          if (cssMode === "strip") { const before = text.length; text = text.replace(/[^{}]*vltd-ins-light[^{}]*{[^{}]*}/g, ""); if (text.length !== before) stripped++; }
          if (cssMode === "vaultHas") { const before = text.length; text = text.replace(/[^{}]*Search vault items[^{}]*{[^{}]*}/g, ""); if (text.length !== before) stripped++; }
          const headers = (m.params.responseHeaders || []).filter((h) => !/^(content-encoding|content-length)$/i.test(h.name));
          await send("Fetch.fulfillRequest", { requestId: id, responseCode: 200, responseHeaders: headers, body: Buffer.from(text, "utf8").toString("base64") });
        } catch (e) { try { await send("Fetch.continueRequest", { requestId: id }); } catch { /* gone */ } }
      });
    }
    await send("Profiler.setSamplingInterval", { interval: 1000 });
    await send("Emulation.setCPUThrottlingRate", { rate: CPU });
    for (let v = 1; v <= K; v++) {
      // how fast is this machine right now? a fixed amount of plain JavaScript, timed in the throttled page just before the visit
      let calib = []; for (let k = 0; k < 3; k++) calib.push(Math.round(await evaluate("(() => { const t = performance.now(); let x = 0; for (let i = 0; i < 2e7; i++) x += i % 7; return performance.now() - t; })()")));
      const calibMs = Math.min(...calib);
      await send("Profiler.start");
      const events = [];
      if (args.trace) { c.on((m) => { if (m.method === "Tracing.dataCollected") events.push(...m.params.value); }); await send("Tracing.start", { categories: "devtools.timeline,v8,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.invalidationTracking,devtools.timeline.async", transferMode: "ReportEvents" }); }
      const t0 = Date.now();
      await send("Page.navigate", { url: BASE + "/vault" });
      let ready = false;
      for (let i = 0; i < 120 && !ready; i++) { await sleep(500); try { ready = await evaluate(`!!document.querySelector('[aria-label="Search the vault"]') && document.querySelectorAll('main a[href^="/vault/item/"]').length > 0`); } catch { /* busy */ } }
      const readyMs = ready ? Date.now() - t0 : null;
      await sleep(Number(args.settle || 3000));
      const prof = (await send("Profiler.stop")).profile;
      if (args.trace) { const done = new Promise((r) => { c.on((m) => { if (m.method === "Tracing.tracingComplete") r(); }); }); await send("Tracing.end"); await Promise.race([done, sleep(15000)]); fs.writeFileSync(__dirname + `/trace-${label}-v${v}.json`, JSON.stringify(events)); }
      fs.writeFileSync(__dirname + `/prof-${label}-v${v}.json`, JSON.stringify(prof));
      const lt = await evaluate("window.__lt.slice()");
      if (args.idleprof && v === 1) { await send("Profiler.start"); await sleep(8000); const ip = (await send("Profiler.stop")).profile; fs.writeFileSync(__dirname + `/prof-${label}-idle.json`, JSON.stringify(ip)); const busy = ip.samples.reduce((sum, id, i) => sum + (ip.nodes.find((n) => n.id === id).callFrame.functionName === "(idle)" ? 0 : ip.timeDeltas[i] || 0), 0); console.log("  idle profile after the first visit: busy " + (busy / 1000).toFixed(0) + " ms of 8000 ms"); }
      const st = JSON.parse(await evaluate(`JSON.stringify({ mark: localStorage.getItem('vltd_vault_items_repaired_v1') !== null, bytes: (localStorage.getItem('vltd_vault_items_v1') || '').length })`));
      const urls = [...new Set(prof.nodes.map((n) => n.callFrame.url).filter((u) => /_next\/static/.test(u)))];
      out.visits.push({ visit: v, cssMode, stripped, cssSeen, calibMs, readyMs, longTasks: lt.map((x) => x[1]), worst: Math.max(0, ...lt.map((x) => x[1])), marked: st.mark, storedChars: st.bytes, chunkCount: urls.length });
      console.log(`visit ${v} [css ${cssMode}${cssMode === "strip" ? ", sheets rewritten " + stripped : ""}]: machine speed check ${calibMs} ms (lower is faster); ready ${readyMs} ms, long tasks [${lt.map((x) => x[1]).join(", ")}], worst ${Math.max(0, ...lt.map((x) => x[1]))}, marked ${st.mark}`);
      c.diag.requests.clear();
    }
  } finally { await c.close(); await admin.from("vault_items").delete().eq("profile_id", P1); }
  fs.writeFileSync(__dirname + `/visits-${label}.json`, JSON.stringify(out, null, 1));
  process.exit(0);
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2); });
