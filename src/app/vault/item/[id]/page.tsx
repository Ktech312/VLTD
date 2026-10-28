"use client";

import { itemMoneyProblem, parseMoneyInput } from "@/lib/moneyInput";
import { saleOutcome, soldItemOf } from "@/lib/soldItems";
import { Toggle } from "@/components/ui/Toggle";
import { pillClassName } from "@/components/ui/PillButton";
import { effectiveMarketValue, hasExplicitValue, hasRecordedCost, isSupplyItem, itemGain } from "@/lib/vaultStats";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useRef, useState } from "react";

import { AppIcon } from "@/components/ui/AppIcon";
import CostToSellPanel from "@/components/CostToSellPanel";
import CoaScanButton from "@/components/CoaScanButton";
import type { CoaAnalysisResult } from "@/app/api/ai/analyze-coa/route";
import ExportListingButton from "@/components/ExportListingButton";
import InsurancePdfButton from "@/components/InsurancePdfButton";
import ItemVisibilityToggle from "@/components/ItemVisibilityToggle";
import ItemMedia from "@/components/ItemMedia";
import ItemDetailsSection from "@/components/ItemDetailsSection";
import { resolveItemDetailProfile } from "@/lib/detailFields";
import DocumentsSection from "@/components/DocumentsSection";
import { Glyph } from "@/components/ui/Glyph";
import NotableBadge from "@/components/NotableBadge";
import PricingMvpCard from "@/components/PricingMvpCard";
import { PillButton } from "@/components/ui/PillButton";
import ContentActionBar from "@/components/share/ContentActionBar";
import SocialExportSheet from "@/components/SocialExportSheet";
import AutoSharePrompt from "@/components/AutoSharePrompt";
import AuctionSetupSheet, { AuctionCountdownChip } from "@/components/AuctionSetupSheet";
import { useAutoShareTrigger } from "@/hooks/useAutoShareTrigger";
import { getStoredActiveProfileId, getCurrentUser } from "@/lib/auth";
import VideoClipSection from "@/components/VideoClipSection";
import { type VideoClip } from "@/lib/videoFeature";
import { isNotable, notableReason } from "@/lib/itemIntelligence";
import { buildPricingPatch, displayPrimaryValue, type PricingMvpFields } from "@/lib/pricingMvp";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import {
  deleteVaultImageFromSupabase,
  hasSupabaseEnv,
  uploadVaultImageToSupabase,
} from "@/lib/vaultCloud";
import { enqueueVaultItemSync, saveItemDurably } from "@/lib/vaultSyncQueue";
import { showToast } from "@/lib/toast";
import {
  appendImage,
  deleteImageAtIndex,
  getOrderedImageUrls,
  getOrderedImages,
  loadItems,
  markItemViewed,
  reorderImages,
  saveItem,
  syncVaultItemsFromSupabase,
  normalizeTags,
  type VaultImage,
  type VaultItem,
} from "@/lib/vaultModel";
import { deleteVaultItemEverywhere } from "@/lib/vaultActions";
import { reportPending } from "@/lib/cloudSaveStatus";
import { isSpecsDeviceOnly, SPECS_DEVICE_ONLY_NOTE } from "@/lib/specsDeviceOnly";
import { useDialogA11y } from "@/components/ui/useDialogA11y";
import { generateHashtags } from "@/lib/generateHashtags";
import {
  generateVaultImageKey,
  prepareImageBlob,
  saveImageBlobToIndexedDb,
} from "@/lib/vaultImageStore";
import {
  getCategories,
  getDefaultCategory,
  getSubcategories,
  getUniverses,
  isUniverseKey,
  resolveCategoryLabel,
  UNIVERSE_LABEL,
  type UniverseKey,
} from "@/lib/taxonomy";
import { setItemPublic } from "@/lib/itemVisibility";
import { fetchRegistrySubjects, type RegistrySubject } from "@/lib/registryModel";
import ListingReadinessPanel from "@/components/ListingReadinessPanel";
import GenerateCopyPanel from "@/components/GenerateCopyPanel";
import { INLINE_EDIT_LINE } from "@/lib/inlineEdit";

const SALES_KEY = "vltd_sales_history";

type SaleRecord = VaultItem & {
  soldPrice?: number;
  soldAt?: number;
};

function getSales(): SaleRecord[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SALES_KEY) || "[]");
    return Array.isArray(parsed) ? (parsed as SaleRecord[]) : [];
  } catch {
    return [];
  }
}

function writeSales(records: SaleRecord[]) {
  try {
    localStorage.setItem(SALES_KEY, JSON.stringify(records));
  } catch {
    // Local sale history is only a compatibility cache.
  }
}

function removeSaleRecord(itemId: string) {
  writeSales(getSales().filter((sale) => String(sale.id) !== String(itemId)));
}

