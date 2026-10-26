// Handoff tests: Upcoming Comics <-> Wishlist / Pull List / Following. Simulated browser, a fake account database and a fake comic catalog; nothing real is touched.
//   1. one release added to the Wishlist and the same series followed give consistent entries
//   2. a release date change from the catalog updates the existing selection
//   3. variants of one release stay separate entries
//   4. a skipped release does not come back (refresh, a second browser, an Upcoming tap, Own)
//   5. a paused rule adds nothing (even after a sync that could not see the pause)
//   6. partial acquisition and retries never duplicate Vault records
//   npm run test:wants-handoff
import assert from "node:assert/strict";

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

// A fake account database: wishlist and pull_rules rows by id. `online = false` makes every request fail the way a lost connection does.
type Row = Record<string, unknown>;
const db: Record<string, Map<string, Row>> = { wishlist: new Map(), pull_rules: new Map() };
let online = true;
let upsertLog: string[] = [];
class Query implements PromiseLike<{ data: unknown; error: { message: string } | null }> {
  private op: "select" | "upsert" | "delete" = "select";
  private filters: Array<[string, unknown]> = [];
  private row: Row | null = null;
  constructor(private table: string) {}
  select() { this.op = "select"; return this; }
  upsert(row: Row) { this.op = "upsert"; this.row = row; return this; }
  delete() { this.op = "delete"; return this; }
  eq(col: string, val: unknown) { this.filters.push([col, val]); return this; }
  then<R1, R2>(ok?: ((v: { data: unknown; error: { message: string } | null }) => R1 | PromiseLike<R1>) | null, bad?: ((e: unknown) => R2 | PromiseLike<R2>) | null) {
    return Promise.resolve(this.run()).then(ok, bad);
  }
  private run(): { data: unknown; error: { message: string } | null } {
    if (!online) return { data: null, error: { message: "Failed to fetch" } };
    const t = db[this.table];
    if (!t) return { data: null, error: { message: `relation "${this.table}" does not exist` } };
    const match = (r: Row) => this.filters.every(([c, v]) => r[c] === v);
    if (this.op === "select") return { data: [...t.values()].filter(match).map((r) => ({ ...r })), error: null };
    if (this.op === "delete") { for (const [id, r] of [...t]) if (match(r)) t.delete(id); return { data: null, error: null }; }
    const row = this.row as Row;
    upsertLog.push(`${this.table}:${String(row.id)}`);
    t.set(String(row.id), { ...(t.get(String(row.id)) ?? {}), ...row });
    return { data: null, error: null };
  }
}
const fakeSupabase = { from: (table: string) => new Query(table), auth: { getSession: async () => ({ data: { session: null } }), getUser: async () => ({ data: { user: null } }) } };

const win: Record<string, unknown> = {
  localStorage: ls,
  sessionStorage: ls,
  addEventListener: (t: string, f: () => void) => { (listeners[t] ??= []).push(f); },
  removeEventListener: () => undefined,
  dispatchEvent: (e: { type: string }) => { (listeners[e.type] ?? []).forEach((f) => f()); return true; },
  location: { origin: "http://test", pathname: "/", search: "" },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  navigator: { onLine: true },
  __vltdSupabaseClient: fakeSupabase,
};
Object.assign(globalThis, { window: win, localStorage: ls, sessionStorage: ls, document: { documentElement: { style: { setProperty() {}, removeProperty() {} }, setAttribute() {}, removeAttribute() {}, hasAttribute: () => false }, addEventListener() {}, visibilityState: "visible" } });
try { Object.defineProperty(globalThis, "navigator", { value: { onLine: true, userAgent: "test" }, configurable: true }); } catch { /* already set */ }
(globalThis as unknown as { Event: unknown }).Event = class { type: string; constructor(t: string) { this.type = t; } };
(globalThis as unknown as { CustomEvent: unknown }).CustomEvent = (globalThis as unknown as { Event: unknown }).Event;

