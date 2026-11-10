// Traffic safeguards (permanent regression check). Fails if automatic link prefetching, explicit prefetch calls or recurring launch-counter polling come back.
//  Part A (static, no server needed): scans src/. Part B (browser, needs the local build + simulator, see README): counts prefetch requests from menus, the phone bottom bar and a long item list,
//  checks the launch counter is read once, and checks that normal navigation still works. A detector self-test runs first so a silent detector cannot pass.
const fs = require("fs"); const path = require("path");
const SRC = path.join(__dirname, "../../src"); let pass = 0, fail = 0; const failures = [];
const check = (n, ok, d) => { ok ? pass++ : (fail++, failures.push(n)); console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 400)); };

// ---- Part A: scanner (exported shape kept simple so the self-test can use it)
function scanSource(file, text) {
  const problems = []; const isAppLink = /components[\\/]ui[\\/]AppLink\.tsx$/.test(file);
  const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  if (!isAppLink && /from\s+["']next\/link["']/.test(code)) problems.push("imports next/link directly (use @/components/ui/AppLink)");
  if (/\brouter\.prefetch\s*\(|\.prefetch\s*\(\s*["'`/]/.test(code)) problems.push("calls router.prefetch()");
  if (!isAppLink) for (const m of code.matchAll(/<(Link|NextLink|a)\b[^>]*?\sprefetch\b(\s*=\s*\{?\s*([^}\s>]*))?/g)) { if (!/^false$/.test(m[3] ?? "")) problems.push("turns prefetch on: " + m[0].slice(0, 60)); }
  return problems;
}
function scanAppLink(text) { const p = []; if (!/prefetch\s*=\s*false/.test(text)) p.push("AppLink no longer defaults prefetch to false"); if (!/NextLink|next\/link/.test(text)) p.push("AppLink does not wrap next/link"); return p; }
function scanLaunchCounter(file, text) { const p = []; if (/get_launch_access_status|launch_access/.test(text) && /setInterval\s*\(/.test(text)) p.push("launch counter file uses setInterval"); return p; }
// self-test: the detector must catch each bad pattern and accept the good one
check("scanner catches a direct next/link import", scanSource("src/x.tsx", 'import Link from "next/link";').length === 1);
check("scanner catches router.prefetch()", scanSource("src/x.tsx", 'router.prefetch("/vault");').length === 1);
check("scanner catches <Link prefetch>", scanSource("src/x.tsx", '<Link href="/a" prefetch>x</Link>').length === 1 && scanSource("src/x.tsx", '<Link href="/a" prefetch={true}>x</Link>').length === 1);
check("scanner accepts prefetch={false} and AppLink import", scanSource("src/x.tsx", 'import Link from "@/components/ui/AppLink"; <Link href="/a" prefetch={false}>x</Link>').length === 0);
check("scanner catches a launch-counter interval", scanLaunchCounter("src/y.tsx", 'rpc("get_launch_access_status"); setInterval(load, 3000)').length === 1);
const files = []; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(e.name)) files.push(p); } })(SRC);
const bad = []; for (const f of files) { const t = fs.readFileSync(f, "utf8"); for (const pr of [...scanSource(f, t), ...scanLaunchCounter(f, t)]) bad.push(path.relative(SRC, f) + ": " + pr); }
check("src/: no direct next/link imports, no prefetch calls, no prefetch-on links, no launch-counter intervals (" + files.length + " files)", bad.length === 0, bad);
check("AppLink wraps next/link and defaults prefetch to false", scanAppLink(fs.readFileSync(path.join(SRC, "components/ui/AppLink.tsx"), "utf8")).length === 0);
const home = fs.readFileSync(path.join(SRC, "app/PublicHomeClient.tsx"), "utf8"); check("public home reads the launch counter without an interval or timer loop", !/setInterval|setTimeout\s*\(\s*load/.test(home) && /load\(\)/.test(home));

// ---- Part B: browser (skipped with a clear message when the local build or simulator is not reachable)
(async () => {
  const BASE = process.env.BASE || "http://localhost:3100", SIM = process.env.SIM_URL || "http://localhost:54321";
  const up = await Promise.all([fetch(BASE + "/robots.txt").then((r) => r.ok).catch(() => false), fetch(SIM + "/__sim/fail").then((r) => r.ok).catch(() => false)]);
  if (!up[0] || !up[1]) { console.log("Part B skipped: local app and/or simulator not running (see scripts/local-tests/README.md)."); console.log(JSON.stringify({ pass, fail, failures })); process.exit(fail ? 1 : 0); }
  const L = require("./lib.cjs"); const { sleep, NL } = L; const sim = L.sim;
  async function session(opts) {
    const s = await L.open(opts); const seen = []; s.c.on((m) => { if (m.method !== "Network.requestWillBeSent") return; const r = m.params.request; let u; try { u = new URL(r.url); } catch { return; } if (u.origin !== BASE) return; const h = Object.fromEntries(Object.entries(r.headers || {}).map(([k, v]) => [k.toLowerCase(), v])); seen.push({ path: u.pathname, prefetch: !!h["next-router-prefetch"] || (h["rsc"] && /prefetch/i.test(JSON.stringify(h))) }); });
    return { s, seen, prefetches: () => seen.filter((x) => x.prefetch) };
  }
  // detector self-test: a request that looks like a Next prefetch must be seen
  { const t = await session({ signedIn: false }); try { await t.s.go("/login", 3000); await t.s.evaluate(`fetch("/vault", { headers: { RSC: "1", "Next-Router-Prefetch": "1" } }).then(() => 1)`); await sleep(800); check("runtime detector sees a prefetch-shaped request (control)", t.prefetches().length === 1, t.seen.length); } finally { await t.s.close(); } }
  // desktop: public home, signed-in dashboard with menus, long vault list
  { const t = await session({ signedIn: true, width: 1280, height: 900 }); try {
      await t.s.go("/dashboard", 8000); await t.s.dismiss(); await t.s.mclick("More", true); await sleep(900); await t.s.mclick("Account menu", false); await sleep(900); await t.s.go("/vault", 9000);
      for (let i = 0; i < 10; i++) { await t.s.evaluate(`(document.querySelector(".vltd-content-wrap") || window).scrollBy(0, 700)`); await sleep(500); } await sleep(2500);
      const links = await t.s.evaluate(`document.querySelectorAll('a[href^="/vault/item/"]').length`); check("desktop: menus open + vault list (" + links + " item links) cause 0 prefetch requests", links >= 20 && t.prefetches().length === 0, t.prefetches().slice(0, 5));
      const first = await t.s.evaluate(`(document.querySelector('a[href^="/vault/item/"]') || {}).getAttribute && document.querySelector('a[href^="/vault/item/"]').getAttribute("href")`); await t.s.mclick("Sim Item", false); await sleep(3500);
      check("normal navigation still works: an item card opens its page", /\/vault\/item\//.test(await t.s.evaluate("location.pathname")), first);
      await t.s.evaluate(`history.back()`); await sleep(2500); check("Back returns to the list", (await t.s.evaluate("location.pathname")) === "/vault", await t.s.evaluate("location.pathname"));
    } finally { await t.s.close(); } }
  // phone: bottom bar + More sheet
  { const t = await session({ signedIn: true, width: 390, height: 800, mobile: true }); try {
      await t.s.go("/dashboard", 8000); await t.s.dismiss(); await t.s.mclick("More", true); await sleep(1200); await t.s.evaluate(`document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))`);
      check("phone: bottom bar + More sheet cause 0 prefetch requests", t.prefetches().length === 0, t.prefetches().slice(0, 5));
      await t.s.mclick("Vault", true); await sleep(3500); check("phone: bottom-bar Vault link navigates", (await t.s.evaluate("location.pathname")) === "/vault", await t.s.evaluate("location.pathname"));
    } finally { await t.s.close(); } }
  // launch counter: read once, not repeated (35 s on the public home; the old poll ran every 30 s)
  { await sim("/__sim/reset"); const t = await session({ signedIn: false }); try { await t.s.go("/", 5000); const at = async () => t.seen.filter((x) => x.path === "/api/launch-access").length;
      const c0 = await at(); await sleep(36000); const c1 = await at(); check("launch counter: one /api/launch-access call on open (" + c0 + ") and none more after 36 s (" + c1 + ")", c0 === 1 && c1 === c0, [c0, c1]);
    } finally { await t.s.close(); } }
  console.log(JSON.stringify({ pass, fail, failures })); process.exit(fail ? 1 : 0);
})();
