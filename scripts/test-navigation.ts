// Tests for the Discover navigation: the Browse menu on the four public pages, Saved and Watchlist in the Account menu, and the active states.
//   npm run test:nav
import assert from "node:assert/strict";
import fs from "node:fs";
import { PRIMARY_NAV, BROWSE_ITEMS, ACCOUNT_SHORTCUTS, isPrimaryNavActive, showMobileAddItem } from "../src/lib/primaryNav";

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
const active = (path: string) => PRIMARY_NAV.filter((i) => isPrimaryNavActive(i, path)).map((i) => i.label);
const read = (p: string) => fs.readFileSync(p, "utf8");

test("Discover is highlighted on its four public pages (and their sub-paths)", () => {
  for (const p of ["/discover", "/market", "/upcoming", "/events"]) assert.deepEqual(active(p), ["Discover"], p);
  assert.deepEqual(active("/events/anything"), ["Discover"]);
});
test("Saved and Watchlist do not highlight Discover (or anything else in the main bar)", () => {
  assert.deepEqual(active("/saved"), []);
  assert.deepEqual(active("/watchlist"), []);
});
test("the other destinations still highlight as before", () => {
  assert.deepEqual(active("/dashboard"), ["Home"]);
  assert.deepEqual(active("/vault/sold"), ["Vault"]);
  assert.deepEqual(active("/portfolio"), ["Vault"]);
  assert.deepEqual(active("/museum"), ["Exhibitions"]);
  assert.deepEqual(active("/learn"), ["Lounge"]);
});
test("Browse lists the four public destinations at their existing URLs", () => {
  assert.deepEqual(
    BROWSE_ITEMS.map((i) => [i.label, i.href]),
    [["Public collections", "/discover"], ["Marketplace", "/market"], ["Upcoming Comics", "/upcoming"], ["Events", "/events"]],
  );
});
test("the Account menu gets Saved then Watchlist at the existing URLs", () => {
  assert.deepEqual(ACCOUNT_SHORTCUTS.map((i) => [i.label, i.href]), [["Saved", "/saved"], ["Watchlist", "/watchlist"]]);
});
test("the mobile Add Item action still shows on all six pages", () => {
  for (const p of ["/discover", "/market", "/upcoming", "/events", "/saved", "/watchlist"]) assert.equal(showMobileAddItem(p), true, p);
});
test("page titles are Discover, Marketplace, Upcoming Comics, Events, Saved, Watchlist", () => {
  const title = (f: string) => read(`src/app/${f}/page.tsx`).match(/<PageHeader[\s\S]*?\btitle="([^"]+)"/)?.[1];
  assert.deepEqual(["discover", "market", "upcoming", "events", "saved", "watchlist"].map(title), ["Discover", "Marketplace", "Upcoming Comics", "Events", "Saved", "Watchlist"]);
});
test("each of the four public pages shows Browse with itself marked; Saved and Watchlist show none", () => {
  const cur = (f: string) => read(`src/app/${f}/page.tsx`).match(/<BrowseMenu current="(\w+)"/)?.[1];
  assert.deepEqual(["discover", "market", "upcoming", "events"].map(cur), ["discover", "market", "upcoming", "events"]);
  assert.equal(cur("saved"), undefined);
  assert.equal(cur("watchlist"), undefined);
});
test("the six-button row is gone from every page", () => {
  for (const f of ["discover", "market", "upcoming", "events", "saved", "watchlist"]) assert.doesNotMatch(read(`src/app/${f}/page.tsx`), /DiscoverNav/, f);
  assert.doesNotMatch(read("src/components/SectionNav.tsx"), /DiscoverNav|DISCOVER_ITEMS/);
});
test("the Account menu reads its Saved and Watchlist rows from the shared list, above Settings", () => {
  const top = read("src/components/TopNav.tsx");
  assert.match(top, /ACCOUNT_SHORTCUTS\.map/);
  assert.ok(top.indexOf("ACCOUNT_SHORTCUTS.map") < top.indexOf('<Link href="/account"'), "shortcuts come before Settings");
});

console.log(`\n${pass} of ${pass + fail} passed`);
process.exit(fail ? 1 : 0);
