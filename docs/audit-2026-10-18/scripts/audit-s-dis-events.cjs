// DIS suite E: /events (catalogue read from collector_events; the "Search beyond the catalog" lookup /api/events/search is INTERCEPTED with a synthetic handler).
const C = require("./audit-s-dis-common.cjs");
const { R, sleep, clean, admin, man } = C;
const r = R("DIS");
const m = man(); const P = m.personalId;
const section = async (name, fn) => { try { await fn(); } catch (e) { console.log("SECTION ERROR", name, e.message); r.nt({ page: "/events", control: "(test harness) " + name, expected: "section runs", actual: "test error, not an app result: " + e.message, impact: "none", repro: "re-run audit-s-dis-events.cjs" }); } };

// mirrors the page's own logic so expected numbers come from the database rows
function categoryFor(e) {
  const text = `${e.name} ${e.short_desc ?? ""} ${e.long_desc ?? ""}`.toLowerCase();
  if (text.includes("auction")) return "auction";
  if (e.relevant_universes?.includes("MUSIC")) return "music";
  if (e.relevant_universes?.includes("ART") || text.includes("art fair")) return "gallery";
  if (text.includes("drop") || text.includes("release")) return "drop";
  if (text.includes("gallery") || text.includes("museum")) return "gallery";
  if (text.includes("card show") || text.includes("sports card") || text.includes("trading card")) return "card_show";
  if (text.includes("namm") || text.includes("music") || text.includes("instrument")) return "music";
  return "convention";
}
const LEGACY = { comics: "POP_CULTURE", toys: "POP_CULTURE", sports_cards: "SPORTS", tcg: "TCG", vinyl: "MUSIC", sneakers: "JEWELRY_APPAREL", watches: "JEWELRY_APPAREL", games: "GAMES", whisky: "BUILT_BOTANY", plants: "BUILT_BOTANY", coins: "MISC", stamps: "MISC", classic_cars: "AUTOMOTIVE", automotive: "AUTOMOTIVE", art: "ART" };
const matchesQuery = (e, q) => [e.name, e.city, e.state_region, e.country, e.venue_name, e.short_desc].filter(Boolean).join(" ").toLocaleLowerCase().includes(q.trim().toLocaleLowerCase());

const SEARCH_HANDLER = function (url) {
  const u = new URL(url, location.origin); const loc = (u.searchParams.get("location") || "").toLowerCase();
  if (loc === "boom") return { status: 500, body: { message: "synthetic failure" } };
  if (loc === "nowhere") return { status: 200, body: { query: "nowhere", searchArea: "Nowhere", results: [] } };
  return { status: 200, body: { query: "QA conventions", searchArea: "Austin, TX (" + u.searchParams.get("radius") + " mi)", results: [
    { id: "qa-sug-1", title: "QA Synthetic Comic Expo", when: "Sat, Nov 7", startDate: "2026-11-07", venue: "QA Hall", location: "Austin, TX", description: "synthetic result", link: "https://example.invalid/expo", mapLink: null, ticketLink: null, thumbnail: null, source: "audit" },
    { id: "qa-sug-2", title: "QA Synthetic Card Show", when: "Sun, Nov 8", startDate: "2026-11-08", venue: "QA Arena", location: "Austin, TX", description: "synthetic result two", link: "https://example.invalid/cards", mapLink: null, ticketLink: null, thumbnail: null, source: "audit" } ] } };
};

const header = (S) => S.evaluate(`(() => { const t = document.body.innerText.replace(/\\s+/g, ' '); return { n: Number((t.match(/(\\d+) events/) || [])[1]), more: (t.match(/Show more events \\((\\d+) remaining\\)/) || [])[1] }; })()`);
const visCards = (S) => S.evaluate(`(() => { const g = document.querySelector('div.grid-cols-5'); return g ? [...g.children].map((c) => ({ name: c.innerText.replace(/\\s+/g, ' ').slice(0, 90), save: (c.querySelector('[aria-label="Save event"], [aria-label="Remove saved event"]') || {}).ariaLabel })) : []; })()`);

