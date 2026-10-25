// Tests for the navigation: the desktop header (Home, Vault, Exhibitions, Insights, More), the More menu, the unchanged phone bar, Saved and Watchlist,
// active states, and that the Browse menu is gone. Reads the real source files.
//   npm run test:nav
import assert from "node:assert/strict";
import fs from "node:fs";
import { PRIMARY_NAV, DESKTOP_NAV, MORE_ITEMS, ACCOUNT_SHORTCUTS, activeMoreKey, isPrimaryNavActive, showMobileAddItem } from "../src/lib/primaryNav";

let pass = 0;
let fail = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    pass += 1;
    console.log("PASS ", name);
  } catch (e) {
    fail += 1;
    console.log("FAIL ", name, "\n      ", String((e as Error).message).split("\n")[0]);
  }
}
const desktop = (path: string) => DESKTOP_NAV.filter((i) => isPrimaryNavActive(i, path)).map((i) => i.label);
const phone = (path: string) => PRIMARY_NAV.filter((i) => isPrimaryNavActive(i, path)).map((i) => i.label);
const read = (p: string) => fs.readFileSync(p, "utf8");

test("the desktop header is Home, Vault, Exhibitions, Insights, then a More menu", () => {
  assert.deepEqual(DESKTOP_NAV.map((i) => [i.label, i.href]), [["Home", "/dashboard"], ["Vault", "/vault"], ["Exhibitions", "/museum"], ["Insights", "/portfolio"]]);
  const top = read("src/components/TopNav.tsx");
  assert.match(top, /DESKTOP_NAV\.map/);
  assert.match(top, /ariaLabel="More"/);
});
test("More holds Discover, Events, VLT Lounge, Activity and Learn at their existing URLs", () => {
  assert.deepEqual(MORE_ITEMS.map((i) => [i.label, i.href]), [["Discover", "/discover"], ["Events", "/events"], ["VLT Lounge", "/community-board"], ["Activity", "/activity"], ["Learn", "/learn"]]);
});
test("Activity is offered only to people who are signed in", () => {
  assert.deepEqual(MORE_ITEMS.filter((i) => i.signedInOnly).map((i) => i.key), ["activity"]);
  assert.match(read("src/components/TopNav.tsx"), /signedIn \|\| !item\.signedInOnly/);
});
test("More is highlighted on its pages (Marketplace and Upcoming Comics belong to Discover) and nowhere else", () => {
  assert.equal(activeMoreKey("/discover"), "discover");
  assert.equal(activeMoreKey("/market"), "discover");
  assert.equal(activeMoreKey("/upcoming"), "discover");
  assert.equal(activeMoreKey("/events"), "events");
  assert.equal(activeMoreKey("/events/anything"), "events");
  assert.equal(activeMoreKey("/community-board"), "lounge");
  assert.equal(activeMoreKey("/community-board/topic"), "lounge");
  assert.equal(activeMoreKey("/activity"), "activity");
  assert.equal(activeMoreKey("/learn"), "learn");
  assert.equal(activeMoreKey("/learn/articles"), "learn");
  for (const p of ["/dashboard", "/vault", "/portfolio", "/museum", "/saved", "/watchlist", "/account"]) assert.equal(activeMoreKey(p), null, p);
});
test("Saved and Watchlist highlight nothing in the header", () => {
  assert.deepEqual(desktop("/saved"), []);
  assert.deepEqual(desktop("/watchlist"), []);
  assert.equal(activeMoreKey("/saved"), null);
});
test("Insights highlights on /portfolio only; Vault keeps Items, For Sale, Sold, Goals and Insurance", () => {
  assert.deepEqual(desktop("/portfolio"), ["Insights"]);
  for (const p of ["/vault", "/vault/for-sale", "/vault/sold", "/goals", "/insurance", "/insurance/packet"]) assert.deepEqual(desktop(p), ["Vault"], p);
  assert.deepEqual(desktop("/dashboard"), ["Home"]);
  assert.deepEqual(desktop("/museum"), ["Exhibitions"]);
});
test("the phone bar is unchanged: Home, Vault, Exhibitions, Lounge, Discover (Insights still counts as Vault there)", () => {
  assert.deepEqual(PRIMARY_NAV.map((i) => i.label), ["Home", "Vault", "Exhibitions", "Lounge", "Discover"]);
  assert.deepEqual(phone("/portfolio"), ["Vault"]);
  for (const p of ["/discover", "/market", "/upcoming", "/events"]) assert.deepEqual(phone(p), ["Discover"], p);
  assert.deepEqual(phone("/learn"), ["Lounge"]);
});
test("the account menu still has Saved then Watchlist at the existing URLs", () => {
  assert.deepEqual(ACCOUNT_SHORTCUTS.map((i) => [i.label, i.href]), [["Saved", "/saved"], ["Watchlist", "/watchlist"]]);
  const top = read("src/components/TopNav.tsx");
  assert.match(top, /ACCOUNT_SHORTCUTS\.map/);
  assert.ok(top.indexOf("ACCOUNT_SHORTCUTS.map") < top.indexOf('<Link href="/account"'), "shortcuts come before Settings");
});
test("Discover shows Saved and Watchlist beside its search controls", () => {
  const page = read("src/app/discover/page.tsx");
  assert.match(page, /href="\/saved"/);
  assert.match(page, /href="\/watchlist"/);
  assert.ok(page.indexOf('placeholder="Search exhibitions') < page.indexOf('href="/saved"'), "after the search field");
  assert.ok(page.indexOf('href="/watchlist"') < page.indexOf('aria-label="Collector spotlight"'), "before the first section");
});
test("the Browse menu is gone everywhere, and Marketplace and Upcoming Comics link back to Discover", () => {
  assert.equal(fs.existsSync("src/components/BrowseMenu.tsx"), false);
  for (const f of ["discover", "market", "upcoming", "events", "saved", "watchlist"]) assert.doesNotMatch(read(`src/app/${f}/page.tsx`), /BrowseMenu/, f);
  for (const f of ["market", "upcoming"]) assert.match(read(`src/app/${f}/page.tsx`), /href="\/discover"/, f);
});
test("the mobile Add Item action still shows on Discover, Marketplace, Upcoming Comics, Events, Saved and Watchlist", () => {
  for (const p of ["/discover", "/market", "/upcoming", "/events", "/saved", "/watchlist"]) assert.equal(showMobileAddItem(p), true, p);
});
test("page titles are Discover, Marketplace, Upcoming Comics, Events, Saved, Watchlist", () => {
  const title = (f: string) => read(`src/app/${f}/page.tsx`).match(/<PageHeader[\s\S]*?\btitle="([^"]+)"/)?.[1];
  assert.deepEqual(["discover", "market", "upcoming", "events", "saved", "watchlist"].map(title), ["Discover", "Marketplace", "Upcoming Comics", "Events", "Saved", "Watchlist"]);
});
test("Discover has the public sections in order, with the Events and Upcoming sections linking to their pages", () => {
  const page = read("src/app/discover/page.tsx");
  const order = ['aria-label="Collector spotlight"', ">Trending Exhibitions<", ">New This Week<", "<NotableItemsSection", ">Across Every Universe<", "<MarketplaceSection", "<EventsSection", "<UpcomingComicsSection"].map((m) => page.indexOf(m));
  assert.ok(order.every((n) => n > 0), `all present: ${order}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, "in the requested order");
  assert.doesNotMatch(page, />Featured Rooms</, "the spotlight is one section, not repeated as Featured Rooms");
  const sections = read("src/components/discover/DiscoverSections.tsx");
  assert.match(sections, /href: "\/events", label: "See all events"/);
  assert.match(sections, /href: "\/upcoming", label: "Open Upcoming Comics"/);
  assert.match(sections, /href: "\/market", label: "Open Marketplace"/);
});
test("Discover's Events preview reads the same data, filter and order as the Events page", () => {
  const events = read("src/app/events/page.tsx");
  const preview = read("src/lib/events/eventPreview.ts");
  for (const fragment of ['from("collector_events")', '.eq("enabled", true)', ".gte(\"ends_at\", earliestStoredEnd", '.order("starts_at", { ascending: true })', "eventPhase("]) {
    assert.ok(events.includes(fragment.replace("earliestStoredEnd", "earliestStoredEnd")), `Events page has ${fragment}`);
    assert.ok(preview.includes(fragment.replace("earliestStoredEnd", "earliestStoredEnd(now")) || preview.includes(fragment), `preview has ${fragment}`);
  }
  assert.match(events, /from "@\/lib\/events\/eventPreview"/, "one date formatter for both");
});
test("Notable Items are real items: no exhibition cards, hidden items and cost are never read", () => {
  const page = read("src/app/discover/page.tsx");
  assert.match(page, /if \(snap\?\.hidden\) continue;/);
  assert.doesNotMatch(read("src/components/discover/DiscoverSections.tsx"), /purchase_price|purchasePrice/);
});


test("Collector supplies & services is a labelled link in Marketplace; Kickstarter and Patreon comics are labelled links in Upcoming Comics; the header and every existing URL are unchanged", () => {
  const market = read("src/app/market/page.tsx");
  assert.ok(market.includes('href="/shop"'));
  assert.match(market, /Collector supplies &amp; services/);
  const upcoming = read("src/app/upcoming/page.tsx");
  assert.ok(upcoming.includes('href="/kickstarter"'));
  assert.match(upcoming, /Kickstarter comics/);
  assert.ok(upcoming.includes('href="/patreon"'));
  assert.match(upcoming, /Patreon comics/);
  // no new header or More entry
  assert.deepEqual(DESKTOP_NAV.map((i) => i.label), ["Home", "Vault", "Exhibitions", "Insights"]);
  assert.deepEqual(MORE_ITEMS.map((i) => i.label), ["Discover", "Events", "VLT Lounge", "Activity", "Learn"]);
  for (const f of ["src/app/shop/page.tsx", "src/app/kickstarter/page.tsx", "src/app/patreon/page.tsx", "src/app/market/page.tsx", "src/app/upcoming/page.tsx"]) assert.ok(fs.existsSync(f), f + " still exists");
  // the destinations keep More (Discover) highlighted, and the phone bar's Discover
  for (const path of ["/shop", "/kickstarter", "/patreon"]) {
    assert.equal(activeMoreKey(path), "discover", path);
    assert.deepEqual(desktop(path), [], path + ": no direct header link highlighted");
    assert.deepEqual(phone(path), ["Discover"], path);
  }
});
test("/collector still redirects to Home and gets no menu entry; the Styles page gets no link", () => {
  assert.ok(read("src/app/collector/page.tsx").includes('redirect("/dashboard")'));
  const nav = JSON.stringify([PRIMARY_NAV, DESKTOP_NAV, MORE_ITEMS, ACCOUNT_SHORTCUTS]);
  assert.equal(nav.includes("/collector"), false);
  assert.equal(nav.includes("/styles"), false);
  assert.equal(read("src/app/account/page.tsx").includes('href="/styles"'), false);
});
console.log(`\n${pass} of ${pass + fail} passed`);
process.exit(fail ? 1 : 0);
