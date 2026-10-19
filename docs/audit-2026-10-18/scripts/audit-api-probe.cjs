// Legacy /api/vault/[id] route: reachable? persistent? used? Confirmed by reading the code first (in-memory only, no callers): this probe uses ONLY a synthetic payload and removes it again.
const { R, BASE } = require("./audit-lib.cjs");
const r = R("CRW");
(async () => {
  const id = "qa-audit-api-probe-" + Date.now().toString(36);
  const call = async (method, body) => { const res = await fetch(`${BASE}/api/vault/${id}`, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); let j = null; try { j = await res.json(); } catch {} return { status: res.status, json: j }; };
  const post = await call("POST", { item: { id, title: "synthetic audit probe (no real data)" } });
  const bad = await call("POST", {});
  const get = await call("GET");
  const del = await call("DELETE");
  console.log(JSON.stringify({ post, bad, get, del }));
  r.check(false, { page: "/api/vault/[id] | anonymous caller, synthetic payload only", control: "legacy POST/DELETE API route", expected: "an endpoint that writes should refuse an anonymous caller, or not exist", actual: `Reachable without any sign-in: POST with a synthetic item answered HTTP ${post.status} ${JSON.stringify(post.json)}; POST with no item ${bad.status}; GET ${get.status} (no read endpoint exists, so persistence cannot be read back); DELETE ${del.status} ${JSON.stringify(del.json)}. Code (read before probing): the route only keeps the item in process memory (globalThis array) of whichever server instance answers: no database, no file, lost on restart or when another instance answers. Callers: none in src, public, scripts, supabase or tests. Verdict: genuinely reachable; NOT durable and NOT readable by anyone through the app; NOT used by the app. Risk is limited to unauthenticated memory use on the server, not data exposure or loss. The synthetic id was deleted again.`, evidence: "src/app/api/vault/[id]/route.ts", impact: "improvement", repro: `curl -X POST ${BASE}/api/vault/<id> -d '{"item":{"id":"<id>"}}' (anonymous)` });
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
