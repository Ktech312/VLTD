// Simulated Supabase for local request-count tests. Nothing here talks to the real service. Logs every request path to counts.json on exit/interval.
const http = require("http"); const fs = require("fs"); const path = require("path");
const PORT = 54321; const U = "11111111-1111-4111-8111-111111111111", P = "22222222-2222-4222-8222-222222222222";
const N_ITEMS = Number(process.env.SIM_ITEMS || 80); const counts = {}; const started = Date.now();
const items = Array.from({ length: N_ITEMS }, (_, i) => ({ id: "sim_item_" + i, profile_id: P, title: "Sim Item " + i, universe: ["MUSIC", "SPORTS", "POP_CULTURE", "MISC"][i % 4], category: "Collectors Choice", category_label: "Collectors Choice", status: "COLLECTION", created_at: 1790000000000 + i, is_public: false, purchase_price: 5 + i, current_value: i % 3 ? 10 + i : null, image_front_url: "/collectibles/" + ["guitar", "vinyl-record", "sports-slab", "movie-poster", "comic-slab"][i % 5] + ".png" }));
const profile = { id: P, user_id: U, display_name: "Sim Collector", username: "sim_collector", profile_type: "personal", primary_focus: "Sports", avatar_emoji: "key", onboarding_completed: true, is_public: false, tier: "FULL", avatar_url: "__preset:key", created_at: "2026-01-01T00:00:00Z" };
const user = { id: U, aud: "authenticated", role: "authenticated", email: "sim@example.com", email_confirmed_at: "2026-01-01T00:00:00Z", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "*" };
const srv = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x"); const key = req.method + " " + url.pathname.replace(/\/[0-9a-f-]{8,}/g, "/:id"); counts[key] = (counts[key] || 0) + 1;
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  const single = /pgrst\.object/.test(req.headers.accept || ""); const send = (code, body) => { res.writeHead(code, { ...cors, "content-type": "application/json", "content-range": "0-" + (Array.isArray(body) ? Math.max(0, body.length - 1) : 0) + "/" + (Array.isArray(body) ? body.length : 1) }); res.end(JSON.stringify(body)); };
  if (url.pathname === "/auth/v1/user") return send(200, user);
  if (url.pathname.startsWith("/auth/v1/")) return send(200, { access_token: "x", token_type: "bearer", expires_in: 3600, refresh_token: "r", user });
  if (url.pathname === "/rest/v1/profiles") return single ? send(200, profile) : send(200, [profile]);
  if (url.pathname === "/rest/v1/vault_items" || url.pathname === "/rest/v1/public_vault_items") return req.method === "GET" ? send(200, single ? items[0] : items) : send(201, []);
  if (url.pathname.startsWith("/rest/v1/rpc/")) return send(200, []);
  if (url.pathname.startsWith("/rest/v1/")) return req.method === "GET" ? (single ? send(406, { message: "none" }) : send(200, [])) : send(201, []);
  send(200, {});
});
srv.listen(PORT, () => console.log("simulated supabase on", PORT));
const dump = () => fs.writeFileSync(path.join(process.env.TRAFFIC_OUT || __dirname, "supabase-counts.json"), JSON.stringify({ since: new Date(started).toISOString(), counts }, null, 1));
setInterval(dump, 2000); process.on("SIGTERM", () => { dump(); process.exit(0); });
