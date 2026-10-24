// Tests for the Wishlist / Pull List / Following rules: unknown stays unknown, planned totals, grouping, recurring pulls (exact series, standard covers only,
// no copies, edits kept, skipped stay skipped, delayed dates), paused rules, quantity changes, acquisition (actual cost, partial quantities, no duplicate
// Vault records, a failed save changes nothing), merging with a database that has not been upgraded, and the public share fields.
//   npm run test:wants
import assert from "node:assert/strict";

// A small simulated browser, so the real Vault code can run.
const store = new Map<string, string>();
const ls = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};
const listeners: Record<string, Array<() => void>> = {};
const win = {
  localStorage: ls,
  sessionStorage: ls,
  addEventListener: (t: string, f: () => void) => { (listeners[t] ??= []).push(f); },
  removeEventListener: () => undefined,
  dispatchEvent: (e: { type: string }) => { (listeners[e.type] ?? []).forEach((f) => f()); return true; },
  location: { origin: "http://test", pathname: "/", search: "" },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  navigator: { onLine: true },
};
Object.assign(globalThis, { window: win, localStorage: ls, sessionStorage: ls, document: { documentElement: { style: { setProperty() {}, removeProperty() {} }, setAttribute() {}, removeAttribute() {}, hasAttribute: () => false }, addEventListener() {}, visibilityState: "visible" } });
try { Object.defineProperty(globalThis, "navigator", { value: { onLine: true, userAgent: "test" }, configurable: true }); } catch { /* already set */ }
(globalThis as unknown as { Event: unknown }).Event = class { type: string; constructor(t: string) { this.type = t; } };
(globalThis as unknown as { CustomEvent: unknown }).CustomEvent = (globalThis as unknown as { Event: unknown }).Event;

store.set("vltd_active_profile_id_v1", "p1");
let pass = 0;
let fail = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    pass += 1;
    console.log("PASS ", name);
  } catch (e) {
    fail += 1;
    console.log("FAIL ", name, "\n      ", String((e as Error).message).split("\n")[0]);
  }
}

