"use client";

import { useMemo, useState } from "react";
import type { BulkAddFieldKey } from "@/lib/bulkAddState";
import {
  detailFieldLibrary,
  detailPlaceholder,
  labelForSpecId,
  resolveDetailProfile,
  type DetailField,
} from "@/lib/detailFields";

// These are entered in the Add Item form's own shared section, so the category fields do not repeat them.
const SHARED_IN_FORM = new Set(["subtitle", "number", "grade", "certNumber", "serialNumber", "subject", "edition", "variant"]);
const OTHER_CHOICE = "__other__";

const INPUT = "h-11 md:h-9 w-full min-w-0 rounded-xl px-3 text-sm focus:outline-none transition-all placeholder:text-[color:var(--muted)] placeholder:italic placeholder:text-xs bg-[color:var(--pill)] ring-1 ring-[color:var(--border)]";
const TEXTAREA = "min-h-[78px] w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none transition-all placeholder:text-[color:var(--muted)] placeholder:italic placeholder:text-xs bg-[color:var(--pill)] ring-1 ring-[color:var(--border)]";

function readSpecs(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) if (typeof v === "string") out[k] = v;
      return out;
    }
  } catch {
    /* an unreadable value is treated as empty */
  }
  return {};
}

/** The Add Item form keeps yes / no as "true" / "false" / "" (nothing chosen). */
function toFormBoolean(choice: string) {
  return choice === "yes" ? "true" : choice === "no" ? "false" : "";
}
function fromFormBoolean(value: string) {
  return value === "true" ? "yes" : value === "false" ? "no" : "";
}

function Control({ field, value, onChange }: { field: DetailField; value: string; onChange: (next: string) => void }) {
  const options = field.options ?? [];
  const [custom, setCustom] = useState(field.control === "choice" && value !== "" && !options.includes(value));
  const placeholder = detailPlaceholder(field) || undefined;

  if (field.control === "yesno") {
    return (
      <select className={INPUT} value={value} onChange={(e) => onChange(e.target.value)} aria-label={field.label}>
        <option value="">Unknown</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    );
  }
  if (field.control === "choice" && !custom) {
    return (
      <select
        className={INPUT}
        value={value}
        aria-label={field.label}
        onChange={(e) => {
          if (e.target.value === OTHER_CHOICE) {
            setCustom(true);
            onChange("");
          } else onChange(e.target.value);
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
    return <textarea className={TEXTAREA} value={value} aria-label={field.label} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <input
      className={INPUT}
      value={value}
      aria-label={field.label}
      placeholder={placeholder}
      inputMode={field.control === "integer" ? "numeric" : undefined}
      autoFocus={custom && value === ""}
      onChange={(e) => onChange(field.control === "integer" ? e.target.value.replace(/[^0-9]/g, "") : e.target.value)}
    />
  );
}

/**
 * The category-specific part of the Add Item form: the fields that fit the chosen Universe / Category / Subcategory (six main
 * ones, the rest under "More details"). Values go to the same form values the rest of the form uses, so locking, lookups and saving
 * work as before. A value typed for a field the current category does not list stays visible under "Other details".
 */
export default function AddDetailFields({
  values,
  setField,
  universe,
  categoryLabel,
  subcategoryLabel,
}: {
  values: Record<string, string | undefined>;
  setField: (key: BulkAddFieldKey, value: string) => void;
  universe?: string;
  categoryLabel?: string;
  subcategoryLabel?: string;
}) {
  const profile = useMemo(() => resolveDetailProfile(universe, categoryLabel, subcategoryLabel), [universe, categoryLabel, subcategoryLabel]);
  const [expanded, setExpanded] = useState(false);
  const set = (key: string, value: string) => setField(key as BulkAddFieldKey, value);

  const specs = readSpecs(values.specs);
  const getValue = (field: DetailField): string => {
    if (field.specId) return specs[field.specId] ?? "";
    const raw = values[field.target] ?? "";
    return field.boolean ? fromFormBoolean(raw) : raw;
  };
  const setValue = (field: DetailField, next: string) => {
    if (field.specId) {
      const merged = { ...specs };
      if (next.trim()) merged[field.specId] = next;
      else delete merged[field.specId];
      set("specs", Object.keys(merged).length ? JSON.stringify(merged) : "");
      return;
    }
    set(field.target, field.boolean ? toFormBoolean(next) : next);
  };

  const fields = profile.all.filter((f) => !SHARED_IN_FORM.has(f.target));
  const primary = fields.filter((f) => f.primary);
  const additional = fields.filter((f) => !f.primary);
  const filledAdditional = additional.filter((f) => getValue(f).trim() !== "");
  const emptyAdditional = additional.filter((f) => getValue(f).trim() === "");
  const shown = [...primary, ...filledAdditional, ...(expanded ? emptyAdditional : [])];

  const inProfile = new Set(profile.all.map((f) => f.target));
  const others: DetailField[] = [];
  for (const [target, field] of detailFieldLibrary()) {
    if (inProfile.has(target) || SHARED_IN_FORM.has(target) || field.specId) continue;
    if ((values[target] ?? "").trim() !== "") others.push(field);
  }
  for (const [id, value] of Object.entries(specs)) {
    const target = `s:${id}`;
    if (inProfile.has(target) || !value.trim()) continue;
    others.push(detailFieldLibrary().get(target) ?? { target, specId: id, label: labelForSpecId(id), control: "text", primary: false, boolean: false });
  }

  const cell = (field: DetailField) => {
    const wide = field.control === "multiline";
    return (
      <div key={field.target} className={`grid min-w-0 grid-cols-1 gap-1 ${wide ? "sm:col-span-2 lg:col-span-3" : ""}`}>
        <label className="text-xs font-medium tracking-[0.14em] text-[color:var(--muted2)]">{field.label}</label>
        <Control field={field} value={getValue(field)} onChange={(next) => setValue(field, next)} />
      </div>
    );
  };

  if (!shown.length && !others.length && !emptyAdditional.length) return null;

  return (
    <>
      {shown.map(cell)}
      {emptyAdditional.length > 0 ? (
        <div className="sm:col-span-2 lg:col-span-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="text-[12px] font-semibold text-[color:var(--muted)] hover:text-[color:var(--fg)]"
          >
            {expanded ? "Fewer details" : `More details (${emptyAdditional.length})`}
          </button>
        </div>
      ) : null}
      {others.length > 0 ? (
        <div className="sm:col-span-2 lg:col-span-3">
          <div className="text-[11px] tracking-[0.16em] text-[color:var(--muted2)]">OTHER DETAILS ALREADY ENTERED</div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">{others.map(cell)}</div>
        </div>
      ) : null}
    </>
  );
}
