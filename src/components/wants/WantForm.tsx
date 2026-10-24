"use client";

import { useMemo, useState } from "react";

import { PillButton } from "@/components/ui/PillButton";
import { Toggle } from "@/components/ui/Toggle";
import { fieldsFor } from "@/components/wants/categoryFields";
import { Field, inputClass } from "@/components/wants/Sheet";
import { parseMoneyInput } from "@/lib/moneyInput";
import { UNIVERSE_LABEL, getCategories, isUniverseKey, getUniverses, type UniverseKey } from "@/lib/taxonomy";
import { clampQuantity, isIsoDay, markEdited } from "@/lib/wantsCore";
import type { WishlistItem } from "@/lib/wishlistModel";

// One form for adding a want and for editing one. Anything left blank stays unknown: no date means "Date unknown" (not today), no price means "Price unknown"
// (not $0). Only the fields that apply to the chosen category are shown.

const OTHER = "__other__";
const TRACKED: (keyof WishlistItem)[] = ["title", "series", "edition", "quantity", "releaseDate", "releaseWindow", "price", "shop", "sourceUrl", "category"];

function safeLink(raw: string): { ok: true; value: string | undefined } | { ok: false } {
  const t = raw.trim();
  if (!t) return { ok: true, value: undefined };
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(t) ? t : `https://${t}`);
    return u.protocol === "http:" || u.protocol === "https:" ? { ok: true, value: u.toString() } : { ok: false };
  } catch {
    return { ok: false };
  }
}

