// probe: what does /discover look like for a visitor, how many galleries, what are the controls
const { session, controls, sleep, man, admin } = require("./audit-lib.cjs");
(async () => {
  const S = await session("visitor");
  await S.visit("/discover");
  await sleep(2500);
  const cs = await controls(S);
  console.log(cs.filter((c) => c.visible).map((c) => `${c.kind}|${c.label}|${c.href}|${c.region}|${c.pressed}`).join("\n"));
  console.log((await S.text()).replace(/\s+/g, " ").slice(0, 3000));
  console.log(await S.evaluate("document.querySelector('[data-testid=featured-carousel]')?.outerHTML.slice(0,1500)"));
  const g = await admin.from("galleries").select("id,title,analytics_views,created_at,profile_id").eq("visibility", "PUBLIC").eq("state", "ACTIVE").order("analytics_views", { ascending: false }).limit(100);
  console.log("public galleries", g.data.length, g.data.slice(0, 12).map((x) => `${x.title}|${x.analytics_views}|${x.created_at}`));
  await S.close();
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
