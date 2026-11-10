// Payment, admin, AI, cron and provider-lookup routes called WITHOUT credentials against the local build: each must refuse (401/403/405/503 or a plain "not configured"), never answer 200 with data,
// never return a stack trace, and never reach a provider (the local build has no provider keys, so a route that tries to call out fails before it can). Does NOT verify any real integration.
// NOT probed on purpose: /api/kickstarter-comics and /api/patreon-comics. They need no key and fetch the public provider site directly, so calling them from a test is a real outbound request
// (found 2026-11-09: one probe each reached the providers). Their local coverage needs a stubbed upstream first.
// Usage: node scripts/local-tests/api-guards.cjs   (needs the local build)
const BASE = process.env.BASE || "http://localhost:3100"; let pass = 0, fail = 0; const failures = [];
const check = (n, ok, d) => { ok ? pass++ : (fail++, failures.push(n)); console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 300)); };
const ROUTES = [
  ["payments", [["POST", "/api/billing/webhook", "{}"], ["POST", "/api/billing/checkout", "{}"], ["POST", "/api/billing/portal", "{}"], ["GET", "/api/billing/session"]]],
  ["admin", [["GET", "/api/admin/bugs"], ["POST", "/api/admin/bugs", "{}"], ["GET", "/api/admin/events"], ["POST", "/api/admin/events/quick-add", "{}"], ["GET", "/api/admin/users"], ["GET", "/api/admin/waitlist"]]],
  ["AI (owner-only)", [["POST", "/api/ai/analyze-item", "{}"], ["POST", "/api/ai/analyze-coa", "{}"]]],
  ["cron / internal", [["GET", "/api/cron/refresh-events"], ["GET", "/api/cron/refresh-events-monthly"], ["GET", "/api/cron/refresh-major-events"], ["POST", "/api/push/send-internal", "{}"], ["POST", "/api/clubs/notify-reddit", "{}"]]],
  ["account email", [["POST", "/api/auth/password-reset", "{\"email\":\"nobody@example.test\"}"], ["POST", "/api/auth/change-email", "{}"], ["POST", "/api/auth/signup", "{}"]]],
  ["provider lookups", [["GET", "/api/psa-lookup?cert=1"], ["GET", "/api/card-lookup?q=x"], ["GET", "/api/comic-lookup?q=x"], ["GET", "/api/upc-lookup?upc=1"], ["GET", "/api/vinyl-lookup?q=x"], ["GET", "/api/events/search?q=x"], ["GET", "/api/gcd-search?q=x"], ["GET", "/api/image-proxy?url=http://169.254.169.254/"]]],
];
(async () => {
  for (const [group, list] of ROUTES) {
    const bad = []; const seen = [];
    for (const [method, url, body] of list) {
      try { const r = await fetch(BASE + url, { method, headers: body ? { "content-type": "application/json" } : {}, body, signal: AbortSignal.timeout(20000) }); const t = await r.text(); seen.push(method + " " + url.split("?")[0].replace("/api/", "") + " " + r.status);
        const okStatus = [400, 401, 403, 404, 405, 429, 501, 503].includes(r.status) || (r.status === 200 && /not.configured|unavailable|disabled|\[\]|"results":\[\]|"items":\[\]|"rows":\[\]|"error"/i.test(t));
        const stack = /at \w+.*\(.*:\d+:\d+\)|node_modules|ECONNREFUSED|stack/i.test(t);
        if (!okStatus || stack) bad.push([method, url, r.status, t.slice(0, 120)]);
      } catch (e) { bad.push([method, url, "fetch error", String(e.message).slice(0, 80)]); } }
    console.log("  " + group + ": " + seen.join(" | ")); check(group + ": every route refuses without credentials, no data, no stack trace", bad.length === 0, bad);
  }
  console.log(JSON.stringify({ pass, fail, failures })); process.exit(fail ? 1 : 0);
})();
