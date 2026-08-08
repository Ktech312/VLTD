"use client";

// ─────────────────────────────────────────────────────────────────────────────
// /vault/halls — build a custom cross-category collection from search terms.
//
// EK's spec: type a term ("Marvel") -> matches show up, all selected by
// default. Type another term ("Spiderman") -> those items get ADDED to the
// working set too, even if they weren't "Marvel" -- each term is an
// independent OR match, not a narrowing filter. Universe/Category are a
// separate AND filter on top. Deselect what you don't want, name the rest,
// save it as a private exhibition (the existing Museum/gallery system).
// Works for every universe -- Music, plants, bar items, everything -- since
// it's a real search over your data, not a hardcoded pop-culture list.
// ─────────────────────────────────────────────────────────────────────────────

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { PillButton } from "@/components/ui/PillButton";
import { Glyph } from "@/components/ui/Glyph";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { universePlaceholder } from "@/lib/itemPlaceholder";
import {
  loadItems,
  saveItems,
  syncVaultItemsFromSupabase,
  getPrimaryImageUrl,
  type VaultItem,
} from "@/lib/vaultModel";
import { syncAllItemsToCloud } from "@/lib/vaultSyncQueue";
import { searchVaultItems } from "@/lib/vaultSearch";
import { suggestAutoTags } from "@/lib/generateHashtags";
import { getUniverses, getCategories, UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
import { createGallery, updateGallery, setGalleryItemIds, loadGalleries, type Gallery } from "@/lib/galleryModel";

const ACTIVE_PROFILE_EVENT = "vltd:active-profile";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatValue(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

// ─── Thumbnail ────────────────────────────────────────────────────────────────

function ItemThumb({
  item,
  selected,
  onToggle,
  matchedTerms,
}: {
  item: VaultItem;
  selected: boolean;
  onToggle: () => void;
  matchedTerms?: string[];
}) {
  const src = getPrimaryImageUrl(item);
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[color:var(--bg)] bg-[color:var(--pill)] ring-1 ring-[color:var(--border)] transition-colors"
        style={selected ? { backgroundColor: "var(--theme-gold)" } : {}}
        title={selected ? "Remove from selection" : "Add to selection"}
      >
        {selected && (
          <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <Link
        href={`/vault/item/${item.id}`}
        className={[
          "group relative block aspect-square overflow-hidden rounded-xl bg-[color:var(--pill)] ring-1 transition-all",
          selected ? "ring-[color:var(--theme-gold)] ring-2" : "ring-[color:var(--border)] opacity-60",
        ].join(" ")}
        title={matchedTerms?.length ? `Matched: ${matchedTerms.join(", ")}` : item.title}
      >
        {src ? (
          <ProgressiveImage
            src={src}
            alt={item.title}
            className="h-full w-full"
            imageClassName="object-contain object-center transition duration-300 group-hover:scale-105"
            draggable={false}
          />
        ) : (
          <img
            src={universePlaceholder(item.universe)}
            alt=""
            className="h-full w-full object-cover opacity-[0.22]"
            draggable={false}
          />
        )}
        {item.grade && (
          <div className="absolute bottom-1 left-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white/90 backdrop-blur-sm">
            {item.grade}
          </div>
        )}
      </Link>
    </div>
  );
}

// ─── Term chip input ──────────────────────────────────────────────────────────

function TermInput({ terms, onAdd, onRemove }: { terms: string[]; onAdd: (t: string) => void; onRemove: (t: string) => void }) {
  const [draft, setDraft] = useState("");

  function commit() {
    const value = draft.trim();
    if (value) onAdd(value);
    setDraft("");
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-[color:var(--pill)] p-2 ring-1 ring-[color:var(--border)]">
      {terms.map((term) => (
        <span
          key={term}
          className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--theme-gold)] px-3 py-1 text-[13px] font-bold text-black"
        >
          {term}
          <button onClick={() => onRemove(term)} aria-label={`Remove ${term}`} className="opacity-70 hover:opacity-100">
            &#x2715;
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && terms.length) {
            onRemove(terms[terms.length - 1]);
          }
        }}
        onBlur={commit}
        placeholder={terms.length ? "Add another term…" : "Search by name, brand, universe, tag…"}
        className="min-w-[160px] flex-1 bg-transparent px-2 py-1.5 text-sm text-[color:var(--fg)] placeholder:text-[color:var(--muted2)] outline-none"
      />
    </div>
  );
}

// ─── Save modal ───────────────────────────────────────────────────────────────

function SaveHallModal({
  selectedCount,
  onSave,
  onCancel,
}: {
  selectedCount: number;
  onSave: (title: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} aria-label="Close" />
      <div className="relative z-10 w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-[color:var(--surface)] p-6 shadow-2xl ring-1 ring-[color:var(--border)]">
        <h3 className="text-lg font-black text-[color:var(--fg)]">Name this Hall</h3>
        <p className="mt-1 text-[13px] text-[color:var(--muted)]">
          {selectedCount} {selectedCount === 1 ? "item" : "items"} selected · private until you choose to share it
        </p>
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Spider-Man Everything"
          className="mt-5 w-full rounded-xl bg-[color:var(--pill)] px-4 py-2.5 text-sm text-[color:var(--fg)] placeholder:text-[color:var(--muted2)] ring-1 ring-[color:var(--border)] focus:outline-none focus:ring-[color:var(--theme-gold)]"
          onKeyDown={(e) => e.key === "Enter" && title.trim() && onSave(title.trim())}
        />
        <div className="mt-5 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl bg-[color:var(--pill)] py-2.5 text-sm font-semibold text-[color:var(--fg)] ring-1 ring-[color:var(--border)] hover:opacity-75 transition-opacity"
          >
            Cancel
          </button>
          <button
            onClick={() => title.trim() && onSave(title.trim())}
            disabled={!title.trim()}
            className="flex-1 rounded-xl bg-[color:var(--theme-gold)] py-2.5 text-sm font-black text-black hover:opacity-85 transition-opacity disabled:opacity-40"
          >
            Save Hall
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Saved Halls list (shown when there's no active search) ─────────────────

function SavedHallsList({ galleries }: { galleries: Gallery[] }) {
  if (galleries.length === 0) return null;
  return (
    <div className="mb-8">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-[color:var(--muted2)]">Your Halls</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {galleries.map((g) => (
          <Link
            key={g.id}
            href={`/museum/${g.id}`}
            className="flex items-center justify-between rounded-2xl bg-[color:var(--surface)] px-4 py-3 ring-1 ring-[color:var(--border)] hover:opacity-80 transition-opacity"
          >
            <div>
              <div className="text-sm font-bold text-[color:var(--fg)]">{g.title}</div>
              <div className="text-[12px] text-[color:var(--muted)]">
                {g.itemIds.length} {g.itemIds.length === 1 ? "item" : "items"} · {g.visibility === "LOCKED" ? "Private" : "Shared"}
              </div>
            </div>
            <Glyph name="building" size={18} className="text-[color:var(--muted2)]" />
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VaultHallsPage() {
  const router = useRouter();
  const [items, setItems] = useState<VaultItem[]>([]);
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [syncing, setSyncing] = useState(true);

  const [terms, setTerms] = useState<string[]>([]);
  const [universe, setUniverse] = useState<UniverseKey | "">("");
  const [categoryLabel, setCategoryLabel] = useState("");
  const [deselectedIds, setDeselectedIds] = useState<Set<string>>(new Set());
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState("");

  function refresh() {
    setItems(loadItems());
    setGalleries(loadGalleries());
    setSyncing(true);
    syncVaultItemsFromSupabase()
      .then(() => setItems(loadItems()))
      .catch(console.error)
      .finally(() => setSyncing(false));
  }

  useEffect(() => {
    refresh();
    window.addEventListener(ACTIVE_PROFILE_EVENT, refresh);
    return () => window.removeEventListener(ACTIVE_PROFILE_EVENT, refresh);
  }, []);

  const { results, matchedTermsByItemId } = useMemo(
    () => searchVaultItems(items, terms, { universe: universe || undefined, categoryLabel: categoryLabel || undefined }),
    [items, terms, universe, categoryLabel]
  );

  const selectedItems = useMemo(() => results.filter((i) => !deselectedIds.has(i.id)), [results, deselectedIds]);
  const totalValue = useMemo(
    () => selectedItems.reduce((s, i) => s + (i.currentValue ?? i.purchasePrice ?? 0), 0),
    [selectedItems]
  );

  const categoryOptions = universe ? getCategories(universe) : [];
  const hasSearch = terms.length > 0;

  // Every tag actually in use across the vault, most-used first -- lets
  // people search by picking a real tag instead of guessing a spelling.
  const popularTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      for (const tag of item.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag)
      .filter((tag) => !terms.some((t) => t.toLowerCase() === tag.toLowerCase()));
  }, [items, terms]);

  const untaggedCount = useMemo(() => items.filter((i) => !i.tags || i.tags.length === 0).length, [items]);

  // Retroactive tagging -- auto-tagging on save only covers NEW items, so
  // everything already in the vault before this feature existed has zero
  // tags otherwise. Same suggestion engine as item creation.
  async function backfillTags() {
    if (backfilling) return;
    setBackfilling(true);
    setBackfillStatus("");
    try {
      const allItems = loadItems({ includeAllProfiles: true });
      let taggedCount = 0;
      const updated = allItems.map((item) => {
        if (item.tags && item.tags.length > 0) return item;
        const tags = suggestAutoTags(item);
        if (!tags.length) return item;
        taggedCount += 1;
        return { ...item, tags };
      });
      saveItems(updated);
      setItems(loadItems());
      setBackfillStatus(`Tagged ${taggedCount} item${taggedCount === 1 ? "" : "s"}.`);
      void syncAllItemsToCloud().catch(console.error);
    } catch (e) {
      console.error("Backfill tagging failed", e);
      setBackfillStatus("Something went wrong tagging your items.");
    } finally {
      setBackfilling(false);
    }
  }

  function addTerm(term: string) {
    setTerms((prev) => (prev.some((t) => t.toLowerCase() === term.toLowerCase()) ? prev : [...prev, term]));
  }
  function removeTerm(term: string) {
    setTerms((prev) => prev.filter((t) => t !== term));
  }
  function toggleItem(id: string) {
    setDeselectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAllResults() {
    setDeselectedIds(new Set());
  }

  async function handleSave(title: string) {
    if (selectedItems.length === 0 || saving) return;
    setSaving(true);
    try {
      const gallery = createGallery(title);
      updateGallery({ ...gallery, visibility: "LOCKED" });
      setGalleryItemIds(gallery.id, selectedItems.map((i) => i.id));
      setShowSaveModal(false);
      router.push(`/museum/${gallery.id}`);
    } catch (e) {
      console.error("Failed to save hall", e);
      setSaving(false);
    }
  }

  const isEmptyVault = items.length === 0;

  return (
    <>
      <div className="min-h-screen bg-[color:var(--bg)] pb-24">
        {/* Header */}
        <div className="sticky top-0 z-20 border-b border-[color:var(--border)] bg-[color:var(--bg)]/90 backdrop-blur-md">
          <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Link href="/vault" className="text-[color:var(--muted)] hover:text-[color:var(--fg)] transition-colors text-sm">
                  &larr; Vault
                </Link>
                <div className="h-4 w-px bg-[color:var(--border)]" />
                <h1 className="text-lg font-black tracking-tight text-[color:var(--fg)]">Halls</h1>
                {syncing && <span className="text-[11px] text-[color:var(--muted2)] animate-pulse">syncing…</span>}
              </div>
              <PillButton href="/vault">Back to vault</PillButton>
            </div>

            {/* Search */}
            {!isEmptyVault && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
                <div className="flex-1">
                  <TermInput terms={terms} onAdd={addTerm} onRemove={removeTerm} />
                </div>
                <div className="flex gap-2">
                  <select
                    value={universe}
                    onChange={(e) => {
                      setUniverse(e.target.value as UniverseKey | "");
                      setCategoryLabel("");
                    }}
                    className="rounded-xl bg-[color:var(--pill)] px-3 py-2 text-sm text-[color:var(--fg)] ring-1 ring-[color:var(--border)] focus:outline-none"
                  >
                    <option value="">All universes</option>
                    {getUniverses().map((u) => (
                      <option key={u} value={u}>{UNIVERSE_LABEL[u]}</option>
                    ))}
                  </select>
                  {universe && (
                    <select
                      value={categoryLabel}
                      onChange={(e) => setCategoryLabel(e.target.value)}
                      className="rounded-xl bg-[color:var(--pill)] px-3 py-2 text-sm text-[color:var(--fg)] ring-1 ring-[color:var(--border)] focus:outline-none"
                    >
                      <option value="">All categories</option>
                      {categoryOptions.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}

            {/* Browse existing tags — pick from what's real instead of guessing spellings */}
            {!isEmptyVault && popularTags.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-[color:var(--muted2)]">Tags:</span>
                {popularTags.slice(0, 12).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => addTerm(tag)}
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 transition hover:bg-[color:var(--pill)]"
                    style={{ color: "var(--muted)", borderColor: "var(--border)" }}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          {isEmptyVault && !syncing && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Glyph name="building" size={56} className="text-[color:var(--muted2)]" />
              <h2 className="mt-6 text-2xl font-black text-[color:var(--fg)]">Your halls are empty</h2>
              <p className="mt-2 max-w-sm text-[color:var(--muted)]">
                Add items to your vault, then search here to build a custom Hall — by franchise, brand, universe,
                tag, or anything else.
              </p>
              <div className="mt-8">
                <PillButton href="/capture" variant="primary">Add your first item</PillButton>
              </div>
            </div>
          )}

          {!isEmptyVault && !hasSearch && <SavedHallsList galleries={galleries} />}

          {!isEmptyVault && !hasSearch && (
            <div className="rounded-2xl bg-[color:var(--theme-elevated)] px-5 py-4 ring-1 ring-[color:var(--theme-border)]">
              <p className="text-[13px] text-[color:var(--muted)]">
                <span className="font-semibold text-[color:var(--fg)]">Type a search term above to start a new
                Hall.</span>{" "}
                Add more terms and each one adds its own matches to the set — search for &ldquo;Marvel&rdquo; and
                &ldquo;Spiderman&rdquo; together to catch everything either one turns up. Everything found is
                selected by default; tap an item to leave it out, then save the rest under whatever name you want.
              </p>
            </div>
          )}

          {!isEmptyVault && !hasSearch && untaggedCount > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[color:var(--surface)] px-5 py-3 ring-1 ring-[color:var(--border)]">
              <p className="text-[13px] text-[color:var(--muted)]">
                <span className="font-semibold text-[color:var(--fg)]">{untaggedCount}</span> item
                {untaggedCount === 1 ? "" : "s"} in your vault {untaggedCount === 1 ? "has" : "have"} no tags yet —
                auto-tagging only runs on new items, so anything added before this feature won't show up in tag
                search until it's tagged.
              </p>
              <div className="flex items-center gap-2">
                {backfillStatus && <span className="text-[12px] text-[color:var(--muted)]">{backfillStatus}</span>}
                <button
                  onClick={() => void backfillTags()}
                  disabled={backfilling}
                  className="shrink-0 rounded-[8px] bg-[color:var(--theme-gold)] px-4 py-1.5 text-sm font-black text-black hover:opacity-85 transition-opacity disabled:opacity-40"
                >
                  {backfilling ? "Tagging…" : "Auto-tag my collection"}
                </button>
              </div>
            </div>
          )}

          {hasSearch && (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-[color:var(--muted)]">
                  <span className="font-semibold text-[color:var(--fg)]">{selectedItems.length}</span> of{" "}
                  {results.length} selected
                  {totalValue > 0 && (
                    <> · <span className="font-semibold text-[color:var(--theme-gold)]">{formatValue(totalValue)}</span></>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={selectAllResults}
                    disabled={deselectedIds.size === 0}
                    className="text-[12px] font-semibold text-[color:var(--theme-gold)] hover:opacity-75 transition-opacity disabled:opacity-40"
                  >
                    Select all
                  </button>
                  <button
                    onClick={() => selectedItems.length > 0 && setShowSaveModal(true)}
                    disabled={selectedItems.length === 0}
                    className="rounded-[8px] bg-[color:var(--theme-gold)] px-4 py-1.5 text-sm font-black text-black hover:opacity-85 transition-opacity disabled:opacity-40"
                  >
                    Save as Hall
                  </button>
                </div>
              </div>

              {results.length === 0 ? (
                <div className="py-16 text-center text-[color:var(--muted)]">
                  No items match {terms.map((t) => `"${t}"`).join(" or ")}
                  {universe ? ` in ${UNIVERSE_LABEL[universe]}` : ""}.
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
                  {results.map((item) => (
                    <ItemThumb
                      key={item.id}
                      item={item}
                      selected={!deselectedIds.has(item.id)}
                      onToggle={() => toggleItem(item.id)}
                      matchedTerms={matchedTermsByItemId.get(item.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showSaveModal && (
        <SaveHallModal selectedCount={selectedItems.length} onSave={handleSave} onCancel={() => setShowSaveModal(false)} />
      )}
    </>
  );
}
