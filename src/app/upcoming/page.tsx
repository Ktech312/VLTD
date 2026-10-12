"use client";

import { DiscoverNav } from "@/components/SectionNav";
import { PageHeader } from "@/components/layout/PageHeader";
import { PillButton } from "@/components/ui/PillButton";
import { PillSelect } from "@/components/ui/PillSelect";
import { AppIcon } from "@/components/ui/AppIcon";
import { useState, useRef, useEffect, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  fetchAllSources,
  groupByYear,
  groupByReleaseDate,
  formatStoreDate,
  roleLabel,
  isCoverOnlyRole,
  type UpcomingIssue,
  type UpcomingComicsResult,
} from "@/lib/comicUpcoming";
import {
  COMIC_STATUS_LABEL,
  comicTitle,
  findOwnedComic,
  loadComicStatuses,
  loadOwnedCatalogTitles,
  ownComic,
  refreshComicStatuses,
  setComicWish,
  undoOwnComic,
  type ComicStatus,
} from "@/lib/comicWishlistModel";
import { showToast } from "@/lib/toast";

const STATUS_ORDER: ComicStatus[] = ["want", "preordered", "own"];
// Short labels so all three fit one row on a 140px card.
const CARD_LABEL: Record<ComicStatus, string> = { want: "Want", preordered: "Ordered", own: "Own" };

/* ── Publisher pills ──────────────────────────────────────────── */

const ALL_PUBLISHERS = [
  { label: "Marvel",     value: "Marvel" },
  { label: "DC",         value: "DC Comics" },
  { label: "Dark Horse", value: "Dark Horse Comics" },
  { label: "Image",      value: "Image Comics" },
  { label: "IDW",        value: "IDW Publishing" },
  { label: "BOOM!",      value: "BOOM! Studios" },
];

/* ── Issue card ──────────────────────────────────────────────── */

function IssueCard({
  issue,
  status,
  onStatus,
}: {
  issue: UpcomingIssue;
  status: ComicStatus | null;
  onStatus: (issue: UpcomingIssue, status: ComicStatus | null) => void;
}) {
  const [imgError, setImgError] = useState(false);
  const metronUrl = `https://metron.cloud/issue/${issue.id}/`;
  const role = roleLabel(issue.creatorRole);
  const isCoverOnly = isCoverOnlyRole(issue.creatorRole);

  return (
    <a
      href={metronUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-full flex-col overflow-hidden rounded-[12px] bg-[color:var(--surface)] ring-1 ring-[color:var(--border)] transition hover:ring-[color:var(--pill-active-ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pill-active-ring)]"
    >
      <div className="relative aspect-[2/3] w-full shrink-0 bg-[color:var(--pill)]">
        {issue.imageUrl && !imgError ? (
          <Image
            src={issue.imageUrl}
            alt={`${issue.series} #${issue.number}`}
            fill
            sizes="(max-width: 640px) 45vw, 160px"
            style={{ objectFit: "cover" }}
            onError={() => setImgError(true)}
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[color:var(--muted)]">
            <AppIcon name="book" size={34} />
          </div>
        )}

        {issue.isVariant && (
          <div className="absolute left-1.5 top-1.5 rounded-[4px] px-1.5 py-0.5 text-[10px] font-bold tracking-[0.05em]" style={{ background: "#6b2fa0", color: "#fff" }}>
            VARIANT
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 px-2.5 pb-3 pt-2.5">
        <div className="line-clamp-2 text-[12px] font-bold leading-[1.3] text-[color:var(--fg)]">{issue.series}</div>
        <div className="text-[11px] font-semibold text-[color:var(--muted)]">#{issue.number}</div>

        {role && (
          <span
            className="self-start rounded-[4px] px-1.5 py-0.5 text-[10px] font-bold"
            style={isCoverOnly ? { background: "#6b2fa0", color: "#fff" } : { background: "var(--pill)", color: "var(--fg)", boxShadow: "inset 0 0 0 1px var(--border)" }}
          >
            {role}
          </span>
        )}

        <div className="mt-auto flex flex-col gap-1 pt-1">
          {issue.storeDate && (
            <div className="text-[11px] font-medium text-[color:var(--muted)]">{formatStoreDate(issue.storeDate)}</div>
          )}
          {/* Want / Pre-ordered / Own -- tap the lit one again to clear it. */}
          <div role="group" aria-label="My status" className="my-1 flex gap-1">
            {STATUS_ORDER.map((s) => {
              const on = status === s;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  title={COMIC_STATUS_LABEL[s]}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onStatus(issue, on ? null : s); }}
                  className={[
                    "h-11 min-w-0 flex-1 rounded-[8px] px-0.5 text-[10px] ring-1 transition select-none md:h-9",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pill-active-ring)]",
                    on
                      ? "bg-[color:var(--pill)] font-semibold text-[color:var(--fg)] ring-[color:var(--pill-active-ring)] vltd-selected"
                      : "bg-[color:var(--pill)] font-medium text-[color:var(--fg)] ring-[color:var(--border)] hover:bg-[color:var(--pill-hover)]",
                  ].join(" ")}
                >
                  {CARD_LABEL[s]}
                </button>
              );
            })}
          </div>
          <div className="truncate text-[11px] text-[color:var(--muted2)]">{issue.publisher}</div>
        </div>
      </div>
    </a>
  );
}