(async () => {
  const core = await import("../src/lib/wantsCore");
  const model = await import("../src/lib/wishlistModel");
  type W = import("../src/lib/wishlistModel").WishlistItem;
  const now = Date.UTC(2026, 9, 24, 12);
  const base = (over: Partial<W>): W => ({ id: "w1", title: "Thing", createdAt: now, status: "want", ...over });

  await test("a blank, text or negative price is unknown (undefined), never $0; a real price is kept", () => {
    assert.equal(core.parsePrice(""), undefined);
    assert.equal(core.parsePrice("abc"), undefined);
    assert.equal(core.parsePrice("-3"), undefined);
    assert.equal(core.parsePrice(undefined), undefined);
    assert.equal(core.parsePrice("$1,234.5"), 1234.5);
    assert.equal(core.parsePrice("0"), 0);
  });
  await test("quantity is a whole number from 1 to 99", () => {
    assert.equal(core.clampQuantity("0"), 1);
    assert.equal(core.clampQuantity(2.9), 2);
    assert.equal(core.clampQuantity(500), 99);
    assert.equal(core.clampQuantity("x"), 1);
  });
  await test("release label: an exact day, a window, or 'Date unknown' (never today)", () => {
    assert.equal(core.releaseLabel({ releaseDate: "2026-11-12" }, new Date(now)), "Thu, Nov 12");
    assert.equal(core.releaseLabel({ releaseWindow: "Q1 2027" }, new Date(now)), "Window: Q1 2027");
    assert.equal(core.releaseLabel({}, new Date(now)), "Date unknown");
    assert.equal(core.releaseLabel({ releaseDate: "not a date" }, new Date(now)), "Date unknown");
  });
  await test("planned total = known prices x copies still to get; unpriced wants are counted separately, acquired and skipped add nothing", () => {
    const items = [
      base({ id: "a", price: 4.99, quantity: 2 }),
      base({ id: "b", price: 143 }),
      base({ id: "c" }), // no price
      base({ id: "d", price: 50, status: "acquired", quantity: 1, quantityAcquired: 1 }),
      base({ id: "e", price: 20, status: "skipped" }),
      base({ id: "f", price: 10, quantity: 3, quantityAcquired: 1 }), // 2 left
    ];
    const t = core.plannedTotals(items);
    assert.equal(t.total, 4.99 * 2 + 143 + 20);
    assert.equal(t.priced, 3);
    assert.equal(t.unpriced, 1);
  });
  await test("the target price never counts toward the planned total", () => {
    const t = core.plannedTotals([base({ targetPrice: 100 })]);
    assert.deepEqual(t, { total: 0, priced: 0, unpriced: 1 });
  });
  await test("Pull List groups: passed dates, each month, windows; wants with neither stay off it; acquired and skipped are not listed", () => {
    const items = [
      base({ id: "1", releaseDate: "2026-11-12", price: 5 }),
      base({ id: "2", releaseDate: "2026-12-06", price: 28 }),
      base({ id: "3", releaseWindow: "Q1 2027", price: 143 }),
      base({ id: "4" }),
      base({ id: "5", releaseDate: "2026-10-01" }),
      base({ id: "6", releaseDate: "2026-11-20", status: "skipped" }),
      base({ id: "7", releaseDate: "2026-11-21", status: "acquired", quantityAcquired: 1 }),
    ];
    const g = core.groupPullList(items, new Date(now));
    assert.deepEqual(g.map((x) => x.label), ["Release date has passed", "November 2026", "December 2026", "Q1 2027 (window)"]);
    assert.deepEqual(g.flatMap((x) => x.items.map((i) => i.id)), ["5", "1", "2", "3"]);
    assert.equal(g[1].total, 5);
  });

  // ---- following -----------------------------------------------------------
  const rule = (over: Partial<import("../src/lib/wantsCore").PullRule> = {}): import("../src/lib/wantsCore").PullRule => ({
    id: "rule1", kind: "comic_series", name: "Night Courier", publisher: "Example Comics", yearBegan: 2026, source: "metron", sourceKey: "metron:series:77",
    quantity: 1, variantPolicy: "standard", state: "following", createdAt: now, ...over,
  });
  const rel = (n: string, over: Partial<import("../src/lib/wantsCore").CatalogRelease> = {}): import("../src/lib/wantsCore").CatalogRelease => ({
    identity: `metron:issue:${n}`, seriesKey: "metron:series:77", title: `Night Courier #${n}`, number: n, date: "2026-11-12", variant: false, edition: "Standard cover", externalId: n, ...over,
  });
  await test("a refresh adds each standard release once, with the rule's quantity, its source identity and a known date", () => {
    const p = core.planRuleRefresh(rule({ quantity: 2 }), [rel("4"), rel("5", { date: "2026-12-10" })], [], now);
    assert.equal(p.add.length, 2);
    assert.deepEqual(p.add.map((w) => [w.title, w.quantity, w.releaseDate, w.sourceIdentity]), [["Night Courier #4", 2, "2026-11-12", "metron:issue:4"], ["Night Courier #5", 2, "2026-12-10", "metron:issue:5"]]);
    assert.equal(p.add[0].status, "want");
  });
  await test("re-running a refresh creates no copies (same ids, nothing to add the second time)", () => {
    const first = core.planRuleRefresh(rule(), [rel("4")], [], now);
    const second = core.planRuleRefresh(rule(), [rel("4")], first.add, now);
    assert.equal(second.add.length, 0);
    assert.equal(second.update.length, 0);
    assert.equal(core.wantIdForIdentity("metron:issue:4"), first.add[0].id);
  });
  await test("an existing catalog pick from Upcoming Comics (source metron + external id) counts as already there", () => {
    const old = base({ id: "metron_4_abcd1234", title: "Night Courier #4", source: "metron", externalId: "4" });
    const p = core.planRuleRefresh(rule(), [rel("4")], [old], now);
    assert.equal(p.add.length, 0);
  });
  await test("a skipped release is never brought back, and a person's edits are kept", () => {
    const skipped = base({ id: "x", sourceIdentity: "metron:issue:4", status: "skipped", releaseDate: "2026-11-12" });
    const edited = base({ id: "y", sourceIdentity: "metron:issue:5", quantity: 3, edition: "Cover B", edited: ["quantity", "edition"], releaseDate: "2026-12-10" });
    const p = core.planRuleRefresh(rule(), [rel("4"), rel("5", { date: "2026-12-10" })], [skipped, edited], now);
    assert.equal(p.add.length, 0);
    assert.equal(p.update.length, 0, "no field of the edited or skipped selection is rewritten");
  });
  await test("a delayed release updates the existing selection's date, unless the person set the date themselves", () => {
    const a = base({ id: "a", sourceIdentity: "metron:issue:4", releaseDate: "2026-11-12", quantity: 2 });
    const b = base({ id: "b", sourceIdentity: "metron:issue:5", releaseDate: "2026-12-10", edited: ["releaseDate"] });
    const p = core.planRuleRefresh(rule(), [rel("4", { date: "2026-11-26" }), rel("5", { date: "2027-01-07" })], [a, b], now);
    assert.deepEqual(p.update.map((u) => [u.id, u.patch.releaseDate]), [["a", "2026-11-26"]]);
    assert.equal(p.add.length, 0);
  });
  await test("only the exact series matches: a similar name in another series is ignored", () => {
    const p = core.planRuleRefresh(rule(), [rel("4"), rel("1", { seriesKey: "metron:series:99", title: "Night Courier Annual #1" })], [], now);
    assert.deepEqual(p.add.map((w) => w.title), ["Night Courier #4"]);
    assert.equal(p.matched, 1);
  });
  await test("variants are offered as suggestions and never added on their own", () => {
    const p = core.planRuleRefresh(rule(), [rel("4"), rel("4B", { variant: true, edition: "Variant cover" })], [], now);
    assert.equal(p.add.length, 1);
    assert.deepEqual(p.suggestions.map((s) => s.identity), ["metron:issue:4B"]);
  });
  await test("a paused or stopped rule, or a manual rule, adds and changes nothing", () => {
    for (const r of [rule({ state: "paused" }), rule({ state: "stopped" }), rule({ source: "manual", sourceKey: undefined })]) {
      const p = core.planRuleRefresh(r, [rel("4")], [], now);
      assert.deepEqual([p.add.length, p.update.length, p.suggestions.length], [0, 0, 0]);
    }
  });
  await test("a release with no date from the catalog is added with an unknown date (not today)", () => {
    const p = core.planRuleRefresh(rule(), [rel("6", { date: null })], [], now);
    assert.equal(p.add[0].releaseDate, undefined);
    assert.equal(core.releaseLabel(p.add[0], new Date(now)), "Date unknown");
  });

  // ---- acquisition ------------------------------------------------------
  await test("receiving part of the quantity keeps the want open ('1 of 2'); the last copy makes it Acquired; the same ids never count twice", () => {
    const w = base({ quantity: 2, status: "preordered" });
    const one = core.withAcquired(w, ["vault_acq_w1_1"], now);
    assert.deepEqual([one.status, one.quantityAcquired], ["preordered", 1]);
    const again = core.withAcquired(one, ["vault_acq_w1_1"], now);
    assert.equal(again, one);
    const two = core.withAcquired(one, ["vault_acq_w1_2"], now);
    assert.deepEqual([two.status, two.quantityAcquired], ["acquired", 2]);
  });
  await test("skipping keeps the record (with the time) and can be undone", () => {
    const s = core.withStatus(base({}), "skipped", now);
    assert.deepEqual([s.status, s.skippedAt], ["skipped", now]);
    const back = core.withStatus(s, "want", now + 1);
    assert.equal(back.skippedAt, undefined);
  });

  const acq = await import("../src/lib/wantAcquire");
  const vault = await import("../src/lib/vaultModel");
  await test("acquiring asks for the real cost: unknown stays unknown, and neither the target nor the expected price is used", async () => {
    const w = base({ id: "wa", title: "Night Courier #4", targetPrice: 3, price: 4.99, quantity: 1, universe: "POP_CULTURE", category: "Comics", edition: "Cover B" });
    const r = await acq.acquireCopies(w, { count: 1, profileId: "p1", now });
    assert.ok(r.ok, r.ok ? "" : r.reason);
    if (!r.ok) return;
    const saved = vault.loadItems().find((i) => i.id === r.itemIds[0]);
    assert.ok(saved, "the Vault record exists");
    assert.equal(saved!.purchasePrice, undefined, "cost unknown, not $3 and not $4.99");
    assert.equal(saved!.currentValue, undefined);
    assert.equal(saved!.edition, "Cover B");
    assert.equal(r.want.status, "acquired");
  });
  await test("acquiring with a real cost stores exactly that", async () => {
    const w = base({ id: "wb", title: "Toy", quantity: 1 });
    const r = await acq.acquireCopies(w, { count: 1, paidEach: 24.5, profileId: "p1", now });
    assert.ok(r.ok, r.ok ? "" : r.reason);
    if (!r.ok) return;
    assert.equal(vault.loadItems().find((i) => i.id === r.itemIds[0])!.purchasePrice, 24.5);
  });
  await test("a second save of the same copy does not create a second Vault record; partial copies number on", async () => {
    const w = base({ id: "wc", title: "Box set", quantity: 2 });
    const first = await acq.acquireCopies(w, { count: 1, paidEach: 10, profileId: "p1", now });
    assert.ok(first.ok, first.ok ? "" : first.reason);
    if (!first.ok) return;
    assert.equal(first.want.status, "want");
    assert.equal(first.want.quantityAcquired, 1);
    const before = vault.loadItems().length;
    const retry = await acq.acquireCopies(w, { count: 1, paidEach: 10, profileId: "p1", now }); // the want was not updated: a retry of the same copy
    assert.ok(retry.ok, retry.ok ? "" : retry.reason);
    if (!retry.ok) return;
    assert.equal(vault.loadItems().length, before, "no duplicate record");
    assert.equal(retry.created, 0);
    const second = await acq.acquireCopies(first.want, { count: 1, paidEach: 12, profileId: "p1", now });
    assert.ok(second.ok, second.ok ? "" : second.reason);
    if (!second.ok) return;
    assert.equal(second.want.status, "acquired");
    assert.equal(vault.loadItems().length, before + 1);
  });
  await test("more copies than are still wanted is refused and nothing is saved", async () => {
    const w = base({ id: "wd", quantity: 1 });
    const before = vault.loadItems().length;
    const r = await acq.acquireCopies(w, { count: 2, profileId: "p1", now });
    assert.equal(r.ok, false);
    assert.equal(vault.loadItems().length, before);
  });

  // ---- storing and merging -----------------------------------------------
  await test("a database without the new columns never turns an Acquired or Skipped want back into Wanted, and keeps its other local details", () => {
    const local = base({ status: "acquired", quantity: 2, quantityAcquired: 2, edition: "Cover B", acquiredItemIds: ["a", "b"] });
    const remote = base({ status: "want" });
    const merged = model.mergeRemote(local, remote, false);
    assert.deepEqual([merged.status, merged.quantity, merged.edition], ["acquired", 2, "Cover B"]);
  });
  await test("with the new columns in the database, the database wins", () => {
    const local = base({ status: "want", quantity: 1 });
    const remote = base({ status: "preordered", quantity: 3, edition: "Cover A" });
    const merged = model.mergeRemote(local, remote, true);
    assert.deepEqual([merged.status, merged.quantity, merged.edition], ["preordered", 3, "Cover A"]);
  });
  await test("saving a want twice is one row (same id), and a skipped catalog pick is not reset by the old Upcoming Comics tap", async () => {
    store.clear();
    model.saveWishlistItem(base({ id: "s1", status: "skipped", source: "metron", externalId: "9" }));
    model.saveWishlistItem(base({ id: "s1", status: "skipped", source: "metron", externalId: "9" }));
    assert.equal(model.loadWishlist().length, 1);
    await model.setCatalogWish({ source: "metron", externalId: "9", title: "x" }, "want");
    assert.equal(model.loadWishlist()[0].status, "skipped");
  });

  await test("nothing in the app copies a want's target price into a Vault purchase price or value (the old Add to Vault bug)", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const bad: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/.(ts|tsx)$/.test(e.name)) {
          const src = fs.readFileSync(p, "utf8");
          if (/purchasePrice:s*targetPrice/.test(src) || /currentValue:s*targetPrice/.test(src) || /convertWishlistToVault/.test(src)) bad.push(p);
        }
      }
    };
    walk(path.join(process.cwd(), "src"));
    assert.deepEqual(bad, []);
  });

  // ---- checklist and sharing -----------------------------------------------
  await test("the checklist lists open wants with edition and quantity; prices, notes and shops only when switched on", () => {
    const items = [base({ id: "1", title: "Night Courier #4", edition: "Cover B", quantity: 2, price: 4.99, notes: "ask for 1:25", shop: "Corner Comics", releaseDate: "2026-11-12" }), base({ id: "2", title: "Skipped", status: "skipped" })];
    const plain = core.checklistText(items, {}, new Date(now));
    assert.match(plain, /\[ \] Night Courier #4 \(Cover B, x2, Thu, Nov 12\)/);
    assert.doesNotMatch(plain, /4\.99|ask for|Corner/);
    assert.doesNotMatch(plain, /Skipped/);
    const full = core.checklistText(items, { includePrices: true, includeNotes: true, includeShops: true }, new Date(now));
    assert.match(full, /\$4\.99/);
    assert.match(full, /ask for 1:25/);
    assert.match(full, /Corner Comics/);
    assert.match(full, /Planned total \$9\.98/);
  });
  await test("share fields: only titles and editions are on by default; everything private is off unless switched on", () => {
    assert.deepEqual(core.normalizeShareFields(undefined), { titles: true, quantities: false, dates: false, prices: false, notes: false, shops: false });
    assert.deepEqual(core.normalizeShareFields({ prices: "yes", notes: true }), { titles: true, quantities: false, dates: false, prices: false, notes: true, shops: false });
  });

  console.log(`\n${pass} of ${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})();