function clamp(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function fmtMoney(value: number) {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

// Costs are shown to the cent so what you typed is what you read back ($3.50 stays $3.50). The stored amounts were never rounded; only the old display was.
function fmtMoneyExact(value: number) {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(value: number) {
  if (!Number.isFinite(value)) return "0.0%";
  return `${value.toFixed(1)}%`;
}

// The header, the summary, the editor and the selling tools all ask the shared resolver, so they can never disagree.
function categoryLabel(item: VaultItem) {
  return resolveCategoryLabel(item);
}

function normUniverse(value: unknown): UniverseKey {
  const raw = String(value ?? "").trim().toUpperCase();
  return isUniverseKey(raw) ? raw : "MISC";
}

function categoryCode(label: string) {
  return label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "COLLECTORS_CHOICE";
}

function safeCategoryForUniverse(universe: UniverseKey, value: unknown) {
  const requested = String(value ?? "").trim();
  return requested || getDefaultCategory(universe);
}

function createdAtMs(item: VaultItem) {
  if (typeof item.createdAt === "number" && Number.isFinite(item.createdAt)) return item.createdAt;
  const maybe = Number(item.id);
  return Number.isFinite(maybe) ? maybe : Date.now();
}

function fmtDate(ms: number) {
  return new Date(ms).toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function totalCost(item: VaultItem) {
  return clamp(item.purchasePrice) + clamp(item.purchaseTax) + clamp(item.purchaseShipping) + clamp(item.purchaseFees);
}

// Unrealized change of this item: only with both a value and a recorded cost (the same rule as every total); otherwise null ("—").
function gain(item: VaultItem): number | null {
  return itemGain(item)?.gain ?? null;
}

function roi(item: VaultItem): number | null {
  return itemGain(item)?.pct ?? null;
}

function detailValue(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[14px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">{title}</div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

type InlineRow = {
  label: string;
  /** Present = this row's value can be edited in place. */
  field?: { key: keyof VaultItem; kind: "text" | "money"; /** A cost: a negative amount is refused (blank and 0 are fine). */ nonNegative?: boolean };
  value: React.ReactNode;
};

/**
 * A details section whose values edit where they are. Click a value, or the
 * pencil for all of them, and the text becomes a line you can type on: same
 * size, same place, nothing else on the card moves. Enter saves, Esc cancels,
 * the check (where the pencil was) saves everything.
 */
function InlineEditSection({
  title,
  item,
  rows,
  onSave,
  children,
}: {
  title: string;
  item: VaultItem;
  rows: InlineRow[];
  onSave: (patch: Partial<VaultItem>) => Promise<void> | void;
  children?: React.ReactNode;
}) {
  const [all, setAll] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [fieldError, setFieldError] = useState("");
  const skipCommit = useRef(false);

  type FieldRow = InlineRow & { field: NonNullable<InlineRow["field"]> };
  const fieldRows = rows.filter((row): row is FieldRow => Boolean(row.field));

  function rawOf(row: FieldRow) {
    const raw = item[row.field.key];
    return raw === undefined || raw === null ? "" : String(raw);
  }

  // A typed amount is checked, never guessed: blank = not recorded, 0 = an explicit zero, letters / malformed numbers / negatives are refused
  // with a message and nothing is saved (src/lib/moneyInput.ts).
  function problemOf(row: FieldRow, text: string): string {
    if (row.field.kind !== "money") return "";
    const r = parseMoneyInput(text, { label: row.label, allowNegative: !row.field.nonNegative });
    return r.ok ? "" : r.message;
  }

  function parse(kind: "text" | "money", text: string): string | number | undefined {
    const t = text.trim();
    if (kind === "money") {
      const r = parseMoneyInput(t);
      return r.ok && !r.blank ? r.value : undefined;
    }
    return t || undefined;
  }

  function startAll() {
    setFieldError("");
    const next: Record<string, string> = {};
    for (const row of fieldRows) next[String(row.field.key)] = rawOf(row);
    setDrafts(next);
    setEditingKey(null);
    setAll(true);
  }

  async function saveAll() {
    const patch: Record<string, string | number | undefined> = {};
    for (const row of fieldRows) {
      const key = String(row.field.key);
      const problem = problemOf(row, drafts[key] ?? "");
      if (problem) {
        // Stay in edit mode: nothing is saved until every amount is blank, 0 or a valid positive amount.
        setFieldError(problem);
        return;
      }
      if ((drafts[key] ?? "").trim() !== rawOf(row).trim()) patch[key] = parse(row.field.kind, drafts[key] ?? "");
    }
    setFieldError("");
    setAll(false);
    if (Object.keys(patch).length) await onSave(patch as Partial<VaultItem>);
  }

  function startOne(row: FieldRow) {
    setFieldError("");
    skipCommit.current = false;
    setDraft(rawOf(row));
    setEditingKey(String(row.field.key));
  }

  async function commitOne(row: FieldRow) {
    if (skipCommit.current) return;
    const problem = problemOf(row, draft);
    if (problem) {
      // Keep the line open on the wrong value so it can be fixed (Esc cancels).
      setFieldError(problem);
      return;
    }
    setFieldError("");
    skipCommit.current = true;
    setEditingKey(null);
    if (draft.trim() === rawOf(row).trim()) return;
    await onSave({ [String(row.field.key)]: parse(row.field.kind, draft) } as Partial<VaultItem>);
  }

  return (
    <Section
      title={title}
      action={
        <button
          type="button"
          onClick={() => (all ? void saveAll() : startAll())}
          aria-label={all ? `Save ${title.toLowerCase()}` : `Edit ${title.toLowerCase()}`}
          title={all ? "Save (Esc to cancel)" : `Edit ${title.toLowerCase()}`}
          className="relative max-md:after:absolute max-md:after:-inset-2 max-md:after:content-[''] inline-flex h-7 w-7 items-center justify-center rounded-[7px] ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)]"
          style={{ color: all ? "var(--theme-gold)" : "var(--muted)" }}
        >
          <AppIcon name={all ? "checkmark" : "edit"} size={14} strokeWidth={1.8} />
        </button>
      }
    >
      <div className="grid gap-3 text-sm">
        {fieldError ? (
          <div role="alert" className="text-[12px] leading-snug text-red-300">{fieldError}</div>
        ) : null}
        {rows.map((row) => {
          const field = row.field ? (row as FieldRow) : null;
          const key = field ? String(field.field.key) : "";
          const inputProps = field
            ? {
                inputMode: field.field.kind === "money" ? ("decimal" as const) : undefined,
                "aria-label": row.label,
                className: `${INLINE_EDIT_LINE} h-5 flex-1 text-right`,
              }
            : null;
          return (
            <div key={row.label} className="flex items-start justify-between gap-4">
              <div className="shrink-0 text-[color:var(--muted)]">{row.label}</div>
              {field && inputProps && all ? (
                <input
                  {...inputProps}
                  value={drafts[key] ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void saveAll();
                    if (e.key === "Escape") setAll(false);
                  }}
                />
              ) : field && inputProps && editingKey === key ? (
                <input
                  {...inputProps}
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => void commitOne(field)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") {
                      skipCommit.current = true;
                      setEditingKey(null);
                    }
                  }}
                />
              ) : field ? (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => startOne(field)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startOne(field); } }}
                  title={`Click to edit ${row.label.toLowerCase()}`}
                  className="vltd-tap cursor-pointer text-right text-[color:var(--fg)] hover:underline hover:decoration-[color:var(--border)] hover:underline-offset-4"
                >
                  {row.value}
                </span>
              ) : (
                <div className="text-right text-[color:var(--fg)]">{row.value}</div>
              )}
            </div>
          );
        })}
      </div>
      {children}
    </Section>
  );
}

/**
 * The item's PUBLIC description, shown under the title. This is the text people
 * see when the item is shared; the Notes section below stays private. Editing
 * happens on the text itself (a line under it), so the header never grows.
 */
function DescriptionField({
  item,
  onSave,
  extra,
}: {
  item: VaultItem;
  onSave: (text: string) => Promise<void> | void;
  /** Shown only while editing. Receives a setter so a generated draft lands in the text. */
  extra?: (setDraft: (text: string) => void) => React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const skip = useRef(false);
  const text = item.description?.trim() ?? "";

  async function save() {
    if (skip.current) return;
    skip.current = true;
    setEditing(false);
    const next = draft.trim();
    if (next !== text) await onSave(next);
  }

  if (editing) {
    return (
      <div
        className="mt-1.5 max-w-3xl"
        onBlur={(e) => {
          // Clicking the Generate button should not count as leaving the text.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) void save();
        }}
      >
        <textarea
          autoFocus
          rows={1}
          maxLength={600}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              skip.current = true;
              setEditing(false);
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void save();
            }
          }}
          placeholder="Describe this item for anyone you share it with."
          aria-label="Description"
          className={`${INLINE_EDIT_LINE} block w-full resize-none text-sm leading-6 text-[color:var(--fg)]`}
        />
        {extra ? <div className="mt-1.5">{extra(setDraft)}</div> : null}
      </div>
    );
  }

  return (
    <div className="mt-1.5 max-w-3xl">
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          skip.current = false;
          setDraft(item.description ?? "");
          setEditing(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            skip.current = false;
            setDraft(item.description ?? "");
            setEditing(true);
          }
        }}
        title="Click to edit the description"
        className="block w-full cursor-text text-left text-sm leading-6 hover:underline hover:decoration-[color:var(--border)] hover:underline-offset-4"
      >
        {text ? (
          <span className="whitespace-pre-wrap text-[color:var(--fg)]">{text}</span>
        ) : (
          <span style={{ color: "var(--muted2)" }}>Add a description. This is what people see when you share this item.</span>
        )}
      </div>
    </div>
  );
}

