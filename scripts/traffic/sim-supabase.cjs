// Simulated Supabase for local tests (in-memory, PostgREST-like). Nothing here talks to the real service.
//  - auth: any token is the simulated user.  - REST: select/eq/neq/in/is/gt/gte/lt/lte/ilike/order/limit/offset, insert, upsert (on_conflict / merge-duplicates), patch, delete.
//  - /__sim/fail?rest=1 makes every REST table call answer 503 (rest=0 restores); /__sim/missing-col?names=a,b answers 42703 for those columns; /__sim/selects shows the last column list per table.
//  - storage: uploads are accepted (bytes dropped), public/sign URLs answer a 1x1 png; /__sim/fail?storage=1 makes storage answer 500, ?storage=0 restores it.
//  - /__sim/reset puts every table, counter and switch back to the starting data.
//  - /__sim/seed (POST {table: rows}) replaces tables, /__sim/dump?table=x reads one, /__sim/counts reads request counts.
const http = require("http"); const fs = require("fs"); const path = require("path");
const PORT = Number(process.env.SIM_PORT || 54321); const U = "11111111-1111-4111-8111-111111111111", P = "22222222-2222-4222-8222-222222222222";
const N_ITEMS = Number(process.env.SIM_ITEMS || 80); const counts = {}; const started = Date.now(); let failStorage = false; let failMsg = "simulated storage failure"; let failRest = false; let missingCols = []; const selects = {}; let seq = 1000;
const uuid = () => "00000000-0000-4000-8000-" + String(++seq).padStart(12, "0");
const T = {};
T.profiles = [{ id: P, user_id: U, display_name: "Sim Collector", username: "sim_collector", profile_type: "personal", primary_focus: "Sports", avatar_emoji: "key", onboarding_completed: true, is_public: false, tier: "FULL", avatar_url: "__preset:key", created_at: "2026-01-01T00:00:00Z" }];
T.vault_items = Array.from({ length: N_ITEMS }, (_, i) => ({ id: "sim_item_" + i, profile_id: P, title: "Sim Item " + i, universe: ["MUSIC", "SPORTS", "POP_CULTURE", "MISC"][i % 4], category: "Collectors Choice", category_label: "Collectors Choice", status: "COLLECTION", created_at: 1790000000000 + i, is_public: false, purchase_price: 5 + i, current_value: i % 3 ? 10 + i : null, image_front_url: "/collectibles/" + ["guitar", "vinyl-record", "sports-slab", "movie-poster", "comic-slab"][i % 5] + ".png" }));
const now = Date.now(); const day = 86400e3;
T.seasonal_themes = [{ id: uuid(), name: "Simulated Season", slug: "sim-season", starts_at: new Date(now - 10 * day).toISOString(), ends_at: new Date(now + 20 * day).toISOString(), enabled: true, accent_color: "#ff4058", accent_secondary: "#27dc79", bg_tint: null, banner_enabled: true, banner_heading: "Simulated season", banner_subtext: "A throwaway theme for tests", banner_emoji: null, banner_cta_label: null, banner_cta_href: null, featured_category: null, accent_style: "none", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }];
T.lounge_posts = [{ id: uuid(), profile_id: "33333333-3333-4333-8333-333333333333", kind: "post", body: "A sample post from another simulated collector.", title: "Sample thread", category: "General", score: 0, comment_count: 0, hidden_at: null, created_at: new Date(now - day).toISOString() }];
T.profiles.push({ id: "33333333-3333-4333-8333-333333333333", user_id: "44444444-4444-4444-8444-444444444444", display_name: "Other Collector", username: "other_collector", profile_type: "personal", onboarding_completed: true, is_public: true, avatar_emoji: "key", tier: "FULL", created_at: "2026-01-01T00:00:00Z" });
const INITIAL = JSON.stringify(T);
const user = { id: U, aud: "authenticated", role: "authenticated", email: "sim@example.com", email_confirmed_at: "2026-01-01T00:00:00Z", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "*" };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
function rows(table) { if (table === "public_vault_items") return (T.vault_items || []).filter((r) => r.is_public === true); return (T[table] = T[table] || []); }
function cmp(a, b) { return a === b ? 0 : a === undefined || a === null ? -1 : b === undefined || b === null ? 1 : a < b ? -1 : 1; }
function filterRows(list, params) { let out = list; for (const [k, v] of params) { if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(k)) continue; const m = /^(not\.)?(eq|neq|in|is|gt|gte|lt|lte|ilike|like|cs)\.(.*)$/.exec(v); if (!m) continue; const neg = !!m[1], op = m[2], val = m[3];
    const test = (r) => { const x = r[k]; const sv = x === null || x === undefined ? "" : String(x); switch (op) { case "eq": return sv === val; case "neq": return sv !== val; case "in": return val.replace(/^\(|\)$/g, "").split(",").map((s) => s.replace(/^"|"$/g, "")).includes(sv); case "is": return val === "null" ? x === null || x === undefined : String(x) === val; case "gt": return x > Number(val) || sv > val; case "gte": return x >= Number(val) || sv >= val; case "lt": return x < Number(val) || sv < val; case "lte": return x <= Number(val) || sv <= val; case "ilike": case "like": return new RegExp("^" + val.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/%/g, ".*") + "$", "i").test(sv); default: return true; } };
    out = out.filter((r) => (neg ? !test(r) : test(r))); }
  const o = params.find(([k]) => k === "order"); if (o) { const [col, dir] = o[1].split(".").slice(0, 2); out = [...out].sort((a, b) => (dir === "desc" ? -1 : 1) * cmp(a[col], b[col])); }
  const off = Number((params.find(([k]) => k === "offset") || [])[1] || 0), lim = (params.find(([k]) => k === "limit") || [])[1]; out = out.slice(off, lim !== undefined ? off + Number(lim) : undefined); return out; }
