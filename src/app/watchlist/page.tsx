"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { AppIcon } from "@/components/ui/AppIcon";
import { Glyph } from "@/components/ui/Glyph";
import { PillButton } from "@/components/ui/PillButton";
import { PillSelect } from "@/components/ui/PillSelect";
import AcquireSheet from "@/components/wants/AcquireSheet";
import AddWantSheet, { type AddMode } from "@/components/wants/AddWantSheet";
import ChecklistSheet from "@/components/wants/ChecklistSheet";
import FollowSheet from "@/components/wants/FollowSheet";
import FollowTab from "@/components/wants/FollowTab";
import WantRow, { WatchingRow } from "@/components/wants/WantRow";
import { loadPullRules, refreshPullRules, syncPullRulesFromSupabase } from "@/lib/pullRules";
import { showToast } from "@/lib/toast";
import { formatMoney, groupPullList, isOpen, plannedTotals, ruleIdentityOfItem, wantFromRelease, wantFromWatching, type CatalogRelease, type PullRule } from "@/lib/wantsCore";
import { loadWatchlist, removeFromWatchlist, syncWatchlistFromSupabase, type WatchlistItem } from "@/lib/watchlistModel";
import { loadWishlist, removeWishlistItem, saveWishlistItem, syncWishlistFromSupabase, type WishlistItem } from "@/lib/wishlistModel";

// Watchlist: three views of what you collect next.
//   Wishlist  = what I want (any category, with or without a date or price), plus things I am Watching (someone else's public items).
//   Pull List = wants with a release date or window, grouped by when.
//   Following = rules that add future releases for you (comic series from the comic catalog; card products and toy lines are manual).
// Exhibition bookmarks are saved content, not things to acquire: they are on Saved.

type Tab = "wishlist" | "pull" | "follow";
type Show = "active" | "wants" | "watching" | "received" | "skipped";
type Sort = "priority" | "newest" | "release" | "az";

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

