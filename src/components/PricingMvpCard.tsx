"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { AppIcon } from "@/components/ui/AppIcon";
import { INLINE_EDIT_LINE } from "@/lib/inlineEdit";
import { getStoredActiveProfileId } from "@/lib/auth";
import {
  buildPricingPatch,
  confidenceLabel,
  confidenceTone,
  displayPrimaryValue,
  effectiveValueRange,
  formatPrice,
  formatPriceUpdatedAt,
  getPricingSuggestions,
  normalizeComparables,
  normalizePriceConfidence,
  parsePastedSoldResults,
  parsePriceInput,
  resolveSearchLinks,
  SEARCH_SITES,
  summarizeComps,
  type PastedComp,
  type PriceComparable,
  type PricingMvpFields,
  type SearchSitePrefs,
} from "@/lib/pricingMvp";

type FieldKey = "range" | "lastComp" | "estimate" | "source" | "notes";

const SEARCH_PREFS_KEY = "vltd_price_search_sites_v1";

function searchPrefsKey() {
  const profile = getStoredActiveProfileId();
  return profile ? `${SEARCH_PREFS_KEY}:${profile}` : SEARCH_PREFS_KEY;
}

function readSearchPrefs(): SearchSitePrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(searchPrefsKey()) || "null");
    if (!parsed || !Array.isArray(parsed.ids)) return null;
    return { ids: parsed.ids.filter((id: unknown) => typeof id === "string"), custom: Array.isArray(parsed.custom) ? parsed.custom : [] };
  } catch {
    return null;
  }
}