const srv = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x"); const key = req.method + " " + url.pathname.replace(/\/[0-9a-f-]{8,}/g, "/:id"); counts[key] = (counts[key] || 0) + 1;
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  const chunks = []; req.on("data", (c) => chunks.push(c)); req.on("end", () => {
    const raw = Buffer.concat(chunks); const body = () => { try { return JSON.parse(raw.toString() || "null"); } catch { return null; } };
    const send = (code, obj, extra = {}) => { res.writeHead(code, { ...cors, "content-type": "application/json", ...extra }); res.end(obj === undefined ? "" : JSON.stringify(obj)); };
    const prefer = String(req.headers.prefer || ""); const single = /pgrst\.object/.test(req.headers.accept || "");
    const p = url.pathname;
    if (p === "/__sim/fail") { failStorage = url.searchParams.get("storage") === "1"; if (url.searchParams.has("rest")) failRest = url.searchParams.get("rest") === "1"; if (url.searchParams.get("msg")) failMsg = url.searchParams.get("msg"); return send(200, { failStorage, failMsg, failRest }); }
    if (p === "/__sim/missing-col") { missingCols = (url.searchParams.get("names") || "").split(",").filter(Boolean); return send(200, { missingCols }); }
    if (p === "/__sim/selects") return send(200, selects);
    if (p === "/__sim/reset") { for (const k of Object.keys(T)) delete T[k]; Object.assign(T, JSON.parse(INITIAL)); for (const k of Object.keys(counts)) delete counts[k]; failStorage = false; failRest = false; missingCols = []; for (const k of Object.keys(selects)) delete selects[k]; return send(200, { reset: true }); }
    if (p === "/__sim/counts") return send(200, { since: new Date(started).toISOString(), counts });
    if (p === "/__sim/dump") return send(200, rows(url.searchParams.get("table")));
    if (p === "/__sim/seed") { const b = body() || {}; for (const [t, r] of Object.entries(b)) T[t] = r; return send(200, { ok: true }); }
    if (p === "/auth/v1/user") return send(200, user);
    if (p.startsWith("/auth/v1/")) return send(200, { access_token: "x", token_type: "bearer", expires_in: 3600, refresh_token: "r", user });
    if (p.startsWith("/storage/v1/")) {
      if (/\/object\/sign\//.test(p) || /\/object\/upload\/sign/.test(p)) return send(200, { signedURL: p.replace("/object/sign/", "/object/public/") + "?token=sim", signedUrl: "http://localhost:" + PORT + p.replace("/object/sign/", "/object/public/") + "?token=sim" });
      if (/\/object\/(public|authenticated)\//.test(p) && req.method === "GET") { res.writeHead(200, { ...cors, "content-type": "image/png" }); return res.end(PNG); }
      if (/\/object\/list\//.test(p)) return send(200, []);
      if (req.method === "POST" || req.method === "PUT") { if (failStorage) return send(400, { statusCode: "403", error: "Unauthorized", message: failMsg }); return send(200, { Key: p.replace("/storage/v1/object/", ""), Id: uuid() }); }
      if (req.method === "DELETE") return send(200, []);
      return send(200, {});
    }
    if (p.startsWith("/rest/v1/rpc/")) return send(200, p.endsWith("get_launch_access_status") ? [{ capacity: 50, claimed: 16, remaining: 34, is_open: true }] : []);
    const m = /^\/rest\/v1\/([a-z0-9_]+)$/.exec(p); if (!m) return send(200, {});
    if (failRest) return send(503, { message: "simulated outage" });
    const table = m[1]; const params = [...url.searchParams.entries()]; const list = rows(table);
    const sel = url.searchParams.get("select"); if (req.method === "GET" && sel) selects[table] = sel;
    const plainCols = sel && !/[*()]/.test(sel) ? sel.split(",").map((c) => c.trim()).filter(Boolean) : null;
    if (plainCols && req.method === "GET") { const bad = plainCols.find((c) => missingCols.includes(c)); if (bad) return send(400, { code: "42703", message: "column " + bad + " does not exist" }); }
    if (req.method === "GET" || req.method === "HEAD") { const full = filterRows(list, params.filter(([k]) => k !== "limit" && k !== "offset")); let page = filterRows(list, params); if (plainCols) page = page.map((r) => Object.fromEntries(plainCols.filter((c) => c in r).map((c) => [c, r[c]]))); const hdr = { "content-range": "0-" + Math.max(0, page.length - 1) + "/" + full.length };
      if (single) return page.length ? send(200, page[0], hdr) : send(406, { code: "PGRST116", message: "no rows" }); return send(200, req.method === "HEAD" ? undefined : page, hdr); }
    if (req.method === "POST") { const b = body(); const arr = Array.isArray(b) ? b : b ? [b] : []; const conflict = (url.searchParams.get("on_conflict") || "").split(",").filter(Boolean); const merge = /merge-duplicates/.test(prefer) || conflict.length; const out = [];
      for (const r of arr) { const row = { id: r.id || (table === "lounge_posts" || table === "lounge_post_comments" ? uuid() : undefined), created_at: new Date().toISOString(), ...r }; if (row.id === undefined) delete row.id; const keys = conflict.length ? conflict : ["id"]; const ix = merge ? list.findIndex((x) => keys.every((k) => x[k] !== undefined && String(x[k]) === String(row[k]))) : -1; if (ix >= 0) { list[ix] = { ...list[ix], ...row }; out.push(list[ix]); } else { list.push(row); out.push(row); } }
      return /return=representation/.test(prefer) ? send(201, single ? out[0] : out) : send(201, undefined); }
    if (req.method === "PATCH") { const hit = filterRows(list, params); const b = body() || {}; hit.forEach((r) => Object.assign(r, b)); return /return=representation/.test(prefer) ? send(200, single ? hit[0] : hit) : send(204, undefined); }
    if (req.method === "DELETE") { const hit = new Set(filterRows(list, params)); T[table] = list.filter((r) => !hit.has(r)); return /return=representation/.test(prefer) ? send(200, [...hit]) : send(204, undefined); }
    send(200, {});
  });
});
srv.listen(PORT, () => console.log("simulated supabase on", PORT));
const dump = () => fs.writeFileSync(path.join(process.env.TRAFFIC_OUT || __dirname, "supabase-counts.json"), JSON.stringify({ since: new Date(started).toISOString(), counts }, null, 1));
setInterval(dump, 2000); process.on("SIGTERM", () => { dump(); process.exit(0); });
