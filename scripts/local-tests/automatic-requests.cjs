// Inventory of requests a page makes by itself (no clicks): to VLTD (the app origin), to Supabase (the simulator) and anywhere else (blocked and counted).
// Visible tab vs hidden tab, after leaving a page (unmounted components must stop), and during a database outage (retries must stay bounded).
// Usage: node scripts/local-tests/automatic-requests.cjs [seconds-per-page]   (needs the local build + simulator; see README)
const L = require("./lib.cjs"); const { sleep, check, sim, seed, P } = L; const SECS = Number(process.argv[2] || 50); const ONLY = process.env.ONLY || ""; // ONLY=hidden runs just the hidden-tab check
const O = "33333333-3333-4333-8333-333333333333"; const GID = "00000000-0000-4000-8000-0000000099aa";
const PAGES = ["/dashboard", "/vault", "/portfolio", "/museum", "/museum/" + GID, "/messages", "/activity", "/vault/sync"];
async function watch(s, ms) {
  const seen = []; const off = (m) => { if (m.method !== "Network.requestWillBeSent") return; try { const u = new URL(m.params.request.url); const origin = u.origin === L.BASE ? "VLTD" : u.origin === "http://localhost:54321" ? "Supabase" : "other"; seen.push({ origin, key: m.params.request.method + " " + u.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ":id").replace(/\/sim_item_\d+/, "/:item") }); } catch {} }; s.c.on(off);
  await sleep(ms); const by = {}; for (const x of seen) { const k = x.origin + " " + x.key; by[k] = (by[k] || 0) + 1; } return { total: seen.length, by };
}
const hide = (s) => s.evaluate(`(() => { Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" }); Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); return true; })()`);
const summarize = (w) => Object.entries(w.by).filter(([k]) => !/OPTIONS/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => v + "x " + k).join(" | ");
(async () => {
  const table = [];
  await seed({ galleries: [{ id: GID, profile_id: P, title: "Auto-request test exhibition", visibility: "LOCKED", state: "ACTIVE", public_token: "pub_sim_auto", layout: { itemIds: [], publicItemSnapshots: [] }, exhibition_layout: { itemIds: [], publicItemSnapshots: [] }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] });
  // visible tab
  for (const page of ONLY ? [] : PAGES) { const s = await L.open({ width: 1280, height: 900 }); try { await s.go(page, 7000); await s.dismiss(); const w = await watch(s, SECS * 1000); table.push({ page, mode: "visible", ...w }); console.log("VISIBLE", page.padEnd(48), "idle " + SECS + "s:", String(w.total).padStart(3), "requests |", summarize(w)); } finally { await s.close(); } }
  // hidden tab: only pages that have timers
  const hiddenOnes = {}; for (const page of ["/dashboard", "/museum", "/museum/" + GID, "/vault"]) { const s = await L.open({ width: 1280, height: 900 }); try { await s.go(page, 7000); await s.dismiss(); await hide(s); await sleep(500); const w = await watch(s, SECS * 1000); hiddenOnes[page] = w; table.push({ page, mode: "hidden", ...w }); console.log("HIDDEN ", page.padEnd(48), "idle " + SECS + "s:", String(w.total).padStart(3), "requests |", summarize(w)); } finally { await s.close(); } }
  // unmounted: open the exhibition page, leave for /vault, then watch
  if (!ONLY) { const s = await L.open({ width: 1280, height: 900 }); try { await s.go("/museum/" + GID, 7000); await s.dismiss(); await s.mclick("Vault", true); await sleep(4000); const w = await watch(s, 36000); const gal = Object.entries(w.by).filter(([k]) => /galleries/.test(k) && !/OPTIONS/.test(k)).reduce((a, [, v]) => a + v, 0); console.log("AFTER LEAVING exhibition page for", await s.evaluate("location.pathname"), "- 36s:", w.total, "requests,", gal, "gallery reads"); check("leaving the exhibition page stops its refresh loop (0 gallery reads in 36 s on /vault)", gal === 0, w.by); } finally { await s.close(); } }
  // outage: bounded retries
  if (!ONLY) { await sim("/__sim/fail?rest=1"); const s = await L.open({ width: 1280, height: 900 }); try { await s.go("/dashboard", 6000); const a = await watch(s, 30000); const b = await watch(s, 30000); console.log("OUTAGE /dashboard first 30s:", a.total, "second 30s:", b.total, "|", summarize(b)); check("outage: requests do not keep growing (second 30 s <= 40, first 30 s <= 150)", b.total <= 40 && a.total <= 150, [a.total, b.total]); } finally { await s.close(); await sim("/__sim/fail?rest=0"); } }
  const hiddenTotal = Object.values(hiddenOnes).reduce((a, w) => a + w.total, 0); check("hidden tab: no automatic requests on dashboard, museum, exhibition page and vault (" + hiddenTotal + " in " + SECS + " s each)", hiddenTotal === 0, Object.fromEntries(Object.entries(hiddenOnes).map(([k, w]) => [k, w.by])));
  require("fs").writeFileSync(require("path").join(process.env.TRAFFIC_OUT || __dirname, "automatic-requests.json"), JSON.stringify(table, null, 1));
  console.log(JSON.stringify(L.results())); process.exit(0);
})();