/** Sale prices keep their cents: $9.75 is not "$10". */
function money2(n?: number) {
  const amount = Number(n ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function numText(n?: number) {
  return n !== undefined && n !== null && Number.isFinite(n) ? String(n) : "";
}

/**
 * Pricing, edited where you read it. Click a value (or the pencil for all of
 * them) and the text turns into a line you can type on; the card never changes
 * size. Enter saves, Esc cancels, the check saves everything.
 */
export default function PricingMvpCard({
  value,
  compact = false,
  title = "PRICING",
  universe,
  categoryLabel,
  grade,
  itemTitle,
  onSave,
}: {
  value: PricingMvpFields;
  compact?: boolean;
  title?: string;
  universe?: string;
  categoryLabel?: string;
  grade?: string;
  itemTitle?: string;
  onSave?: (patch: PricingMvpFields) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const [all, setAll] = useState(false);
  const [draft, setDraft] = useState({ low: "", median: "", high: "", last: "", estimate: "", source: "", notes: "" });
  const [addingComp, setAddingComp] = useState(false);
  const [compDraft, setCompDraft] = useState({ source: "", price: "", date: "", url: "" });
  const skipCommit = useRef(false);

  // Which sites to link to: each person chooses; nothing is forced on them.
  const [prefs, setPrefs] = useState<SearchSitePrefs | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [customDraft, setCustomDraft] = useState({ label: "", url: "" });
  useEffect(() => {
    setPrefs(readSearchPrefs());
  }, []);
  function savePrefs(next: SearchSitePrefs) {
    setPrefs(next);
    try {
      window.localStorage.setItem(searchPrefsKey(), JSON.stringify(next));
    } catch {
      /* storage blocked: the choice just lasts until the page reloads */
    }
  }

  // Paste sold results: the person copies a sold-listings page and pastes it; only that text is read.
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteSource, setPasteSource] = useState("eBay sold (pasted)");
  const [pasteResults, setPasteResults] = useState<PastedComp[] | null>(null);
  const [pasteChecked, setPasteChecked] = useState<Record<string, boolean>>({});

  const primaryValue = useMemo(() => displayPrimaryValue(value), [value]);
  const range = useMemo(() => effectiveValueRange(value), [value]);
  const suggestions = useMemo(
    () => getPricingSuggestions(universe ?? "", categoryLabel ?? "", grade, itemTitle),
    [universe, categoryLabel, grade, itemTitle]
  );
  const comparables = useMemo(() => normalizeComparables(value.comparables) ?? [], [value.comparables]);
  const links = useMemo(() => resolveSearchLinks(suggestions, prefs, itemTitle, grade), [suggestions, prefs, itemTitle, grade]);
  const compSummary = useMemo(() => summarizeComps(comparables), [comparables]);

  async function commit(overrides: Parameters<typeof buildPricingPatch>[0]) {
    if (!onSave) return;
    await onSave(
      buildPricingPatch({
        estimatedValue: value.estimatedValue,
        lastCompValue: value.lastCompValue,
        valueLow: value.valueLow,
        valueMedian: value.valueMedian,
        valueHigh: value.valueHigh,
        priceSource: value.priceSource,
        priceConfidence: value.priceConfidence,
        priceNotes: value.priceNotes,
        priceSources: value.priceSources,
        comparables,
        ...overrides,
      })
    );
  }

  function fillDraft() {
    setDraft({
      low: numText(value.valueLow),
      median: numText(value.valueMedian),
      high: numText(value.valueHigh),
      last: numText(value.lastCompValue),
      estimate: numText(value.estimatedValue),
      source: value.priceSource ?? "",
      notes: value.priceNotes ?? "",
    });
  }

  function open(field: FieldKey) {
    skipCommit.current = false;
    fillDraft();
    setEditing(field);
  }

  function startAll() {
    skipCommit.current = false;
    fillDraft();
    setEditing(null);
    setAll(true);
  }

  async function saveAll() {
    setAll(false);
    await commit({
      valueLow: parsePriceInput(draft.low),
      valueMedian: parsePriceInput(draft.median),
      valueHigh: parsePriceInput(draft.high),
      lastCompValue: parsePriceInput(draft.last),
      estimatedValue: parsePriceInput(draft.estimate),
      priceSource: draft.source.trim(),
      priceNotes: draft.notes.trim(),
    });
  }

  async function finishOne() {
    if (skipCommit.current || !editing) return;
    const field = editing;
    // Enter and blur can both fire for one edit; only save once.
    skipCommit.current = true;
    setEditing(null);
    if (field === "range") {
      const next = {
        valueLow: parsePriceInput(draft.low),
        valueMedian: parsePriceInput(draft.median),
        valueHigh: parsePriceInput(draft.high),
      };
      if (next.valueLow !== value.valueLow || next.valueMedian !== value.valueMedian || next.valueHigh !== value.valueHigh) await commit(next);
    } else if (field === "lastComp") {
      const next = parsePriceInput(draft.last);
      if (next !== value.lastCompValue) await commit({ lastCompValue: next });
    } else if (field === "estimate") {
      const next = parsePriceInput(draft.estimate);
      if (next !== value.estimatedValue) await commit({ estimatedValue: next });
    } else if (field === "source") {
      if (draft.source.trim() !== (value.priceSource ?? "").trim()) await commit({ priceSource: draft.source.trim() });
    } else if (field === "notes") {
      if (draft.notes.trim() !== (value.priceNotes ?? "").trim()) await commit({ priceNotes: draft.notes.trim() });
    }
  }

  function cancel() {
    skipCommit.current = true;
    setEditing(null);
    setAll(false);
  }

  function keys(e: React.KeyboardEvent, multiline = false) {
    if (e.key === "Escape") cancel();
    if (e.key === "Enter" && !(multiline && e.shiftKey)) {
      e.preventDefault();
      if (all) void saveAll();
      else void finishOne();
    }
  }

  const isOpen = (field: FieldKey) => all || editing === field;
  const blurSave = () => {
    if (!all) void finishOne();
  };

  async function addComp() {
    const salePrice = parsePriceInput(compDraft.price);
    const source = compDraft.source.trim();
    if (!source || !salePrice || salePrice <= 0) return;
    const comp: PriceComparable = {
      source,
      salePrice,
      saleDate: compDraft.date.trim() || undefined,
      url: compDraft.url.trim() || undefined,
    };
    setAddingComp(false);
    setCompDraft({ source: "", price: "", date: "", url: "" });
    await commit({ comparables: [...comparables, comp] });
  }

  function readPaste() {
    const results = parsePastedSoldResults(pasteText, pasteSource.trim() || "Sold listings (pasted)");
    setPasteResults(results);
    setPasteChecked(Object.fromEntries(results.map((r) => [r.id, true])));
  }

  async function addPasted() {
    const chosen = (pasteResults ?? []).filter((r) => pasteChecked[r.id]);
    if (chosen.length === 0) return;
    const additions: PriceComparable[] = chosen.map((r) => ({
      source: r.source,
      salePrice: r.salePrice,
      saleDate: r.saleDate,
      condition: r.condition,
      notes: r.notes,
    }));
    setPasteOpen(false);
    setPasteText("");
    setPasteResults(null);
    await commit({ comparables: [...comparables, ...additions] });
  }

  async function useCompsAsEstimate() {
    if (!compSummary) return;
    const span = compSummary.from && compSummary.to && compSummary.from !== compSummary.to ? ` (${compSummary.from} to ${compSummary.to})` : "";
    await commit({
      valueLow: compSummary.low,
      valueMedian: compSummary.median,
      valueHigh: compSummary.high,
      priceSource: `Estimated from ${compSummary.n} sold comp${compSummary.n === 1 ? "" : "s"} you added${span}`,
      priceConfidence: compSummary.n >= 3 ? "medium" : "low",
    });
  }

  async function removeComp(index: number) {
    await commit({ comparables: comparables.filter((_, i) => i !== index) });
  }

  async function applyCompAsValue(comp: PriceComparable) {
    const salePrice = Number(comp.salePrice);
    if (!Number.isFinite(salePrice) || salePrice <= 0) return;
    await commit({
      valueMedian: salePrice,
      lastCompValue: salePrice,
      priceSource: comp.source,
      priceConfidence: value.priceConfidence ?? "medium",
    });
  }

  const tile = "w-full rounded-[14px] bg-[color:var(--surface)] p-3 text-left ring-1 ring-[color:var(--border)]";
  const tileLabel = "text-[11px] tracking-[0.14em] text-[color:var(--muted2)]";
  const hover = "transition hover:ring-[color:var(--theme-gold,#C8CDD2)]";
  const smallInput = "rounded-lg bg-[color:var(--pill)] px-2.5 py-1 text-sm ring-1 ring-[color:var(--border)] focus:outline-none";

  return (
    <section className="rounded-[16px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">{title}</div>
          {!compact ? (
            <div className="mt-1 text-sm text-[color:var(--muted)]">
              Click any value to edit it.
              {links.length > 0 ? (
                <>
                  {" "}Look up sold prices:{" "}
                  {links.map((s, i) => (
                    <span key={s.key}>
                      {i > 0 ? " · " : ""}
                      <a href={s.url} target="_blank" rel="noopener noreferrer" title={s.note} className="text-[color:var(--theme-gold)] underline-offset-2 hover:underline">
                        {s.label}
                      </a>
                    </span>
                  ))}
                </>
              ) : null}
              {" "}
              <button type="button" onClick={() => setChooserOpen((open) => !open)} className="text-[12px] font-semibold text-[color:var(--muted)] underline-offset-2 hover:underline">
                {chooserOpen ? "Close" : "Choose sites"}
              </button>
            </div>
          ) : null}
          {!compact && chooserOpen ? (
            <div className="mt-2 rounded-xl bg-[color:var(--pill)] p-3 text-[12px] ring-1 ring-[color:var(--border)]">
              <div className="text-[color:var(--muted)]">
                Pick the sites you use. Each one opens in your own browser; VLTD does not fetch them or track what you look up.
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                {SEARCH_SITES.map((site) => {
                  const checked = prefs ? prefs.ids.includes(site.id) : links.some((l) => l.key === site.id);
                  return (
                    <label key={site.id} className="inline-flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const current = prefs ?? { ids: links.filter((l) => SEARCH_SITES.some((x) => x.id === l.key)).map((l) => l.key), custom: [] };
                          const ids = current.ids.includes(site.id) ? current.ids.filter((id) => id !== site.id) : [...current.ids, site.id];
                          savePrefs({ ids, custom: current.custom });
                        }}
                      />
                      <span>{site.label}</span>
                    </label>
                  );
                })}
              </div>
              <div className="mt-3 text-[color:var(--muted)]">
                Add your own search site. Use <b>{"{query}"}</b> where the item&apos;s name goes, for example https://www.example.com/search?q={"{query}"}
              </div>
              <div className="mt-1.5 grid gap-2 sm:grid-cols-[160px_1fr_auto]">
                <input className={smallInput} placeholder="Name" value={customDraft.label} onChange={(e) => setCustomDraft((d) => ({ ...d, label: e.target.value }))} />
                <input className={smallInput} placeholder="https://…{query}" value={customDraft.url} onChange={(e) => setCustomDraft((d) => ({ ...d, url: e.target.value }))} />
                <button
                  type="button"
                  className="rounded-[8px] px-3 py-1 text-xs font-bold"
                  style={{ background: "var(--theme-gold, #C8CDD2)", color: "#0A0800" }}
                  onClick={() => {
                    if (!customDraft.label.trim() || !/^https?:\/\//i.test(customDraft.url.trim())) return;
                    const current = prefs ?? { ids: links.filter((l) => SEARCH_SITES.some((x) => x.id === l.key)).map((l) => l.key), custom: [] };
                    savePrefs({ ids: current.ids, custom: [...current.custom, { label: customDraft.label.trim(), url: customDraft.url.trim() }] });
                    setCustomDraft({ label: "", url: "" });
                  }}
                >
                  Add
                </button>
              </div>
              {prefs && prefs.custom.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {prefs.custom.map((c, i) => (
                    <span key={`${c.label}-${i}`} className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--surface)] px-2.5 py-0.5 ring-1 ring-[color:var(--border)]">
                      {c.label}
                      <button type="button" aria-label={`Remove ${c.label}`} onClick={() => savePrefs({ ids: prefs.ids, custom: prefs.custom.filter((_, idx) => idx !== i) })} className="text-[color:var(--muted)]">
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              {prefs ? (
                <button
                  type="button"
                  className="mt-2 text-[12px] font-semibold text-[color:var(--muted)] underline-offset-2 hover:underline"
                  onClick={() => {
                    try {
                      window.localStorage.removeItem(searchPrefsKey());
                    } catch {
                      /* ignore */
                    }
                    setPrefs(null);
                  }}
                >
                  Back to the suggested sites
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => (all ? void saveAll() : startAll())}
          aria-label={all ? "Save pricing" : "Edit pricing"}
          title={all ? "Save (Esc to cancel)" : "Edit pricing"}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)]"
          style={{ color: all ? "var(--theme-gold)" : "var(--muted)" }}
        >
          <AppIcon name={all ? "checkmark" : "edit"} size={14} strokeWidth={1.8} />
        </button>
      </div>

      <div className="mt-3 grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {/* VALUE RANGE */}
          <div
            className={`${tile} ${isOpen("range") ? "" : "cursor-pointer " + hover}`}
            onClick={() => { if (!isOpen("range")) open("range"); }}
            onBlur={(e) => {
              if (!all && editing === "range" && !e.currentTarget.contains(e.relatedTarget as Node | null)) void finishOne();
            }}
            title={isOpen("range") ? undefined : "Click to edit value range"}
          >
            <div className={tileLabel}>VALUE RANGE</div>
            {isOpen("range") ? (
              <div className="mt-1 flex flex-wrap items-baseline gap-1.5">
                <input aria-label="Low" placeholder="low" inputMode="decimal" className={`${INLINE_EDIT_LINE} h-4 w-14 text-xs text-[color:var(--muted)]`} value={draft.low} onChange={(e) => setDraft((d) => ({ ...d, low: e.target.value }))} onKeyDown={keys} />
                <input aria-label="Value" autoFocus={!all} placeholder="value" inputMode="decimal" className={`${INLINE_EDIT_LINE} h-7 w-20 text-lg font-semibold`} value={draft.median} onChange={(e) => setDraft((d) => ({ ...d, median: e.target.value }))} onKeyDown={keys} />
                <input aria-label="High" placeholder="high" inputMode="decimal" className={`${INLINE_EDIT_LINE} h-4 w-14 text-xs text-[color:var(--muted)]`} value={draft.high} onChange={(e) => setDraft((d) => ({ ...d, high: e.target.value }))} onKeyDown={keys} />
              </div>
            ) : (
              <div className="mt-1 flex flex-wrap items-baseline gap-1.5">
                {range.low ? <span className="text-xs text-[color:var(--muted)]">{formatPrice(range.low)}</span> : null}
                <span className="text-lg font-semibold">{formatPrice(primaryValue)}</span>
                {range.high ? <span className="text-xs text-[color:var(--muted)]">{formatPrice(range.high)}</span> : null}
              </div>
            )}
          </div>

          {/* LAST COMP */}
          <div className={`${tile} ${isOpen("lastComp") ? "" : "cursor-pointer " + hover}`} onClick={() => { if (!isOpen("lastComp")) open("lastComp"); }} title={isOpen("lastComp") ? undefined : "Click to edit last comp"}>
            <div className={tileLabel}>LAST COMP</div>
            {isOpen("lastComp") ? (
              <input aria-label="Last comp" autoFocus={!all} inputMode="decimal" className={`${INLINE_EDIT_LINE} mt-1 h-7 w-full text-lg font-semibold`} value={draft.last} onChange={(e) => setDraft((d) => ({ ...d, last: e.target.value }))} onBlur={blurSave} onKeyDown={keys} />
            ) : (
              <div className="mt-1 text-lg font-semibold">{formatPrice(value.lastCompValue)}</div>
            )}
          </div>

          {/* CONFIDENCE: pick and it saves */}
          <div className={tile}>
            <div className={tileLabel}>CONFIDENCE</div>
            <div className="mt-2 flex items-center gap-2">
              <span className={["rounded-full px-2.5 py-1 text-[11px] font-medium ring-1", confidenceTone(value.priceConfidence)].join(" ")}>
                {confidenceLabel(value.priceConfidence)}
              </span>
              <select
                aria-label="Confidence"
                className="h-7 rounded-lg bg-[color:var(--pill)] px-1.5 text-[11px] text-[color:var(--muted)] ring-1 ring-[color:var(--border)] focus:outline-none"
                value={value.priceConfidence ?? ""}
                onChange={(e) => void commit({ priceConfidence: normalizePriceConfidence(e.target.value) })}
              >
                <option value="">Change…</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          {/* UPDATED: automatic */}
          <div className={tile}>
            <div className={tileLabel}>UPDATED</div>
            <div className="mt-1 text-lg font-semibold">{formatPriceUpdatedAt(value.priceUpdatedAt)}</div>
          </div>
        </div>

        {/* Comparable sales */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className={tileLabel}>
              COMPARABLE SALES
              {comparables.length === 0 && !addingComp ? <span className="ml-2 normal-case tracking-normal text-[color:var(--muted2)]">none yet</span> : null}
            </span>
            {!addingComp && !pasteOpen ? (
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setPasteOpen(true)} className="text-[11px] font-semibold text-[color:var(--theme-gold)]">
                  + Paste sold results
                </button>
                <button type="button" onClick={() => setAddingComp(true)} className="text-[11px] font-semibold text-[color:var(--theme-gold)]">
                  + Add comp
                </button>
              </div>
            ) : null}
          </div>
          <div className="space-y-1.5">
            {comparables.map((comp, index) => (
              <div key={`${comp.source}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-[color:var(--pill)] px-3 py-2 ring-1 ring-[color:var(--border)]">
                <div className="min-w-0 flex-1">
                  <span className="text-[13px] font-semibold text-[color:var(--fg)]">{money2(comp.salePrice)}</span>
                  {comp.condition ? <span className="ml-2 text-[11px] text-[color:var(--muted)]">{comp.condition}</span> : null}
                  {comp.notes ? <div className="mt-0.5 truncate text-[11px] text-[color:var(--muted)]">{comp.notes}</div> : null}
                </div>
                <div className="shrink-0 text-right">
                  {comp.url ? (
                    <a href={comp.url} target="_blank" rel="noopener noreferrer" className="text-[12px] font-semibold text-[color:var(--muted)] hover:underline">{comp.source}</a>
                  ) : (
                    <div className="text-[12px] font-semibold text-[color:var(--muted)]">{comp.source}</div>
                  )}
                  {comp.saleDate ? <div className="text-[11px] text-[color:var(--muted2)]">{comp.saleDate}</div> : null}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button type="button" onClick={() => void applyCompAsValue(comp)} className="rounded-md px-2 py-1 text-[11px] font-semibold text-[color:var(--theme-gold)] ring-1 ring-[color:var(--border)] hover:bg-[color:var(--surface)]" title="Use this sale as the current value">
                    Use as value
                  </button>
                  <button type="button" onClick={() => void removeComp(index)} className="rounded-md px-2 py-1 text-[11px] text-[color:var(--muted)] ring-1 ring-[color:var(--border)] hover:bg-[color:var(--surface)]" title="Remove this comparable" aria-label="Remove this comparable">
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {pasteOpen ? (
              <div className="rounded-xl bg-[color:var(--pill)] p-2.5 ring-1 ring-[color:var(--border)]">
                <div className="text-[12px] text-[color:var(--muted)]">
                  Open a sold-listings page (for example the eBay sold link above), select everything on it, copy, and paste it here. VLTD only reads what you paste.
                </div>
                <input className={`${smallInput} mt-2 w-full sm:w-72`} placeholder="Where it is from" value={pasteSource} onChange={(e) => setPasteSource(e.target.value)} />
                <textarea
                  className={`${smallInput} mt-2 h-28 w-full resize-y`}
                  placeholder="Paste the page text here"
                  value={pasteText}
                  onChange={(e) => {
                    setPasteText(e.target.value);
                    setPasteResults(null);
                  }}
                />
                {pasteResults ? (
                  pasteResults.length === 0 ? (
                    <div className="mt-2 text-[12px] text-[color:var(--muted)]">Nothing that looks like a sold price and date was found. Try copying more of the page, or add comps one by one.</div>
                  ) : (
                    <div className="mt-2 space-y-1">
                      <div className="text-[12px] text-[color:var(--muted)]">Found {pasteResults.length}. Untick any you don&apos;t want.</div>
                      {pasteResults.map((r) => (
                        <label key={r.id} className="flex items-start gap-2 rounded-lg bg-[color:var(--surface)] px-2.5 py-1.5 text-[12px] ring-1 ring-[color:var(--border)]">
                          <input type="checkbox" className="mt-0.5" checked={!!pasteChecked[r.id]} onChange={() => setPasteChecked((c) => ({ ...c, [r.id]: !c[r.id] }))} />
                          <span className="min-w-0 flex-1">
                            <span className="font-semibold">{money2(r.salePrice)}</span>
                            {r.saleDate ? <span className="ml-2 text-[color:var(--muted)]">{r.saleDate}</span> : null}
                            {r.condition ? <span className="ml-2 text-[color:var(--muted)]">{r.condition}</span> : null}
                            {r.notes ? <span className="block truncate text-[color:var(--muted)]">{r.notes}</span> : null}
                          </span>
                        </label>
                      ))}
                    </div>
                  )
                ) : null}
                <div className="mt-2 flex items-center gap-2">
                  {!pasteResults ? (
                    <button type="button" onClick={readPaste} disabled={!pasteText.trim()} className="rounded-[8px] px-3 py-1 text-xs font-bold disabled:opacity-50" style={{ background: "var(--theme-gold, #C8CDD2)", color: "#0A0800" }}>Read it</button>
                  ) : (
                    <button type="button" onClick={() => void addPasted()} disabled={!Object.values(pasteChecked).some(Boolean)} className="rounded-[8px] px-3 py-1 text-xs font-bold disabled:opacity-50" style={{ background: "var(--theme-gold, #C8CDD2)", color: "#0A0800" }}>Add selected</button>
                  )}
                  <button type="button" onClick={() => { setPasteOpen(false); setPasteResults(null); setPasteText(""); }} className="rounded-[8px] px-3 py-1 text-xs font-semibold text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">Cancel</button>
                </div>
              </div>
            ) : null}
            {compSummary && compSummary.n >= 2 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[color:var(--surface)] px-3 py-2 text-[12px] ring-1 ring-[color:var(--border)]">
                <span className="text-[color:var(--muted)]">
                  From these {compSummary.n} sold comps: {money2(compSummary.low)} to {money2(compSummary.high)}, middle {money2(compSummary.median)}.
                </span>
                <button type="button" onClick={() => void useCompsAsEstimate()} className="rounded-md px-2 py-1 text-[11px] font-semibold text-[color:var(--theme-gold)] ring-1 ring-[color:var(--border)] hover:bg-[color:var(--pill)]">
                  Use as my estimate
                </button>
              </div>
            ) : null}
            {addingComp ? (
              <div className="rounded-xl bg-[color:var(--pill)] p-2.5 ring-1 ring-[color:var(--border)]">
                <div className="grid gap-2 sm:grid-cols-4">
                  <input autoFocus className={smallInput} placeholder="Source (eBay…)" value={compDraft.source} onChange={(e) => setCompDraft((d) => ({ ...d, source: e.target.value }))} />
                  <input className={smallInput} placeholder="Sold price" inputMode="decimal" value={compDraft.price} onChange={(e) => setCompDraft((d) => ({ ...d, price: e.target.value }))} />
                  <input className={smallInput} placeholder="Sale date" value={compDraft.date} onChange={(e) => setCompDraft((d) => ({ ...d, date: e.target.value }))} />
                  <input className={smallInput} placeholder="Link (optional)" value={compDraft.url} onChange={(e) => setCompDraft((d) => ({ ...d, url: e.target.value }))} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button type="button" onClick={() => void addComp()} className="rounded-[8px] px-3 py-1 text-xs font-bold" style={{ background: "var(--theme-gold, #C8CDD2)", color: "#0A0800" }}>Add</button>
                  <button type="button" onClick={() => setAddingComp(false)} className="rounded-[8px] px-3 py-1 text-xs font-semibold text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">Cancel</button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Rows */}
        <div className="grid gap-2 text-sm leading-5">
          {(
            [
              ["estimate", "Estimate", formatPrice(value.estimatedValue)],
              ["source", "Price source", value.priceSource?.trim() || "—"],
              ["notes", "Notes", value.priceNotes?.trim() || "—"],
            ] as const
          ).map(([field, label, shown]) => (
            <div key={field} className="flex items-start justify-between gap-4">
              <div className="shrink-0 text-[color:var(--muted)]">{label}</div>
              {isOpen(field) ? (
                field === "notes" ? (
                  <textarea
                    autoFocus={!all}
                    rows={1}
                    aria-label={label}
                    className={`${INLINE_EDIT_LINE} min-h-5 flex-1 resize-none text-right leading-5`}
                    value={draft.notes}
                    onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                    onBlur={blurSave}
                    onKeyDown={(e) => keys(e, true)}
                  />
                ) : (
                  <input
                    autoFocus={!all}
                    aria-label={label}
                    inputMode={field === "estimate" ? "decimal" : undefined}
                    className={`${INLINE_EDIT_LINE} h-5 flex-1 text-right`}
                    value={field === "estimate" ? draft.estimate : draft.source}
                    onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))}
                    onBlur={blurSave}
                    onKeyDown={keys}
                  />
                )
              ) : (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => open(field)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(field); } }}
                  title={`Click to edit ${label.toLowerCase()}`}
                  className="max-w-[70%] cursor-pointer whitespace-pre-wrap text-right text-[color:var(--fg)] hover:underline hover:decoration-[color:var(--border)] hover:underline-offset-4"
                >
                  {shown}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
