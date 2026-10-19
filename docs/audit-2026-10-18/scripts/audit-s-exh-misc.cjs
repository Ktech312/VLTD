// EXH suite 9: opening someone else's exhibition in the editor (viewer / other profile / signed out), unfinished-onboarding user.
const X = require("./audit-s-exh-lib.cjs");
const { session, admin, sleep, man, rows, gdb } = X;
const R = rows();
const m = man();
const ex = JSON.parse(require("fs").readFileSync(__dirname + "/exh-created.json", "utf8"));
const PUB = m.audit.publicGalleryId, A = ex.A;
const editorControls = (S) => S.evaluate(`({ title: (document.querySelector('main h1') || {}).textContent || null, controls: ['Edit/Add','Organize','Private','Guest View','Regenerate link','Announce'].filter(l => [...document.querySelectorAll('button')].some(b => b.textContent.trim().startsWith(l))) })`);

(async () => {
  const before = { pub: (await gdb(PUB)), a: (await gdb(A)) };
  // unrelated signed-in user opens the owner's exhibition in the editor
  let S = await session("viewer");
  try {
    for (const [label, id, tag] of [["Public exhibition", PUB, "PUBLIC"], ["Private exhibition", A, "LOCKED"]]) {
      await S.visit("/museum/" + id); await sleep(9000);
      const t = (await S.text()).replace(/\s+/g, " ");
      const ec = await editorControls(S);
      R.check(/Exhibition not found/.test(t) && ec.controls.length === 0, { page: `/museum/[galleryId] | unrelated signed-in user | owner's ${label}`, control: "Opening another collector's exhibition in the editor URL", expected: "'Exhibition not found' and no editor controls", actual: `title ${ec.title}; editor controls shown: ${JSON.stringify(ec.controls)}`, evidence: await S.jshot("exh-misc-viewer-editor-" + tag), impact: "privacy/data loss", repro: "Sign in as another user, open /museum/<someone else's exhibition id>" });
      await sleep(1500);
    }
    const after = { pub: await gdb(PUB), a: await gdb(A) };
    R.check(after.pub.updated_at === before.pub.updated_at && after.a.updated_at === before.a.updated_at && JSON.stringify(after.pub.layout) === JSON.stringify(before.pub.layout), { page: "/museum/[galleryId] | unrelated signed-in user", control: "Opening another collector's exhibition changes nothing", expected: "Owner's exhibitions unchanged in the database", actual: `public updated ${before.pub.updated_at === after.pub.updated_at ? "unchanged" : "CHANGED"}; private updated ${before.a.updated_at === after.a.updated_at ? "unchanged" : "CHANGED"}`, impact: "privacy/data loss", repro: "Open the editor URL as another user; compare rows" });
  } finally { await S.close(); }
  // the same owner on the Business profile opening a Personal-profile exhibition
  S = await session("business");
  try {
    await S.visit("/museum/" + A); await sleep(9000);
    const t = (await S.text()).replace(/\s+/g, " "); const ec = await editorControls(S);
    R.check(/Exhibition not found/.test(t) && ec.controls.length === 0, { page: "/museum/[galleryId] | owner on the Business profile | a Personal-profile exhibition", control: "Opening a Personal exhibition while the Business profile is active", expected: "'Exhibition not found … belongs to another profile'; no editor", actual: `editor controls shown: ${JSON.stringify(ec.controls)}; ${t.slice(t.indexOf("MUSEUM"), t.indexOf("MUSEUM") + 120)}`, evidence: await S.jshot("exh-misc-business-editor-personal"), impact: "privacy/data loss", repro: "Switch to the Business profile, open /museum/<personal exhibition id>" });
  } finally { await S.close(); }
  // unfinished onboarding
  S = await session("onboard");
  try {
    await S.visit("/museum"); await sleep(6000);
    const p = await S.path(); const t = (await S.text()).replace(/\s+/g, " ");
    R.check(!/Sports Slabs|Vinyl Wall|Guitars|Movie Posters/.test(t), { page: "/museum | signed-in user with unfinished onboarding", control: "Exhibitions list", expected: "Redirected to onboarding or shows the user's own (empty) list; never anyone else's exhibitions", actual: p + " | " + t.slice(0, 160), evidence: await S.jshot("exh-misc-onboarding-list"), impact: "privacy/data loss", repro: "Sign in with an account that has not finished onboarding; open /museum" });
    await S.visit("/museum/new"); await sleep(5000);
    R.pass({ page: "/museum/new | signed-in user with unfinished onboarding", control: "Create page", expected: "Record only", actual: (await S.path()) + " | " + (await S.text()).replace(/\s+/g, " ").slice(0, 140), evidence: "", impact: "none" });
  } finally { await S.close(); }
  console.log("DONE misc");
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