export default function WantForm({
  initial,
  presetTitle,
  presetLink,
  ruleId,
  presetSeries,
  presetUniverse,
  presetCategory,
  submitLabel,
  onSubmit,
  onCancel,
  compact = false,
}: {
  initial?: WishlistItem;
  presetTitle?: string;
  presetLink?: string;
  ruleId?: string;
  presetSeries?: string;
  presetUniverse?: string;
  presetCategory?: string;
  submitLabel: string;
  onSubmit: (item: WishlistItem) => void;
  onCancel?: () => void;
  compact?: boolean;
}) {
  const startUniverse = (initial?.universe ?? presetUniverse ?? "") as string;
  const [title, setTitle] = useState(initial?.title ?? presetTitle ?? "");
  const [universe, setUniverse] = useState<string>(isUniverseKey(startUniverse) ? startUniverse : "");
  const startCategory = initial?.category ?? presetCategory ?? "";
  const [category, setCategory] = useState(startCategory);
  const [series, setSeries] = useState(initial?.series ?? presetSeries ?? "");
  const [edition, setEdition] = useState(initial?.edition ?? "");
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 1));
  const [priority, setPriority] = useState(initial?.priority ?? "medium");
  const [price, setPrice] = useState(initial?.price != null ? String(initial.price) : "");
  const [target, setTarget] = useState(initial?.targetPrice != null ? String(initial.targetPrice) : "");
  const [date, setDate] = useState(initial?.releaseDate ?? "");
  const [windowText, setWindowText] = useState(initial?.releaseWindow ?? "");
  const [shop, setShop] = useState(initial?.shop ?? "");
  const [link, setLink] = useState(initial?.sourceUrl ?? presetLink ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [older, setOlder] = useState(Boolean(initial?.details && (initial.details.era || initial.details.maker)));
  const [details, setDetails] = useState<Record<string, string>>(initial?.details ?? {});
  const [error, setError] = useState("");

  const categories = useMemo(() => (isUniverseKey(universe) ? getCategories(universe as UniverseKey) : []), [universe]);
  const categoryIsListed = categories.includes(category);
  const extra = fieldsFor(universe, category, older);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return setError("Give it a title.");
    const money = parseMoneyInput(price, { label: "Expected price" });
    if (!money.ok) return setError(money.message);
    const tgt = parseMoneyInput(target, { label: "Target price" });
    if (!tgt.ok) return setError(tgt.message);
    if (date.trim() && !isIsoDay(date.trim())) return setError("Use a real date, or leave the release date empty if you do not know it.");
    const l = safeLink(link);
    if (!l.ok) return setError("The link must start with http:// or https://.");
    const keptDetails: Record<string, string> = {};
    for (const f of extra) if (details[f.key]?.trim()) keptDetails[f.key] = details[f.key].trim();
    const next: WishlistItem = {
      ...(initial ?? { id: `wish_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, createdAt: Date.now(), source: "manual", status: "want" as const }),
      title: title.trim(),
      universe: universe || initial?.universe || undefined,
      category: category.trim() || undefined,
      series: series.trim() || undefined,
      edition: edition.trim() || undefined,
      quantity: clampQuantity(quantity),
      priority: priority as WishlistItem["priority"],
      price: money.blank ? undefined : money.value,
      targetPrice: tgt.blank ? undefined : tgt.value,
      releaseDate: date.trim() || undefined,
      releaseWindow: date.trim() ? undefined : windowText.trim() || undefined,
      shop: shop.trim() || undefined,
      sourceUrl: l.value,
      notes: notes.trim() || undefined,
      details: Object.keys(keptDetails).length ? keptDetails : undefined,
      ruleId: initial?.ruleId ?? ruleId,
      updatedAt: Date.now(),
    };
    // A change made by hand is remembered, so a later catalog refresh never overwrites it.
    const changed = initial ? TRACKED.filter((k) => (initial[k] ?? undefined) !== (next[k] ?? undefined)).map(String) : [];
    onSubmit(initial && changed.length ? markEdited(next, changed) : next);
  }

  const grid = compact ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-4" : "grid gap-3 sm:grid-cols-2";
  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <div className={grid}>
        <Field label="Title" className={compact ? "sm:col-span-2" : "sm:col-span-2"}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="What you want" aria-label="Title" autoFocus={!compact} />
        </Field>
        <Field label="Category">
          <select
            value={universe}
            onChange={(e) => { setUniverse(e.target.value); setCategory(""); }}
            className={inputClass}
            aria-label="Collecting area"
          >
            <option value="">Choose…</option>
            {getUniverses().map((u) => <option key={u} value={u}>{UNIVERSE_LABEL[u]}</option>)}
          </select>
        </Field>
        <Field label="Type">
          {categories.length > 0 && (categoryIsListed || category === "") ? (
            <select value={category} onChange={(e) => (e.target.value === OTHER ? setCategory(" ") : setCategory(e.target.value))} className={inputClass} aria-label="Type of collectible">
              <option value="">Any</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value={OTHER}>Other (type it)</option>
            </select>
          ) : (
            <input value={category.trim() === "" ? "" : category} onChange={(e) => setCategory(e.target.value)} className={inputClass} placeholder="Type of collectible" aria-label="Type of collectible" />
          )}
        </Field>
        <Field label="Series or product line"><input value={series} onChange={(e) => setSeries(e.target.value)} className={inputClass} placeholder="Optional" /></Field>
        <Field label="Edition or variant"><input value={edition} onChange={(e) => setEdition(e.target.value)} className={inputClass} placeholder="Optional, e.g. Cover B" /></Field>
        <Field label="Quantity"><input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" className={inputClass} /></Field>
        <Field label="Priority">
          <select value={priority} onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")} className={inputClass}>
            <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </select>
        </Field>
        <Field label="Expected price (each)" hint="Counts toward the planned total. Blank stays unknown."><input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" className={inputClass} placeholder="Unknown" /></Field>
        <Field label="Target price (optional)" hint="A note to yourself. VLTD does not watch prices."><input value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" className={inputClass} placeholder="Unknown" /></Field>
        <Field label="Release date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} /></Field>
        <Field label="Or a release window" hint={date ? "Not used while a date is set." : "e.g. Q1 2027. Blank stays unknown."}><input value={windowText} onChange={(e) => setWindowText(e.target.value)} className={inputClass} placeholder="Unknown" disabled={Boolean(date)} /></Field>
        <Field label="Shop"><input value={shop} onChange={(e) => setShop(e.target.value)} className={inputClass} placeholder="Optional" /></Field>
        <Field label="Product or shop link" hint="Opens outside VLTD. VLTD does not read the page."><input value={link} onChange={(e) => setLink(e.target.value)} className={inputClass} placeholder="https://…" inputMode="url" /></Field>
      </div>
      <div className="flex items-center gap-3 text-sm" style={{ color: "var(--fg)" }}>
        <Toggle on={older} onChange={() => setOlder((v) => !v)} ariaLabel="Older or vintage piece" />
        <span>Older or vintage piece (adds era and maker)</span>
      </div>
      {extra.length > 0 ? (
        <div className={grid} data-testid="category-fields">
          {extra.map((f) => (
            <Field key={f.key} label={f.label}>
              <input value={details[f.key] ?? ""} onChange={(e) => setDetails((d) => ({ ...d, [f.key]: e.target.value }))} className={inputClass} placeholder={f.placeholder ?? "Optional"} />
            </Field>
          ))}
        </div>
      ) : null}
      <Field label="Notes (private)"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full min-w-0 rounded-[7px] border border-[rgba(203,208,213,0.22)] px-3 py-2 text-sm outline-none" /></Field>
      {error ? <p role="alert" className="text-sm text-red-400">{error}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel ? <PillButton onClick={onCancel}>Cancel</PillButton> : null}
        <PillButton type="submit" variant="primary">{submitLabel}</PillButton>
      </div>
    </form>
  );
}
