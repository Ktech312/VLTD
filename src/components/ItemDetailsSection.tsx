"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { AppIcon } from "@/components/ui/AppIcon";
import { INLINE_EDIT_LINE } from "@/lib/inlineEdit";
import {
  applyDetailEdits,
  cleanDetailInput,
  detailPatch,
  detailPlaceholder,
  displayDetail,
  hasDetailValue,
  otherSavedDetails,
  readDetail,
  resolveItemDetailProfile,
  type DetailField,
} from "@/lib/detailFields";
import type { VaultItem } from "@/lib/vaultModel";
import { isSpecsDeviceOnly, SPECS_DEVICE_ONLY_NOTE, subscribeSpecsDeviceOnly } from "@/lib/specsDeviceOnly";

const OTHER_CHOICE = "__other__";

const SELECT_LINE = `${INLINE_EDIT_LINE} h-6 cursor-pointer text-right [field-sizing:fixed] max-w-[60%]`;

/** One value's editor: a line to type on, a short list to choose from, or yes / no. Nothing else on the card moves. */
function DetailEditor({
  field,
  value,
  onChange,
  onCommit,
  onCancel,
  onSubmit,
  autoFocus,
}: {
  field: DetailField;
  value: string;
  onChange: (next: string) => void;
  /** Enter inside the "edit everything" mode saves the whole card. */
  onSubmit?: () => void;
  /** Called when the value should be saved now (Enter, leaving the box, or picking from a list). */
  onCommit: (next?: string) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const options = field.options ?? [];
  const typedOther = field.control === "choice" && value !== "" && !options.includes(value);
  const [custom, setCustom] = useState(typedOther);
  const common = { "aria-label": field.label, placeholder: detailPlaceholder(field) || undefined } as const;

  if (field.control === "yesno") {
    return (
      <select
        {...common}
        autoFocus={autoFocus}
        className={SELECT_LINE}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onCommit(e.target.value);
        }}
        onBlur={() => onCommit()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel?.();
        }}
      >
        <option value="">Unknown</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    );
  }

  if (field.control === "choice" && !custom) {
    return (
      <select
        {...common}
        autoFocus={autoFocus}
        className={SELECT_LINE}
        value={value}
        onChange={(e) => {
          if (e.target.value === OTHER_CHOICE) {
            setCustom(true);
            onChange("");
            return;
          }
          onChange(e.target.value);
          onCommit(e.target.value);
        }}
        onBlur={() => onCommit()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel?.();
        }}
      >
        <option value="">—</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        <option value={OTHER_CHOICE}>Other…</option>
      </select>
    );
  }

  if (field.control === "multiline") {
    return (
      <textarea
        {...common}
        autoFocus={autoFocus}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onCommit()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel?.();
        }}
        className="w-[60%] min-w-[10rem] resize-y rounded-lg bg-[color:var(--pill)] px-2 py-1 text-right text-sm leading-5 ring-1 ring-[color:var(--border)] focus:outline-none"
        style={{ color: "var(--fg)" }}
      />
    );
  }

  return (
    <input
      {...common}
      autoFocus={autoFocus || custom}
      inputMode={field.control === "integer" ? "numeric" : undefined}
      value={value}
      onChange={(e) => onChange(field.control === "integer" ? e.target.value.replace(/[^0-9]/g, "") : e.target.value)}
      onBlur={() => onCommit()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          if (onSubmit) onSubmit();
          else e.currentTarget.blur();
        }
        if (e.key === "Escape") onCancel?.();
      }}
      className={`${INLINE_EDIT_LINE} h-5 flex-1 text-right`}
    />
  );
}

/**
 * The item's DETAILS card. The rows come from the item's Universe / Category / Subcategory (up to six main fields, the rest under
 * "More details"), values edit where they are, and anything saved that this category does not list stays visible under
 * "Other saved details" instead of disappearing when an item's category changes.
 */
