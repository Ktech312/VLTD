// Visits every page in a given state and viewport and records what it actually shows: where it ends up, errors, overflow, every control.
//   node audit-crawl.cjs <state: visitor|owner|business|viewer|onboard> <width> [--only=/path,/path] [--base=...]
const { session, controls, AUD, admin, sleep, man, fs, BASE } = require("./audit-lib.cjs");
const STATE = process.argv[2] || "visitor"; const WIDTH = Number(process.argv[3] || 1440);
const only = (process.argv.find((a) => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean);
const mobile = WIDTH < 700;
const stat = JSON.parse(fs.readFileSync(AUD + "/routes-static.json", "utf8"));
const m = man(); const A = m.audit;
const OUTF = `${AUD}/crawl-${STATE}-${WIDTH}.jsonl`;
const done = new Set(fs.existsSync(OUTF) ? fs.readFileSync(OUTF, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => !r.error).map((r) => r.requested) : []);

const SUB = {
  "/vault/item/[id]": `/vault/item/${A.itemIds[0]}`,
  "/vault/item/[id]/present": `/vault/item/${A.itemIds[0]}/present`,
  "/vault/[universe]": "/vault/sports",
  "/museum/[galleryId]": `/museum/${A.publicGalleryId}`,
  "/museum/[galleryId]/guest": `/museum/${A.publicGalleryId}/guest`,
  "/museum/share/[token]": `/museum/share/${A.publicToken}`,
  "/museum/invite/[token]": "/museum/invite/qa-invalid-token",
  "/gallery/[galleryId]": `/gallery/${A.publicGalleryId}`,
  "/u/[username]": `/u/qa_jr_p_${m.stamp}`,
  "/v/[profileId]": `/v/${m.personalId}`,
  "/share/[itemId]": `/share/${A.itemIds[8]}`,
  "/registry/[subject]": "/registry/comics",
  "/community-board/[subject]": "/community-board/comics",
  "/auction/[id]": `/auction/${A.itemIds[5]}`,
  "/wishlist/[token]": "/wishlist/qa-invalid-token",
  "/portfolio/universe/[key]": "/portfolio/universe/POP_CULTURE",
  "/portfolio/universe/[key]/category/[category]": "/portfolio/universe/POP_CULTURE/category/comics",
  "/portfolio/universe/[key]/category/[category]/subcategory/[sub]": "/portfolio/universe/POP_CULTURE/category/comics/subcategory/comics",
  "/studio/[[...tool]]": "/studio",
  "/learn/articles/[slug]": "/learn/articles/qa-nonexistent-article",
  "/clubs/[clubId]": "/clubs/00000000-0000-0000-0000-000000000000",
  "/learn/[slug]": "/learn/before-you-sell",
};
const BUSINESS_SET = ["/dashboard", "/vault", "/vault/for-sale", "/vault/sold", "/portfolio", "/goals", "/insurance", "/museum", "/account", "/account/team", "/account/workspace", "/account/roles", "/vault/add", "/discover"];
const VIEWER_EXTRA = [`/vault/item/${A.itemIds[0]}`, `/museum/${A.audit ? "" : ""}`, `/share/${A.itemIds[0]}`, `/share/${A.itemIds[8]}`, `/museum/${A.galleries.find((g) => g.title === "Vinyl Wall").id}/guest`, `/museum/${A.galleries.find((g) => g.title === "Vinyl Wall").id}`, `/museum/${A.publicGalleryId}`, `/museum/${A.publicGalleryId}/guest`, `/insurance/item?id=${A.itemIds[0]}`, `/v/${m.personalId}`, `/u/qa_jr_p_${m.stamp}`];
const ONBOARD_SET = ["/dashboard", "/vault", "/onboarding", "/museum", "/discover", "/account", "/goals", "/vault/add"];

(async () => {
  let routes = stat.pages.map((p) => ({ route: p.route, req: SUB[p.route] || p.route, dynamic: !!p.dynamic }));
  // pages whose address is a pattern we cannot fill from fixtures are found through links on their index pages
  const disc = [["/learn", /^\/learn\/[^/]+$/, "/learn/[slug]"], ["/learn/articles", /^\/learn\/articles\/[^/?#]+$/, "/learn/articles/[slug]"], ["/clubs", /^\/clubs\/[^/?#]+$/, "/clubs/[clubId]"]];
  const S = await session(STATE, { width: WIDTH, height: mobile ? 800 : 900, mobile });
  try {
    for (const [idx, re, pat] of disc) {
      if (routes.find((r) => r.route === pat && !r.req.includes("["))) continue;
      try { await S.visit(idx); const hs = await S.evaluate("[...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'))"); const h = hs.find((x) => re.test(x.split("?")[0])); const r = routes.find((x) => x.route === pat); if (r && h && r.req.includes("[")) r.req = h; } catch { /* handled below as NOT TESTED */ }
    }
    if (STATE === "business") routes = routes.filter((r) => BUSINESS_SET.includes(r.req));
    if (STATE === "onboard") routes = routes.filter((r) => ONBOARD_SET.includes(r.req));
    if (STATE === "viewer") { const extra = [...new Set(VIEWER_EXTRA.filter((x) => x && !x.endsWith("/museum/")))].map((p) => ({ route: "(viewer) " + p, req: p, dynamic: true })); routes = [...routes.filter((r) => ["/dashboard", "/vault", "/museum", "/discover", "/account", "/insurance", "/goals"].includes(r.req)), ...extra]; }
    if (only.length) routes = routes.filter((r) => only.includes(r.req));
    console.log(STATE, WIDTH, "pages to visit:", routes.length);
    for (const r of routes) {
      if (done.has(r.req)) continue;
      if (r.route === "/studio/[[...tool]]" || r.req === "/studio") { fs.appendFileSync(OUTF, JSON.stringify({ route: r.route, requested: r.req, state: STATE, width: WIDTH, note: "Sanity Studio (external CMS, separate login): not exercised" }) + "\n"); continue; }
      const rec = { route: r.route, requested: r.req, state: STATE, width: WIDTH };
      try {
        S.intercepted.length = 0; S.dialogs.length = 0;
        const settled = await S.visit(r.req);
        const info = await S.evaluate(`({ path: location.pathname + location.search, title: document.title, h1: (document.querySelector('h1,h2') || {}).innerText || '', text: document.body.innerText.length, overflowX: document.documentElement.scrollWidth > innerWidth + 1, body: document.body.innerText.replace(/\\s+/g, ' ').slice(0, 300) })`);
        const cs = await controls(S);
        const nameBase = `${STATE}-${WIDTH}-${(r.req.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root").slice(0, 70)}`;
        rec.finalPath = info.path; rec.redirected = info.path.split("?")[0] !== r.req.split("?")[0]; rec.title = info.title; rec.h1 = String(info.h1).replace(/\s+/g, " ").slice(0, 100); rec.textLen = info.text; rec.overflowX = info.overflowX; rec.bodyStart = info.body; rec.settled = settled;
        rec.consoleErrors = [...S.consoleErrors].slice(0, 8); rec.badResponses = [...S.badResponses].slice(0, 12); rec.intercepted = S.intercepted.length;
        rec.controlCounts = cs.reduce((a, c) => { a[c.kind] = (a[c.kind] || 0) + 1; return a; }, {});
        rec.controls = cs.map((c) => ({ id: c.id, kind: c.kind, label: c.label, href: c.href, target: c.target, type: c.type, disabled: c.disabled, visible: c.visible, region: c.region, pressed: c.pressed, tag: c.tag }));
        rec.shot = await S.jshot(nameBase);
      } catch (e) { rec.error = String(e.message || e).slice(0, 200); }
      fs.appendFileSync(OUTF, JSON.stringify(rec) + "\n");
      console.log(STATE, WIDTH, r.req, "->", rec.finalPath || rec.error, "| controls", rec.controls ? rec.controls.length : "-", "| errs", (rec.consoleErrors || []).length, "| bad", (rec.badResponses || []).length);
    }
  } finally { await S.close(); }
  console.log("crawl finished", STATE, WIDTH);
  process.exit(0);
})().catch((e) => { console.error("CRAWL ERR", e.message); process.exit(1); });