// A fake comic catalog: whatever is in `catalog` is what the comic source answers with.
type Issue = { id: number; series: string; seriesId: number; seriesYearBegan: number; number: string; publisher: string; storeDate: string | null; coverDate: string | null; imageUrl: string | null };
let catalog: Issue[] = [];
let catalogDown = false;
let catalogCalls = 0;
(globalThis as unknown as { fetch: unknown }).fetch = async (url: string) => {
  const u = new URL(url, "http://test");
  if (u.pathname === "/api/comic-upcoming") {
    catalogCalls += 1;
    if (catalogDown) return { ok: false, json: async () => ({}) };
    const q = (u.searchParams.get("series") ?? "").toLowerCase();
    return { ok: true, json: async () => ({ count: 0, page: 1, pageSize: 100, hasMore: false, resolvedCreator: null, results: catalog.filter((i) => !q || i.series.toLowerCase().includes(q)) }) };
  }
  if (u.pathname === "/api/comic-lookup") return { ok: true, json: async () => ({ result: { series: "Night Courier", number: "4", publisher: "Example Comics", price: "3.99" } }) };
  return { ok: false, json: async () => ({}) };
};

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

const issue = (id: number, number: string, storeDate: string | null, over: Partial<Issue> = {}): Issue => ({
  id, series: "Night Courier", seriesId: 77, seriesYearBegan: 2026, number, publisher: "Example Comics", storeDate, coverDate: null, imageUrl: `https://img.test/${id}.jpg`, ...over,
});

