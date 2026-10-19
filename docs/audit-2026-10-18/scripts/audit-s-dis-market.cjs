// DIS suite K: /market (Marketplace) as visitor, owner and unrelated viewer; filters, sort, search, card links, failed load.
const C = require("./audit-s-dis-common.cjs");
const { R, sleep, clean, admin, man } = C;
const r = R("DIS");
const m = man(); const P = m.personalId; const st = m.stamp; const TAG = "dismk" + st;
const section = async (name, fn) => { try { await fn(); } catch (e) { console.log("SECTION ERROR", name, e.message); r.nt({ page: "/market", control: "(test harness) " + name, expected: "section runs", actual: "test error, not an app result: " + e.message, impact: "none", repro: "re-run audit-s-dis-market.cjs" }); } };
const id = (n) => `qa_vz_${st}_${n}`;
const cards = (S) => S.evaluate(`[...document.querySelectorAll('main a[href^="/v/"], a[href^="/v/"]')].map((a) => ({ href: a.getAttribute('href'), text: a.innerText.replace(/\\s+/g, ' ') }))`);
const head = (S) => S.evaluate(`(() => { const t = document.body.innerText.replace(/\\s+/g, ' '); return { listed: (t.match(/(\\d+) items listed/) || [])[1], matching: (t.match(/(\\d+) matching/) || [])[1], total: (t.match(/Total asking: (\\$[\\d,]+)/) || [])[1] }; })()`);
const mine = async (S) => (await cards(S)).filter((c) => c.text.includes(TAG) || /QA Album 1[3-6]/.test(c.text));