(async () => {
  // database truth
  let rows = []; for (let off = 0; ; off += 1000) { const x = await admin.from("collector_events").select("*").eq("enabled", true).gte("ends_at", new Date().toISOString()).order("id").range(off, off + 999); rows = rows.concat(x.data || []); if (!x.data || x.data.length < 1000) break; }
  const N = rows.length;
  const S = await C.session("visitor");
  await C.stubHandler(S, "api/events/search", SEARCH_HANDLER, null);
  await S.visit("/events"); await sleep(4000);
  const PG = "/events | visitor, 1440";
  const shot = await S.jshot("dis-events-visitor");

  await section("catalogue", async () => {
    const h = await header(S); const cs = await visCards(S);
    r.check(Math.abs(h.n - N) <= 3 && cs.length === 30 && Number(h.more) === h.n - 30, { page: PG, control: "Events: total, first page and 'Show more events'", expected: `'N events' equals the catalogue (${N} upcoming rows enabled in the database); 30 cards first; 'Show more events (N-30 remaining)'`, actual: `heading ${h.n}; db ${N}; cards ${cs.length}; remaining ${h.more}`, evidence: shot, impact: "misleading result", repro: "Open /events" });
    await C.clickText(S, "^Show more events", { scope: "body", tags: "button" }); await sleep(800);
    const cs2 = await visCards(S); const h2 = await header(S);
    r.check(cs2.length === 60 && Number(h2.more) === h.n - 60, { page: PG, control: "Show more events (click)", expected: "30 more cards (60); remaining drops by 30", actual: `cards ${cs2.length}; remaining ${h2.more}`, evidence: "n/a", impact: "usability", repro: "Click Show more events" });
    await S.visit("/events"); await sleep(3500);
  });

  await section("type", async () => {
    await C.click(S, `document.querySelector('button[aria-label="Filter by event type"]')`); await sleep(300);
    const labels = await C.menuLabels(S);
    await C.key(S, "Escape", "Escape", 27);
    r.check(labels.join("|") === "All Event Types|Conventions|Card Shows|Auctions|Drops|Gallery|Music", { page: PG, control: "Filter by event type: options", expected: "All Event Types, Conventions, Card Shows, Auctions, Drops, Gallery, Music", actual: labels.join(" | "), evidence: "n/a", impact: "usability", repro: "Open the dropdown" });
    const keys = { Conventions: "convention", "Card Shows": "card_show", Auctions: "auction", Drops: "drop", Gallery: "gallery", Music: "music" };
    const bad = [];
    for (const [lab, key] of Object.entries(keys)) {
      await C.pick(S, "Filter by event type", `^${lab}$`); await sleep(600);
      const h = await header(S); const exp = rows.filter((e) => categoryFor(e) === key).length;
      const chips = await S.evaluate(`[...document.querySelectorAll('div.grid-cols-5 > *')].map((c) => (c.querySelector('div.absolute')?.innerText || '').replace(/\\s+/g, ' ').trim()).filter(Boolean)`);
      if (h.n !== exp && !(exp === 0 && h.n === undefined)) bad.push(`${lab}: shown ${h.n}, expected ${exp}`);
      if (exp > 0 && chips.length && !chips.every((c) => c.toLowerCase() === ({ convention: "convention", card_show: "card show", auction: "auction", drop: "online drop", gallery: "gallery", music: "music" })[key])) bad.push(`${lab}: tags ${[...new Set(chips)].join("/")}`);
    }
    r.check(bad.length === 0, { page: PG, control: "Filter by event type: every type", expected: "the heading count equals the database events of that type (classified the way the page does) and every card carries that type's tag", actual: bad.length ? bad.join("; ") : "all six types consistent", evidence: await S.jshot("dis-events-type-music"), impact: "misleading result", repro: "Pick each event type; compare count and tags" });
    await C.pick(S, "Filter by event type", "^All Event Types"); await sleep(500);
  });

  await section("universe", async () => {
    await C.scrollTo(S, 0); await sleep(300);
    const fb = await S.evaluate("document.querySelector('button[aria-label=\"Filter by universe\"]').getBoundingClientRect().bottom");
    await C.click(S, `document.querySelector('button[aria-label="Filter by universe"]')`); await sleep(300);
    const menuBox = await S.evaluate("(() => { const m = document.querySelector('[role=menu]'); const b = m.getBoundingClientRect(); const last = [...m.querySelectorAll('[role=menuitemradio]')].pop().getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), vh: innerHeight, lastBottom: Math.round(last.bottom) }; })()");
    const labels = await C.menuLabels(S); await C.key(S, "Escape", "Escape", 27);
    r.check(menuBox.lastBottom <= menuBox.vh, { page: PG + " (1440x900 window, page at top)", control: "Filter by universe: the open menu", expected: "all 11 options fit on screen so each can be clicked (the menu closes if the page is scrolled)", actual: "filter button bottom at " + Math.round(fb) + "px; menu runs from " + menuBox.top + " to " + menuBox.bottom + "px in a " + menuBox.vh + "px window - the last options (Misc, Gears & Gasoline, Art) are off screen", evidence: "n/a", impact: "usability", repro: "Open /events in a 1440x900 window; open Filter by universe; try to click Art" });
    await C.scrollTo(S, 400); await sleep(500);
    r.check(labels[0] === "All Universes" && labels.length === 11, { page: PG, control: "Filter by universe: options", expected: "All Universes + the 10 universes", actual: labels.join(" | "), evidence: "n/a", impact: "usability", repro: "Open the dropdown" });
    const { UNIVERSE_LABEL } = { UNIVERSE_LABEL: null };
    const KEYS = ["POP_CULTURE", "SPORTS", "TCG", "MUSIC", "JEWELRY_APPAREL", "GAMES", "BUILT_BOTANY", "MISC", "AUTOMOTIVE", "ART"];
    const bad = [];
    for (let i = 1; i < labels.length; i++) {
      await C.pick(S, "Filter by universe", `^${labels[i].replace(/[.*+?^${}()|[\]\\&]/g, "\\$&")}$`); await sleep(500);
      const h = await header(S); const key = KEYS[i - 1];
      const exp = rows.filter((e) => e.relevant_universes?.some((u) => (LEGACY[u] ?? u) === key)).length;
      if ((h.n || 0) !== exp) bad.push(`${labels[i]}: shown ${h.n}, expected ${exp}`);
    }
    r.check(bad.length === 0, { page: PG, control: "Filter by universe: every universe", expected: "heading count equals the number of database events relevant to that universe", actual: bad.length ? bad.join("; ") : "all ten consistent", evidence: await S.jshot("dis-events-universe-last"), impact: "misleading result", repro: "Pick each universe; compare" });
    // empty universe message
    const empty = await S.evaluate("[...document.querySelectorAll('h2, div')].some((d) => /No events match these filters/.test(d.textContent) && d.children.length === 0)");
    await C.pick(S, "Filter by universe", "^All Universes"); await sleep(500);
  });

  await section("search", async () => {
    await C.typeInto(S, "input[aria-label='Search listed events']", "anaheim");
    const h = await header(S); const exp = rows.filter((e) => matchesQuery(e, "anaheim")).length;
    r.check(h.n === exp && exp > 0, { page: PG, control: "Search listed events: 'anaheim'", expected: `count equals database events whose name/city/region/country/venue/description contain it (${exp})`, actual: `shown ${h.n}`, evidence: await S.jshot("dis-events-search-anaheim"), impact: "misleading result", repro: "Type anaheim" });
    await C.pick(S, "Filter by event type", "^Card Shows$"); await sleep(500);
    const h2 = await header(S); const exp2 = rows.filter((e) => categoryFor(e) === "card_show" && matchesQuery(e, "anaheim")).length;
    r.check(h2.n === exp2, { page: PG, control: "Search + event type together (Card Shows + 'anaheim')", expected: `${exp2}`, actual: `${h2.n}`, evidence: "n/a", impact: "misleading result", repro: "Card Shows; type anaheim" });
    await C.pick(S, "Filter by event type", "^All Event Types"); await sleep(400);
    await C.typeInto(S, "input[aria-label='Search listed events']", "qqzzxx");
    const t = clean(await S.text());
    r.check(/No events match these filters/.test(t) && !/Show more events/.test(t), { page: PG, control: "Search listed events: no match", expected: "'No events match these filters...' and no 'Show more'", actual: (t.match(/No events match[^.]*\./) || ["none"])[0], evidence: await S.jshot("dis-events-nomatch"), impact: "usability", repro: "Type nonsense" });
    await C.typeInto(S, "input[aria-label='Search listed events']", "");
    r.check((await header(S)).n >= N - 3, { page: PG, control: "Search listed events: clearing", expected: "all events back", actual: String((await header(S)).n), evidence: "n/a", impact: "usability", repro: "Clear the box" });
  });

  await section("detail", async () => {
    await S.visit("/events"); await sleep(3500);
    const second = rows.slice().sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))[3];
    const card = `document.querySelectorAll('div.grid-cols-5 > *')[3]`;
    const cname = await S.evaluate(`${card}.innerText.replace(/\\s+/g, ' ')`);
    await C.click(S, card); await sleep(700);
    const hi = await S.evaluate(`(() => { const sec = [...document.querySelectorAll('section')].find((s) => /Event Highlight/i.test(s.innerText)); const a = sec && [...sec.querySelectorAll('a')].find((x) => /Event link/.test(x.textContent)); return { title: sec && sec.querySelector('h2')?.textContent, href: a && a.href, target: a && a.target, rel: a && a.rel }; })()`);
    const dbRow = rows.find((e) => hi.title === e.name);
    r.check(dbRow && cname.includes(dbRow.name.slice(0, 20)) && (hi.href === (dbRow.ticket_url || dbRow.website_url) || !hi.href) && (!hi.href || (hi.target === "_blank" && /noopener/.test(hi.rel))), { page: PG, control: "Event card click -> Event Highlight", expected: "highlight shows the clicked event; 'Event link' goes to its ticket/website URL in a new tab with rel noopener", actual: `${hi.title} | ${hi.href} | ${hi.target} ${hi.rel}`, evidence: await S.jshot("dis-events-highlight"), impact: "misleading result", repro: "Click an event card; read the Event Highlight section" });
    // featured View Event
    await C.scrollTo(S, 0);
    await C.clickText(S, "^View Event$", { scope: "body", tags: "button" }); await sleep(900);
    const hi2 = await S.evaluate(`(() => { const sec = [...document.querySelectorAll('section')].find((s) => /Event Highlight/i.test(s.innerText)); const f = document.querySelector('main h1'); return { h: sec && sec.querySelector('h2')?.textContent, feat: f && f.textContent }; })()`);
    r.check(hi2.h === hi2.feat, { page: PG, control: "Featured event: View Event", expected: "Event Highlight shows the featured event", actual: `${hi2.h} vs featured ${hi2.feat}`, evidence: "n/a", impact: "usability", repro: "Click View Event on the featured banner" });
  });

  await section("save", async () => {
    await S.visit("/events"); await sleep(3500);
    const lab = async (i) => S.evaluate(`document.querySelectorAll('div.grid-cols-5 > *')[${i}].querySelector('[aria-label="Save event"], [aria-label="Remove saved event"]').getAttribute('aria-label')`);
    const savedBtn = () => S.evaluate("[...document.querySelectorAll('button')].find((b) => /Saved Events|Showing saved/.test(b.textContent)).textContent.replace(/\\s+/g, ' ').trim()");
    const e1 = await S.evaluate("document.querySelectorAll('div.grid-cols-5 > *')[2].innerText.replace(/\\s+/g, ' ').slice(0, 60)");
    await C.click(S, `document.querySelectorAll('div.grid-cols-5 > *')[2].querySelector('[aria-label="Save event"]')`); await sleep(800);
    const l1 = await lab(2); const sb = await savedBtn();
    r.check(l1 === "Remove saved event" && /Saved Eventss*1/.test(sb), { page: PG + " (signed out)", control: "Save event (card heart)", expected: "label flips to 'Remove saved event'; Saved Events counter becomes 1", actual: `${l1}; ${sb}`, evidence: await S.jshot("dis-events-saved"), impact: "misleading result", repro: "Click the heart on an event card" });
    r.check(clean(await S.text()).includes("Saved Events") , { page: PG + " (signed out)", control: "Side panel title after saving", expected: "'Saved Events' list replaces 'Coming Up'", actual: (await S.evaluate("[...document.querySelectorAll('aside h2')].map((h) => h.textContent).join('|')")), evidence: "n/a", impact: "usability", repro: "Save an event" });
    await C.clickText(S, "Saved Events", { scope: "body", tags: "button" }); await sleep(700);
    const h = await header(S);
    r.check(h.n === 1 && /Showing saved/.test(await savedBtn()), { page: PG + " (signed out)", control: "Saved Events toggle", expected: "shows only the saved event (1) and the button reads 'Showing saved'", actual: `${h.n} events; ${await savedBtn()}`, evidence: "n/a", impact: "misleading result", repro: "Click Saved Events" });
    await S.visit("/events"); await sleep(3500);
    r.check(/Saved Eventss*1/.test(await savedBtn()), { page: PG + " (signed out)", control: "Saved event after reload (this browser)", expected: "still saved on this device", actual: await savedBtn(), evidence: "n/a", impact: "data loss", repro: "Reload" });
    await C.click(S, `document.querySelectorAll('div.grid-cols-5 > *')[2].querySelector('[aria-label="Remove saved event"]')`); await sleep(700);
    const t = await savedBtn();
    await C.clickText(S, "Saved Events", { scope: "body", tags: "button" }); await sleep(600);
    r.check(/Saved Eventss*0/.test(t) && /You haven't saved any events yet/.test(clean(await S.text())), { page: PG + " (signed out)", control: "Unsave, then the saved-only list", expected: "counter 0 and the empty message 'You haven't saved any events yet.'", actual: `${t}; message=${/You haven't saved any events yet/.test(clean(await S.text()))}`, evidence: await S.jshot("dis-events-saved-empty"), impact: "usability", repro: "Unsave; click Saved Events" });
  });

  await section("save-owner", async () => {
    const O = await C.session("owner");
    await O.visit("/events"); await sleep(3500);
    await C.click(O, `document.querySelectorAll('div.grid-cols-5 > *')[1].querySelector('[aria-label="Save event"]')`); await sleep(2500);
    const row = (await admin.from("saved_events").select("event_id,profile_id").eq("profile_id", P)).data;
    const O2 = await C.session("owner"); await O2.visit("/events"); await sleep(4000);
    const cnt = await O2.evaluate("[...document.querySelectorAll('button')].find((b) => /Saved Events|Showing saved/.test(b.textContent)).textContent.replace(/\\s+/g, ' ').trim()");
    r.check(row.length === 1 && /Saved Eventss*1/.test(cnt), { page: "/events | owner, Personal", control: "Save event as a signed-in collector (clean second browser)", expected: "one saved_events row for this profile, visible in a fresh browser", actual: `rows=${row.length}; second browser: ${cnt}`, evidence: "n/a", impact: "data loss", repro: "Sign in; save an event; open /events in another browser" });
    await O2.close();
    const B = await C.session("business"); await B.visit("/events"); await sleep(3500);
    const bc = await B.evaluate("[...document.querySelectorAll('button')].find((b) => /Saved Events|Showing saved/.test(b.textContent)).textContent.replace(/\\s+/g, ' ').trim()");
    r.check(/Saved Eventss*0/.test(bc), { page: "/events | owner, Business profile", control: "Saved events under the Business profile", expected: "0 (saves belong to the Personal profile)", actual: bc, evidence: "n/a", impact: "privacy/data loss", repro: "Switch to Business" });
    await B.close();
    await C.click(O, `document.querySelectorAll('div.grid-cols-5 > *')[1].querySelector('[aria-label="Remove saved event"]')`); await sleep(2500);
    r.check((await admin.from("saved_events").select("event_id").eq("profile_id", P)).data.length === 0, { page: "/events | owner, Personal", control: "Unsave as a signed-in collector", expected: "row removed", actual: String((await admin.from("saved_events").select("event_id").eq("profile_id", P)).data.length), evidence: "n/a", impact: "data loss", repro: "Unsave" });
    await O.close();
  });

  await section("beyond", async () => {
    await S.visit("/events"); await sleep(3500);
    await C.click(S, `document.querySelector('details summary')`); await sleep(500);
    const open = await S.evaluate("document.querySelector('details').open");
    await C.clickText(S, "^Search$", { scope: "details", tags: "button" }); await sleep(800);
    const t1 = clean(await S.text());
    r.check(open && /Enter a city or ZIP code/.test(t1) && (await C.fx2List(S)).length === 0, { page: PG, control: "Search beyond the catalog: empty city (lookup INTERCEPTED/synthetic)", expected: "asks for a city or ZIP and sends nothing", actual: `${(t1.match(/Enter a city[^.]*\./) || ["none"])[0]}; requests=${(await C.fx2List(S)).length}`, evidence: await S.jshot("dis-events-beyond-empty"), impact: "usability", repro: "Open Search beyond the catalog; Search with the box empty" });
    await C.typeInto(S, "details input[placeholder='San Diego or 92101']", "Austin");
    await C.pick(S, "Category", "^Auctions"); await C.pick(S, "Range", "^250 miles"); await C.pick(S, "Date", "^This month");
    await C.clickText(S, "^Search$", { scope: "details", tags: "button" }); await sleep(1800);
    const req = (await C.fx2List(S)).pop(); const t2 = clean(await S.text());
    const q = req ? new URL("http://x" + req.url).searchParams : null;
    r.check(q && q.get("location") === "Austin" && q.get("category") === "auction" && q.get("radius") === "250" && q.get("dateRange") === "this_month" && /QA Synthetic Comic Expo/.test(t2) && /QA Synthetic Card Show/.test(t2), { page: PG, control: "Search beyond the catalog: Austin / Auctions / 250 miles / This month (INTERCEPTED: synthetic results, no external lookup)", expected: "the request carries the four chosen values; both synthetic suggestions are listed with a search summary", actual: `${req && req.url} | results shown=${/QA Synthetic Comic Expo/.test(t2) && /QA Synthetic Card Show/.test(t2)} | ${(t2.match(/Search: [^S]*/) || ["no summary"])[0].slice(0, 70)}`, evidence: await S.jshot("dis-events-beyond-results"), impact: "misleading result", repro: "Fill the four fields; Search" });
    const links = await S.evaluate(`[...document.querySelectorAll('details a')].filter((a) => /Open/.test(a.textContent)).map((a) => ({ href: a.href, target: a.target, rel: a.rel }))`);
    r.check(links.length === 2 && links.every((l) => l.target === "_blank" && /noopener/.test(l.rel)), { page: PG, control: "Suggestion 'Open' links", expected: "new tab with rel noopener", actual: JSON.stringify(links).slice(0, 220), evidence: "n/a", impact: "usability", repro: "Inspect the Open links" });
    await C.click(S, `([...document.querySelectorAll('details button')].find((b) => b.textContent.trim() === 'Save'))`); await sleep(500);
    const sv = await S.evaluate("[document.querySelector('details') && [...document.querySelectorAll('details button')].some((b) => b.textContent.trim() === 'Saved'), localStorage.getItem('vltd_event_search_saved_v1')]");
    r.check(sv[0] === true && /qa-sug-1/.test(sv[1] || ""), { page: PG, control: "Save a suggestion", expected: "button reads 'Saved'; stored on this device", actual: JSON.stringify(sv), evidence: "n/a", impact: "usability", repro: "Click Save on a suggestion" });
    await C.typeInto(S, "details input[placeholder='San Diego or 92101']", "Nowhere");
    await C.clickText(S, "^Search$", { scope: "details", tags: "button" }); await sleep(1500);
    r.check(/No event suggestions found/.test(clean(await S.text())), { page: PG, control: "Search beyond the catalog: zero results", expected: "'No event suggestions found. Try another ZIP or category.'", actual: (clean(await S.text()).match(/No event suggestions[^.]*\./) || ["none"])[0], evidence: "n/a", impact: "usability", repro: "Search a place with no results" });
    await C.typeInto(S, "details input[placeholder='San Diego or 92101']", "Boom");
    await C.clickText(S, "^Search$", { scope: "details", tags: "button" }); await sleep(1500);
    const t3 = clean(await S.text());
    r.check(/synthetic failure|Event search failed/.test(t3) && !/QA Synthetic Comic Expo/.test(t3), { page: PG, control: "Search beyond the catalog: server error", expected: "an error message and the previous results cleared", actual: (t3.match(/(synthetic failure|Event search failed[^.]*\.)/) || ["none"])[0] + `; old results cleared=${!/QA Synthetic Comic Expo/.test(t3)}`, evidence: await S.jshot("dis-events-beyond-error"), impact: "misleading result", repro: "Make the lookup fail" });
    // Enter key submits
    await C.typeInto(S, "details input[placeholder='San Diego or 92101']", "Austin");
    const n0 = (await C.fx2List(S)).length;
    await C.key(S, "Enter", "Enter", 13); await sleep(1500);
    r.check((await C.fx2List(S)).length === n0 + 1, { page: PG, control: "Enter key in the city box", expected: "runs the search", actual: `requests ${n0} -> ${(await C.fx2List(S)).length}`, evidence: "n/a", impact: "usability", repro: "Type a city; press Enter" });
  });

  await section("failed", async () => {
    await C.failRequests(S, ["*/rest/v1/collector_events*"]);
    await S.visit("/events"); await S.waitFor("!document.body.innerText.includes('Loading events')", 60000, "events settle").catch(() => {}); await sleep(1500);
    const t = clean(await S.text());
    r.check(!/No events match these filters/.test(t) && /Failed|error|fetch/i.test(t), { page: PG, control: "Failed catalogue read (CDP Fetch -> 503)", expected: "an error message, not 'No events match these filters'", actual: (t.match(/(No events match[^.]*\.|TypeError[^A]*)/) || ["none"])[0].slice(0, 90), evidence: await S.jshot("dis-events-read-failed"), impact: "misleading result", repro: "Block the events request; open /events" });
    await C.restoreNet(S);
  });
  await S.close();

  // phone
  const M = await C.session("visitor", { width: 390, height: 844, mobile: true });
  await M.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await M.visit("/events"); await sleep(4000);
  const ov = await M.evaluate("(() => { const sc = document.querySelector('.vltd-content-wrap'); return { sc: sc.scrollWidth, w: innerWidth, rows: document.querySelectorAll('div.md\\\\:hidden.space-y-2 > *').length, desk: document.querySelectorAll('div.grid-cols-5 > *').length && getComputedStyle(document.querySelector('div.grid-cols-5')).display }; })()");
  r.check(ov.sc <= ov.w + 1 && ov.rows >= 30, { page: "/events | visitor, 390 phone (browser-emulated)", control: "Phone layout", expected: "no sideways scroll; compact event rows (30); desktop grid hidden", actual: JSON.stringify(ov), evidence: await M.jshot("dis-events-390"), impact: "usability", repro: "Open /events at 390 px" });
  const rowSave = await M.evaluate(`(() => { const row = document.querySelector('div.md\\\\:hidden.space-y-2 > *'); const b = row.querySelector('[aria-label="Save event"]'); const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })()`);
  r.check(rowSave.w >= 40 && rowSave.h >= 40, { page: "/events | visitor, 390 phone (browser-emulated)", control: "Save heart touch target on an event row", expected: "at least 40 x 40 px", actual: JSON.stringify(rowSave), evidence: "n/a", impact: "usability", repro: "Measure the heart" });
  await M.close();
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