(async () => {
  const core = await import("../src/lib/wantsCore");
  const model = await import("../src/lib/wishlistModel");
  const rules = await import("../src/lib/pullRules");
  const comics = await import("../src/lib/comicWishlistModel");
  const acq = await import("../src/lib/wantAcquire");
  const vault = await import("../src/lib/vaultModel");
  const upc = await import("../src/lib/comicUpcoming");

  const PROFILE = "p1";
  function freshDevice() { store.clear(); store.set("vltd_active_profile_id_v1", PROFILE); }
  function freshWorld() { freshDevice(); db.wishlist.clear(); db.pull_rules.clear(); online = true; catalogDown = false; catalog = []; upsertLog = []; }
  const settle = () => new Promise((r) => setTimeout(r, 15));
  const asIssue = (i: Issue) => i as unknown as import("../src/lib/comicUpcoming").UpcomingIssue;
  const comicRule = (over: Partial<import("../src/lib/wantsCore").PullRule> = {}): import("../src/lib/wantsCore").PullRule => ({
    id: "rule_nc", kind: "comic_series", name: "Night Courier", publisher: "Example Comics", yearBegan: 2026, source: "metron", sourceKey: "metron:series:77",
    quantity: 1, variantPolicy: "standard", state: "following", createdAt: Date.now(), ...over,
  });
  const wishFor = (id: number) => model.loadWishlist().filter((w) => core.ruleIdentityOfItem(w) === `metron:issue:${id}`);
  const vaultFor = (prefix: string) => vault.loadItems().filter((i) => String(i.id).startsWith(prefix));
  const annotate = (i: Issue) => upc.detectVariant(i.number) ? { ...i, isVariant: true } : i;

  /* ───────────── case 1: one release on the Wishlist vs following its series ───────────── */

  await test("1. the entry made by a Want tap on Upcoming Comics and the entry Following would make describe the same release (title, date, series, edition, identity)", async () => {
    freshWorld();
    const i = issue(1001, "4", "2026-11-12");
    await comics.setComicWish(asIssue(i), "want");
    const tapped = model.loadWishlist()[0];
    const viaRule = core.wantFromRelease(rules.issueToRelease(annotate(i) as never), { quantity: 1, seriesName: "Night Courier", ruleId: "r", idNamespace: "p1" });
    assert.equal(tapped.title, viaRule.title);
    assert.equal(tapped.releaseDate, viaRule.releaseDate);
    assert.equal(core.ruleIdentityOfItem(tapped), viaRule.sourceIdentity);
    assert.equal(tapped.series, viaRule.series, "series");
    assert.equal(tapped.edition, viaRule.edition, "edition / cover");
    assert.equal(tapped.sourceIdentity, viaRule.sourceIdentity, "own identity, not only a fallback guess from source + id");
    assert.equal(tapped.imageUrl, viaRule.imageUrl);
  });
  await test("1. an issue with no number gets the same title either way (not 'Night Courier #')", async () => {
    freshWorld();
    const i = issue(1002, "", "2026-11-19");
    await comics.setComicWish(asIssue(i), "want");
    const tapped = model.loadWishlist()[0];
    assert.equal(tapped.title, rules.issueToRelease(i as never).title);
  });
  await test("1. Want first, then follow the series: the refresh finds the release already there (one entry), keeps it, and adds only the other issue", async () => {
    freshWorld();
    catalog = [issue(1003, "4", "2026-11-12"), issue(1004, "5", "2026-12-10")];
    await comics.setComicWish(asIssue(catalog[0]), "preordered");
    const before = wishFor(1003)[0];
    rules.saveRule(comicRule());
    const out = await rules.refreshPullRules({ force: true });
    assert.equal(out.added, 1);
    assert.equal(wishFor(1003).length, 1, "no second entry for the release that was added by hand");
    assert.equal(wishFor(1003)[0].id, before.id);
    assert.equal(wishFor(1003)[0].status, "preordered", "the person's Preordered is kept");
    assert.equal(wishFor(1004).length, 1);
    assert.equal(model.loadWishlist().length, 2);
  });
  await test("1. Follow first, then tap Want/Preordered on the same release: the same entry is updated (not a second one); the rule link, quantity and a date set by hand are kept", async () => {
    freshWorld();
    catalog = [issue(1005, "4", "2026-11-12")];
    rules.saveRule(comicRule({ quantity: 2 }));
    await rules.refreshPullRules({ force: true });
    const added = wishFor(1005)[0];
    assert.equal(added.quantity, 2);
    model.updateWishlistItem(added.id, { releaseDate: "2026-11-30", edited: ["releaseDate"] }); // the person typed their own date
    await comics.setComicWish(asIssue(catalog[0]), "preordered");
    const list = wishFor(1005);
    assert.equal(list.length, 1, "one entry");
    assert.equal(list[0].id, added.id);
    assert.equal(list[0].ruleId, "rule_nc");
    assert.equal(list[0].quantity, 2);
    assert.equal(list[0].status, "preordered");
    assert.equal(list[0].releaseDate, "2026-11-30", "a date the person set is not overwritten by the tap");
  });
  await test("1. a catalog tap with no date from the source does not erase a date the entry already has", async () => {
    freshWorld();
    await comics.setComicWish(asIssue(issue(1006, "4", "2026-11-12")), "want");
    await comics.setComicWish(asIssue(issue(1006, "4", null)), "preordered");
    assert.equal(wishFor(1006)[0].releaseDate, "2026-11-12");
  });

  /* ───────────── case 2: a date change from the source ───────────── */

  await test("2. a delayed release changes the date of the existing entry: one entry, new date, nothing added, repeat refreshes change nothing more", async () => {
    freshWorld();
    catalog = [issue(1010, "4", "2026-11-12")];
    rules.saveRule(comicRule());
    await rules.refreshPullRules({ force: true });
    const id = wishFor(1010)[0].id;
    catalog = [issue(1010, "4", "2026-11-26")];
    const out = await rules.refreshPullRules({ force: true });
    assert.deepEqual([out.added, out.updated], [0, 1]);
    assert.equal(wishFor(1010).length, 1);
    assert.equal(wishFor(1010)[0].id, id);
    assert.equal(wishFor(1010)[0].releaseDate, "2026-11-26");
    const again = await rules.refreshPullRules({ force: true });
    assert.deepEqual([again.added, again.updated], [0, 0]);
    assert.equal(model.loadWishlist().length, 1);
  });
  await test("2. the new date reaches the account, and a second browser shows the new date (not the stale one)", async () => {
    freshWorld();
    catalog = [issue(1011, "4", "2026-11-12")];
    rules.saveRule(comicRule());
    await rules.refreshPullRules({ force: true });
    await settle();
    catalog = [issue(1011, "4", "2026-12-03")];
    await rules.refreshPullRules({ force: true });
    await settle();
    const row = [...db.wishlist.values()].find((r) => r.source_identity === "metron:issue:1011");
    assert.equal(row?.release_date, "2026-12-03");
    freshDevice(); // a clean second browser
    const items = await model.syncWishlistFromSupabase();
    assert.equal(items.filter((w) => core.ruleIdentityOfItem(w) === "metron:issue:1011").length, 1);
    assert.equal(items.find((w) => core.ruleIdentityOfItem(w) === "metron:issue:1011")?.releaseDate, "2026-12-03");
  });
  await test("2. a want added by a Want tap on Upcoming Comics (no rule of its own) also follows the date once the series is followed", async () => {
    freshWorld();
    catalog = [issue(1012, "4", "2026-11-12")];
    await comics.setComicWish(asIssue(catalog[0]), "want");
    rules.saveRule(comicRule());
    catalog = [issue(1012, "4", "2026-11-19")];
    await rules.refreshPullRules({ force: true });
    assert.equal(wishFor(1012).length, 1);
    assert.equal(wishFor(1012)[0].releaseDate, "2026-11-19");
  });
  await test("2. a catalog failure changes nothing and says so on the rule; the next good check catches up", async () => {
    freshWorld();
    catalog = [issue(1013, "4", "2026-11-12")];
    rules.saveRule(comicRule());
    await rules.refreshPullRules({ force: true });
    catalogDown = true;
    const bad = await rules.refreshPullRules({ force: true });
    assert.deepEqual([bad.added, bad.updated, bad.failed.length], [0, 0, 1]);
    assert.equal(wishFor(1013)[0].releaseDate, "2026-11-12");
    catalogDown = false;
    catalog = [issue(1013, "4", "2026-11-26")];
    await rules.refreshPullRules({ force: true });
    assert.equal(wishFor(1013)[0].releaseDate, "2026-11-26");
  });

  /* ───────────── case 3: variants stay separate ───────────── */

  await test("3. standard, variant B and variant C are three separate entries when each is chosen; following never merges or auto-adds the variants", async () => {
    freshWorld();
    catalog = [issue(1020, "4", "2026-11-12"), issue(1021, "4B", "2026-11-12"), issue(1022, "4C", "2026-11-12")];
    rules.saveRule(comicRule());
    const out = await rules.refreshPullRules({ force: true });
    assert.equal(out.added, 1, "only the standard cover is added");
    assert.deepEqual(out.suggestions.map((s) => s.identity).sort(), ["metron:issue:1021", "metron:issue:1022"]);
    for (const s of out.suggestions) model.saveWishlistItem(core.wantFromRelease(s, { quantity: 1, seriesName: "Night Courier", ruleId: "rule_nc", idNamespace: model.wantIdNamespace() }));
    const all = model.loadWishlist();
    assert.equal(all.length, 3);
    assert.equal(new Set(all.map((w) => w.id)).size, 3, "three different ids");
    assert.deepEqual(all.map((w) => w.title).sort(), ["Night Courier #4", "Night Courier #4B", "Night Courier #4C"]);
    assert.deepEqual(all.filter((w) => w.title.endsWith("4B")).map((w) => w.edition), ["Variant cover"]);
    const again = await rules.refreshPullRules({ force: true });
    assert.deepEqual([again.added, again.updated, again.suggestions.length], [0, 0, 0], "re-checking adds, changes and suggests nothing once all three are chosen");
    assert.equal(model.loadWishlist().length, 3);
  });
  await test("3. a variant already added with a Want tap on Upcoming Comics is not suggested again and cannot be added a second time from the Following card", async () => {
    freshWorld();
    catalog = [issue(1023, "4", "2026-11-12"), issue(1024, "4B", "2026-11-12")];
    await comics.setComicWish(asIssue(annotate(catalog[1]) as Issue), "want");
    rules.saveRule(comicRule());
    const out = await rules.refreshPullRules({ force: true });
    assert.deepEqual(out.suggestions, [], "the variant is already a want, so nothing to suggest");
    // The suggestion list the page still holds from an earlier check: Add must be a no-op for a release already on the list
    const stale = rules.issueToRelease(annotate(catalog[1]) as never);
    assert.equal(core.findWantForIdentity(model.loadWishlist(), stale.identity)?.externalId, "1024");
    assert.equal(core.addableSuggestion(model.loadWishlist(), stale, comicRule(), model.wantIdNamespace()), null);
    assert.equal(wishFor(1024).length, 1);
  });
  await test("3. variants tapped on Upcoming Comics (Want on 4 and on 4B) are two entries, and each keeps its own cover label", async () => {
    freshWorld();
    const std = issue(1025, "4", "2026-11-12");
    const v = annotate(issue(1026, "4B", "2026-11-12")) as Issue & { isVariant?: boolean };
    await comics.setComicWish(asIssue(std), "want");
    await comics.setComicWish(v as never, "want");
    const all = model.loadWishlist();
    assert.equal(all.length, 2);
    assert.deepEqual(all.map((w) => w.title).sort(), ["Night Courier #4", "Night Courier #4B"]);
    assert.equal(all.find((w) => w.title.endsWith("4B"))?.edition, "Variant cover");
    assert.equal(all.find((w) => w.title.endsWith("#4"))?.edition, "Standard cover");
  });

  /* ───────────── case 4: a skipped release does not come back ───────────── */

  await test("4. skipped stays skipped through a refresh, a second browser's sync, and a refresh after that", async () => {
    freshWorld();
    catalog = [issue(1030, "4", "2026-11-12"), issue(1031, "5", "2026-12-10")];
    rules.saveRule(comicRule());
    await rules.refreshPullRules({ force: true });
    await settle();
    const target = wishFor(1030)[0];
    model.saveWishlistItem(core.withStatus(target, "skipped"));
    await settle();
    await rules.refreshPullRules({ force: true });
    assert.equal(wishFor(1030)[0].status, "skipped");
    freshDevice(); // second browser: nothing local
    store.set("vltd_pull_rules_v1:p1", JSON.stringify([])); // its rules come from the account
    const synced = await model.syncWishlistFromSupabase();
    assert.equal(synced.find((w) => core.ruleIdentityOfItem(w) === "metron:issue:1030")?.status, "skipped");
    await rules.syncPullRulesFromSupabase();
    await rules.refreshPullRules({ force: true });
    assert.equal(wishFor(1030).length, 1);
    assert.equal(wishFor(1030)[0].status, "skipped");
    assert.equal(model.loadWishlist().length, 2);
  });
  await test("4. on Upcoming Comics a skipped release is not lit as Want, and clearing it (a stale tap) never deletes the skipped record", async () => {
    freshWorld();
    catalog = [issue(1032, "4", "2026-11-12")];
    rules.saveRule(comicRule());
    await rules.refreshPullRules({ force: true });
    model.saveWishlistItem(core.withStatus(wishFor(1032)[0], "skipped"));
    assert.equal(comics.loadComicStatuses().get(1032), undefined, "not shown as Want");
    await comics.setComicWish(asIssue(catalog[0]), null);
    assert.equal(wishFor(1032).length, 1, "the skipped record is the only thing stopping Following from adding it again");
    assert.equal(wishFor(1032)[0].status, "skipped");
    await rules.refreshPullRules({ force: true });
    assert.equal(wishFor(1032).length, 1);
    assert.equal(wishFor(1032)[0].status, "skipped");
  });
  await test("4. a Want tap on Upcoming Comics does not un-skip a skipped release (existing rule)", async () => {
    freshWorld();
    catalog = [issue(1033, "4", "2026-11-12")];
    rules.saveRule(comicRule());
    await rules.refreshPullRules({ force: true });
    model.saveWishlistItem(core.withStatus(wishFor(1033)[0], "skipped"));
    await comics.setComicWish(asIssue(catalog[0]), "want");
    assert.equal(wishFor(1033)[0].status, "skipped");
  });
  await test("4. a release that was skipped and then bought with Own on Upcoming Comics is not put back on the Wishlist by the next check", async () => {
    freshWorld();
    catalog = [issue(1034, "4", "2026-11-12")];
    rules.saveRule(comicRule());
    await rules.refreshPullRules({ force: true });
    model.saveWishlistItem(core.withStatus(wishFor(1034)[0], "skipped"));
    const res = await comics.ownComic(asIssue(catalog[0]));
    assert.ok(res.ok);
    await rules.refreshPullRules({ force: true });
    assert.equal(wishFor(1034).filter((w) => w.status !== "skipped").length, 0, "no new open want for a comic that is already in the Vault");
    assert.equal(vault.loadItems().filter((i) => i.catalogRef === "metron:1034").length, 1);
  });

  /* ───────────── case 5: a paused rule adds nothing ───────────── */

  await test("5. a paused rule adds nothing and does not even ask the catalog; resuming adds the releases", async () => {
    freshWorld();
    catalog = [issue(1040, "4", "2026-11-12")];
    rules.saveRule(comicRule({ state: "paused" }));
    catalogCalls = 0;
    const out = await rules.refreshPullRules({ force: true });
    assert.deepEqual([out.checked, out.added, out.updated], [0, 0, 0]);
    assert.equal(catalogCalls, 0);
    assert.equal(model.loadWishlist().length, 0);
    rules.setRuleState("rule_nc", "following");
    const after = await rules.refreshPullRules({ force: true });
    assert.equal(after.added, 1);
  });
  await test("5. a paused rule also changes no dates on what it added earlier", async () => {
    freshWorld();
    catalog = [issue(1041, "4", "2026-11-12")];
    rules.saveRule(comicRule());
    await rules.refreshPullRules({ force: true });
    rules.setRuleState("rule_nc", "paused");
    catalog = [issue(1041, "4", "2026-11-26")];
    await rules.refreshPullRules({ force: true });
    assert.equal(wishFor(1041)[0].releaseDate, "2026-11-12");
  });
  await test("5. pausing while offline survives the next sync: the account still says Following, but the pause is kept and sent again; nothing is added meanwhile", async () => {
    freshWorld();
    catalog = [issue(1042, "4", "2026-11-12")];
    rules.saveRule(comicRule());
    await settle(); // the rule reached the account as Following
    assert.equal(db.pull_rules.get("rule_nc")?.state, "following");
    online = false;
    rules.setRuleState("rule_nc", "paused");
    await settle();
    online = true; // back online; the account still holds the old state
    const synced = await rules.syncPullRulesFromSupabase();
    assert.equal(synced.rules.find((r) => r.id === "rule_nc")?.state, "paused", "the sync must not undo a pause that has not reached the account");
    await rules.refreshPullRules({ force: true });
    assert.equal(model.loadWishlist().length, 0, "a paused rule adds nothing");
    await settle();
    assert.equal(db.pull_rules.get("rule_nc")?.state, "paused", "the pause reaches the account");
  });
  await test("5. a rule made while offline is not dropped by the next sync", async () => {
    freshWorld();
    rules.saveRule(comicRule({ id: "rule_a", name: "Other Series", sourceKey: "metron:series:5" }));
    await settle();
    online = false;
    rules.saveRule(comicRule({ id: "rule_b" }));
    await settle();
    online = true;
    const synced = await rules.syncPullRulesFromSupabase();
    assert.deepEqual(synced.rules.map((r) => r.id).sort(), ["rule_a", "rule_b"]);
    await settle();
    assert.ok(db.pull_rules.has("rule_b"), "and it reaches the account");
  });

  /* ───────────── case 6: partial acquisition and retries ───────────── */

  const wantFor = (id: string, qty: number, extra: Partial<import("../src/lib/wishlistModel").WishlistItem> = {}) => ({ id, title: `Box ${id}`, createdAt: Date.now(), status: "want" as const, quantity: qty, universe: "POP_CULTURE", category: "Comics", ...extra });

  await test("6. two of three variants acquired: two Vault records, the third want is untouched, and Following adds or duplicates nothing afterwards", async () => {
    freshWorld();
    catalog = [issue(1050, "4", "2026-11-12"), issue(1051, "4B", "2026-11-12"), issue(1052, "4C", "2026-11-12")];
    rules.saveRule(comicRule());
    const out = await rules.refreshPullRules({ force: true });
    for (const s of out.suggestions) model.saveWishlistItem(core.wantFromRelease(s, { quantity: 1, seriesName: "Night Courier", ruleId: "rule_nc", idNamespace: model.wantIdNamespace() }));
    const [a, b, c] = [1050, 1051, 1052].map((id) => wishFor(id)[0]);
    const before = vault.loadItems().length;
    for (const w of [a, b]) {
      const r = await acq.acquireCopies(w, { count: 1, profileId: PROFILE });
      assert.ok(r.ok);
      if (r.ok) model.saveWishlistItem(r.want);
    }
    assert.equal(vault.loadItems().length, before + 2);
    assert.equal(wishFor(1050)[0].status, "acquired");
    assert.equal(wishFor(1051)[0].status, "acquired");
    assert.equal(wishFor(1052)[0].status, "want");
    const again = await rules.refreshPullRules({ force: true });
    assert.deepEqual([again.added, again.updated, again.suggestions.length], [0, 0, 0]);
    assert.equal(model.loadWishlist().length, 3);
    assert.equal(vault.loadItems().length, before + 2);
    void c;
  });
  await test("6. two presses of Save at the same moment make one Vault record per copy", async () => {
    freshWorld();
    const w = wantFor("dbl1", 1);
    const before = vault.loadItems().length;
    const [r1, r2] = await Promise.all([acq.acquireCopies(w, { count: 1, profileId: PROFILE }), acq.acquireCopies(w, { count: 1, profileId: PROFILE })]);
    assert.ok(r1.ok && r2.ok);
    assert.equal(vault.loadItems().length, before + 1);
    assert.equal(vaultFor("vault_acq_dbl1_").length, 1);
  });
  await test("6. the same acquisition run again (a stale list, a second tab, a re-run after the want was updated) creates nothing new", async () => {
    freshWorld();
    const w = wantFor("rerun1", 3);
    const one = await acq.acquireCopies(w, { count: 2, profileId: PROFILE });
    assert.ok(one.ok);
    if (!one.ok) return;
    assert.equal(one.want.quantityAcquired, 2);
    assert.equal(one.want.status, "want");
    const stale = await acq.acquireCopies(w, { count: 2, profileId: PROFILE }); // the old want, as another tab still holds it
    assert.ok(stale.ok);
    if (stale.ok) assert.equal(stale.created, 0);
    const updated = await acq.acquireCopies(one.want, { count: 1, profileId: PROFILE });
    assert.ok(updated.ok);
    if (updated.ok) { assert.equal(updated.created, 1); assert.equal(updated.want.status, "acquired"); }
    const done = await acq.acquireCopies(updated.ok ? updated.want : one.want, { count: 1, profileId: PROFILE });
    assert.equal(done.ok, false, "nothing left to receive");
    assert.equal(vaultFor("vault_acq_rerun1_").length, 3);
    assert.equal(new Set(vaultFor("vault_acq_rerun1_").map((i) => i.id)).size, 3);
  });
  await test("6. a want that was acquired through the Wishlist cannot be added to the Vault a second time with Own on Upcoming Comics", async () => {
    freshWorld();
    catalog = [issue(1060, "4", "2026-11-12")];
    await comics.setComicWish(asIssue(catalog[0]), "want");
    const want = wishFor(1060)[0];
    const r = await acq.acquireCopies(want, { count: 1, profileId: PROFILE });
    assert.ok(r.ok);
    if (r.ok) model.saveWishlistItem(r.want);
    assert.equal(comics.loadComicStatuses().get(1060), "own", "Upcoming Comics shows it as Own");
    const own = await comics.ownComic(asIssue(catalog[0]));
    assert.ok(own.ok);
    assert.equal(vault.loadItems().filter((i) => i.catalogRef === "metron:1060").length, 1, "still one Vault record for this comic");
  });
  await test("6. Own on Upcoming Comics after Following has added the want: the want is taken off, the next check does not put the owned comic back, and the Vault holds one record", async () => {
    freshWorld();
    catalog = [issue(1061, "4", "2026-11-12")];
    rules.saveRule(comicRule());
    await rules.refreshPullRules({ force: true });
    const own = await comics.ownComic(asIssue(catalog[0]));
    assert.ok(own.ok);
    await rules.refreshPullRules({ force: true });
    assert.equal(wishFor(1061).length, 0, "an owned comic is not added back as a want");
    assert.equal(vault.loadItems().filter((i) => i.catalogRef === "metron:1061").length, 1);
  });

  await test("6. a Vault that refuses the save (free-plan limit) marks nothing and makes no record; after the limit is lifted the retry makes exactly one", async () => {
    freshWorld();
    const w = wantFor("fail1", 2);
    // Fill the free plan's 50 items for this profile.
    while (vault.loadItems().length < 50) vault.appendItems([{ id: `filler_${vault.loadItems().length}`, profile_id: PROFILE, title: "Filler", status: "COLLECTION", createdAt: Date.now() } as never]);
    const full = vault.loadItems().length;
    const first = await acq.acquireCopies(w, { count: 1, profileId: PROFILE });
    assert.equal(first.ok, false, "refused");
    assert.equal(vaultFor("vault_acq_fail1_").length, 0, "no record was made");
    assert.equal(vault.loadItems().length, full);
    store.set("vltd_tier", "MID"); // the limit is lifted
    const retry = await acq.acquireCopies(w, { count: 1, profileId: PROFILE });
    assert.ok(retry.ok, retry.ok ? "" : retry.reason);
    const again = await acq.acquireCopies(w, { count: 1, profileId: PROFILE });
    assert.ok(again.ok);
    assert.equal(vaultFor("vault_acq_fail1_").length, 1, "exactly one record for copy 1");
    assert.equal(vault.loadItems().length, full + 1);
  });

  console.log(`
${pass} of ${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})();
