// Read-only: what a scheduled event refresh saved. Lists the collector_events rows created or updated since a time (UTC), with the totals, so they can be compared with
// the run's own log line ({inserted, updated, ...}). Nothing is written.
//   AUDIT_MANIFEST=<any manifest> node check-refresh-run.cjs <since ISO, e.g. 2026-10-23T12:55:00Z> [<until ISO>]
const path = require("path");
const L = require(path.join(__dirname, "..", "..", "scripts", "audit-lib.cjs"));
const since = process.argv[2];
const until = process.argv[3] || new Date().toISOString();
if (!since) { console.error("usage: node check-refresh-run.cjs <since ISO> [until ISO]"); process.exit(2); }
(async () => {
  const cols = "slug,name,starts_at,ends_at,city,state_region,country,image_url,is_featured,enabled,created_at,updated_at,relevant_universes";
  const created = (await L.admin.from("collector_events").select(cols).gte("created_at", since).lte("created_at", until).order("created_at")).data || [];
  const touched = (await L.admin.from("collector_events").select(cols).gte("updated_at", since).lte("updated_at", until).order("updated_at")).data || [];
  const updatedOnly = touched.filter((r) => !created.some((c) => c.slug === r.slug));
  const total = (await L.admin.from("collector_events").select("slug", { count: "exact", head: true })).count;
  const upcoming = (await L.admin.from("collector_events").select("slug", { count: "exact", head: true }).gte("ends_at", new Date().toISOString())).count;
  const show = (r) => `${r.slug} | ${r.name.slice(0, 40)} | ${r.starts_at.slice(0, 10)}..${r.ends_at.slice(0, 10)} | ${r.city || ""} ${r.state_region || ""} | feat=${r.is_featured} | img=${r.image_url ? "yes" : "no"} | created ${r.created_at.slice(11, 19)} updated ${r.updated_at.slice(11, 19)}`;
  console.log(`window ${since} .. ${until}`);
  console.log(`created in window: ${created.length}; updated (not created) in window: ${updatedOnly.length}; table total ${total}, upcoming ${upcoming}`);
  console.log("--- created"); created.forEach((r) => console.log(show(r)));
  console.log("--- updated"); updatedOnly.forEach((r) => console.log(show(r)));
  // repeats the refresh should never have made: the same normalised name starting within 3 days
  const norm = (n) => n.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/\b(19|20)\d{2}\b/g, " ").replace(/^\s*the\s+/, "").replace(/[^a-z0-9]+/g, "");
  const all = (await L.admin.from("collector_events").select("slug,name,starts_at,city").gte("ends_at", new Date().toISOString()).limit(5000)).data || [];
  const dups = [];
  for (const c of created) for (const o of all) if (o.slug !== c.slug && norm(o.name) === norm(c.name) && Math.abs(Date.parse(o.starts_at) - Date.parse(c.starts_at)) <= 3 * 864e5) dups.push(`${c.slug} ~ ${o.slug}`);
  console.log(`--- possible repeats of the new rows: ${dups.length}`); dups.forEach((d) => console.log(d));
  process.exit(0);
})();