/* ── Main page ───────────────────────────────────────────────── */

export default function UpcomingPage() {
  const [mode, setMode]               = useState<"creator" | "series">("creator");
  const [query, setQuery]             = useState("");
  const [selectedPubs, setSelectedPubs] = useState<Set<string>>(new Set());
  const [days, setDays]               = useState(90);
  const [allMode, setAllMode]         = useState(false);
  const [loading, setLoading]         = useState(true); // initial browse load
  const [loadingMore, setLoadingMore] = useState(false);
  const [fedResult, setFedResult]     = useState<UpcomingComicsResult | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [statuses, setStatuses]       = useState<Map<number, ComicStatus>>(new Map());
  const [saving, setSaving]           = useState<Set<number>>(new Set());
  const [ownedTitles, setOwnedTitles] = useState<Set<string>>(new Set());
  const statusOf = (issue: UpcomingIssue): ComicStatus | null =>
    statuses.get(issue.id) ?? (ownedTitles.has(comicTitle(issue.series, issue.number)) ? "own" : null);
  const [notFound, setNotFound]       = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Statuses: instant from this device's copy, then refreshed from the account.
  useEffect(() => {
    let active = true;
    void refreshComicStatuses().then((m) => {
      if (!active) return;
      setStatuses(m);
      setOwnedTitles(loadOwnedCatalogTitles());
    });
    const onChange = () => {
      setStatuses(loadComicStatuses());
      setOwnedTitles(loadOwnedCatalogTitles());
    };
    window.addEventListener("vltd:wishlist-updated", onChange);
    window.addEventListener("vltd:vault-updated", onChange);
    return () => {
      active = false;
      window.removeEventListener("vltd:wishlist-updated", onChange);
      window.removeEventListener("vltd:vault-updated", onChange);
    };
  }, []);

  // Open on the full upcoming list, like a comic shop's pre-order page.
  // Same request the Search button sends with an empty box.
  useEffect(() => {
    let cancelled = false;
    fetchAllSources({ days: 90, page: 1, pageSize: 25, byDate: true }).then((data) => {
      if (cancelled) return;
      setLoading(false);
      if (!data) return;
      setFedResult((prev) => prev ?? data);
      setCurrentPage(1);
    });
    return () => { cancelled = true; };
  }, []);

  /**
   * pubOverride: undefined = use current selectedPubs; null = no filter; string = specific publisher
   */
  async function handleSearch(pg = 1, pubOverride?: string | null) {
    const q = query.trim();
    // No name = browse everything releasing in the window (soonest first).
    // Never browse the whole back catalog unfiltered.
    if (!q && allMode) return;

    const isLoadMore = pg > 1;
    if (isLoadMore) setLoadingMore(true);
    else { setLoading(true); setNotFound(false); }

    const singlePub =
      pubOverride !== undefined
        ? (pubOverride ?? undefined)
        : selectedPubs.size === 1
        ? Array.from(selectedPubs)[0]
        : undefined;

    const opts = {
      days: allMode ? undefined : days,
      all: allMode || undefined,
      page: pg,
      pageSize: 25,
      byDate: !allMode,
      publisher: singlePub,
      ...(q ? (mode === "creator" ? { creator: q } : { series: q }) : {}),
    };

    const data = await fetchAllSources(opts);

    if (!data || (data.results.length === 0 && pg === 1)) {
      if (!isLoadMore) { setFedResult(null); setNotFound(true); }
    } else if (data && isLoadMore && fedResult) {
      setFedResult({ ...data, results: [...fedResult.results, ...data.results] });
      setCurrentPage(pg);
    } else if (data) {
      setFedResult(data as UpcomingComicsResult);
      setCurrentPage(pg);
    }

    if (isLoadMore) setLoadingMore(false);
    else setLoading(false);
  }

  async function handleStatus(issue: UpcomingIssue, next: ComicStatus | null) {
    if (saving.has(issue.id)) return;
    const prev = statusOf(issue);
    const apply = (value: ComicStatus | null) =>
      setStatuses((m) => { const n = new Map(m); if (value) n.set(issue.id, value); else n.delete(issue.id); return n; });

    // Already in the vault: never delete it from here (it may have been edited since).
    if (prev === "own") {
      const owned = findOwnedComic(issue);
      showToast("Already in your vault", 4000, owned ? { label: "Open", onClick: () => router.push(`/vault/item/${owned.id}`) } : undefined);
      return;
    }

    apply(next);
    setSaving((p) => new Set(p).add(issue.id));
    // .catch instead of try/finally keeps this component compiler-optimized.
    await saveStatus(issue, next, prev).catch(() => {
      apply(prev);
      showToast("Couldn't save that. Try again.");
    });
    setSaving((p) => { const n = new Set(p); n.delete(issue.id); return n; });

    async function saveStatus(target: UpcomingIssue, value: ComicStatus | null, before: ComicStatus | null) {
      if (value === "own") {
        const res = await ownComic(target);
        if (!res.ok) {
          apply(before);
          showToast("Couldn't add that to your vault. Try again.");
          return;
        }
        showToast(`Added "${res.item.title}" to your vault`, 7000, {
          label: "Undo",
          onClick: () => {
            void undoOwnComic(target, res.item.id, res.previousWish).then((ok) => {
              setStatuses(loadComicStatuses());
              setOwnedTitles(loadOwnedCatalogTitles());
              showToast(ok ? "Removed from your vault" : "Couldn't undo. Delete it from the item page.");
            });
          },
        });
        return;
      }
      const ok = await setComicWish(target, value);
      if (!ok) {
        // Don't leave a change only on this device: put it back.
        await setComicWish(target, before === "want" || before === "preordered" ? before : null);
        apply(before);
        showToast("Couldn't save to your account. Try again.");
      }
    }
  }


  function togglePub(value: string) {
    const next = new Set(selectedPubs);
    if (next.has(value)) next.delete(value); else next.add(value);
    // If all individually selected → snap to "All" (no filter)
    if (next.size === ALL_PUBLISHERS.length) {
      setSelectedPubs(new Set());
      if (fedResult) handleSearch(1, null);
      return;
    }
    setSelectedPubs(next);
    if (fedResult) {
      if (next.size === 1) handleSearch(1, Array.from(next)[0]); // server-side filter
      else if (next.size === 0) handleSearch(1, null);           // clear filter
      // 2+ selected: client-side filter only (no re-fetch)
    }
  }

  const filteredResults = useMemo(() => {
    if (!fedResult) return [];
    if (selectedPubs.size === 0 || selectedPubs.size === 1) return fedResult.results; // server filtered or unfiltered
    return fedResult.results.filter((issue) =>
      Array.from(selectedPubs).some((pub) =>
        issue.publisher.toLowerCase().includes(pub.toLowerCase())
      )
    );
  }, [fedResult, selectedPubs]);

  // Upcoming: a row per release date (each "Load more" adds the next date below).
  // Back catalog ("All"): a row per year, newest first.
  const groups = useMemo(
    () => (allMode
      ? groupByYear(filteredResults, "desc").map((g) => ({ label: g.year, issues: g.issues }))
      : groupByReleaseDate(filteredResults)),
    [filteredResults, allMode]
  );
  const totalCount   = fedResult?.count ?? 0;
  const shownCount   = filteredResults.length;
  const variantCount = filteredResults.filter((r) => r.isVariant).length;
  const creatorName  = fedResult?.resolvedCreator?.name;

  const inputCls = "h-11 min-w-0 flex-1 rounded-[8px] bg-[color:var(--pill)] px-3 text-[13px] text-[color:var(--fg)] ring-1 ring-[color:var(--border)] placeholder:text-[color:var(--muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pill-active-ring)] md:h-9";

  return (
    <>
      <PageHeader
        title="Upcoming Comics"
        description={statuses.size > 0 ? `Releases by artist or series. ${statuses.size} saved.` : "Releases by artist or series."}
        contentClassName="max-w-[900px]"
      />
      <main className="text-[color:var(--fg)]" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 90px)" }}>
        <DiscoverNav activeKey="upcoming" />
        <div className="mx-auto max-w-[900px] px-4">
          {/* Mode toggle */}
          <div className="flex flex-wrap gap-2">
            {(["creator", "series"] as const).map((m) => (
              <PillButton
                key={m}
                variant={mode === m ? "active" : "default"}
                onClick={() => { setMode(m); setFedResult(null); setNotFound(false); }}
              >
                {m === "creator" ? "By Artist" : "By Series"}
              </PillButton>
            ))}
          </div>

          {/* Search bar */}
          <form onSubmit={(e) => { e.preventDefault(); handleSearch(1); }} className="mt-3 flex gap-2">
            <input
              ref={inputRef} type="text" value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={mode === "creator" ? "Artist name" : "Series title"}
              placeholder={mode === "creator" ? "Artist name, for example Peach Momoko" : "Series title, for example Demon Days"}
              className={inputCls}
            />
            <PillButton
              type="submit"
              disabled={loading}
              className="font-black"
              style={{ background: "linear-gradient(180deg, #79E7FB, #41C6E4 55%, #2CB1D1)", color: "#06171d", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), 0 0 16px rgba(79,211,238,0.25)" }}
            >
              <AppIcon name="search" size={16} />
              {loading ? "Searching…" : "Search"}
            </PillButton>
          </form>

          {/* Publisher pills + date range */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <PillButton
              variant={selectedPubs.size === 0 ? "active" : "default"}
              onClick={() => { setSelectedPubs(new Set()); if (fedResult) handleSearch(1, null); }}
            >
              All publishers
            </PillButton>
            {ALL_PUBLISHERS.map((p) => (
              <PillButton key={p.value} variant={selectedPubs.has(p.value) ? "active" : "default"} onClick={() => togglePub(p.value)}>
                {p.label}
              </PillButton>
            ))}
            <PillSelect
              value={allMode ? "all" : String(days)}
              ariaLabel="Date range"
              align="right"
              minWidthPx={150}
              onChange={(next) => {
                if (next === "all") setAllMode(true);
                else { setDays(Number(next)); setAllMode(false); }
              }}
              options={[
                { value: "30", label: "Next 30 days" },
                { value: "60", label: "Next 60 days" },
                { value: "90", label: "Next 90 days" },
                { value: "180", label: "Next 180 days" },
                { value: "all", label: "All time" },
              ]}
            />
          </div>

          <div className="mt-5">
            {/* Banner */}
            {fedResult && (
              <div className="mb-3.5 rounded-[10px] bg-[color:var(--surface)] px-3.5 py-2.5 text-[13px] text-[color:var(--fg)] ring-1 ring-[color:var(--border)]">
                {creatorName && <><strong>{creatorName}</strong>{" · "}</>}
                {selectedPubs.size > 1
                  ? <>{shownCount} shown of {totalCount} total</>
                  : <>{totalCount} issue{totalCount !== 1 ? "s" : ""}</>}
                {allMode ? " (all time)" : ` in next ${days} days`}
                {variantCount > 0 && (
                  <> · <span className="font-semibold">{variantCount} variant{variantCount !== 1 ? "s" : ""}</span></>
                )}
              </div>
            )}

            {/* Not found */}
            {notFound && !loading && (
              <div className="px-5 py-14 text-center text-[color:var(--muted)]">
                <div className="mb-3 flex justify-center"><AppIcon name="search" size={40} /></div>
                <div className="mb-1.5 text-base font-semibold text-[color:var(--fg)]">Nothing found</div>
                <div className="text-[13px]">
                  {mode === "creator" ? "Try the full name, for example \"Peach Momoko\" rather than \"Momoko\"."
                    : "Try a partial title or check the publisher filter."}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!fedResult && !notFound && !loading && (
              <div className="px-5 py-14 text-center text-[color:var(--muted)]">
                <div className="mb-3.5 flex justify-center"><AppIcon name="events" size={44} /></div>
                <div className="mb-1.5 text-base font-semibold text-[color:var(--fg)]">Find what&apos;s dropping soon</div>
                <div className="text-[13px] leading-relaxed">
                  Search by artist or series. Data from Metron. Variants are detected automatically.
                </div>
              </div>
            )}

            {/* Loading skeleton */}
            {loading && (
              <div role="status" aria-label="Loading upcoming comics" className="flex flex-col gap-7">
                {[2026, 2025].map((y) => (
                  <div key={y}>
                    <div className="vltd-skeleton-pulse mb-2.5 h-4 w-[60px] rounded-[6px] bg-[color:var(--pill)]" />
                    <div className="flex gap-2.5 overflow-hidden">
                      {[1, 2, 3, 4, 5].map((c) => (
                        <div key={c} className="vltd-skeleton-pulse aspect-[2/3] w-[156px] shrink-0 rounded-[10px] bg-[color:var(--pill)]" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Release rows */}
            {!loading && groups.map((group) => (
              <div key={group.label} className="mb-7">
                <div className="mb-2.5 flex items-center gap-2.5">
                  <div className="text-sm font-extrabold tracking-[0.06em] text-[color:var(--fg)]">{group.label}</div>
                  <div className="h-px flex-1 bg-[color:var(--border)]" />
                  <div className="text-[11px] text-[color:var(--muted)]">
                    {group.issues.length} issue{group.issues.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <div className="year-row flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-2">
                  {group.issues.map((issue) => (
                    <div key={issue.id} className="w-[156px] shrink-0 snap-start">
                      <IssueCard issue={issue} status={statusOf(issue)} onStatus={handleStatus} />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Load more */}
            {!loading && fedResult?.hasMore && (
              <div className="flex justify-center pb-4">
                <PillButton onClick={() => handleSearch(currentPage + 1)} disabled={loadingMore}>
                  {loadingMore ? "Loading…" : `Load more (${totalCount - shownCount} remaining)`}
                </PillButton>
              </div>
            )}
          </div>
        </div>

        <style>{`
          @keyframes vltd-upcoming-pulse { 0%,100%{opacity:.5} 50%{opacity:.9} }
          .vltd-skeleton-pulse { animation: vltd-upcoming-pulse 1.5s ease-in-out infinite }
          .year-row::-webkit-scrollbar { display: none }
        `}</style>
      </main>
    </>
  );
}