export default function WatchlistPage() {
  const [tab, setTab] = useState<Tab>("wishlist");
  const [wishlist, setWishlist] = useState<WishlistItem[]>(() => loadWishlist());
  const [watching, setWatching] = useState<WatchlistItem[]>(() => loadWatchlist());
  const [rules, setRules] = useState<PullRule[]>(() => loadPullRules());
  const [inAccount, setInAccount] = useState(true);
  const [suggestions, setSuggestions] = useState<CatalogRelease[]>([]);
  const [checking, setChecking] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [show, setShow] = useState<Show>("active");
  const [sort, setSort] = useState<Sort>("priority");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ mode: AddMode; rule?: PullRule } | null>(null);
  const [acquiring, setAcquiring] = useState<WishlistItem | null>(null);
  const [following, setFollowing] = useState(false);
  const [checklist, setChecklist] = useState(false);

  const reload = useCallback(() => setWishlist(loadWishlist()), []);

  useEffect(() => {
    let active = true;
    const onWish = () => setWishlist(loadWishlist());
    const onWatch = () => setWatching(loadWatchlist());
    const onRules = () => setRules(loadPullRules());
    window.addEventListener("vltd:wishlist-updated", onWish);
    window.addEventListener("vltd:watchlist-updated", onWatch);
    window.addEventListener("vltd:pull-rules-updated", onRules);
    void (async () => {
      const [w, wl, pr] = await Promise.all([syncWishlistFromSupabase(), syncWatchlistFromSupabase(), syncPullRulesFromSupabase()]);
      if (!active) return;
      setWishlist(w); setWatching(wl); setRules(pr.rules); setInAccount(pr.inAccount);
      // Check Following comic rules (at most every six hours per rule); adds nothing for paused or stopped rules.
      const outcome = await refreshPullRules();
      if (!active) return;
      if (outcome.suggestions.length) setSuggestions(outcome.suggestions);
      setWishlist(loadWishlist()); setRules(loadPullRules());
    })();
    return () => {
      active = false;
      window.removeEventListener("vltd:wishlist-updated", onWish);
      window.removeEventListener("vltd:watchlist-updated", onWatch);
      window.removeEventListener("vltd:pull-rules-updated", onRules);
    };
  }, []);

  const categories = useMemo(() => [...new Set(wishlist.map((w) => w.category).filter((c): c is string => Boolean(c && c.trim())))].sort(), [wishlist]);
  const ruleNames = useMemo(() => new Map(rules.map((r) => [r.id, r.name])), [rules]);
  const watchingIdentities = useMemo(() => new Set(wishlist.map((w) => ruleIdentityOfItem(w))), [wishlist]);

  const matches = useCallback((w: { title: string; category?: string; series?: string; edition?: string; notes?: string }) => {
    const q = query.trim().toLowerCase();
    if (category !== "all" && (w.category ?? "") !== category) return false;
    return !q || [w.title, w.category, w.series, w.edition, w.notes].filter(Boolean).join(" ").toLowerCase().includes(q);
  }, [query, category]);

  const wants = useMemo(() => {
    const list = wishlist.filter((w) => matches(w));
    const pick = (w: WishlistItem) => show === "received" ? w.status === "acquired" : show === "skipped" ? w.status === "skipped" : show === "watching" ? false : isOpen(w);
    const out = list.filter(pick);
    const rank = (w: WishlistItem) => PRIORITY_RANK[w.priority ?? "medium"];
    out.sort((a, b) =>
      sort === "az" ? a.title.localeCompare(b.title)
      : sort === "newest" ? (b.createdAt ?? 0) - (a.createdAt ?? 0)
      : sort === "release" ? (a.releaseDate ?? "9999").localeCompare(b.releaseDate ?? "9999") || a.title.localeCompare(b.title)
      : rank(a) - rank(b) || (a.releaseDate ?? "9999").localeCompare(b.releaseDate ?? "9999") || (b.createdAt ?? 0) - (a.createdAt ?? 0));
    return out;
  }, [wishlist, matches, show, sort]);

  const watchRows = useMemo(() => (show === "active" || show === "watching" ? watching.filter((w) => matches({ title: w.title })) : []), [watching, matches, show]);
  const pullGroups = useMemo(() => groupPullList(wishlist.filter((w) => matches(w))), [wishlist, matches]);
  const openWants = useMemo(() => wishlist.filter(isOpen), [wishlist]);
  const pullCount = useMemo(() => groupPullList(wishlist).reduce((n, g) => n + g.items.length, 0), [wishlist]);
  const visibleTotals = plannedTotals(tab === "pull" ? pullGroups.flatMap((g) => g.items) : wants);

  function save(next: WishlistItem) {
    saveWishlistItem(next);
    reload();
  }
  function addFromWatching(w: WatchlistItem) {
    const want = wantFromWatching(w);
    if (wishlist.some((x) => ruleIdentityOfItem(x) === want.sourceIdentity)) return showToast(`${w.title} is already one of your wants.`);
    save(want);
    showToast("Added to your wants. The watched item stays as it is.");
  }

  async function checkNow(rule?: PullRule) {
    setChecking(true);
    const outcome = await refreshPullRules({ force: true, ruleId: rule?.id });
    setChecking(false);
    setSuggestions((prev) => [...prev.filter((p) => !outcome.suggestions.some((n) => n.identity === p.identity)), ...outcome.suggestions]);
    setWishlist(loadWishlist()); setRules(loadPullRules());
    showToast(outcome.failed.length ? "The comic catalog could not be reached. Try again soon." : outcome.added || outcome.updated ? `${outcome.added} added, ${outcome.updated} date change${outcome.updated === 1 ? "" : "s"}.` : "Nothing new.");
  }

  const tabButton = (key: Tab, label: string, count: number) => (
    <PillButton key={key} variant={tab === key ? "active" : "default"} pressed={tab === key} onClick={() => setTab(key)}>
      {label} <span className="opacity-70" style={{ fontVariantNumeric: "tabular-nums" }}>{count}</span>
    </PillButton>
  );
  const activeRules = rules.filter((r) => r.state !== "stopped").length;
  const wishlistCount = openWants.length + watching.length;

  return (
    <>
      <PageHeader
        title="Watchlist"
        description={<span style={{ color: "var(--theme-text-muted,#61656B)" }}>Wishlist, Pull List and Following: what you want, what is coming, and what to collect for you.</span>}
        contentClassName="max-w-[1480px]"
        actions={
          <div className="flex items-center gap-2">
            <PillButton onClick={() => setChecklist(true)}><AppIcon name="document" size={15} />Checklist</PillButton>
            <PillButton variant="primary" onClick={() => setAdding({ mode: "manual" })}><AppIcon name="addItem" size={15} />Add</PillButton>
          </div>
        }
      />
      <main className="px-4 pb-32 sm:px-6 md:pb-8 lg:px-8">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-3">
          <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="watchlist-controls">
            {tabButton("wishlist", "Wishlist", wishlistCount)}
            {tabButton("pull", "Pull List", pullCount)}
            {tabButton("follow", "Following", activeRules)}
            {tab !== "follow" ? (
              <div className="flex w-full min-w-0 flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                <label className="flex h-10 min-w-[180px] items-center gap-2 rounded-[7px] border border-[rgba(203,208,213,0.22)] px-3" style={{ background: "var(--theme-card,rgba(15,25,45,0.85))" }}>
                  <Glyph name="search" size={15} className="opacity-60" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search wants" aria-label="Search wants" className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:opacity-45" />
                </label>
                <div className="-mx-1 flex min-w-0 items-center gap-2 overflow-x-auto px-1 pb-0.5 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&>*]:shrink-0">
                <PillSelect value={category} ariaLabel="Filter by category" align="right" minWidthPx={140} onChange={(v) => setCategory(v)} options={[{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c, label: c }))]} />
                {tab === "wishlist" ? (
                  <PillSelect value={show} ariaLabel="Show" align="right" minWidthPx={140} onChange={(v) => setShow(v as Show)} options={[{ value: "active", label: "Wants and watching" }, { value: "wants", label: "Wants only" }, { value: "watching", label: "Watching only" }, { value: "received", label: "Received" }, { value: "skipped", label: "Skipped" }]} />
                ) : null}
                <PillSelect value={sort} ariaLabel="Sort" align="right" minWidthPx={130} onChange={(v) => setSort(v as Sort)} options={[{ value: "priority", label: "Priority first" }, { value: "release", label: "Release date" }, { value: "newest", label: "Newest" }, { value: "az", label: "A to Z" }]} />
                {(query || category !== "all" || show !== "active") ? <PillButton size="compact" onClick={() => { setQuery(""); setCategory("all"); setShow("active"); }}>Clear all</PillButton> : null}
                </div>
              </div>
            ) : (
              <div className="ml-auto flex gap-2"><PillButton size="compact" variant="primary" onClick={() => setFollowing(true)}><AppIcon name="addItem" size={14} />Follow</PillButton></div>
            )}
          </div>

          {tab === "wishlist" ? (
            <section aria-label="Wishlist" className="flex flex-col gap-1.5">
              {wants.length === 0 && watchRows.length === 0 ? (
                <div className="rounded-[8px] border px-4 py-10 text-center" style={{ borderColor: "rgba(203,208,213,0.18)" }}>
                  <p className="text-sm font-semibold">{wishlist.length === 0 && watching.length === 0 ? "Nothing on your wishlist yet" : "Nothing matches that"}</p>
                  <p className="mx-auto mt-1 max-w-md text-[13px]" style={{ color: "var(--muted)" }}>{wishlist.length === 0 ? "Add what you want from a catalog, a link, or by typing it in. Any category works." : "Clear the search or filters to see everything."}</p>
                  {wishlist.length === 0 ? <PillButton className="mt-3" variant="primary" onClick={() => setAdding({ mode: "manual" })}>Add a want</PillButton> : <PillButton className="mt-3" onClick={() => { setQuery(""); setCategory("all"); setShow("active"); }}>Clear all</PillButton>}
                </div>
              ) : null}
              {wants.map((w) => (
                <WantRow key={w.id} want={w} open={openId === w.id} onToggle={() => setOpenId((id) => (id === w.id ? null : w.id))} onChange={save} onAcquire={setAcquiring} onRemove={(id) => { removeWishlistItem(id); reload(); setOpenId(null); }} ruleName={w.ruleId ? ruleNames.get(w.ruleId) : undefined} />
              ))}
              {watchRows.length > 0 ? (
                <div className="mt-2 flex flex-col gap-1.5" aria-label="Watching">
                  <h2 className="px-0.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--muted2)" }}>Watching (other people&apos;s items, not yours)</h2>
                  {watchRows.map((w) => (
                    <WatchingRow key={w.id} item={w} added={watchingIdentities.has(`watch:${w.id}`)} onAdd={() => addFromWatching(w)} onStop={() => { removeFromWatchlist(w.id); setWatching(loadWatchlist()); }} />
                  ))}
                </div>
              ) : null}
              <p className="px-0.5 pt-2 text-[12px]" style={{ color: "var(--muted)" }}>Exhibition bookmarks are not things to buy: they are on <Link href="/saved" className="underline underline-offset-2" style={{ color: "var(--theme-gold)" }}>Saved</Link>.</p>
            </section>
          ) : null}

          {tab === "pull" ? (
            <section aria-label="Pull List" className="flex flex-col gap-1.5">
              {pullGroups.length === 0 ? (
                <div className="rounded-[8px] border px-4 py-10 text-center" style={{ borderColor: "rgba(203,208,213,0.18)" }}>
                  <p className="text-sm font-semibold">Nothing is dated yet</p>
                  <p className="mx-auto mt-1 max-w-md text-[13px]" style={{ color: "var(--muted)" }}>The Pull List shows wants that have a release date or window. Add one with a date, or follow a comic series and its releases arrive here.</p>
                </div>
              ) : null}
              {pullGroups.map((g) => (
                <div key={g.key} className="flex flex-col gap-1.5" data-testid="pull-group">
                  <h2 className="flex items-baseline justify-between px-0.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--muted2)" }}><span>{g.label}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{g.total > 0 ? formatMoney(g.total) : ""}</span></h2>
                  {g.items.map((w) => (
                    <WantRow key={w.id} want={w} open={openId === w.id} onToggle={() => setOpenId((id) => (id === w.id ? null : w.id))} onChange={save} onAcquire={setAcquiring} onRemove={(id) => { removeWishlistItem(id); reload(); setOpenId(null); }} ruleName={w.ruleId ? ruleNames.get(w.ruleId) : undefined} />
                  ))}
                </div>
              ))}
            </section>
          ) : null}

          {tab === "follow" ? (
            <FollowTab
              rules={rules}
              wants={wishlist}
              suggestions={suggestions}
              inAccount={inAccount}
              checking={checking}
              onChanged={setRules}
              onCheck={(r) => void checkNow(r)}
              onAddRelease={(r) => setAdding({ mode: "manual", rule: r })}
              onAddSuggestion={(release, rule) => { save(wantFromRelease(release, { quantity: rule.quantity, seriesName: rule.name, ruleId: rule.id, formatNote: rule.formatNote })); setSuggestions((s) => s.filter((x) => x.identity !== release.identity)); }}
              onFollow={() => setFollowing(true)}
            />
          ) : null}

          {tab !== "follow" ? (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-[13px]" style={{ borderColor: "rgba(203,208,213,0.18)" }} data-testid="planned-total">
              <span>Planned total <b style={{ fontVariantNumeric: "tabular-nums" }}>{formatMoney(visibleTotals.total)}</b> <span style={{ color: "var(--muted)" }}>from {visibleTotals.priced} priced {visibleTotals.priced === 1 ? "want" : "wants"}, with quantities</span></span>
              {visibleTotals.unpriced > 0 ? <span className="rounded-full border px-2.5 py-0.5 text-[12px]" style={{ borderColor: "rgba(224,166,76,0.5)", color: "#e0a64c" }}>{visibleTotals.unpriced} without a price, not counted</span> : null}
            </div>
          ) : null}
        </div>
      </main>

      {adding ? (
        <AddWantSheet
          watching={watching}
          initialMode={adding.mode}
          ruleId={adding.rule?.id}
          presetSeries={adding.rule?.name}
          onClose={() => setAdding(null)}
          onAdded={(item) => { reload(); showToast(`Added: ${item.title}`); }}
        />
      ) : null}
      {acquiring ? <AcquireSheet want={acquiring} onClose={() => setAcquiring(null)} onSaved={(updated) => save(updated)} /> : null}
      {following ? <FollowSheet onClose={() => setFollowing(false)} onCreated={(rule) => { setRules(loadPullRules()); setTab("follow"); void checkNow(rule); }} /> : null}
      {checklist ? <ChecklistSheet items={wishlist} onClose={() => setChecklist(false)} /> : null}
    </>
  );
}
