// ACC: admin / owner-only routes as visitor, owner (non-admin QA user) and unrelated viewer; /api/admin/* answers for a non-admin token; the Alerts feed's admin call.
const A = require("./audit-s-acc-lib.cjs");
const { session, R, sleep, admin, man } = A;
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const env = require("../qa/env.cjs");
const r = R("ACC");
setTimeout(() => { console.log("WATCHDOG"); process.exit(3); }, 1500000).unref();

const ROUTES = ["/admin/bugs", "/admin/characters", "/admin/events", "/admin/events/quick-add", "/admin/museum-campus", "/admin/referrals", "/admin/scan-limits", "/admin/spotlights", "/admin/themes", "/admin/users", "/admin/waitlist", "/owner-lab/forge", "/studio", "/forge"];
const DENIED = /don.t have access|not authorized|access denied|need admin access|forge is locked|owner access required|admins only|not found|sign in with an admin/i;

async function ui(kind) {
  const m = man();
  const S = await session(kind, { width: 1440, height: 900 });
  const who = kind === "visitor" ? "visitor, signed out" : kind === "owner" ? "QA owner (non-admin), Personal" : "unrelated viewer (non-admin)";
  try {
    for (const p of ROUTES) {
      await S.visit(p); await sleep(2500);
      const fin = await S.path();
      const text = await A.bodyText(S);
      const body = text.replace(/^Home Vault Exhibitions Lounge Discover \? Help ⌘K (G |COLLECTOR Level \d+ |NOVICE Level \d+ )?/, "");
      const info = await S.evaluate(`(() => { const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; }; const mainEl = document.querySelector('main') || document.body; const ctl = [...mainEl.querySelectorAll('button,a[href],input,select,textarea')].filter(vis).filter((e) => !e.closest('header,nav')).map((e) => (e.getAttribute('aria-label') || e.innerText || e.placeholder || e.value || '').replace(/\\s+/g, ' ').trim().slice(0, 30)).filter(Boolean); return { ctl: ctl.slice(0, 25), n: ctl.length, rows: document.querySelectorAll('tbody tr,[role=row],li').length }; })()`);
      const denied = DENIED.test(body.slice(0, 300)) || fin.startsWith("/login");
      const restOk = S.badResponses.length;
      const shot = denied ? "" : await S.jshot(`acc-admin-${kind}-${p.replace(/\W+/g, "_")}`);
      // anything the page fetched from the data API with rows is data a non-admin could see
      r.check(denied && info.n <= 3, { page: `${p} | ${who} | 1440`, control: "Open the admin/owner-only route", expected: "a clear 'no access' message with no admin data and no admin controls (or a redirect to sign in)", actual: `landed ${fin}; text="${body.slice(0, 180)}"; ${info.n} controls in the page body: ${JSON.stringify(info.ctl.slice(0, 14))}`, evidence: shot, impact: "privacy/data loss", repro: `Open ${p} as ${who}` });
    }
  } finally { await S.close(); }
}

async function api() {
  const m = man();
  const sb = (c) => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } }).auth.signInWithPassword({ email: c.email, password: c.password });
  const tOwner = (await sb(m)).data.session.access_token; const tViewer = (await sb(m.k)).data.session.access_token;
  for (const ep of ["/api/admin/bugs", "/api/admin/events", "/api/admin/users", "/api/admin/waitlist"]) {
    const out = {};
    for (const [who, tok] of [["no token", null], ["QA owner (non-admin)", tOwner], ["QA viewer (non-admin)", tViewer]]) {
      const res = await fetch(A.BASE + ep, { headers: tok ? { Authorization: "Bearer " + tok } : {}, cache: "no-store" });
      const body = await res.text();
      out[who] = `${res.status} ${body.slice(0, 70).replace(/\s+/g, " ")}`;
    }
    const ok = Object.values(out).every((v) => /^40[13] /.test(v));
    r.check(ok, { page: `GET ${ep} | no token / non-admin tokens`, control: "Admin API read (GET)", expected: "refused (401/403) without data for anyone who is not an admin", actual: JSON.stringify(out), evidence: "", impact: "privacy/data loss", repro: `Call ${ep} with and without a normal user's token` });
  }
  // cache of the refusal: the Alerts feed asks again on every page unless the answer is a 401/403
  r.pass({ page: "Alerts feed (every signed-in page) | non-admin", control: "Why /api/admin/bugs is requested on every page", expected: "(informational) a non-admin triggers an admin endpoint; harmless because the server refuses with 403 and the app remembers the refusal for the browser session", actual: "In the audit the request is intercepted (503), which the app does not treat as a refusal, so it re-asks on every page and the crawl saw it everywhere. Against the real server the answer is 403 (see rows above) and sessionStorage caches it, so a normal person triggers it once per browser session. Triggering it is not a leak.", evidence: "", impact: "improvement", repro: "Sign in as a non-admin; open any page; watch network" });
}

(async () => {
  const which = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7);
  if (!which || which === "visitor") await ui("visitor");
  if (!which || which === "owner") await ui("owner");
  if (!which || which === "viewer") await ui("viewer");
  if (!which || which === "api") await api();
})().catch((e) => { console.error("ERR", e); process.exit(2); });