export default function ItemDetailsSection({
  item,
  onSave,
  children,
}: {
  item: VaultItem;
  onSave: (patch: Partial<VaultItem>) => Promise<void> | void;
  children?: ReactNode;
}) {
  const deviceOnly = useSyncExternalStore(subscribeSpecsDeviceOnly, () => isSpecsDeviceOnly(item.id), () => false);
  const profile = useMemo(() => resolveItemDetailProfile(item), [item]);
  const others = useMemo(() => otherSavedDetails(item, profile), [item, profile]);
  const [expanded, setExpanded] = useState(false);
  const [all, setAll] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const skipCommit = useRef(false);

  const filledMore = profile.additional.filter((f) => hasDetailValue(item, f));
  const emptyMore = profile.additional.filter((f) => !hasDetailValue(item, f));
  const showMore = expanded || all;
  const mainRows = [...profile.primary, ...filledMore];
  const rows = [...mainRows, ...(showMore ? emptyMore : [])];
  const everyRow = [...rows, ...others];

  function startAll() {
    const next: Record<string, string> = {};
    for (const field of [...profile.all, ...others]) next[field.target] = readDetail(item, field);
    setDrafts(next);
    setEditing(null);
    setAll(true);
  }

  async function saveAll() {
    const edits = [...profile.all, ...others]
      .filter((field) => cleanDetailInput(field, drafts[field.target] ?? "") !== readDetail(item, field).trim())
      .map((field) => ({ field, value: drafts[field.target] ?? "" }));
    setAll(false);
    if (edits.length) await onSave(applyDetailEdits(item, edits));
  }

  function startOne(field: DetailField) {
    skipCommit.current = false;
    setDraft(readDetail(item, field));
    setEditing(field.target);
  }

  async function commitOne(field: DetailField, value?: string) {
    if (skipCommit.current) return;
    skipCommit.current = true;
    setEditing(null);
    const next = value ?? draft;
    if (cleanDetailInput(field, next) === readDetail(item, field).trim()) return;
    await onSave(detailPatch(item, field, next));
  }

  function row(field: DetailField) {
    const isEditing = editing === field.target;
    return (
      <div key={field.target} className="flex items-start justify-between gap-4">
        <div className="shrink-0 text-[color:var(--muted)]">{field.label}</div>
        {all ? (
          <DetailEditor
            field={field}
            value={drafts[field.target] ?? ""}
            onChange={(next) => setDrafts((d) => ({ ...d, [field.target]: next }))}
            onCommit={() => {}}
            onCancel={() => setAll(false)}
            onSubmit={() => void saveAll()}
          />
        ) : isEditing ? (
          <DetailEditor
            field={field}
            value={draft}
            onChange={setDraft}
            onCommit={(next) => void commitOne(field, next)}
            onCancel={() => {
              skipCommit.current = true;
              setEditing(null);
            }}
            autoFocus
          />
        ) : (
          <span
            role="button"
            tabIndex={0}
            onClick={() => startOne(field)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                startOne(field);
              }
            }}
            title={`Click to edit ${field.label.toLowerCase()}`}
            className="vltd-tap cursor-pointer whitespace-pre-wrap break-words text-right text-[color:var(--fg)] hover:underline hover:decoration-[color:var(--border)] hover:underline-offset-4"
          >
            {displayDetail(item, field)}
          </span>
        )}
      </div>
    );
  }

  const sourceNote =
    profile.source === "generic" ? "General details" : profile.source === "category" ? "Shared details for this category" : "";

  return (
    <section className="rounded-[14px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]" data-testid="item-details">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">DETAILS</div>
        <button
          type="button"
          onClick={() => (all ? void saveAll() : startAll())}
          aria-label={all ? "Save details" : "Edit details"}
          title={all ? "Save (Esc to cancel)" : "Edit details"}
          className="relative max-md:after:absolute max-md:after:-inset-2 max-md:after:content-[''] inline-flex h-7 w-7 items-center justify-center rounded-[7px] ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)]"
          style={{ color: all ? "var(--theme-gold)" : "var(--muted)" }}
        >
          <AppIcon name={all ? "checkmark" : "edit"} size={14} strokeWidth={1.8} />
        </button>
      </div>
      <div className="mt-4">
        {sourceNote ? <div className="mb-3 text-[11px] text-[color:var(--muted2)]">{sourceNote}</div> : null}
        {deviceOnly ? (
          <div role="status" data-testid="specs-device-only" className="mb-3 rounded-lg bg-[color:var(--pill)] px-3 py-2 text-[12px] text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
            {SPECS_DEVICE_ONLY_NOTE}
          </div>
        ) : null}
        <div className="grid gap-3 text-sm">{rows.map(row)}</div>
        {emptyMore.length > 0 && !all ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="vltd-tap-y mt-3 text-[12px] font-semibold text-[color:var(--muted)] hover:text-[color:var(--fg)]"
          >
            {expanded ? "Fewer details" : `More details (${emptyMore.length})`}
          </button>
        ) : null}
        {others.length > 0 ? (
          <div className="mt-4 border-t border-[color:var(--border)] pt-3">
            <div className="mb-2 text-[11px] tracking-[0.16em] text-[color:var(--muted2)]">OTHER SAVED DETAILS</div>
            <div className="grid gap-3 text-sm">{others.map(row)}</div>
          </div>
        ) : null}
        {everyRow.length === 0 ? <div className="text-sm text-[color:var(--muted2)]">No details for this category yet.</div> : null}
      </div>
      {children}
    </section>
  );
}
