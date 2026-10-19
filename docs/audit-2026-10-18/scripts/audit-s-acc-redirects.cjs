// ACC: signed-out visit to every route in the crawl: protected routes must redirect to /login?next=<route> and must not flash private/page content first.
const A = require("./audit-s-acc-lib.cjs");
const { session, R, sleep, fs, AUD } = A;
const r = R("ACC");
setTimeout(() => { console.log("WATCHDOG"); process.exit(3); }, 2400000).unref();

// copy of src/lib/routeAccess.ts (prefix rules) used only to decide what the app is MEANT to protect
const SETUP = ["/dashboard", "/vault", "/museum", "/community-board", "/lounge-preview", "/messages", "/notifications", "/portfolio", "/insurance", "/reports", "/sales", "/saved", "/favorites", "/goals", "/watchlist", "/account", "/capture", "/ingest", "/forge", "/redeem", "/auction", "/activity"];
const pub = (p) => p.startsWith("/museum/share/") || p === "/museum/virtual-room/guest" || /^\/museum\/[^/]+\/guest(\/|$)/.test(p);
const meant = (p) => { p = p.split("?")[0].replace(/\/+$/, "") || "/"; if (p === "/onboarding") return true; if (pub(p)) return false; return SETUP.some((x) => p === x || p.startsWith(x + "/")); };

const SEEN = `(() => { if (window.__seenH) return; window.__seenH = []; const add = (s) => { if (s && window.__seenH.indexOf(s) < 0 && window.__seenH.length < 40) window.__seenH.push(s); }; const snap = () => { try { document.querySelectorAll('h1,h2,h3').forEach((h) => add(h.tagName + ':' + h.innerText.trim().slice(0, 50))); const m = document.querySelector('main'); if (m && m.innerText.length > 40) add('MAIN:' + m.innerText.replace(/\\s+/g, ' ').slice(0, 40)); } catch (e) {} }; const start = () => { new MutationObserver(snap).observe(document.documentElement, { subtree: true, childList: true, characterData: true }); snap(); }; if (document.documentElement) start(); else document.addEventListener('DOMContentLoaded', start); })()`;

async function rawHtml(path) {
  try {
    const res = await fetch(A.BASE + path, { redirect: "manual" });
    const html = await res.text();
    const text = html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return { status: res.status, loc: res.headers.get("location"), textLen: text.length, text: text.slice(0, 160) };
  } catch (e) { return { err: String(e.message) }; }
}

(async () => {
  const L = fs.readFileSync(AUD + "/crawl-visitor-1440.jsonl", "utf8").trim().split("\n").map((x) => JSON.parse(x));
  const seen = new Set(); const routes = [];
  for (const p of L) { const q = p.requested; if (!q || /\[/.test(q) || seen.has(q)) continue; seen.add(q); routes.push(q); }
  for (const extra of ["/vault/item/qa_vz_x_1", "/vault/item/qa_vz_x_1/present", "/watchlist", "/forge", "/messages?thread=abc", "/goals?x=1"]) if (!seen.has(extra)) { seen.add(extra); routes.push(extra); }
  console.log("routes", routes.length);
  const S = await session("visitor", { width: 1440, height: 900 });
  await S.send("Page.addScriptToEvaluateOnNewDocument", { source: SEEN });
  const unprotected = [];
  try {
    for (const path of routes) {
      const protectedMeant = meant(path);
      await S.visit(path);
      await sleep(800);
      const fin = await S.path();
      const hs = await S.evaluate("window.__seenH || []").catch(() => []);
      const h1 = await S.evaluate("(document.querySelector('h1') || {}).innerText || ''").catch(() => "");
      const expectQ = "/login?next=" + encodeURIComponent(path);
      const page = `${path} | visitor, signed out | 1440`;
      if (protectedMeant) {
        const raw = await rawHtml(path);
        const redirected = fin === expectQ || (path.startsWith("/registry") && fin.startsWith("/login?next=%2Fcommunity-board")) || (path === "/onboarding" && fin === "/login?next=%2Fonboarding");
        const flashed = hs.filter((x) => !/^(H1|H2|H3):(Log in to your vault|Home|)$/.test(x) && !/Log in to your vault|WELCOME BACK|Get back into/i.test(x) && !/^MAIN:/.test(x));
        const mainFlash = hs.filter((x) => /^MAIN:/.test(x) && !/Back to VLTD|WELCOME BACK|Log in/i.test(x));
        const shot = redirected && !flashed.length && !mainFlash.length ? "" : await S.jshot("acc-redirect-" + path.replace(/\W+/g, "_").slice(0, 50));
        r.check(redirected && !flashed.length && !mainFlash.length, { page, control: "Direct visit while signed out", expected: `redirects to ${expectQ} and no page content is shown before the redirect`, actual: `landed on ${fin}; headings/main text seen during load: ${JSON.stringify(hs).slice(0, 220)}; raw server HTML (no scripts) ${JSON.stringify({ status: raw.status, textLen: raw.textLen, text: raw.text })}`, evidence: shot, impact: redirected ? "privacy/data loss" : "blocked workflow", repro: `Signed out, open ${path}` });
      } else {
        const toLogin = fin.startsWith("/login");
        if (!toLogin) unprotected.push(`${path} -> ${fin} [${h1.slice(0, 30)}]`);
      }
    }
    // Back button after a guard redirect must not trap the visitor
    await S.visit("/pricing-qa-neutral"); // a public 404 as the previous page
    await S.visit("/goals");
    const afterRedirect = await S.path();
    await S.send("Page.navigate", { url: A.BASE + "/robots.txt" }).catch(() => {});
    await sleep(500);
    await S.visit("/goals");
    await S.evaluate("history.back()"); await sleep(2500);
    const back = await S.path();
    r.check(afterRedirect === "/login?next=%2Fgoals" && !/^\/goals/.test(back) || back.startsWith("/robots") , { page: "/goals | visitor | 1440", control: "Browser Back after the sign-in redirect", expected: "Back leaves the sign-in page for where the visitor came from (not a redirect loop back to /goals -> /login)", actual: `after redirect ${afterRedirect}; after Back ${back}`, evidence: "", impact: "usability", repro: "Signed out: open /goals (redirected to /login); press Back" });
    r.pass({ page: "all crawled public routes | visitor | 1440", control: "Routes that do NOT require sign-in (informational list)", expected: "routes outside the app areas stay public on purpose", actual: `${unprotected.length} routes not redirected: ${unprotected.join("; ")}`, evidence: "", impact: "improvement", repro: "Signed out, open each route" });
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e); process.exit(2); });
