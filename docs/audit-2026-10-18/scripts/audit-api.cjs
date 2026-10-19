// API route inventory: methods, how each route checks the caller (static reading), and an UNAUTHENTICATED probe of admin/user-data routes that are
// safe to call (GET, no body, never cron/push/billing/AI/lookup). Probes only check that the route refuses an anonymous caller.
const fs = require("fs");
const { AUD, REPO, BASE } = require("./audit-lib.cjs");
const stat = JSON.parse(fs.readFileSync(AUD + "/routes-static.json", "utf8"));
const out = [];
(async () => {
  for (const a of stat.apis) {
    const src = fs.readFileSync(REPO + "/" + a.file, "utf8");
    const checks = [/Authorization|bearer/i.test(src) && "bearer-token", /getUser\(|auth\.getUser|createServerClient|supabase\.auth/.test(src) && "user-lookup", /isAdmin|is_admin|ADMIN|requireAdmin|admin/i.test(src.slice(0, 4000)) && "admin-ref", /CRON_SECRET|x-cron|cron/i.test(src) && "cron-secret", /stripe-signature|STRIPE_WEBHOOK/i.test(src) && "stripe-signature", /service_role|SERVICE_ROLE|supabaseAdmin|createClient\(.*SERVICE/i.test(src) && "service-role"].filter(Boolean);
    const row = { route: a.route, methods: a.methods, file: a.file, authSignals: checks.join("+") || "NONE FOUND", probe: "" };
    const probeSafe = /^\/api\/admin\//.test(a.route) && /GET/.test(a.methods);
    if (probeSafe) { try { const r = await fetch(BASE + a.route, { redirect: "manual" }); row.probe = `anonymous GET -> ${r.status}`; } catch (e) { row.probe = "probe error " + String(e).slice(0, 60); } }
    else row.probe = "not called (would act, spend, notify or write)";
    out.push(row);
  }
  fs.writeFileSync(AUD + "/api-inventory.json", JSON.stringify(out, null, 1));
  const csv = ["route,methods,authSignals,probe,file", ...out.map((r) => [r.route, r.methods, r.authSignals, r.probe, r.file].map((x) => '"' + String(x).replace(/"/g, '""') + '"').join(","))].join("\n");
  fs.writeFileSync(AUD + "/api-inventory.csv", csv);
  console.log(out.map((r) => r.route.padEnd(36) + r.methods.padEnd(12) + r.authSignals.padEnd(38) + r.probe).join("\n"));
})();