function TagsEditor({ item, onSave }: { item: VaultItem; onSave: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const tags = item.tags ?? [];

  const suggestions = useMemo(
    () => generateHashtags(item).filter((t) => !tags.includes(t.toLowerCase())),
    [item, tags]
  );

  function addTag(raw: string) {
    const next = normalizeTags([...tags, raw]);
    if (next) onSave(next);
    setDraft("");
  }

  function removeTag(tag: string) {
    onSave(tags.filter((t) => t !== tag));
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold ring-1"
            style={{ background: "var(--pill)", color: "var(--fg)", borderColor: "var(--border)" }}
          >
            #{tag}
            <button onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`} className="relative opacity-60 hover:opacity-100 max-md:after:absolute max-md:after:-inset-4 max-md:after:content-['']">
              <AppIcon name="close" size={12} strokeWidth={2.5} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === ",") && draft.trim()) {
              e.preventDefault();
              addTag(draft);
            }
          }}
          placeholder={tags.length ? "Add another tag…" : "Add a tag…"}
          className="min-w-[120px] flex-1 rounded-full px-3 py-1 text-[12px] outline-none ring-1 focus:ring-[color:var(--theme-gold)] max-md:min-h-11"
          style={{ background: "transparent", color: "var(--fg)", borderColor: "var(--border)" }}
        />
      </div>

      {suggestions.length > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--muted2)]">
            Suggested
          </div>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.slice(0, 8).map((tag) => (
              <button
                key={tag}
                onClick={() => addTag(tag)}
                className="relative max-md:after:absolute max-md:after:inset-x-0 max-md:after:-inset-y-3 max-md:after:content-[''] rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 transition hover:bg-[color:var(--pill)]"
                style={{ color: "var(--muted)", borderColor: "var(--border)" }}
              >
                + {tag}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailGrid({ rows }: { rows: Array<{ label: string; value: React.ReactNode }> }) {
  return (
    <div className="grid gap-3 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start justify-between gap-4">
          <div className="text-[color:var(--muted)]">{row.label}</div>
          <div className="text-right text-[color:var(--fg)]">{row.value}</div>
        </div>
      ))}
    </div>
  );
}

export default function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [items, setItems] = useState<VaultItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [mediaMessage, setMediaMessage] = useState("");
  const [askingError, setAskingError] = useState("");
  const [recordMessage, setRecordMessage] = useState("");
  const recordMessageRef = useRef("");
  recordMessageRef.current = recordMessage;
  const [recordDraft, setRecordDraft] = useState({
    universe: "MISC" as UniverseKey,
    categoryLabel: "Collectors Choice",
    subcategoryLabel: "",
    title: "",
    subject: "",
  });
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [sale, setSale] = useState<SaleRecord | null>(null);
  const [isSoldView, setIsSoldView] = useState(false);
  const [socialExportOpen, setSocialExportOpen] = useState(false);
  const [auctionOpen, setAuctionOpen] = useState(false);
  const { trigger: shareTrigger, dismiss: dismissShareTrigger } = useAutoShareTrigger();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  // Escape closes, Tab stays inside, focus goes in and comes back to the Delete button (not while a delete is running).
  const deleteDialogRef = useDialogA11y<HTMLDivElement>(deleteConfirm, () => {
    if (isDeleting) return;
    setDeleteConfirm(false);
    setDeleteError("");
  });
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [headerEditing, setHeaderEditing] = useState(false);
  const [headerSaving, setHeaderSaving] = useState(false);
  const [headerError, setHeaderError] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const router = useRouter();
  const [registryEntry, setRegistryEntry] = useState<import("@/lib/registryModel").RegistrySubject | null>(null);

  // Fetch current user email for feature gating
  useEffect(() => {
    void getCurrentUser().then((result) => {
      setUserEmail(result.data.user?.email ?? null);
    });
  }, []);

  useEffect(() => {
    const next = loadItems({ includeAllProfiles: true });
    setItems(next);
    markItemViewed(id);

    const params = new URLSearchParams(window.location.search);
    const sold = params.get("sold") === "1";
    setIsSoldView(sold);
    setSale(null);

    if (sold) {
      const sales = getSales();
      const match = sales.find((s) => String(s.id) === String(id));
      if (match) setSale(match);
    }

    // The saved copy on this device can be older than the cloud (an edit made
    // elsewhere, or a bulk fix). Pull in the background and only swap in the
    // fresh data if THIS item actually changed, so a refresh landing while
    // you are typing never resets what you are editing.
    let cancelled = false;
    if (hasSupabaseEnv()) {
      void syncVaultItemsFromSupabase()
        .then(() => {
          if (cancelled) return;
          const fresh = loadItems({ includeAllProfiles: true });
          setItems((prev) => {
            const before = prev.find((entry) => String(entry.id) === String(id));
            const after = fresh.find((entry) => String(entry.id) === String(id));
            return JSON.stringify(before) === JSON.stringify(after) ? prev : fresh;
          });
        })
        .catch(() => {
          /* offline or cloud unavailable: keep showing the saved copy */
        });
    }
    return () => {
      cancelled = true;
    };
  }, [id]);

  const item = useMemo(() => {
    const found = items.find((entry) => String(entry.id) === String(id));
    // Personal and Business are separate: an item that belongs to the other profile is not shown here.
    const activeProfileId = getStoredActiveProfileId();
    if (found && activeProfileId && found.profile_id && found.profile_id !== activeProfileId) return null;
    return found ?? sale ?? null;
  }, [items, id, sale]);
  const images = useMemo(() => (item ? getOrderedImageUrls(item) : []), [item]);

  useEffect(() => {
    if (!item?.subject) { setRegistryEntry(null); return; }
    import("@/lib/registryModel").then(({ fetchRegistrySubjects }) => {
      fetchRegistrySubjects().then((subjects) => {
        const match = subjects.find((s) => s.subject === item.subject);
        setRegistryEntry(match ?? null);
      }).catch(() => {});
    });
  }, [item?.subject]);

  useEffect(() => {
    if (!item) return;
    const nextUniverse = normUniverse(item.universe);
    const nextCategory = categoryLabel(item);
    setRecordDraft({
      universe: nextUniverse,
      categoryLabel: nextCategory,
      subcategoryLabel: item.subcategoryLabel ?? "",
      title: item.title ?? "",
      subject: item.subject ?? "",
    });
  }, [item]);

  useEffect(() => {
    if (activeImageIndex > images.length - 1) {
      setActiveImageIndex(Math.max(0, images.length - 1));
    }
  }, [images.length, activeImageIndex]);

  if (!item) {
    return (
      <main className="bg-[color:var(--bg)] px-4 py-10 text-[color:var(--fg)]">
        <div className="mx-auto max-w-5xl rounded-[14px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)]">
          Item not found.
        </div>
      </main>
    );
  }

  async function persist(nextItem: VaultItem) {
    // Defence for every edit on this page: an amount that CHANGED in this save must be a valid, non-negative number. (Old records that
    // already hold something odd are not rewritten and do not block unrelated edits.)
    const problem = item ? itemMoneyProblem(item, nextItem) : undefined;
    if (problem) {
      showToast(problem);
      setMediaMessage(problem);
      return;
    }
    saveItem(nextItem);
    setItems((prev) => prev.map((entry) => (entry.id === nextItem.id ? nextItem : entry)));

    // This is the save path for every edit on this page (title, value, notes, tags, asking price, video clip, Details...).
    // The edit is already on this device; saveItemDurably records it as "waiting to upload" BEFORE the network is touched and
    // then sends it through the shared upload queue. Leaving the page, refreshing, closing the tab or losing the connection
    // therefore cannot lose it: the next visit finishes the upload, and a download from the account never replaces it while
    // it is waiting. If the account has not got it yet, the status pill and a note say so.
    if (hasSupabaseEnv()) {
      const { pending } = await saveItemDurably(nextItem);
      if (pending) {
        reportPending("items");
        showToast("Saved on this device — not in your account yet. We will keep trying.");
      } else if (isSpecsDeviceOnly(nextItem.id)) {
        // The account took the item but the database has no place for its specialist details yet.
        showToast(SPECS_DEVICE_ONLY_NOTE);
      }
    }

    window.dispatchEvent(new Event("vltd:vault-updated"));
  }

  function setDraftUniverse(nextUniverse: UniverseKey) {
    const nextCategory = getDefaultCategory(nextUniverse);
    setRecordDraft((prev) => ({
      ...prev,
      universe: nextUniverse,
      categoryLabel: nextCategory,
      subcategoryLabel: "",
    }));
  }

  function setDraftCategory(nextCategory: string) {
    setRecordDraft((prev) => ({
      ...prev,
      categoryLabel: nextCategory,
      subcategoryLabel: "",
    }));
  }

  // "Turn on public sharing?" -> Yes. The Share panel only shows its public-link choices once this has been saved to the account.
  async function enablePublicSharing() {
    if (!item) return;
    const result = await setItemPublic(item, true);
    if (!result.ok) throw new Error(result.error || "It could not be saved.");
    setItems((prev) => prev.map((entry) => (String(entry.id) === String(result.item.id) ? result.item : entry)));
  }

  async function handleSaveBasicRecord(): Promise<boolean> {
    if (!item) return false;
    const title = recordDraft.title.trim();
    if (!title) {
      setRecordMessage("Title is required.");
      recordMessageRef.current = "Title is required.";
      return false;
    }

    const universe = normUniverse(recordDraft.universe);
    const categoryLabelValue = safeCategoryForUniverse(universe, recordDraft.categoryLabel);
    const subcategoryOptions = getSubcategories(universe, categoryLabelValue);
    const requestedSubcategory = recordDraft.subcategoryLabel.trim();
    // A subcategory you did not touch is kept even when it is not on today's list; one you picked must be on the list.
    const subcategoryUnchanged = requestedSubcategory !== "" && requestedSubcategory === (item.subcategoryLabel ?? "");
    const subcategoryLabel =
      requestedSubcategory && !subcategoryUnchanged && subcategoryOptions.length && !subcategoryOptions.includes(requestedSubcategory)
        ? ""
        : requestedSubcategory;

    // Classification: only rewritten when you changed it. Left alone, a category the item already had stays as it was (an older item
    // that only had the code "comics" gains the matching label "Comics", so every screen now says the same thing). The item's own
    // specialist Details are never touched here.
    const universeChanged = universe !== normUniverse(item.universe);
    const categoryChanged = categoryLabelValue !== categoryLabel(item);
    const knownCategory = getCategories(universe).includes(categoryLabelValue);
    const classification: Partial<VaultItem> =
      universeChanged || categoryChanged
        ? { category: categoryCode(categoryLabelValue), categoryLabel: categoryLabelValue }
        : item.categoryLabel || !knownCategory
          ? {}
          : { categoryLabel: categoryLabelValue };

    const nextItem: VaultItem = {
      ...item,
      title,
      universe,
      ...classification,
      subcategoryLabel: subcategoryLabel || undefined,
      subject: recordDraft.subject.trim() || undefined,
    };

    await persist(nextItem);
    setRecordMessage("Basic item record saved.");
    return true;
  }

  async function saveHeaderEdit() {
    if (headerSaving) return;
    setHeaderSaving(true);
    setHeaderError("");
    try {
      if (await handleSaveBasicRecord()) setHeaderEditing(false);
      else setHeaderError(recordMessageRef.current || "Could not save.");
    } catch (error) {
      setHeaderError(error instanceof Error && error.message ? error.message : "Could not save. Your edits are still here.");
    } finally {
      setHeaderSaving(false);
    }
  }

  function cancelHeaderEdit() {
    if (item) {
      const nextUniverse = normUniverse(item.universe);
      setRecordDraft({
        universe: nextUniverse,
        categoryLabel: categoryLabel(item),
        subcategoryLabel: item.subcategoryLabel ?? "",
        title: item.title ?? "",
        subject: item.subject ?? "",
      });
    }
    setRecordMessage("");
    setHeaderError("");
    setHeaderEditing(false);
  }

  async function handleApplyCoa(data: CoaAnalysisResult, imageFile: File) {
    if (!item) return;
    // Merge extracted fields — only overwrite if the field is currently empty
    const nextItem: VaultItem = {
      ...item,
      certNumber: item.certNumber || data.certNumber || item.certNumber,
      grade: item.grade || data.grade || item.grade,
      condition: item.condition || data.authenticator || item.condition,
      notes: item.notes
        ? item.notes
        : [data.itemDescription, data.signerName, data.authDate, data.notes]
            .filter(Boolean)
            .join(" · ") || item.notes,
    };
    await persist(nextItem);
    // Also save the CoA image as a secondary photo on the item
    await handleAddImages([imageFile]);
  }

  async function handleAddImages(files: File[]) {
    if (!item || files.length === 0) return;

    setUploading(true);
    setMediaMessage("Uploading image(s)...");

    try {
      let nextItem = { ...item };
      let imageIndex = getOrderedImages(nextItem).length;

      for (const file of files) {
        try {
          if (hasSupabaseEnv()) {
            // Perf/size fix (2026-09-19): this used to upload `file` raw —
            // prepareImageBlob was only ever called on the offline/error
            // fallback branches below, never here on the normal online
            // path, which is what runs in production whenever Supabase is
            // reachable. That's the real reason an untouched, full-
            // resolution photo could land in storage from this screen.
            const durableBlob = await prepareImageBlob(file);
            const uploaded = await uploadVaultImageToSupabase({
              itemId: item.id,
              file: durableBlob,
              fileName: file.name,
            });
            nextItem = appendImage(nextItem, uploaded.publicUrl, uploaded.path, { localOnly: false });
          } else {
            const durableBlob = await prepareImageBlob(file);
            const storageKey = generateVaultImageKey(item.id, imageIndex);
            await saveImageBlobToIndexedDb(durableBlob, storageKey);
            const localUrl = URL.createObjectURL(durableBlob);
            nextItem = appendImage(nextItem, localUrl, storageKey, { localOnly: true });
          }
        } catch (uploadError) {
          const durableBlob = await prepareImageBlob(file).catch(() => file);
          const storageKey = generateVaultImageKey(item.id, imageIndex);
          await saveImageBlobToIndexedDb(durableBlob, storageKey);
          const localUrl = URL.createObjectURL(durableBlob);
          nextItem = appendImage(nextItem, localUrl, storageKey, { localOnly: true });
          setMediaMessage(
            uploadError instanceof Error
              ? `${uploadError.message} Saved locally on this device.`
              : "Cloud upload failed. Saved locally on this device."
          );
        }
        imageIndex += 1;
      }

      try {
        await persist(nextItem);
        if (!mediaMessage) setMediaMessage("Images saved.");
      } catch (persistError) {
        saveItem(nextItem);
        setItems((prev) => prev.map((entry) => (entry.id === nextItem.id ? nextItem : entry)));
        setMediaMessage(
          persistError instanceof Error
            ? `${persistError.message} Local fallback kept the images on this device.`
            : "Cloud save failed. Local fallback kept the images on this device."
        );
      }

      setActiveImageIndex(Math.max(0, (nextItem.images?.length ?? 1) - 1));
    } finally {
      setUploading(false);
    }
  }

  async function handleMoveImage(fromIndex: number, toIndex: number) {
    if (!item) return;
    const nextItem = reorderImages(item, fromIndex, toIndex);
    saveItem(nextItem);
    setItems((prev) => prev.map((entry) => (entry.id === nextItem.id ? nextItem : entry)));
    setActiveImageIndex(toIndex);
    setMediaMessage("Image order updated.");

    if (hasSupabaseEnv()) {
      const { pending } = await saveItemDurably(nextItem);
      if (pending) setMediaMessage("Order changed on this device — not in your account yet. We will keep trying.");
    }
  }

  async function handleDeleteImage(index: number) {
    if (!item) return;

    const beforeImages = getOrderedImages(item);
    const target = beforeImages[index];
    const nextItem = deleteImageAtIndex(item, index);

    saveItem(nextItem);
    setItems((prev) => prev.map((entry) => (entry.id === nextItem.id ? nextItem : entry)));
    setActiveImageIndex((prev) => Math.max(0, Math.min(prev, (nextItem.images?.length ?? 1) - 1)));
    setMediaMessage("Image deleted.");

    if (hasSupabaseEnv()) {
      const { pending } = await saveItemDurably(nextItem);
      if (pending) {
        setMediaMessage("Image removed on this device — not in your account yet. We will keep trying.");
      } else if (target && target.storageKey && !target.localOnly) {
        try {
          await deleteVaultImageFromSupabase(target.storageKey);
        } catch (error) {
          setMediaMessage(error instanceof Error ? `${error.message} The picture file is still stored.` : "The picture file is still stored.");
        }
      }
    }
  }

  async function handleReplaceImage(index: number, file: File, meta?: { snapshotOf?: string }) {
    if (!item) return;

    const orderedImages = getOrderedImages(item);
    const target = orderedImages[index];
    if (!target) return;

    setUploading(true);
    setMediaMessage("Saving edited photo...");

    try {
      let replacement: VaultImage;

      try {
        if (hasSupabaseEnv()) {
          // Same fix as handleAddImages above -- the online path never
          // resized before uploading, only the offline/error fallbacks did.
          const durableBlob = await prepareImageBlob(file);
          const uploaded = await uploadVaultImageToSupabase({
            itemId: item.id,
            file: durableBlob,
            fileName: file.name || "edited-photo.jpg",
          });
          replacement = {
            ...target,
            id: uploaded.path,
            storageKey: uploaded.path,
            url: uploaded.publicUrl,
            localOnly: false,
            ...(meta?.snapshotOf ? { quality: "snapshot" as const, sourceUrl: meta.snapshotOf } : {}),
          };
        } else {
          const durableBlob = await prepareImageBlob(file);
          const storageKey = generateVaultImageKey(item.id, index);
          await saveImageBlobToIndexedDb(durableBlob, storageKey);
          const localUrl = URL.createObjectURL(durableBlob);
          replacement = {
            ...target,
            id: storageKey,
            storageKey,
            url: localUrl,
            localOnly: true,
          };
        }
      } catch (uploadError) {
        const durableBlob = await prepareImageBlob(file).catch(() => file);
        const storageKey = generateVaultImageKey(item.id, index);
        await saveImageBlobToIndexedDb(durableBlob, storageKey);
        const localUrl = URL.createObjectURL(durableBlob);
        replacement = {
          ...target,
          id: storageKey,
          storageKey,
          url: localUrl,
          localOnly: true,
        };
        setMediaMessage(
          uploadError instanceof Error
            ? `${uploadError.message} Edited photo saved locally on this device.`
            : "Cloud upload failed. Edited photo saved locally on this device."
        );
      }

      const nextImages = orderedImages.map((image, imageIndex) =>
        imageIndex === index ? { ...replacement, order: imageIndex } : { ...image, order: imageIndex }
      );
      const replacingPrimary =
        target.storageKey === item.primaryImageKey || target.url === item.imageFrontUrl || index === 0;
      const nextItem: VaultItem = {
        ...item,
        images: nextImages,
        primaryImageKey: replacingPrimary ? replacement.storageKey : item.primaryImageKey,
        imageFrontUrl: replacingPrimary ? replacement.url : item.imageFrontUrl,
        imageFrontStoragePath: replacingPrimary ? replacement.storageKey : item.imageFrontStoragePath,
      };

      await persist(nextItem);

      if (hasSupabaseEnv() && target.storageKey && !target.localOnly && target.storageKey !== replacement.storageKey) {
        try {
          await deleteVaultImageFromSupabase(target.storageKey);
        } catch {
          // The edited image is saved; old-file cleanup can fail safely.
        }
      }

      setMediaMessage("Edited photo saved.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSavePricing(patch: PricingMvpFields) {
    if (!item) return;

    const pricingPatch = buildPricingPatch(patch);

    const nextItem: VaultItem = {
      ...item,
      id: item.id,
      title: item.title,
      estimatedValue: pricingPatch.estimatedValue,
      lastCompValue: pricingPatch.lastCompValue,
      priceSource: pricingPatch.priceSource,
      priceConfidence: pricingPatch.priceConfidence,
      priceUpdatedAt: pricingPatch.priceUpdatedAt,
      priceNotes: pricingPatch.priceNotes,
      valueLow: pricingPatch.valueLow,
      valueMedian: pricingPatch.valueMedian,
      valueHigh: pricingPatch.valueHigh,
      comparables: pricingPatch.comparables,
      priceSources: pricingPatch.priceSources,
      // The card now shows the item's whole value (see the value passed to the card), so what it saves IS the value: clearing the box clears the
      // valuation instead of silently keeping the old one.
      currentValue: displayPrimaryValue(pricingPatch),
    };

    await persist(nextItem);
    setMediaMessage("Pricing updated.");
  }

  async function handleReturnToVault() {
    if (!item) return;
    const confirmed = window.confirm("Return this item to the Vault and remove its sold status?");
    if (!confirmed) return;

    const nextItem: VaultItem = {
      ...item,
      status: "COLLECTION",
      soldPrice: undefined,
      soldAt: undefined,
      soldPlatform: undefined,
    };

    saveItem(nextItem);
    removeSaleRecord(item.id);
    setItems((prev) => prev.map((entry) => (entry.id === nextItem.id ? nextItem : entry)));
    setSale(null);
    setIsSoldView(false);
    window.history.replaceState(null, "", `/vault/item/${encodeURIComponent(item.id)}`);

    if (hasSupabaseEnv()) {
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        const { error } = await supabase
          .from("vault_items")
          .update({
            status: "COLLECTION",
            sold_price: null,
            sold_at: null,
            sold_platform: null,
          })
          .eq("id", item.id);

        if (error) {
          enqueueVaultItemSync(item.id);
          setMediaMessage(`${error.message} Item restored here; it will retry saving to your account.`);
          return;
        }
      }
    }

    setMediaMessage("Returned to Vault.");
    window.dispatchEvent(new Event("vltd:vault-updated"));
  }

  async function handleToggleForSale() {
    if (!item || item.status === "SOLD") return;
    const nextStatus = item.status === "FOR_SALE" ? "COLLECTION" : "FOR_SALE";
    const nextItem: VaultItem = {
      ...item,
      status: nextStatus,
      askingPrice:
        nextStatus === "FOR_SALE"
          ? item.askingPrice ?? effectiveMarketValue(item)
          : item.askingPrice,
    };

    await persist(nextItem);
    setMediaMessage(nextStatus === "FOR_SALE" ? "Marked for sale." : "Removed from For Sale.");
    showToast(nextStatus === "FOR_SALE" ? "Marked for sale." : "Removed from For Sale.");
  }

  async function handleAskingPriceBlur(value: string) {
    if (!item) return;
    // blank clears the asking price; 0 is an explicit $0; letters, malformed numbers and negatives are refused with a message and not saved
    const parsed = parseMoneyInput(value, { label: "Asking price" });
    if (!parsed.ok) {
      setAskingError(parsed.message);
      return;
    }
    setAskingError("");
    const askingPrice = parsed.blank ? undefined : parsed.value;
    await persist({ ...item, askingPrice });
    const saved = askingPrice === undefined ? "Asking price cleared." : "Asking price saved.";
    setMediaMessage(saved);
    // The line above sits in the photo card at the top of the page, out of sight while the price field is on screen: say it where the person is looking.
    showToast(saved);
  }

  const universe = normUniverse(item.universe);
  const addedAt = createdAtMs(item);
  const displayedSale: SaleRecord | null =
    sale ??
    (item.status === "SOLD" || item.soldAt || item.soldPrice !== undefined
      ? {
          ...item,
          soldPrice: item.soldPrice,
          soldAt: item.soldAt,
        }
      : null);
  // The same sale rule as the Sold page, Home and Sales History: revenue - all-in cost - estimated seller fees; unknown cost = unknown profit.
  const saleInfo = displayedSale ? soldItemOf({ ...item, soldPrice: displayedSale.soldPrice ?? item.soldPrice, soldAt: displayedSale.soldAt ?? item.soldAt }) : null;
  const saleResult = saleInfo ? saleOutcome(saleInfo) : null;
  const recordSelectedCategory = safeCategoryForUniverse(recordDraft.universe, recordDraft.categoryLabel);
  const baseRecordCategoryOptions = getCategories(recordDraft.universe);
  const recordCategoryOptions =
    recordSelectedCategory && !baseRecordCategoryOptions.includes(recordSelectedCategory)
      ? [recordSelectedCategory, ...baseRecordCategoryOptions]
      : baseRecordCategoryOptions;
  const recordSubcategoryOptions = getSubcategories(recordDraft.universe, recordSelectedCategory);
  // The item's own subcategory stays selectable even when it is not on today's list, so editing the title never silently drops it.
  const recordSubcategoryChoices =
    recordDraft.subcategoryLabel && !recordSubcategoryOptions.includes(recordDraft.subcategoryLabel)
      ? [recordDraft.subcategoryLabel, ...recordSubcategoryOptions]
      : recordSubcategoryOptions;
  const notable = isNotable(item);
  const itemIsSupply = isSupplyItem({ universe: item.universe, categoryLabel: item.categoryLabel });
  const itemShareUrl = typeof window !== "undefined" ? `${window.location.origin}/share/${encodeURIComponent(item.id)}` : "";
  // The Details card lists Edition and Variant as rows for some categories; the chips below then skip them so they are not shown twice.
  const detailTargets = new Set(resolveItemDetailProfile(item).all.map((field) => field.target));
  const editionShownAbove = detailTargets.has("edition");
  const variantShownAbove = detailTargets.has("variant");

  return (
    <>
    <main className="bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-5 sm:py-6">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_360px]">
          <div>
            <div className="relative rounded-[14px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
              {/* Delete button — top-right */}
              <button
                type="button"
                onClick={() => setDeleteConfirm(true)}
                className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full ring-1 transition-colors max-md:after:absolute max-md:after:-inset-1 max-md:after:content-['']"
                style={{ background: "rgba(248,113,113,0.08)", borderColor: "rgba(248,113,113,0.22)", color: "rgba(248,113,113,0.75)" }}
                aria-label="Delete item"
                title="Delete item"
              >
                <AppIcon name="delete" size={16} strokeWidth={1.75} />
              </button>
              <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">ITEM</div>
              {headerEditing ? (
                <>
                  {/* Green check: saves the title and the classification together. Enter does the same; Esc cancels. */}
                  <PillButton
                    variant="success"
                    onClick={() => void saveHeaderEdit()}
                    disabled={headerSaving}
                    ariaLabel="Save title and classification"
                    title="Save (Enter). Esc cancels."
                    className="absolute right-16 top-4 w-11 px-0! md:w-9"
                  >
                    <AppIcon name={headerSaving ? "loader" : "checkmark"} size={18} strokeWidth={2.4} className={headerSaving ? "animate-spin" : ""} />
                  </PillButton>
                  <input
                    type="text"
                    autoFocus
                    aria-label="Title"
                    className={`${INLINE_EDIT_LINE} mt-0.5 block h-8 w-[calc(100%-7rem)] text-xl font-semibold leading-tight sm:text-2xl`}
                    value={recordDraft.title}
                    onChange={(event) => setRecordDraft((prev) => ({ ...prev, title: event.target.value }))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void saveHeaderEdit();
                      }
                      if (event.key === "Escape") cancelHeaderEdit();
                    }}
                  />
                  <div role="status" aria-live="polite" className="text-xs text-[color:var(--muted)]">{headerSaving ? "Saving…" : ""}</div>
                  {headerError ? <div role="alert" className="text-xs text-red-300">{headerError}</div> : null}
                </>
              ) : (
                <h1 className="mt-0.5 break-words pr-12 text-2xl font-semibold leading-tight [overflow-wrap:anywhere] sm:text-3xl">
                  {item.title}
                  <PillButton size="compact" className="ml-2 w-8 px-0! align-middle md:w-7" onClick={() => setHeaderEditing(true)} ariaLabel="Edit title and category" title="Edit title and category">
                    <AppIcon name="edit" size={16} strokeWidth={1.8} />
                  </PillButton>
                  {notable ? <span className="ml-2 inline-block align-middle"><NotableBadge reason={notableReason(item)} /></span> : null}
                </h1>
              )}
              <DescriptionField
                item={item}
                onSave={(text) => persist({ ...item, description: text })}
                extra={(setText) => (
                  <GenerateCopyPanel
                    item={item}
                    mode="description"
                    onAccept={(text) => setText(text)}
                    triggerLabel={item.description?.trim() ? "Regenerate description" : "Generate description"}
                  />
                )}
              />
              {headerEditing ? (
                <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-[color:var(--muted)]">
                  <select
                    aria-label="Universe"
                    className={`${INLINE_EDIT_LINE} h-6 w-auto max-md:h-9`}
                    value={recordDraft.universe}
                    onChange={(event) => setDraftUniverse(normUniverse(event.target.value))}
                    onKeyDown={(event) => { if (event.key === "Escape") cancelHeaderEdit(); }}
                  >
                    {getUniverses().map((key) => (
                      <option key={key} value={key}>{UNIVERSE_LABEL[key]}</option>
                    ))}
                  </select>
                  <span aria-hidden="true">›</span>
                  <select
                    aria-label="Category"
                    className={`${INLINE_EDIT_LINE} h-6 w-auto max-md:h-9`}
                    value={recordSelectedCategory}
                    onChange={(event) => setDraftCategory(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Escape") cancelHeaderEdit(); }}
                  >
                    {recordCategoryOptions.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                  <span aria-hidden="true">›</span>
                  <select
                    aria-label="Subcategory"
                    className={`${INLINE_EDIT_LINE} h-6 w-auto max-md:h-9`}
                    value={recordDraft.subcategoryLabel}
                    disabled={recordSubcategoryChoices.length === 0}
                    onChange={(event) => setRecordDraft((prev) => ({ ...prev, subcategoryLabel: event.target.value }))}
                    onKeyDown={(event) => { if (event.key === "Escape") cancelHeaderEdit(); }}
                  >
                    <option value="">{recordSubcategoryChoices.length === 0 ? "No subcategories" : "(none)"}</option>
                    {recordSubcategoryChoices.map((subcategory) => (
                      <option key={subcategory} value={subcategory}>{subcategory}</option>
                    ))}
                  </select>
                  <span aria-hidden="true">•</span>
                  <span>Added {fmtDate(addedAt)}</span>
                </div>
              ) : (
                <div className="mt-1.5 text-sm text-[color:var(--muted)]">
                  {UNIVERSE_LABEL[universe]} • {categoryLabel(item)}
                  {item.subcategoryLabel ? ` • ${item.subcategoryLabel}` : ""}
                  {" • "}Added {fmtDate(addedAt)}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <PillButton href="/vault"><AppIcon name="arrowLeft" size={16} />Vault</PillButton>
                <PillButton href={`/vault/item/${encodeURIComponent(item.id)}/present`}>Stream</PillButton>
                <div className="ml-1 h-6 w-px bg-[color:var(--border)]" />
                <ContentActionBar
                  kind="item"
                  contentId={item.id}
                  title={item.title}
                  previewUrl={images[0]}
                  shareUrl={itemShareUrl}
                  canShare={Boolean(item.isPublic) && !itemIsSupply}
                  shareRestriction="Storage and display supplies are never shared publicly, so this item has no public link."
                  onEnablePublic={itemIsSupply ? undefined : enablePublicSharing}
                  sharePhotos={images.map((url, index) => ({ url, label: index === 0 ? "Main photo" : `Photo ${index + 1}` }))}
                  isOwner
                  viewerProfileId=""
                  onExport={() => setSocialExportOpen(true)}
                />
                <PillButton onClick={() => setAuctionOpen(true)}>
                  <Glyph name="gavel" size={16} />
                  {item.auctionStatus === "ACTIVE" ? "Manage Auction" : "Start Auction"}
                  {item.auctionStatus === "ACTIVE" && <AuctionCountdownChip item={item} />}
                </PillButton>
              </div>
              {socialExportOpen && (
                <SocialExportSheet
                  item={item}
                  onClose={() => setSocialExportOpen(false)}
                  shareUrl={itemIsSupply ? "" : itemShareUrl}
                  onEnablePublic={itemIsSupply ? undefined : enablePublicSharing}
                />
              )}
              {auctionOpen && (
                <AuctionSetupSheet
                  item={item}
                  onClose={() => setAuctionOpen(false)}
                  onSaved={(updated) => {
                    setItems((prev) => prev.map((i) => i.id === updated.id ? updated : i));
                  }}
                />
              )}
            </div>

            {displayedSale ? (
              <div className="mt-2">
                <PillButton onClick={() => void handleReturnToVault()} style={{ background: 'rgba(203,208,213,0.15)', color: '#67E8F9' }}>
                  Return to Vault
                </PillButton>
              </div>
            ) : null}


            {isSoldView && displayedSale && (
              <div className="mb-5 mt-4">
                <Section title="SALE DETAILS">
                  <DetailGrid
                    rows={[
                      { label: "Sold Price", value: <span data-testid="sale-revenue">{fmtMoney(clamp(displayedSale.soldPrice))}</span> },
                      { label: "Cost (all-in)", value: <span data-testid="sale-cost">{saleResult && saleResult.cost !== null ? fmtMoneyExact(saleResult.cost) : "Unknown"}</span> },
                      { label: "Estimated fees", value: <span data-testid="sale-fees">{saleResult && saleResult.fees > 0 ? fmtMoney(saleResult.fees) : "—"}</span> },
                      {
                        label: "Profit / Loss",
                        value:
                          !saleResult || saleResult.profit === null ? (
                            <span data-testid="sale-profit" className="text-[color:var(--muted)]" title="No purchase cost is recorded for this item, so its profit is unknown.">Unknown (no cost recorded)</span>
                          ) : (
                            <span data-testid="sale-profit" className={saleResult.profit >= 0 ? "text-green-400" : "text-red-400"}>
                              {saleResult.profit >= 0 ? "+" : ""}
                              {fmtMoney(saleResult.profit)}
                            </span>
                          ),
                      },
                      {
                        label: "Sold Date",
                        value: displayedSale.soldAt ? fmtDate(displayedSale.soldAt) : "—",
                      },
                    ]}
                  />
                </Section>
              </div>
            )}

            <div id="media" className="mt-4 scroll-mt-24">
              <Section title="MEDIA">
                <ItemMedia
                  images={images}
                  activeIndex={activeImageIndex}
                  onSelect={setActiveImageIndex}
                  onAddImages={handleAddImages}
                  onMoveImage={handleMoveImage}
                  onDeleteImage={handleDeleteImage}
                  onReplaceImage={handleReplaceImage}
                />

                {(uploading || mediaMessage) && (
                  <div className="mt-3 text-sm text-[color:var(--muted)]">
                    {uploading ? "Uploading..." : mediaMessage}
                  </div>
                )}

                <VideoClipSection
                  item={item}
                  userEmail={userEmail}
                  onSave={(clip: VideoClip | null) => void persist({ ...item, videoClip: clip ?? undefined })}
                />
              </Section>
            </div>

          </div>

          <div>
            <Section title="ITEM SUMMARY">
              <div className="pt-1">
                <DetailGrid
                  rows={[
                    { label: "Universe", value: UNIVERSE_LABEL[universe] },
                    { label: "Category", value: categoryLabel(item) },
                    { label: "Subcategory", value: detailValue(item.subcategoryLabel) },
                    { label: "Vault ID", value: detailValue(item.itemCode) },
                    { label: "Added", value: fmtDate(addedAt) },
                  ]}
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  <InsurancePdfButton
                    items={[item]}
                    single
                    label="Insurance Documents"
                    className={pillClassName("default")}
                  />
                  <CoaScanButton onApply={(data, file) => void handleApplyCoa(data, file)} />
                </div>
              </div>

              <div className="mt-5 rounded-[14px] bg-[color:var(--theme-elevated)] p-4 ring-1 ring-[color:var(--theme-border)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[13px] font-semibold">Visibility</div>
                    <div className="mt-1 text-[11px] text-[color:var(--muted)]">
                      Private items stay in your vault. Public items can be shown later in shared vault and museum links.
                    </div>
                  </div>
                  <ItemVisibilityToggle
                    item={item}
                    size="md"
                    showLabel
                    onChange={(nextItem) =>
                      setItems((prev) =>
                        prev.map((entry) => (String(entry.id) === String(nextItem.id) ? nextItem : entry))
                      )
                    }
                  />
                </div>
              </div>

              <div className="mt-5 rounded-[14px] bg-[color:var(--theme-elevated)] p-4 ring-1 ring-[color:var(--theme-border)]">
                <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">MARKET</div>
                <div className={"mt-3 text-[40px] font-semibold leading-none" + (hasExplicitValue(item) ? "" : " text-[color:var(--muted2)]")}>{hasExplicitValue(item) ? fmtMoney(effectiveMarketValue(item)) : hasRecordedCost(item) ? fmtMoney(totalCost(item)) : "Missing value"}</div>
                {!hasExplicitValue(item) ? <div className="mt-1 text-xs text-[color:var(--muted)]">{hasRecordedCost(item) ? "At purchase cost. Not valued yet." : "No valuation and no purchase cost recorded."}</div> : null}
                {effectiveMarketValue(item) > 0 ? (
                  item.priceSource ? (
                    <div className="mt-2 text-xs text-[color:var(--muted)]">Estimated price based on: {item.priceSource}</div>
                  ) : null
                ) : (
                  <div className="mt-2 text-xs text-[color:var(--muted)]">{totalCost(item) > 0 ? "Not priced yet, so vault totals use what you paid (grey). Add a value in Pricing below." : "No market value yet. Add one in Pricing below; nothing is filled in for you."}</div>
                )}
                <div className="mt-4 border-t border-[color:var(--theme-border)] pt-3">
                  <DetailGrid
                    rows={[
                      { label: "ROI", value: roi(item) !== null ? fmtPct(roi(item) as number) : "—" },
                      { label: "Total cost", value: totalCost(item) > 0 || typeof item.purchasePrice === "number" ? fmtMoneyExact(totalCost(item)) : "Not recorded" },
                      { label: "Gain", value: gain(item) !== null ? fmtMoneyExact(gain(item) as number) : "—" },
                    ]}
                  />
                </div>
              </div>

              {item.status !== "SOLD" ? (
                <div className="mt-5 rounded-[14px] bg-[color:var(--theme-elevated)] p-4 ring-1 ring-[color:var(--theme-border)]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-[13px] font-semibold">
                        {item.status === "FOR_SALE" ? "Listed for sale" : "Mark for sale"}
                      </div>
                      <div className="mt-1 text-[11px] text-[color:var(--muted)]">
                        {item.status === "FOR_SALE"
                          ? "Keeps this item in your vault while enabling listing tools."
                          : "Adds a For Sale badge and unlocks listing copy."}
                      </div>
                    </div>
                    <Toggle on={item.status === "FOR_SALE"} onChange={() => void handleToggleForSale()} ariaLabel={item.status === "FOR_SALE" ? "Listed for sale" : "Mark for sale"} />
                  </div>

                  {item.status === "FOR_SALE" ? (
                    <label className="mt-4 grid gap-1.5">
                      <span className="text-[11px] font-semibold tracking-[0.16em] text-[color:var(--muted2)]">
                        Asking Price
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label="Asking price"
                        aria-invalid={askingError ? true : undefined}
                        defaultValue={item.askingPrice ?? effectiveMarketValue(item) ?? ""}
                        onBlur={(event) => void handleAskingPriceBlur(event.target.value)}
                        className="h-10 rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none max-md:h-11"
                        placeholder={String(effectiveMarketValue(item) || "")}
                      />
                      {askingError ? <span role="alert" data-testid="asking-error" className="text-[12px] leading-snug text-red-300">{askingError}</span> : null}
                    </label>
                  ) : null}
                </div>
              ) : null}
            </Section>

            <div className="mt-4">
              <Section title="DOCUMENTS">
                <DocumentsSection itemId={item.id} />
              </Section>
            </div>
          </div>
        </div>

        {/* Cost to Sell — full-width horizontal */}
        <div className="mt-5">
          <CostToSellPanel
            price={effectiveMarketValue(item)}
            costBasis={totalCost(item)}
            category={categoryLabel(item)}
            universe={item.universe}
            subcategory={item.subcategoryLabel}
          />
        </div>

        <div className="mt-4">
          {item.status === "FOR_SALE" && (
            <div className="mb-4 space-y-3">
              <ListingReadinessPanel item={item} />
              <GenerateCopyPanel
                item={item}
                mode="listing"
                onAccept={(text) => void persist({ ...item, description: text })}
                triggerLabel="Generate listing copy"
              />
            </div>
          )}
          {item.status === "FOR_SALE" ? (
            <ExportListingButton item={item} />
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[18px] bg-[color:var(--surface)] px-4 py-3 ring-1 ring-[color:var(--border)]">
              <div className="min-w-0 flex-1 basis-[280px]">
                <div className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted2)]">Listing copy</div>
                <p className="mt-0.5 text-xs leading-snug text-[color:var(--muted)]">
                  Writes paste-ready text for marketplaces like eBay, Mercari and Whatnot from this item&apos;s details. You copy it and paste it into the marketplace yourself; nothing is listed or published for you.
                </p>
              </div>
              {item.status !== "SOLD" ? (
                <PillButton onClick={() => void handleToggleForSale()}>Mark for sale to unlock</PillButton>
              ) : (
                <span className="text-xs text-[color:var(--muted)]">Available while an item is for sale.</span>
              )}
            </div>
          )}
        </div>

        <div className="mt-5">
          <PricingMvpCard
            title="PRICING MVP"
            value={{
              estimatedValue: item.estimatedValue,
              lastCompValue: item.lastCompValue,
              priceSource: item.priceSource,
              priceConfidence: item.priceConfidence,
              priceUpdatedAt: item.priceUpdatedAt,
              priceNotes: item.priceNotes,
              valueLow: item.valueLow,
              // A valuation typed on the Add page lives only in currentValue: show it here so it can be seen, edited and cleared.
              valueMedian: item.valueMedian ?? (item.estimatedValue === undefined && item.lastCompValue === undefined ? item.currentValue : undefined),
              valueHigh: item.valueHigh,
              comparables: item.comparables,
              priceSources: item.priceSources,
            }}
            universe={item.universe}
            categoryLabel={categoryLabel(item)}
            grade={item.grade}
            itemTitle={item.title}
            onSave={handleSavePricing}
          />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <ItemDetailsSection item={item} onSave={(patch) => persist({ ...item, ...patch })}>
            {(((item.edition && !editionShownAbove) || (item.variant && !variantShownAbove)) || item.printRun || item.isFirstEdition) && (
              <div className="mt-4 rounded-[14px] bg-[color:var(--pill)] p-4 ring-1 ring-[color:var(--border)]">
                <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted2)]">
                  Edition / Variant
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.isFirstEdition ? (
                    <span
                      className="rounded-full px-3 py-1 text-xs font-semibold ring-1"
                      style={{
                        background: "var(--theme-gold-subtle)",
                        borderColor: "var(--theme-gold-border)",
                        color: "var(--theme-gold)",
                      }}
                    >
                      1st Edition
                    </span>
                  ) : null}
                  {item.edition && !item.isFirstEdition && !editionShownAbove ? (
                    <span
                      className="rounded-full px-3 py-1 text-xs ring-1 ring-[color:var(--border)]"
                      style={{ color: "var(--fg)" }}
                    >
                      {item.edition}
                    </span>
                  ) : null}
                  {item.variant && !variantShownAbove ? (
                    <span
                      className="rounded-full px-3 py-1 text-xs ring-1 ring-[color:var(--border)]"
                      style={{ color: "var(--fg)" }}
                    >
                      {item.variant}
                    </span>
                  ) : null}
                  {item.printRun ? (
                    <span
                      className="rounded-full px-3 py-1 text-xs ring-1 ring-[color:var(--border)]"
                      style={{ color: "var(--fg)" }}
                    >
                      # {item.printRun}
                    </span>
                  ) : null}
                </div>
              </div>
            )}
            {item.subject ? (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--muted2)" }}>
                    Subject
                  </span>
                  <Link
                    href={`/community-board/${encodeURIComponent(item.subject)}`}
                    className="rounded-full px-2.5 py-0.5 text-[12px] font-semibold ring-1 hover:brightness-110 transition"
                    style={{
                      background: "var(--theme-gold-subtle)",
                      borderColor: "var(--theme-gold-border)",
                      color: "var(--theme-gold)",
                    }}
                  >
                    {item.subject}
                  </Link>
                </div>
                {registryEntry && (
                  <Link
                    href={`/community-board/${encodeURIComponent(item.subject)}`}
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold ring-1 hover:ring-[color:var(--theme-gold)] transition"
                    style={{ background: "var(--pill)", borderColor: "var(--border)", color: "var(--muted)" }}
                  >
                    <span className="inline-flex items-center gap-1"><Glyph name="users" size={12} /> {registryEntry.collectorCount} collector{registryEntry.collectorCount !== 1 ? "s" : ""} tracking</span>
                    <span style={{ color: "var(--border)" }}>·</span>
                    <span style={{ color: "var(--theme-gold)" }}>View on Community Board →</span>
                  </Link>
                )}
              </div>
            ) : null}
          </ItemDetailsSection>

          <InlineEditSection
            title="PURCHASE"
            item={item}
            onSave={(patch) => persist({ ...item, ...patch })}
            rows={[
                { label: "Purchase price", field: { key: "purchasePrice", kind: "money", nonNegative: true }, value: item.purchasePrice == null ? "—" : fmtMoneyExact(clamp(item.purchasePrice)) },
                { label: "Tax", field: { key: "purchaseTax", kind: "money", nonNegative: true }, value: item.purchaseTax == null ? "—" : fmtMoneyExact(clamp(item.purchaseTax)) },
                { label: "Shipping", field: { key: "purchaseShipping", kind: "money", nonNegative: true }, value: item.purchaseShipping == null ? "—" : fmtMoneyExact(clamp(item.purchaseShipping)) },
                { label: "Fees", field: { key: "purchaseFees", kind: "money", nonNegative: true }, value: item.purchaseFees == null ? "—" : fmtMoneyExact(clamp(item.purchaseFees)) },
                { label: "Source", field: { key: "purchaseSource", kind: "text" }, value: detailValue(item.purchaseSource) },
                { label: "Location", field: { key: "purchaseLocation", kind: "text" }, value: detailValue(item.purchaseLocation) },
                { label: "Order #", field: { key: "orderNumber", kind: "text" }, value: detailValue(item.orderNumber) },
            ]}
          />

          <InlineEditSection
            title="STORAGE + TRACKING"
            item={item}
            onSave={(patch) => persist({ ...item, ...patch })}
            rows={[
                { label: "Storage location", field: { key: "storageLocation", kind: "text" }, value: detailValue(item.storageLocation) },
                { label: "Value source", value: detailValue(item.valueSource) },
                { label: "Value updated", value: detailValue(item.valueUpdatedAt ? fmtDate(item.valueUpdatedAt) : "—") },
                { label: "Confidence", value: typeof item.valueConfidence === "number" ? `${item.valueConfidence}%` : "\u2014" },
            ]}
          />
        </div>

        <div className="mt-5">
          <Section
            title="INTERNAL NOTES (ONLY YOU SEE THESE)"
            action={
              !isEditingNotes ? (
                <button
                  type="button"
                  onClick={() => { setNotesDraft(item.notes ?? ""); setIsEditingNotes(true); }}
                  aria-label="Edit notes"
                  title="Edit notes"
                  className="relative max-md:after:absolute max-md:after:-inset-2 max-md:after:content-[''] inline-flex h-7 w-7 items-center justify-center rounded-[7px] ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)]"
                  style={{ color: "var(--muted)" }}
                >
                  <AppIcon name="edit" size={14} strokeWidth={1.8} />
                </button>
              ) : null
            }
          >
            {isEditingNotes ? (
              <div>
                <textarea
                  autoFocus
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-xl px-3 py-2.5 text-sm leading-6 ring-1 focus:outline-none"
                  style={{ background: "var(--pill)", color: "var(--fg)", borderColor: "var(--border)" }}
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { void persist({ ...item, notes: notesDraft.trim() }); setIsEditingNotes(false); }}
                    className="rounded-[8px] px-4 py-1.5 text-xs font-bold transition"
                    style={{ background: "var(--theme-gold, #C8CDD2)", color: "#0A0800" }}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingNotes(false)}
                    className="rounded-[8px] px-4 py-1.5 text-xs font-semibold ring-1 ring-[color:var(--border)]"
                    style={{ color: "var(--muted)" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="whitespace-pre-wrap text-sm leading-6 mb-3">
                  {item.notes?.trim() ? item.notes : (
                    <span style={{ color: "var(--muted2)" }}>No private notes yet.</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {item.notes?.trim() ? (
                    <button
                      type="button"
                      onClick={() => void persist({ ...item, notes: "" })}
                      className="relative max-md:after:absolute max-md:after:inset-x-0 max-md:after:-inset-y-2 max-md:after:content-[''] rounded-[7px] px-3 py-1.5 text-xs font-semibold text-red-400 ring-1 ring-red-400/30 transition hover:bg-red-500/10"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </Section>
        </div>

        <div className="mt-5">
          <Section title="TAGS">
            <TagsEditor item={item} onSave={(tags) => void persist({ ...item, tags })} />
          </Section>
        </div>
      </div>
    </main>

      {shareTrigger && (
        <AutoSharePrompt
          trigger={shareTrigger}
          onShare={() => setSocialExportOpen(true)}
          onDismiss={() => dismissShareTrigger()}
        />
      )}

      {deleteConfirm && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center px-4"
          onClick={() => setDeleteConfirm(false)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            ref={deleteDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-item-title"
            className="relative z-10 w-full max-w-sm rounded-[14px] p-6 ring-1"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">DELETE ITEM</div>
            <h2 id="delete-item-title" className="mt-3 text-xl font-semibold">{item.title}</h2>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              This will permanently remove the item from your vault. This cannot be undone.
            </p>
            {deleteError ? (
              <p className="mt-2 text-sm text-rose-400">{deleteError}</p>
            ) : null}
            <div className="mt-5 flex items-center gap-3">
              <PillButton onClick={() => { setDeleteConfirm(false); setDeleteError(""); }} className="flex-1" disabled={isDeleting}>
                Cancel
              </PillButton>
              <PillButton
                onClick={async () => {
                  setIsDeleting(true);
                  setDeleteError("");
                  const result = await deleteVaultItemEverywhere(item.id);
                  if (result.ok) {
                    router.replace("/vault");
                    return;
                  }
                  setIsDeleting(false);
                  setDeleteError(result.error || "Could not delete this item. Please try again.");
                }}
                disabled={isDeleting}
                className="flex-1"
                style={{ background: "rgba(248,113,113,0.15)", color: "rgb(248,113,113)" }}
              >
                {isDeleting ? "Deleting…" : "Delete Forever"}
              </PillButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
