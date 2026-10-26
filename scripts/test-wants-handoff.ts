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
// One-issue answers (the date check): an issue listed here is answered even when the discovery window no longer lists it; an id that is absent answers "not listed".
const byId = new Map<number, Issue>();
let lookupCalls = 0;
let lookupDown = false;
const lookedUp: number[] = [];
const metronIssues = new Map<number, Record<string, unknown> | "error">();
const metronCalls: number[] = [];
(globalThis as unknown as { fetch: unknown }).fetch = async (url: string) => {
  const u = new URL(url, "http://test");
  const metronIssue = u.hostname === "metron.cloud" ? u.pathname.match(/^\/api\/issue\/(\d+)\/$/) : null;
  if (metronIssue) {
    metronCalls.push(Number(metronIssue[1]));
    const hit = metronIssues.get(Number(metronIssue[1]));
    if (hit === "error") return { ok: false, status: 500, text: async () => "boom", json: async () => ({}) };
    if (!hit) return { ok: false, status: 404, text: async () => "", json: async () => ({}) };
    return { ok: true, status: 200, text: async () => "", json: async () => hit };
  }
  if (u.pathname === "/api/comic-upcoming" && u.searchParams.get("id")) {
    lookupCalls += 1;
    const id = Number(u.searchParams.get("id"));
    lookedUp.push(id);
    if (lookupDown) return { ok: false, json: async () => ({}) };
    const hit = byId.get(id);
    return { ok: true, json: async () => ({ count: hit ? 1 : 0, results: hit ? [hit] : [] }) };
  }
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
  function freshWorld() { freshDevice(); db.wishlist.clear(); db.pull_rules.clear(); online = true; catalogDown = false; catalog = []; upsertLog = []; byId.clear(); lookupCalls = 0; lookupDown = false; lookedUp.length = 0; }
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

  /* ───────────── removed releases: Remove is a recorded decision, Undo restores it ───────────── */

  const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  const tracked = () => model.loadWishlist().filter((w) => !core.isRemoved(w));

  await test("R. removing a release Following added keeps the rule following and is not undone by the next check; a new issue is still added", async () => {
    freshWorld();
    catalog = [issue(1100, "4", day(20)), issue(1101, "5", day(34))];
    rules.saveRule(comicRule());
    await rules.refreshPullRules({ force: true });
    const id = wishFor(1100)[0].id;
    const original = model.removeWant(id);
    assert.ok(original);
    assert.equal(tracked().some((w) => w.id === id), false, "gone from every list");
    assert.equal(wishFor(1100).length, 1, "the removal is kept as a record");
    assert.equal(core.isRemoved(wishFor(1100)[0]), true);
    const again = await rules.refreshPullRules({ force: true });
    assert.deepEqual([again.added, again.updated], [0, 0], "the check does not restore it");
    assert.equal(tracked().some((w) => w.id === id), false);
    assert.equal(rules.loadPullRules()[0].state, "following", "the series is still followed");
    catalog = [...catalog, issue(1102, "6", day(48))];
    const next = await rules.refreshPullRules({ force: true });
    assert.equal(next.added, 1, "the next issue of the series still arrives");
    assert.deepEqual(tracked().map((w) => w.externalId).sort(), ["1101", "1102"]);
  });
  await test("R. Undo puts the removed want back exactly as it was (variant label, quantity, status, identity, dates, edits)", async () => {
    freshWorld();
    catalog = [issue(1103, "4", day(20)), issue(1104, "4B", day(20))];
    rules.saveRule(comicRule({ quantity: 2 }));
    const out = await rules.refreshPullRules({ force: true });
    for (const sug of out.suggestions) model.saveWishlistItem(core.wantFromRelease(sug, { quantity: 2, seriesName: "Night Courier", ruleId: "rule_nc", idNamespace: model.wantIdNamespace() }));
    const variant = wishFor(1104)[0];
    model.saveWishlistItem({ ...variant, status: "preordered", releaseDate: day(25), edited: ["releaseDate"], notes: "ask for the 1:25", details: { cover: "B" } });
    const std = wishFor(1103)[0];
    for (const target of [wishFor(1104)[0], std]) {
      const before = JSON.parse(JSON.stringify(model.loadWishlist().find((w) => w.id === target.id)));
      const original = model.removeWant(target.id);
      assert.ok(original);
      assert.equal(model.undoRemoveWant(original), true);
      const after = model.loadWishlist().find((w) => w.id === target.id);
      assert.deepEqual(JSON.parse(JSON.stringify(after)), before, "identical, field for field");
    }
    assert.equal(wishFor(1103).length + wishFor(1104).length, 2, "no duplicates");
  });
  await test("R. Undo does not overwrite a want the person has since put in its place", async () => {
    freshWorld();
    catalog = [issue(1105, "4", day(20))];
    rules.saveRule(comicRule());
    await rules.refreshPullRules({ force: true });
    const original = model.removeWant(wishFor(1105)[0].id);
    assert.ok(original);
    await comics.setComicWish(asIssue(catalog[0]), "preordered"); // tapped Preordered on Upcoming: the release is back
    assert.equal(wishFor(1105)[0].status, "preordered");
    assert.equal(model.undoRemoveWant(original), false);
    assert.equal(wishFor(1105)[0].status, "preordered");
    assert.equal(wishFor(1105).length, 1);
  });
  await test("R. clearing the Want tap on Upcoming Comics is remembered the same way; a Want tap later brings it back; Undo restores the status", async () => {
    freshWorld();
    catalog = [issue(1106, "4", day(20))];
    rules.saveRule(comicRule());
    await rules.refreshPullRules({ force: true });
    await comics.setComicWish(asIssue(catalog[0]), "preordered");
    const before = JSON.parse(JSON.stringify(wishFor(1106)[0]));
    await comics.setComicWish(asIssue(catalog[0]), null);
    assert.equal(tracked().length, 0);
    assert.equal(comics.loadComicStatuses().get(1106), undefined);
    await rules.refreshPullRules({ force: true });
    assert.equal(tracked().length, 0, "the check does not put it back");
    await comics.setComicWish(asIssue(catalog[0]), "preordered"); // what the Undo button does
    const back = wishFor(1106);
    assert.equal(back.length, 1);
    assert.deepEqual({ ...back[0], updatedAt: 0 }, { ...before, updatedAt: 0 });
  });
  await test("R. the removal reaches the account: a clean second browser's check does not restore it either", async () => {
    freshWorld();
    catalog = [issue(1107, "4", day(20)), issue(1108, "5", day(34))];
    rules.saveRule(comicRule());
    await rules.refreshPullRules({ force: true });
    await settle();
    model.removeWant(wishFor(1107)[0].id);
    await settle();
    const row = [...db.wishlist.values()].find((r) => r.source_identity === "metron:issue:1107");
    assert.equal(row?.status, "skipped");
    assert.deepEqual(row?.details, { removed: "1", removedFrom: "want" });
    freshDevice();
    await model.syncWishlistFromSupabase();
    await rules.syncPullRulesFromSupabase();
    const out = await rules.refreshPullRules({ force: true });
    assert.equal(out.added, 0);
    assert.deepEqual(tracked().map((w) => w.externalId), ["1108"]);
  });
  await test("R. Skip is unchanged (kept, visible under Skipped, not a removal); a want typed in by hand is simply deleted and Undo brings it back", async () => {
    freshWorld();
    catalog = [issue(1109, "4", day(20))];
    rules.saveRule(comicRule());
    await rules.refreshPullRules({ force: true });
    model.saveWishlistItem(core.withStatus(wishFor(1109)[0], "skipped"));
    assert.equal(core.isRemoved(wishFor(1109)[0]), false);
    assert.equal(wishFor(1109)[0].details, undefined);
    await rules.refreshPullRules({ force: true });
    assert.equal(wishFor(1109).length, 1);
    assert.equal(wishFor(1109)[0].status, "skipped");
    const mine = model.addWishlistItem({ title: "A thing I typed in" });
    assert.equal(core.needsRemovalRecord(mine), false);
    const original = model.removeWant(mine.id);
    assert.ok(original);
    assert.equal(model.loadWishlist().some((w) => w.id === mine.id), false, "deleted, no record");
    assert.equal(model.undoRemoveWant(original), true);
    assert.deepEqual(model.loadWishlist().find((w) => w.id === mine.id), original);
  });
  await test("R. the Following text says what removing and skipping do", async () => {
    const fs = await import("node:fs");
    const text = fs.readFileSync("src/components/wants/FollowTab.tsx", "utf8");
    assert.match(text, /skip or remove stays off your list/);
    assert.match(text, /keeps following the series/);
    assert.match(text, /Removing offers Undo/);
    assert.doesNotMatch(text, /A release you skipped never comes back, and/);
  });

  /* ───────────── date corrections for releases already on the list ───────────── */

  await test("D. a tracked release whose date moves from inside the window to outside it is corrected (one entry, new date), by a one-issue lookup", async () => {
    freshWorld();
    catalog = [issue(1120, "4", day(30))];
    rules.saveRule(comicRule());
    await rules.refreshPullRules({ force: true });
    const id = wishFor(1120)[0].id;
    assert.equal(lookupCalls, 0, "listed by discovery: no extra lookup");
    catalog = []; // the catalog now dates it 300 days out, past the 180-day window, so discovery no longer lists it
    byId.set(1120, issue(1120, "4", day(300)));
    const out = await rules.refreshPullRules({ force: true });
    assert.deepEqual([out.added, out.updated, out.lookups], [0, 1, 1]);
    assert.equal(wishFor(1120).length, 1);
    assert.equal(wishFor(1120)[0].id, id);
    assert.equal(wishFor(1120)[0].releaseDate, day(300));
  });
  await test("D. a release the source dropped (no date, or no longer listed) keeps its last known date and is not duplicated", async () => {
    freshWorld();
    catalog = [issue(1121, "4", day(30)), issue(1122, "5", day(40))];
    rules.saveRule(comicRule());
    await rules.refreshPullRules({ force: true });
    catalog = [];
    byId.set(1121, issue(1121, "4", null)); // still listed, but the date is gone
    // 1122 is not in byId at all: the catalog no longer lists it
    const out = await rules.refreshPullRules({ force: true });
    assert.equal(out.lookups, 2);
    assert.equal(out.updated, 0);
    assert.equal(wishFor(1121)[0].releaseDate, day(30));
    assert.equal(wishFor(1122)[0].releaseDate, day(40));
    assert.equal(model.loadWishlist().length, 2, "nothing added");
  });
  await test("D. a date the person set by hand always wins and is not even looked up", async () => {
    freshWorld();
    catalog = [issue(1123, "4", day(30))];
    rules.saveRule(comicRule());
    await rules.refreshPullRules({ force: true });
    model.updateWishlistItem(wishFor(1123)[0].id, { releaseDate: day(33), edited: ["releaseDate"] });
    catalog = [];
    byId.set(1123, issue(1123, "4", day(300)));
    const out = await rules.refreshPullRules({ force: true });
    assert.equal(out.lookups, 0);
    assert.equal(wishFor(1123)[0].releaseDate, day(33));
  });
  await test("D. a want added by a Want tap with no Following rule at all also gets its date corrected", async () => {
    freshWorld();
    await comics.setComicWish(asIssue(issue(1124, "4", day(30))), "want");
    byId.set(1124, issue(1124, "4", day(75)));
    const out = await rules.refreshPullRules({ force: true });
    assert.deepEqual([out.checked, out.lookups, out.updated], [0, 1, 1]);
    assert.equal(wishFor(1124).length, 1);
    assert.equal(wishFor(1124)[0].releaseDate, day(75));
    const quiet = await rules.refreshPullRules({ now: Date.now() + 3_600_000 }); // an hour later, automatic: not due again
    assert.equal(quiet.lookups, 0);
  });
  await test("D. lookups are bounded: at most 8 per check, 24 in any six hours, and an issue is not asked about again inside six hours", async () => {
    freshWorld();
    const T = Date.now();
    for (let n = 0; n < 30; n++) {
      await comics.setComicWish(asIssue(issue(2000 + n, String(n + 1), day(30))), "want");
      byId.set(2000 + n, issue(2000 + n, String(n + 1), day(200)));
    }
    const counts: number[] = [];
    for (let run = 0; run < 4; run++) counts.push((await rules.refreshPullRules({ force: true, now: T })).lookups);
    assert.deepEqual(counts, [8, 8, 8, 0], "8 + 8 + 8 = 24, then none until the window passes");
    assert.equal(new Set(lookedUp).size, 24, "24 different issues, none asked twice");
    const firstBatch = lookedUp.slice(0, 24);
    const later = await rules.refreshPullRules({ now: T + 7 * 3_600_000 });
    assert.equal(later.lookups, 8);
    assert.equal(lookedUp.slice(24).filter((id) => !firstBatch.includes(id)).length, 6, "the six never looked up go first");
    assert.equal((await rules.refreshPullRules({ now: T + 7 * 3_600_000 + 60_000 })).lookups, 8);
    assert.equal((await rules.refreshPullRules({ now: T + 7 * 3_600_000 + 120_000 })).lookups, 8);
    assert.equal((await rules.refreshPullRules({ now: T + 7 * 3_600_000 + 180_000 })).lookups, 0, "24 reached in this window");
  });
  await test("D. a paused rule's wants are not looked up; a catalog failure stops the pass after one request and changes nothing", async () => {
    freshWorld();
    catalog = [issue(1130, "4", day(30))];
    rules.saveRule(comicRule());
    await rules.refreshPullRules({ force: true });
    rules.setRuleState("rule_nc", "paused");
    catalog = [];
    byId.set(1130, issue(1130, "4", day(300)));
    const paused = await rules.refreshPullRules({ force: true });
    assert.equal(paused.lookups, 0);
    assert.equal(wishFor(1130)[0].releaseDate, day(30));
    rules.setRuleState("rule_nc", "following");
    for (let n = 0; n < 3; n++) {
      await comics.setComicWish(asIssue(issue(1140 + n, "9", day(30))), "want");
      byId.set(1140 + n, issue(1140 + n, "9", day(90)));
    }
    lookupDown = true;
    const before = model.loadWishlist().map((w) => w.releaseDate);
    const down = await rules.refreshPullRules({ force: true });
    assert.equal(down.lookups, 1, "stopped at the first failure");
    assert.equal(down.updated, 0);
    assert.deepEqual(model.loadWishlist().map((w) => w.releaseDate), before);
    lookupDown = false;
    const ok = await rules.refreshPullRules({ force: true });
    assert.ok(ok.lookups >= 1 && ok.updated >= 1, "the next check catches up");
  });
  await test("D. the pure rule: a different valid date updates; no date or unlisted changes nothing; a hand-set date wins", async () => {
    const w = { id: "x", title: "t", createdAt: 1, releaseDate: "2026-11-12" };
    assert.equal(core.planDateCorrection(w, { date: "2026-11-26" })?.releaseDate, "2026-11-26");
    assert.equal(core.planDateCorrection(w, { date: null }), null);
    assert.equal(core.planDateCorrection(w, null), null);
    assert.equal(core.planDateCorrection(w, { date: "2026-11-12" }), null);
    assert.equal(core.planDateCorrection(w, { date: "garbage" }), null);
    assert.equal(core.planDateCorrection({ ...w, edited: ["releaseDate"] }, { date: "2026-12-01" }), null);
  });

  await test("D. the one-issue route answers from the catalog (no permanent cache): the issue as listed now, an empty answer when it is gone, an error only on a real failure", async () => {
    process.env.METRON_USERNAME = "u";
    process.env.METRON_PASSWORD = "p";
    const route = await import("../src/app/api/comic-upcoming/route");
    const { NextRequest } = await import("next/server");
    const get = async (query: string) => { const r = await route.GET(new NextRequest(`http://test/api/comic-upcoming?${query}`)); return { status: r.status, body: (await r.json()) as { results?: Array<{ id: number; storeDate: string | null; seriesId?: number; series: string }>; error?: string } }; };
    metronIssues.set(777, { id: 777, series: { id: 77, name: "Night Courier", year_began: 2026 }, number: "4", publisher: { id: 1, name: "Example Comics" }, store_date: "2027-05-05", cover_date: null, image: null });
    const ok = await get("id=777");
    assert.equal(ok.status, 200);
    assert.deepEqual([ok.body.results?.length, ok.body.results?.[0].id, ok.body.results?.[0].storeDate, ok.body.results?.[0].seriesId], [1, 777, "2027-05-05", 77]);
    metronIssues.set(777, { id: 777, series: { id: 77, name: "Night Courier" }, number: "4", store_date: "2027-06-09" });
    assert.equal((await get("id=777")).body.results?.[0].storeDate, "2027-06-09", "a changed date is seen on the next ask (nothing is kept forever)");
    assert.equal((await get("id=abc7d7e7")).body.results?.[0]?.id, 777, "only the digits of the id are used");
    const gone = await get("id=999");
    assert.deepEqual([gone.status, gone.body.results?.length, gone.body.error], [200, 0, undefined]);
    metronIssues.set(888, "error");
    const bad = await get("id=888");
    assert.equal(bad.status, 502);
    assert.ok(bad.body.error);
    delete process.env.METRON_USERNAME;
    delete process.env.METRON_PASSWORD;
    void metronCalls;
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