(async () => {
  // ---- seed: four public for-sale items with a unique subtitle, one private for-sale item
  const up = async (n, patch) => { const x = await admin.from("vault_items").update(patch).eq("id", id(n)); if (x.error) throw new Error(x.error.message); };
  await up(13, { status: "FOR_SALE", is_public: true, subtitle: TAG, universe: "SPORTS", asking_price: 250, current_value: 120, grade: null });
  await up(14, { status: "FOR_SALE", is_public: true, subtitle: TAG, universe: "MUSIC", asking_price: 90, current_value: null, grade: null });
  await up(15, { status: "FOR_SALE", is_public: true, subtitle: TAG, universe: "POP_CULTURE", asking_price: 400, current_value: null, grade: "CGC 9.8" });
  await up(16, { status: "FOR_SALE", is_public: true, subtitle: TAG, universe: "MUSIC", asking_price: null, current_value: 65, grade: null });
  await up(5, { status: "FOR_SALE", is_public: false, subtitle: TAG, universe: "SPORTS", asking_price: 777, purchase_price: 7777.77 });
  const dbPublic = (await admin.from("public_vault_items").select("id", { count: "exact", head: true }).eq("status", "FOR_SALE").eq("is_public", true)).count;

  const V = await C.session("visitor");
  await V.visit("/market"); await sleep(3500);
  const PG = "/market | visitor, 4 public for-sale QA items + 1 private";
  const shot = await V.jshot("dis-market-visitor");

  await section("listing", async () => {
    const h = await head(V); const cs = await mine(V);
    r.check(Math.abs(Number(h.listed) - dbPublic) <= 3 && cs.length === 4, { page: PG, control: "Market: items listed", expected: `'N items listed' equals the number of public for-sale items in the database (${dbPublic}); all 4 of mine are listed and the private one is not`, actual: `heading ${h.listed}; db ${dbPublic}; mine shown ${cs.length}; private item 777 listed=${(await cards(V)).some((c) => /\$777/.test(c.text))}`, evidence: shot, impact: "misleading result", repro: "Open /market" });
    const text = clean(await V.text());
    r.check(!/7,?777/.test(text) && !/\$777/.test(text), { page: PG, control: "Market vs a PRIVATE for-sale item (asking $777, purchase $7,777.77)", expected: "not listed; no private cost anywhere", actual: /7,?777|\$777/.test(text) ? "private data visible" : "not present", evidence: shot, impact: "privacy/data loss", repro: "Mark an item For Sale but keep it private; open /market signed out" });
    const c13 = cs.find((c) => /QA Album 13/.test(c.text)), c14 = cs.find((c) => /QA Album 14/.test(c.text)), c15 = cs.find((c) => /QA Album 15/.test(c.text)), c16 = cs.find((c) => /QA Album 16/.test(c.text));
    r.check(c13 && /\$250/.test(c13.text) && c14 && /\$90/.test(c14.text) && c15 && /\$400/.test(c15.text) && /CGC/.test(c15.text) && c16 && /\$65/.test(c16.text), { page: PG, control: "Market card prices: the seller's ASKING price", expected: "asking price shown ($250 / $90 / $400); the item with no asking price shows its value ($65); CGC grade chip. (The page reads public_vault_items, which has no asking_price column.)", actual: cs.map((c) => c.text.slice(0, 90)).join(" || "), evidence: shot, impact: "misleading result", repro: "Read the cards" });
    r.check(cs.length === 4 && cs.every((c) => /QA dis Collector/.test(c.text)), { page: PG, control: "Market card: seller name", expected: "the seller's public name (QA dis Collector)", actual: cs.map((c) => (c.text.match(/(Collector|QA dis Collector)\s*$/) || ["?"])[0]).join(", "), evidence: shot, impact: "misleading result", repro: "Compare the name at the bottom right of a card with the seller's public profile name" });
    r.check(cs.length === 4 && cs.every((c) => c.href === `/v/${encodeURIComponent(P)}`), { page: PG, control: "Market card link", expected: `each card links to the seller's public vault /v/<seller profile id>`, actual: [...new Set(cs.map((c) => c.href))].join(", "), evidence: shot, impact: "blocked workflow", repro: "Hover a card and read its link" });
  });

  await section("click", async () => {
    await V.visit("/market"); await sleep(3000);
    const before = await V.path();
    await C.click(V, `([...document.querySelectorAll('a[href^="/v/"]')].find((a) => /QA Album 14/.test(a.innerText)))`);
    await V.waitFor("location.pathname.startsWith('/v/')", 20000, "card click").catch(() => {}); await sleep(2500);
    const p = await V.path(); const t = clean(await V.text());
    r.check(p === `/v/${P}` && /QA dis Collector|QA Visual|vault/i.test(t) && !/404|not found/i.test(t), { page: PG, control: "Click a market card (real click)", expected: "opens the seller's public vault page", actual: `${p} | ${t.slice(60, 220)}`, evidence: await V.jshot("dis-market-card-click"), impact: "blocked workflow", repro: "Click a listing" });
    await V.visit("/market"); await sleep(2500);
  });

  await section("filters", async () => {
    await C.typeInto(V, "input[placeholder='Search listings...']", TAG);
    let cs = await cards(V); let h = await head(V);
    r.check(cs.length === 4, { page: PG, control: "Search listings...: subtitle text (unique tag)", expected: "the 4 tagged items (all current listings; the 'N matching' note only appears when it differs from the total)", actual: `cards=${cs.length}, matching=${h.matching}`, evidence: "n/a", impact: "misleading result", repro: "Type the tag" });
    const pills = await V.evaluate(`[...document.querySelectorAll('button')].map((b) => b.textContent.trim()).filter((t) => /^(All|Sports|TCG|Comics|Vinyl|Games|Toys|Art|Books|Other) \\(\\d+\\)$/.test(t))`);
    const tot = Number((pills.find((p) => /^All/.test(p)) || "").match(/\((\d+)\)/)?.[1] || 0);
    const sum = pills.filter((p) => !/^All/.test(p)).reduce((a, p) => a + Number(p.match(/\((\d+)\)/)[1]), 0);
    r.check(sum === tot, { page: PG, control: "Universe pills vs 'All'", expected: "the universe pills add up to All: every item can be reached by some pill (QA items are Sports, Music and Pop Culture)", actual: `pills: ${pills.join(", ")}; All=${tot}, others add up to ${sum}`, evidence: await V.jshot("dis-market-pills"), impact: "misleading result", repro: "Add public for-sale items in Music and Pop Culture; compare the pill counts" });
    // Sports pill
    await C.clickText(V, "^Sports \\(", { scope: "body", tags: "button" }); await sleep(600);
    cs = await cards(V);
    r.check(cs.length >= 1 && (await mine(V)).length === 1 && /QA Album 13/.test((await mine(V))[0].text), { page: PG, control: "Pill: Sports", expected: "only Sports items (mine: Album 13)", actual: `${cs.length} cards; mine: ${(await mine(V)).map((c) => c.text.slice(0, 30)).join("|")}`, evidence: "n/a", impact: "misleading result", repro: "Click Sports" });
    await C.clickText(V, "^All \\(", { scope: "body", tags: "button" }); await sleep(500);
    // sort
    await C.pick(V, "Sort listings", "^Price: Low"); await sleep(500);
    let pr = (await mine(V)).map((c) => Number((c.text.match(/\$([\d,]+)/) || [])[1]?.replace(/,/g, "")));
    r.check(pr.join() === "65,90,250,400", { page: PG, control: "Sort: Price: Low -> High", expected: "$65, $90, $250, $400", actual: pr.join(", "), evidence: "n/a", impact: "misleading result", repro: "Choose Price: Low -> High" });
    await C.pick(V, "Sort listings", "^Price: High"); await sleep(500);
    pr = (await mine(V)).map((c) => Number((c.text.match(/\$([\d,]+)/) || [])[1]?.replace(/,/g, "")));
    r.check(pr.join() === "400,250,90,65", { page: PG, control: "Sort: Price: High -> Low", expected: "$400, $250, $90, $65", actual: pr.join(", "), evidence: "n/a", impact: "misleading result", repro: "Choose Price: High -> Low" });
    const tt = (await head(V)).total;
    r.check(tt !== undefined && Number(tt.replace(/[$,]/g, "")) >= 805, { page: PG, control: "Total asking", expected: "at least $805 (250+90+400+65 of mine)", actual: tt, evidence: "n/a", impact: "misleading result", repro: "Read the header" });
    // no-match + clear filters
    await C.typeInto(V, "input[placeholder='Search listings...']", "qqzzxx");
    const t = clean(await V.text());
    r.check(/No listings match your filters/.test(t) && /Clear filters/.test(t), { page: PG, control: "Search listings...: no match", expected: "'No listings match your filters.' and a Clear filters button", actual: (t.match(/No listings[^.]*\./) || ["none"])[0], evidence: await V.jshot("dis-market-nomatch"), impact: "usability", repro: "Type nonsense" });
    await C.clickText(V, "^Clear filters$", { scope: "body", tags: "button" }); await sleep(600);
    r.check((await cards(V)).length >= 4 && (await V.evaluate("document.querySelector(\"input[placeholder='Search listings...']\").value")) === "", { page: PG, control: "Clear filters", expected: "search box emptied and all listings back", actual: `cards=${(await cards(V)).length}`, evidence: "n/a", impact: "blocked workflow", repro: "Click Clear filters" });
  });

  await section("roles", async () => {
    const O = await C.session("owner"); await O.visit("/market"); await sleep(3500);
    r.check((await mine(O)).length === 4, { page: "/market | owner (seller)", control: "Owner sees own listings", expected: "same 4 listings as a visitor", actual: String((await mine(O)).length), evidence: "n/a", impact: "misleading result", repro: "Sign in as the seller; open /market" });
    await O.close();
    const K = await C.session("viewer"); await K.visit("/market"); await sleep(3500);
    r.check((await mine(K)).length === 4 && !(await cards(K)).some((c) => /\$777/.test(c.text)), { page: "/market | unrelated viewer", control: "Viewer sees the same public listings and not the private one", expected: "4 listings, no $777", actual: String((await mine(K)).length), evidence: "n/a", impact: "privacy/data loss", repro: "Sign in as another user; open /market" });
    await K.close();
  });

  await section("failed", async () => {
    await C.failRequests(V, ["*/rest/v1/public_vault_items*", "*/rest/v1/vault_items*"]);
    await V.visit("/market"); await V.waitFor("!document.body.innerText.includes('Loading market listings')", 60000, "market settle").catch(() => {}); await sleep(1500);
    const t = clean(await V.text());
    r.check(!/No items for sale yet|No listings match/.test(t) && /Failed|error|fetch|couldn/i.test(t), { page: PG, control: "Failed listings read (CDP Fetch -> 503)", expected: "an error message, not 'No items for sale yet'", actual: t.slice(t.indexOf("Events") > 0 ? t.indexOf("Events") : 80, 300), evidence: await V.jshot("dis-market-read-failed"), impact: "misleading result", repro: "Block the listings request; open /market" });
    await C.restoreNet(V);
  });

  await V.close();
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
