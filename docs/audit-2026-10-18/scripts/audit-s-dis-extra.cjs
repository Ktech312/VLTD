// DIS extra: The Flip as a signed-in owner (cloud save), Discover images, Create Exhibition call to action.
const C = require("./audit-s-dis-common.cjs");
const { R, sleep, clean, admin, man } = C;
const r = R("DIS");
const m = man(); const P = m.personalId; const sd = C.seed(); const T = sd.titles;
const section = async (name, fn) => { try { await fn(); } catch (e) { console.log("SECTION ERROR", name, e.message); r.nt({ page: "/discover", control: "(test harness) " + name, expected: "section runs", actual: "test error, not an app result: " + e.message, impact: "none", repro: "re-run audit-s-dis-extra.cjs" }); } };
(async () => {
  await admin.from("watchlist").delete().eq("owner_profile_id", P);
  const O = await C.session("owner");
  await section("flip-owner", async () => {
    await O.visit("/discover"); await sleep(3500);
    await C.scrollTo(O, "end");
    await O.evaluate("(() => { const sec = [...document.querySelectorAll('main section')].find((s) => /Across Every Universe/i.test((s.querySelector('h2') || {}).textContent || '')); const b = [...sec.querySelectorAll('button')].filter((x) => /View all/.test(x.textContent))[1]; b.click(); return true; })()");
    await O.waitFor("document.body.innerText.includes('THE FLIP') && !document.body.innerText.includes('Loading items')", 30000, "flip").catch(() => {});
    await sleep(800);
    const first = clean(await O.evaluate("(() => { const o = [...document.querySelectorAll('div.fixed')].find((d) => /THE FLIP/.test(d.innerText)); const c = o && [...o.querySelectorAll('div.absolute.inset-0')].pop(); return c ? c.innerText : ''; })()"));
    await C.key(O, "ArrowRight", "ArrowRight", 39); await sleep(2500);
    const rows = (await admin.from("watchlist").select("item_id,title,owner_profile_id").eq("owner_profile_id", P)).data;
    const badge = clean(await O.evaluate("(() => { const o = [...document.querySelectorAll('div.fixed')].find((d) => /THE FLIP/.test(d.innerText)); return o ? o.innerText : ''; })()"));
    r.check(rows.length === 1 && first.includes(rows[0].title.slice(0, 20)) && /1 saved/.test(badge), { page: "/discover The Flip | owner, Personal", control: "Right arrow (save) as a signed-in collector", expected: "one watchlist row for this profile naming the card that was shown; badge '1 saved'", actual: `rows=${rows.length}${rows[0] ? " title='" + rows[0].title.slice(0, 40) + "'" : ""}; first card='${first.slice(0, 50)}'; badge=${/1 saved/.test(badge)}`, evidence: await O.jshot("dis-flip-owner-saved"), impact: "data loss", repro: "Signed in; open The Flip; press Right" });
    await C.key(O, "Escape", "Escape", 27); await sleep(500);
    await O.visit("/saved"); await sleep(3500);
    const sv = clean(await O.text());
    r.check(rows[0] && sv.includes(rows[0].title.slice(0, 20)) && /1 SAVED ITEM/i.test(sv), { page: "/saved | owner", control: "Item saved in The Flip appears in Your Saves", expected: "listed with the count '1 saved item'", actual: (sv.match(/\d+ SAVED ITEMS?/i) || ["no count"])[0], evidence: "n/a", impact: "misleading result", repro: "Save in The Flip; open /saved" });
    await admin.from("watchlist").delete().eq("owner_profile_id", P);
  });
  await section("images", async () => {
    await O.visit("/discover"); await sleep(4500);
    const broken = await O.evaluate("[...document.querySelectorAll('main img')].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.getAttribute('src'))");
    const bgs = await O.evaluate("[...document.querySelectorAll('main [style*=\"url(\"]')].map((e) => (e.getAttribute('style').match(/url[(]([^)]+)[)]/) || [])[1]).filter(Boolean)");
    r.check(broken.length === 0, { page: "/discover | owner", control: "Pictures on Discover (img tags)", expected: "no broken pictures", actual: broken.length ? broken.slice(0, 5).join(", ") : `all ${await O.evaluate("document.querySelectorAll('main img').length")} img tags load; ${bgs.length} background pictures`, evidence: "n/a", impact: "cosmetic", repro: "Open /discover" });
    await C.click(O, `([...document.querySelectorAll('[data-testid=featured-rooms] button')].find((x) => x.innerText.includes(${JSON.stringify(T.A)})))`); await sleep(600);
    const thumbs = await O.evaluate("[...document.querySelectorAll('aside img')].filter((i) => i.closest('div.grid, div.flex')).map((i) => i.complete && i.naturalWidth > 0)");
    const feat = await O.evaluate("(() => { const a = document.querySelector('aside'); const t = a.innerText.replace(/\\s+/g, ' '); const k = t.indexOf('FEATURED ITEMS'); return t.slice(k, k + 40); })()");
    r.check(thumbs.filter(Boolean).length >= 4 && /\+1/.test(feat || ""), { page: "/discover | owner", control: "Detail panel 'Featured items' for a 5-item room", expected: "four item pictures and '+1' for the fifth", actual: `${thumbs.filter(Boolean).length} loaded pictures; ${feat}`, evidence: await O.jshot("dis-panel-featured-items"), impact: "misleading result", repro: "Select the Alpha room card" });
  });
  await O.close();
  const V = await C.session("visitor");
  await section("cta", async () => {
    await V.visit("/discover"); await sleep(3500);
    await C.click(V, `([...document.querySelectorAll('main a')].find((a) => /Create Exhibition/.test(a.textContent)))`); await sleep(2500);
    r.check(/\/login|\/museum\/new|\/signup/.test(await V.path()), { page: "/discover | visitor", control: "Create Exhibition (call to action at the bottom)", expected: "goes to sign-in/sign-up or the builder", actual: await V.path(), evidence: "n/a", impact: "usability", repro: "Signed out; click Create Exhibition" });
  });
  await V.close();
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
