"use client";

import { parseMoneyInput } from "@/lib/moneyInput";
import { useDialogA11y } from "@/components/ui/useDialogA11y";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { showToast } from "@/lib/toast";
import { createPortal } from "react-dom";
import UpgradeNudge, { isFreeTierLimitError } from "@/components/UpgradeNudge";

import CameraCapturePanel from "@/components/CameraCapturePanel";
import BarcodeScanCamera from "@/components/BarcodeScanCamera";
import DropReviewSheet from "@/components/DropReviewSheet";
import { type ImageRole } from "@/components/ImageRoleSelector";
import ScanCropEditor from "@/components/ScanCropEditor";
import ScanPanel from "@/components/ScanPanel";
import { PillButton } from "@/components/ui/PillButton";
import { AppIcon } from "@/components/ui/AppIcon";
import {
  applyBulkLockedValues,
  buildRememberedValues,
  DEFAULT_BULK_ADD_LOCKS,
  EMPTY_BULK_ADD_VALUES,
  readBulkAddState,
  resetUnlockedBulkValues,
  toggleBulkAddLock,
  writeBulkAddState,
  type BulkAddFieldKey,
  type BulkAddLocks,
  type BulkAddValues,
} from "@/lib/bulkAddState";
import { lookupBookByIsbn, detectBookIsbnFromFile, extractIsbnFromText } from "@/lib/bookIsbn";
import {
  addDropItem,
  clearDropSession,
  createDropSession,
  dropItemFromVaultItem,
  dropSessionStats,
  loadDropSession,
  saveDropSession,
  type DropSession,
} from "@/lib/dropSession";
import { buildPricingPatch, type PricingMvpFields } from "@/lib/pricingMvp";
import { parseComicScanResult, scanComicRegionsFromFile } from "@/lib/scanners/comicParser";
import { lookupComicByUpc, lookupComicBySeries, formatComicCoverDate } from "@/lib/metronLookup";
import { lookupComicByBarcode, lookupComicBySeriesIssue } from "@/lib/gcdLookup";
import { scanTcgCardRegionsFromFile } from "@/lib/scanners/tcgCardParser";
import { lookupMtgCard, lookupPokemonCard, type CardLookupResult } from "@/lib/cardLookup";
import { lookupVinylByBarcode, lookupVinylByText } from "@/lib/discogLookup";
import { lookupPSACert, looksLikePSACert, extractPSACertFromUrl, formatPSAGrade, formatPSASet } from "@/lib/psaLookup";
import type { BarcodeLookupResult } from "@/lib/scanners/barcodeLookup";
import { cropImageFile, type ScanCropRect } from "@/lib/scanners/cropImageFile";
import { scanBarcodeFromFile } from "@/lib/scanners/barcodeScanner";
import {
  attachScanImage,
  clearScanSession,
  clearScanSessionReview,
  createScanSession,
  markScanSessionApplied,
  markScanSessionFailed,
  markScanSessionScanning,
  setScanSessionBarcode,
  setScanSessionReview,
  type ScanSessionReview,
  type ScanSessionState,
} from "@/lib/scanners/scanSession";
import { newId } from "@/lib/id";
import { lookupUpcItem } from "@/lib/upcLookup";
import { emitVaultUpdate } from "@/lib/vaultEvents";
import {
  appendItems,
  loadItems,
  syncVaultItemsFromSupabase,
  type VaultImage,
  type VaultItem,
} from "@/lib/vaultModel";
import { suggestAutoTags } from "@/lib/generateHashtags";
import { enqueueVaultItemSync, processVaultSyncQueue } from "@/lib/vaultSyncQueue";
import { hasSupabaseEnv, uploadVaultImageToSupabase } from "@/lib/vaultCloud";
import {
  runImageScanAutofill,
  type ScanItemType,
} from "@/lib/scanAutofill";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import {
  generateVaultImageKey,
  prepareImageBlob,
  revokeImageObjectUrl,
  saveImageBlobToIndexedDb,
} from "@/lib/vaultImageStore";
import { analyzeImageWithVision } from "@/lib/ai/openaiVision";
import { ScanRefusedError } from "@/lib/ai/scanRequest";
import {
  getCategories,
  getDefaultCategory,
  getSubcategories,
  getTypeOptions,
  getCheckboxOptions,
  getUniverses,
  isUniverseKey,
  UNIVERSE_LABEL,
  type UniverseKey,
} from "@/lib/taxonomy";
import { resolveCategoryLabel } from "@/lib/categoryLabels";
import AddDetailFields from "@/components/AddDetailFields";
import { resolveDetailProfile } from "@/lib/detailFields";
import { isSpecsDeviceOnly, SPECS_DEVICE_ONLY_NOTE } from "@/lib/specsDeviceOnly";
import { useAiAccess } from "@/lib/ai/useAiAccess";

const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";

// The form keeps yes / no as "true" / "false" / "" (not chosen). Not chosen stays unknown; it is never saved as No.
function boolFromForm(value?: string) {
  return value === "true" ? true : value === "false" ? false : undefined;
}

// Category-specific details with no field of their own travel as one JSON text in the form.
function parseFormSpecs(raw?: string): Record<string, string> | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.trim()) out[key] = value.trim();
    }
    return Object.keys(out).length ? out : undefined;
  } catch {
    return undefined;
  }
}
const HAUL_AUTOSTART_KEY = "vltd_drop_autostart_v1";

type FormValues = BulkAddValues;

const EMPTY_VALUES: FormValues = { ...EMPTY_BULK_ADD_VALUES };
const EMPTY_PRICING_VALUES: PricingMvpFields = {};
const DEFAULT_SCAN_CROP: ScanCropRect = { left: 0, top: 0, right: 0, bottom: 0 };

type DraftMediaImage = {
  id: string;
  file: File;
  previewUrl: string;
  role: ImageRole;
};

function isDefaultCrop(crop: ScanCropRect) {
  return crop.left === 0 && crop.top === 0 && crop.right === 0 && crop.bottom === 0;
}

function getActiveProfileId() {
  if (typeof window === "undefined") return "";
  try {
    return String(window.localStorage.getItem(ACTIVE_PROFILE_KEY) ?? "").trim();
  } catch {
    return "";
  }
}

function inputClass(isAiFilled?: boolean) {
  return [
    "h-11 md:h-9 w-full min-w-0 rounded-xl px-3 text-sm focus:outline-none transition-all placeholder:text-[color:var(--muted)] placeholder:italic placeholder:text-xs",
    isAiFilled
      ? "bg-[rgba(203,208,213,0.18)] ring-2 ring-[rgba(203,208,213,0.7)] text-[#EDEFF1] font-semibold"
      : "bg-[color:var(--pill)] ring-1 ring-[color:var(--border)]",
  ].join(" ");
}

function selectClass(isAiFilled?: boolean) {
  return [
    "h-11 md:h-9 w-full rounded-xl px-3 text-sm focus:outline-none transition-all",
    isAiFilled
      ? "bg-[rgba(203,208,213,0.18)] ring-2 ring-[rgba(203,208,213,0.7)] text-[#EDEFF1] font-semibold"
      : "bg-[color:var(--pill)] ring-1 ring-[color:var(--border)]",
  ].join(" ");
}

function textareaClass(isAiFilled?: boolean) {
  return [
    "min-h-[78px] rounded-xl px-3 py-2.5 text-sm focus:outline-none transition-all placeholder:text-[color:var(--muted)] placeholder:italic placeholder:text-xs",
    isAiFilled
      ? "bg-[rgba(203,208,213,0.18)] ring-2 ring-[rgba(203,208,213,0.7)] text-[#EDEFF1] font-semibold"
      : "bg-[color:var(--pill)] ring-1 ring-[color:var(--border)]",
  ].join(" ");
}

function generateNotesSummary(values: FormValues): string {
  const p: string[] = [];
  const u = values.universe;

  // Universe-specific lead
  if (u === "SPORTS" && values.sportsSport) p.push(values.sportsSport);
  if (values.categoryLabel) p.push(values.categoryLabel);

  // Subject (player/character) before title when different
  if (values.subject && values.subject !== values.title) p.push(values.subject);
  if (values.title) p.push(values.title);
  if (values.subtitle) p.push(values.subtitle);
  if (values.number) p.push(`#${values.number}`);

  // Edition / variant
  if (values.edition) p.push(values.edition);
  if (values.variant) p.push(values.variant);

  // Universe-specific detail
  if (u === "SPORTS") {
    if (values.sportsTeam) p.push(values.sportsTeam);
    if (values.sportsParallelType) p.push(values.sportsParallelType);
    if (values.sportsSerialNumber) p.push(`/${values.sportsSerialNumber}`);
  } else if (u === "TCG") {
    if (values.tcgRarity) p.push(values.tcgRarity);
    if (values.tcgParallelType) p.push(values.tcgParallelType);
    if (values.tcgLanguage && values.tcgLanguage !== "English") p.push(values.tcgLanguage);
  } else if (u === "MUSIC") {
    if (values.vinylLabel) p.push(values.vinylLabel);
    if (values.vinylPressing) p.push(values.vinylPressing);
    if (values.vinylColor) p.push(values.vinylColor);
  } else if (u === "POP_CULTURE") {
    if (values.comicPublisher) p.unshift(values.comicPublisher);
    if (values.comicCoverDate) p.push(values.comicCoverDate);
    if (values.toyBrand) p.unshift(values.toyBrand);
    if (values.toyLine) p.push(values.toyLine);
    if (values.artCardArtist) p.push(values.artCardArtist);
  } else if (u === "JEWELRY_APPAREL") {
    if (values.watchBrand) p.unshift(values.watchBrand);
    if (values.watchReference) p.push(`Ref. ${values.watchReference}`);
    if (values.watchMovement) p.push(values.watchMovement);
    if (values.bagBrand) p.unshift(values.bagBrand);
    if (values.bagColor) p.push(values.bagColor);
    if (values.bagMaterial) p.push(values.bagMaterial);
    if (values.apparelColorway) p.push(values.apparelColorway);
    if (values.apparelSize) p.push(values.apparelSize);
  } else if (u === "GAMES") {
    if (values.gamePlatform) p.push(values.gamePlatform);
    if (values.gamePublisher) p.push(values.gamePublisher);
  }

  // Grade always last
  if (values.grade) p.push(values.grade);

  // Deduplicate and join
  return [...new Set(p.filter(Boolean))].join(" · ");
}

function categoryCode(label: string) {
  return label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "COLLECTORS_CHOICE";
}

function safeUniverse(value: unknown): UniverseKey {
  const key = String(value ?? "").trim().toUpperCase();
  return isUniverseKey(key) ? key : "MISC";
}

function safeCategoryForUniverse(universe: UniverseKey, value: unknown) {
  const requested = String(value ?? "").trim();
  return requested || getDefaultCategory(universe);
}

function normalizeHierarchy(values: FormValues): FormValues {
  const universe = safeUniverse(values.universe);
  const categoryLabel = safeCategoryForUniverse(
    universe,
    resolveCategoryLabel(getCategories(universe), values.categoryLabel, values.category)
  );
  const allowedSubcategories = getSubcategories(universe, categoryLabel);
  const requestedSubcategory = String(values.subcategoryLabel ?? "").trim();
  const subcategoryLabel =
    requestedSubcategory && allowedSubcategories.includes(requestedSubcategory)
      ? requestedSubcategory
      : requestedSubcategory && allowedSubcategories.length === 0
        ? requestedSubcategory
        : "";

  return {
    ...values,
    universe,
    category: categoryCode(categoryLabel),
    categoryLabel,
    subcategoryLabel,
  };
}

function looksLikeBookBarcode(digits?: string) {
  const clean = String(digits ?? "").trim();
  if (!clean) return false;
  if (clean.length === 13 && (clean.startsWith("978") || clean.startsWith("979"))) return true;
  if (clean.length === 10) return true;
  return false;
}

/**
 * Per-field "carry to next item" lock. On phones it is a real 44x44 box (so its hit area is the box itself and
 * never overlaps the input below); on desktop it keeps the 28px compact geometry.
 */
function LockButton({ locked, onToggle }: { locked: boolean; onToggle: () => void }) {
  const label = locked ? "Locked for next item" : "Unlocked for next item";
  return (
    <PillButton
      variant={locked ? "active" : "default"}
      pressed={locked}
      onClick={onToggle}
      ariaLabel={label}
      title={label}
      className="shrink-0 max-md:w-11 max-md:px-0! md:h-7! md:px-2.5!"
    >
      {locked ? (
        <AppIcon name="lock" size={14} strokeWidth={2.5} style={{ color: "var(--theme-gold, #C8CDD2)" }} />
      ) : (
        <AppIcon name="unlocked" size={14} strokeWidth={2.5} style={{ color: "var(--muted)" }} />
      )}
    </PillButton>
  );
}

function Field({
  label,
  locked = false,
  onToggleLock,
  children,
}: {
  label: string;
  locked?: boolean;
  /** Omit for fields that cannot be carried over to the next item -- no lock control is shown. */
  onToggleLock?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-1">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium tracking-[0.14em] text-[color:var(--muted2)]">
          {label}
        </label>
        {onToggleLock ? (
          <LockButton locked={locked} onToggle={onToggleLock} />
        ) : null}
      </div>
      {children}
    </div>
  );
}

export default function AddPage() {
  // Only an account that has AI is told to use it (and shown the button); the server refuses every other account.
  const aiAccess = useAiAccess();
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const mediaCameraInputRef = useRef<HTMLInputElement | null>(null);
  const numberInputRef = useRef<HTMLInputElement | null>(null);
  const scanStageRef = useRef<HTMLDivElement | null>(null);
  const mediaImagesRef = useRef<DraftMediaImage[]>([]);

  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);
  const [locks, setLocks] = useState<BulkAddLocks>({ ...DEFAULT_BULK_ADD_LOCKS });

  const [scanSession, setScanSession] = useState<ScanSessionState>(createScanSession());
  const [scanFile, setScanFile] = useState<File | null>(null);
  // Tracks whether the Auto Identify scan actually ran for this item, so
  // the Activity feed can honestly say "scanned" vs. "added manually"
  // instead of assuming every item here was scanned.
  const [usedAutoIdentify, setUsedAutoIdentify] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isCropEditorOpen, setIsCropEditorOpen] = useState(false);
  // The photo that was added by choosing a file a moment ago and whose crop step is still open: Cancel discards it (nothing was ever asked to keep it).
  const [freshCropMediaId, setFreshCropMediaId] = useState("");
  const [cropEditorTarget, setCropEditorTarget] = useState<"scan" | "media">("scan");
  const [cropMediaImageId, setCropMediaImageId] = useState("");
  const [scanCrop, setScanCrop] = useState<ScanCropRect>(DEFAULT_SCAN_CROP);
  const [isApplyingCrop, setIsApplyingCrop] = useState(false);

  const [draftMediaImages, setDraftMediaImages] = useState<DraftMediaImage[]>([]);
  const [activeMediaImageId, setActiveMediaImageId] = useState("");
  const [selectedMediaImageId, setSelectedMediaImageId] = useState("");
  // Dialog behaviour (Escape, focus containment, focus return) for the photo options and crop editor.
  const photoDialogRef = useDialogA11y<HTMLDivElement>(Boolean(selectedMediaImageId), () => setSelectedMediaImageId(""));
  const cropDialogRef = useDialogA11y<HTMLDivElement>(isCropEditorOpen, () => cancelCropEditor());
  const [cameraTarget, setCameraTarget] = useState<"scan" | "item">("scan");
  const [isCameraPanelOpen, setIsCameraPanelOpen] = useState(false);
  const [cameraPanelKey, setCameraPanelKey] = useState(0);
  const [isBarcodeScanOpen, setIsBarcodeScanOpen] = useState(false);

  const [pricingValues, setPricingValues] = useState<PricingMvpFields>(EMPTY_PRICING_VALUES);

  const [saveScanAsPhoto, setSaveScanAsPhoto] = useState(false);

  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasDraftChanges, setHasDraftChanges] = useState(false);
  const [limitHit, setLimitHit] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isBookLookupRunning, setIsBookLookupRunning] = useState(false);
  const [isComicLookupRunning, setIsComicLookupRunning] = useState(false);
  const [isCardLookupRunning, setIsCardLookupRunning] = useState(false);
  const [isUpcLookupRunning, setIsUpcLookupRunning] = useState(false);
  const [isVisionLookupRunning, setIsVisionLookupRunning] = useState(false);
  const [aiFilledFields, setAiFilledFields] = useState<Set<keyof FormValues>>(new Set());
  // Identify path derives from the universe/category the user already picked —
  // no manual "identify mode" selector needed.
  const scanType = useMemo<ScanItemType>(() => {
    const cat = (values.categoryLabel || values.category || "").toLowerCase();
    if (values.universe === "POP_CULTURE" && cat.includes("comic")) return "comic";
    if (values.universe === "TCG" || values.universe === "SPORTS" || cat.includes("card")) return "card";
    if (cat.includes("book")) return "book";
    return "auto";
  }, [values.universe, values.categoryLabel, values.category]);
  const [existingItems, setExistingItems] = useState<VaultItem[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState("");
  const [dropMode, setDropMode] = useState(false);
  const [dropSession, setDropSession] = useState<DropSession | null>(null);
  const [showDropReview, setShowDropReview] = useState(false);

  useEffect(() => {
    const state = readBulkAddState();
    setLocks(state.locks);
    setValues(applyBulkLockedValues(undefined, state.rememberedValues, state.locks));

    const existingDrop = loadDropSession();
    const shouldAutostart = window.localStorage.getItem(HAUL_AUTOSTART_KEY) === "1";
    if (shouldAutostart) {
      window.localStorage.removeItem(HAUL_AUTOSTART_KEY);
    }

    if (existingDrop && existingDrop.items.length > 0) {
      setDropSession(existingDrop);
      setDropMode(true);
    } else if (shouldAutostart) {
      const session = createDropSession();
      saveDropSession(session);
      setDropSession(session);
      setDropMode(true);
      setStatus("Batch Mode started. Save items back-to-back, then review the batch.");
    }
  }, []);

  useEffect(() => {
    let isActive = true;

    async function hydrateExistingItems() {
      if (isActive) {
        setExistingItems(loadItems());
      }

      try {
        await syncVaultItemsFromSupabase();
      } catch {
        // local cache is still useful for duplicate checks
      }

      if (isActive) {
        setExistingItems(loadItems());
      }
    }

    void hydrateExistingItems();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    writeBulkAddState({
      locks,
      rememberedValues: buildRememberedValues(values, locks),
    });
  }, [locks, values]);

  useEffect(() => {
    return () => {
      const previewUrl = scanSession.image?.previewUrl ?? "";
      if (previewUrl.startsWith("blob:")) revokeImageObjectUrl(previewUrl);
    };
  }, [scanSession.image]);

  useEffect(() => {
    mediaImagesRef.current = draftMediaImages;
  }, [draftMediaImages]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // This page is "Manual entry" / "Add manually": every link to it means "let me type the details". It used to open the camera
  // by itself (since July), which is the Scan screen's job (/capture). The camera is one tap away in the photo box.

  useEffect(() => {
    if (isCropEditorOpen || selectedMediaImageId || isCameraPanelOpen || showDropReview) return;

    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
    document.body.style.touchAction = "";
  }, [isCameraPanelOpen, isCropEditorOpen, selectedMediaImageId, showDropReview]);

  useEffect(() => {
    return () => {
      mediaImagesRef.current.forEach((image) => {
        if (image.previewUrl.startsWith("blob:")) {
          revokeImageObjectUrl(image.previewUrl);
        }
      });
    };
  }, []);

  useEffect(() => {
    const titleNorm = values.title.trim().toLowerCase();
    const numberNorm = (values.number ?? "").trim().toLowerCase();
    const subtitleNorm = (values.subtitle ?? "").trim().toLowerCase();
    // Only flag a duplicate when title AND number are both non-empty and exactly match an existing item
    if (!titleNorm || !numberNorm) {
      setDuplicateWarning("");
      return;
    }
    const exactMatch = existingItems.find((item) => {
      const titleMatch = (item.title?.trim().toLowerCase() ?? "") === titleNorm;
      const numberMatch = (item.number?.trim().toLowerCase() ?? "") === numberNorm;
      const subtitleMatch = !subtitleNorm || (item.subtitle?.trim().toLowerCase() ?? "") === subtitleNorm;
      return titleMatch && numberMatch && subtitleMatch;
    });
    setDuplicateWarning(
      exactMatch
        ? `Possible duplicate: ${exactMatch.title}${exactMatch.subtitle ? ` · ${exactMatch.subtitle}` : ""}${exactMatch.number ? ` #${exactMatch.number}` : ""}`
        : ""
    );
  }, [existingItems, values.title, values.subtitle, values.number]);

  const canSave = useMemo(() => values.title.trim().length > 0 && !isSaving, [values.title, isSaving]);

  useUnsavedChangesGuard(
    hasDraftChanges && !isSaving,
    canSave
      ? "This item isn't saved to your vault yet. Tap Save first, or leave to discard it."
      : "This item isn't saved yet — it needs a title before it can be saved. Leave and discard it?"
  );

  const selectedUniverse = safeUniverse(values.universe);
  // After a save with the category kept for the next item the form holds only the stored code
  // ("INSTRUMENTS_GEAR"); turn it back into the name people see instead of listing the raw code.
  const selectedCategory = safeCategoryForUniverse(
    selectedUniverse,
    resolveCategoryLabel(getCategories(selectedUniverse), values.categoryLabel, values.category)
  );
  const baseCategoryOptions = getCategories(selectedUniverse);
  const categoryOptions =
    selectedCategory && !baseCategoryOptions.includes(selectedCategory)
      ? [selectedCategory, ...baseCategoryOptions]
      : baseCategoryOptions;
  const subcategoryOptions = getSubcategories(selectedUniverse, selectedCategory);
  // The shared boxes (Subject, Number, Edition...) take the wording of the chosen category (Artist / performer, Catalog number...).
  const detailProfile = resolveDetailProfile(selectedUniverse, selectedCategory, values.subcategoryLabel);
  const detailLabel = (key: string, fallback: string) => detailProfile.all.find((f) => f.target === key)?.label ?? fallback;
  const typeOptions = getTypeOptions(selectedUniverse, selectedCategory, values.subcategoryLabel || undefined);
  const checkboxOptions = getCheckboxOptions(selectedUniverse, selectedCategory, values.subcategoryLabel || undefined);

  // Parse itemAttributes from JSON or comma string to Set for checkbox state
  const selectedAttributes: Set<string> = useMemo(() => {
    const raw = (values.itemAttributes ?? "").trim();
    if (!raw) return new Set();
    try { const p = JSON.parse(raw); if (Array.isArray(p)) return new Set(p as string[]); } catch {}
    return new Set(raw.split(",").map((s: string) => s.trim()).filter(Boolean));
  }, [values.itemAttributes]);

  function toggleAttribute(attr: string) {
    const next = new Set(selectedAttributes);
    if (next.has(attr)) next.delete(attr); else next.add(attr);
    setField("itemAttributes", JSON.stringify(Array.from(next)));
  }

  function markDraftChanged() {
    setHasDraftChanges(true);
  }

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => {
      if (prev[key] === value) return prev;
      setHasDraftChanges(true);
      return { ...prev, [key]: value };
    });
  }

  function setUniverse(nextUniverse: UniverseKey) {
    const nextCategory = getDefaultCategory(nextUniverse);
    setValues((prev) => {
      if (
        prev.universe === nextUniverse &&
        prev.category === categoryCode(nextCategory) &&
        prev.categoryLabel === nextCategory &&
        !prev.subcategoryLabel
      ) {
        return prev;
      }
      setHasDraftChanges(true);
      return {
        ...prev,
        universe: nextUniverse,
        category: categoryCode(nextCategory),
        categoryLabel: nextCategory,
        subcategoryLabel: "",
      };
    });
  }

  function setCategoryLabel(nextCategory: string) {
    setValues((prev) => {
      if (
        prev.category === categoryCode(nextCategory) &&
        prev.categoryLabel === nextCategory &&
        !prev.subcategoryLabel
      ) {
        return prev;
      }
      setHasDraftChanges(true);
      return {
        ...prev,
        category: categoryCode(nextCategory),
        categoryLabel: nextCategory,
        subcategoryLabel: "",
      };
    });
  }

  function applyScanFieldsToEmpty(fields: ScanSessionReview["fields"]) {
    setValues((prev) => {
      const next = { ...prev };
      const newlyFilled = new Set<keyof FormValues>();
      const apply = (key: keyof FormValues, value?: string) => {
        if (!value?.trim()) return;
        if (String(next[key] ?? "").trim()) return;
        next[key] = value;
        newlyFilled.add(key);
      };

      // Taxonomy fields: a detected universe/category may CORRECT a remembered
      // value from the last item (e.g. camera sees a card while the form still
      // says Gears & Gasoline). User locks always win.
      const applyTaxonomy = (key: keyof FormValues, value: string | undefined, locked: boolean) => {
        if (!value?.trim() || locked) return;
        if (String(next[key] ?? "").trim() === value.trim()) return;
        next[key] = value;
        newlyFilled.add(key);
      };

      apply("title", fields.title);
      apply("subtitle", fields.subtitle);
      apply("number", fields.number);
      apply("grade", fields.grade);
      apply("conditionReason", fields.conditionReason);
      apply("conditionSource", fields.conditionSource);
      apply("certNumber", fields.certNumber);
      applyTaxonomy("universe", fields.universe, locks.universe);
      applyTaxonomy("category", fields.category, locks.category || locks.categoryLabel);
      applyTaxonomy("categoryLabel", fields.categoryLabel, locks.category || locks.categoryLabel);
      applyTaxonomy("subcategoryLabel", fields.subcategoryLabel, locks.subcategoryLabel);
      apply("serialNumber", fields.serialNumber);
      apply("notes", fields.notes);

      if (newlyFilled.size) {
        setHasDraftChanges(true);
        setAiFilledFields((prevFields) => {
          const nextFields = new Set(prevFields);
          newlyFilled.forEach((field) => nextFields.add(field));
          return nextFields;
        });
      }

      return normalizeHierarchy(next);
    });
  }

  function handleToggleLock(key: BulkAddFieldKey) {
    setLocks((prev) => toggleBulkAddLock(prev, key));
  }

  function startDrop() {
    const session = createDropSession();
    saveDropSession(session);
    setDropSession(session);
    setDropMode(true);
    setShowDropReview(false);
    setStatus("Batch Mode started. Save items back-to-back, then review the batch.");
  }

  function endDrop() {
    if (!dropSession) return;
    setShowDropReview(true);
  }

  function finishDrop() {
    clearDropSession();
    setDropMode(false);
    setDropSession(null);
    setShowDropReview(false);
    router.push("/vault");
  }

  useEffect(() => {
    if (!isCropEditorOpen) setFreshCropMediaId("");
  }, [isCropEditorOpen]);

  function clearScanImage() {
    const previewUrl = scanSession.image?.previewUrl ?? "";
    if (previewUrl.startsWith("blob:")) revokeImageObjectUrl(previewUrl);
    setScanFile(null);
    setScanSession(clearScanSession());
    setSaveScanAsPhoto(false);
    setIsCropEditorOpen(false);
    setCropEditorTarget("scan");
    setCropMediaImageId("");
    setScanCrop(DEFAULT_SCAN_CROP);
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (uploadInputRef.current) uploadInputRef.current.value = "";
  }

  function normalizeDraftMediaImages(images: DraftMediaImage[]): DraftMediaImage[] {
    if (images.length === 0) return [];

    const primaryId = images.find((image) => image.role === "primary")?.id ?? images[0].id;

    return images.map((image) => ({
      ...image,
      role:
        image.id === primaryId
          ? "primary"
          : image.role === "primary"
            ? "detail"
            : image.role,
    }));
  }

  function addDraftMediaFiles(files: File[]) {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) {
      setStatus("That item photo is not an image.");
      return [];
    }

    markDraftChanged();

    const newEntries: DraftMediaImage[] = imageFiles.map((file, index) => ({
      id: newId(),
      file,
      previewUrl: URL.createObjectURL(file),
      role: draftMediaImages.length === 0 && index === 0 ? "primary" : "detail",
    }));

    setDraftMediaImages((prev) => normalizeDraftMediaImages([...prev, ...newEntries]));
    setActiveMediaImageId(newEntries[newEntries.length - 1]?.id ?? "");
    setStatus(
      imageFiles.length === 1
        ? "Item photo added. It will save with this item."
        : `${imageFiles.length} item photos added. They will save with this item.`
    );

    if (mediaInputRef.current) mediaInputRef.current.value = "";
    if (mediaCameraInputRef.current) mediaCameraInputRef.current.value = "";

    return newEntries;
  }

  function clearMediaImage() {
    draftMediaImages.forEach((image) => {
      if (image.previewUrl.startsWith("blob:")) revokeImageObjectUrl(image.previewUrl);
    });
    setDraftMediaImages([]);
    setActiveMediaImageId("");
    setSelectedMediaImageId("");
    if (mediaInputRef.current) mediaInputRef.current.value = "";
    if (mediaCameraInputRef.current) mediaCameraInputRef.current.value = "";
  }

  function clearAllImages() {
    clearScanImage();
    clearMediaImage();
  }

  function handleToggleSaveScanAsPhoto(next: boolean) {
    setSaveScanAsPhoto(next);
    markDraftChanged();
  }

  function removeDraftMediaImage(imageId: string) {
    const imageToRemove = draftMediaImages.find((image) => image.id === imageId);
    if (!imageToRemove) return;

    if (imageToRemove.previewUrl.startsWith("blob:")) {
      revokeImageObjectUrl(imageToRemove.previewUrl);
    }

    const nextImages = normalizeDraftMediaImages(draftMediaImages.filter((image) => image.id !== imageId));
    setDraftMediaImages(nextImages);
    setSelectedMediaImageId("");

    if (activeMediaImageId === imageId) {
      clearScanImage();
      const nextActive = nextImages[0];
      if (nextActive) {
        setActiveMediaImageId(nextActive.id);
        replaceScanImage(nextActive.file);
      } else {
        setActiveMediaImageId("");
      }
    }

    setStatus("Photo removed.");
  }

  function openCameraFor(target: "scan" | "item") {
    setCameraTarget(target);
    setCameraPanelKey((key) => key + 1);
    setIsCameraPanelOpen(true);
  }

  function openScanCamera() {
    openCameraFor("scan");
  }

  function handleCapturedPhoto(file: File, barcode?: { digits?: string; rawValue?: string }) {
    setIsCameraPanelOpen(false);

    if (cameraTarget === "item") {
      addDraftMediaFiles([file]);
      return;
    }

    addDraftMediaFiles([file]);
    replaceScanImage(file);

    // A barcode read live off the camera feed is more reliable than re-reading
    // the compressed still — stash it so Auto Identify uses it directly.
    if (barcode?.digits) {
      const digits = barcode.digits;
      const raw = barcode.rawValue ?? digits;
      setScanSession((prev) => setScanSessionBarcode(prev, raw, digits));
      setStatus(aiAccess ? "Picture + barcode captured. Choose Identify with AI or save the item." : "Picture + barcode captured. Fill in the details or save the item.");
    } else {
      setStatus(aiAccess ? "Picture added. Choose Identify with AI or save the item." : "Picture added. Fill in the details or save the item.");
    }
  }

  function replaceScanImage(file: File) {
    const oldPreview = scanSession.image?.previewUrl ?? "";
    if (oldPreview.startsWith("blob:")) revokeImageObjectUrl(oldPreview);

    const previewUrl = URL.createObjectURL(file);
    setScanFile(file);
    setIsCropEditorOpen(false);
    setScanCrop(DEFAULT_SCAN_CROP);

    setScanSession((prev) =>
      attachScanImage(
        prev,
        {
          fileName: file.name || "scan-image",
          previewUrl,
          mimeType: file.type,
          lastModified: file.lastModified,
        },
        scanType === "auto" ? "generic" : scanType
      )
    );
  }

  function selectDraftMediaImageForIdentify(imageId: string) {
    const image = draftMediaImages.find((entry) => entry.id === imageId);
    if (!image) return;

    setActiveMediaImageId(image.id);
    replaceScanImage(image.file);
    setSelectedMediaImageId("");
    setStatus(aiAccess ? "Selected picture ready. Crop if needed, then choose Identify with AI." : "Selected picture ready. Crop if needed, then fill in the details.");
  }

  // Cancel (and Close, the backdrop and Escape) in the crop step. For a picture that was only just chosen, it discards that picture; for one that was
  // already part of the item it just closes the step and leaves the photo as it was.
  function cancelCropEditor() {
    const fresh = freshCropMediaId;
    if (fresh && cropEditorTarget === "scan" && draftMediaImages.some((image) => image.id === fresh)) {
      setFreshCropMediaId("");
      removeDraftMediaImage(fresh);
      setIsCropEditorOpen(false);
      setStatus("Picture discarded. Choose another when you are ready.");
      showToast("That picture was discarded. Choose another when you are ready.");
      return;
    }
    setIsCropEditorOpen(false);
  }

  function openScanCropEditor() {
    if (!scanSession.image?.previewUrl) return;
    setCropEditorTarget("scan");
    setCropMediaImageId("");
    setIsCropEditorOpen(true);
  }

  function openActivePhotoOptions() {
    if (activeMediaImageId && draftMediaImages.some((image) => image.id === activeMediaImageId)) {
      setSelectedMediaImageId(activeMediaImageId);
      return;
    }
    openScanCropEditor();
  }

  function openMediaCropEditor(imageId: string) {
    if (!draftMediaImages.some((image) => image.id === imageId)) return;
    setCropEditorTarget("media");
    setCropMediaImageId(imageId);
    setScanCrop(DEFAULT_SCAN_CROP);
    setSelectedMediaImageId("");
    setIsCropEditorOpen(true);
  }

  function clearPricing() {
    setPricingValues(EMPTY_PRICING_VALUES);
  }

  async function runBookLookupForFile(file: File) {
    setIsBookLookupRunning(true);
    setScanSession((prev) => markScanSessionScanning(prev));

    try {
      let isbn = await detectBookIsbnFromFile(file);
      let rawText = "";

      if (!isbn) {
        const ocr = await runImageScanAutofill(file, "book");
        rawText = ocr.rawText;
        const candidates = extractIsbnFromText(rawText);
        isbn = candidates[0] ?? "";
      }

      if (!isbn) {
        setScanSession((prev) =>
          setScanSessionReview(prev, {
            source: "book_lookup",
            confidence: "low",
            score: 10,
            safeToAutofill: false,
            warnings: [
              "No readable ISBN found.",
              "Try a straight-on shot of the barcode or back cover.",
            ],
            rawText,
            fields: {},
          })
        );
        setStatus("No ISBN found. Try a tighter barcode photo.");
        return false;
      }

      const book = await lookupBookByIsbn(isbn);

      if (!book) {
        const fields = {
          serialNumber: isbn,
        };
        setScanSession((prev) =>
          setScanSessionReview(prev, {
            source: "book_lookup",
            confidence: "medium",
            score: 45,
            safeToAutofill: true,
            warnings: ["ISBN found, but no metadata source returned a book match."],
            rawText: rawText || `ISBN detected: ${isbn}`,
            fields,
          })
        );
        applyScanFieldsToEmpty(fields);
        setScanSession((prev) => markScanSessionApplied(prev));
        setStatus("ISBN found and added. No book metadata was returned.");
        return false;
      }

      const notes = book.notes || `ISBN: ${book.isbn}`;
      const fields = {
        title: book.title,
        subtitle: book.subtitle || "",
        universe: "POP_CULTURE",
        category: "BOOKS",
        categoryLabel: "Books",
        subcategoryLabel: "Book",
        serialNumber: book.isbn,
        notes,
      };

      setScanSession((prev) =>
        setScanSessionReview(prev, {
          source: "book_lookup",
          confidence: "high",
          score: 92,
          safeToAutofill: true,
          warnings: [],
          rawText: rawText || `ISBN detected: ${book.isbn}`,
          fields,
        })
      );

      applyScanFieldsToEmpty(fields);
      setScanSession((prev) => markScanSessionApplied(prev));
      setStatus("Book metadata filled where fields were empty.");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Book lookup failed.";
      setScanSession((prev) => markScanSessionFailed(prev, message));
      setStatus(message);
      return false;
    } finally {
      setIsBookLookupRunning(false);
    }
  }

  async function runComicLookupForFile(file: File, barcodeDigits?: string, barcodeRawValue?: string) {
    setIsComicLookupRunning(true);
    setScanSession((prev) => markScanSessionScanning(prev));

    try {
      const effectiveBarcode = barcodeDigits?.replace(/\D/g, "").trim() ?? "";

      // Run OCR region scan + Metron + GCD barcode lookup in parallel
      const [regionScan, fallbackOcr, metronResult, gcdBarcodeResult] = await Promise.all([
        scanComicRegionsFromFile(file),
        runImageScanAutofill(file, "comic"),
        // Only hit Metron if we have a barcode (12-13 digits — comic UPCs)
        effectiveBarcode.length >= 12
          ? lookupComicByUpc(effectiveBarcode).catch(() => null)
          : Promise.resolve(null),
        // GCD barcode lookup (supplement-tolerant) — broad English DB backs up Metron
        effectiveBarcode.length >= 8
          ? lookupComicByBarcode(effectiveBarcode).catch(() => null)
          : Promise.resolve(null),
      ]);

      const parsed = parseComicScanResult({
        titleRegionText: regionScan.titleText,
        issueRegionText: regionScan.issueText,
        addonText: regionScan.addon,
        fallbackOcrText: fallbackOcr.rawText,
        barcodeDigits: effectiveBarcode || regionScan.barcode,
      });

      // Metron wins; GCD backs it up. If neither hit by barcode but OCR found a
      // title + issue, try GCD by series/issue before giving up.
      let gcdResult = gcdBarcodeResult;
      if (!metronResult && !gcdResult && parsed.title && parsed.issueNumber) {
        gcdResult = await lookupComicBySeriesIssue(parsed.title, parsed.issueNumber).catch(() => null);
      }

      // Build fields — priority: Metron → GCD → OCR
      const metronTitle = metronResult?.seriesTitle ?? "";
      const metronIssueNumber = metronResult?.issueNumber ?? "";
      const metronPublisher = metronResult?.publisher ?? "";
      const metronCoverDate = metronResult?.coverDate
        ? formatComicCoverDate(metronResult.coverDate)
        : "";

      const dbTitle = metronTitle || gcdResult?.series || "";
      const dbNumber = metronIssueNumber || gcdResult?.number || "";
      const dbPublisher = metronPublisher || gcdResult?.publisher || "";
      const dbCoverDate = metronCoverDate || gcdResult?.coverDate || "";

      const fields = {
        title: dbTitle || parsed.title,
        subtitle: parsed.subtitle,
        number: dbNumber || parsed.issueNumber,
        universe: "POP_CULTURE",
        category: "COMICS",
        categoryLabel: "Comics",
        subcategoryLabel: "Comic Book",
        comicPublisher: dbPublisher || undefined,
        comicCoverDate: dbCoverDate || undefined,
        notes: parsed.notes || undefined,
      };

      // Determine confidence — a database match (Metron or GCD) upgrades confidence
      const metronMatched = Boolean(metronResult);
      const dbMatched = metronMatched || Boolean(gcdResult);
      const ocrConfidence = parsed.confidence;
      const finalConfidence: typeof parsed.confidence =
        dbMatched
          ? "high"
          : ocrConfidence;

      const warnings = finalConfidence === "low"
        ? [
            ...parsed.warnings,
            "Try a straighter, tighter scan with the title band, issue box, and barcode all visible.",
          ]
        : parsed.warnings;

      const rawText = [
        dbMatched
          ? `${metronMatched ? "Metron" : "GCD"} DB: ${dbTitle} #${dbNumber} (${dbPublisher})`
          : "",
        parsed.notes || fallbackOcr.rawText || "",
      ]
        .filter(Boolean)
        .join("\n\n");

      setScanSession((prev) => {
        let next = prev;

        if (barcodeRawValue || effectiveBarcode) {
          next = setScanSessionBarcode(next, barcodeRawValue || "", effectiveBarcode || "");
        }

        return setScanSessionReview(next, {
          source: "comic_lookup",
          confidence: finalConfidence,
          score:
            finalConfidence === "high"
              ? (dbMatched ? 95 : 88)
              : finalConfidence === "medium"
                ? 62
                : 20,
          safeToAutofill: finalConfidence !== "low",
          warnings,
          rawText,
          fields,
        });
      });

      if (finalConfidence !== "low") {
        applyScanFieldsToEmpty(fields);
        // Always set comic publisher and cover date from the DB match if we got them
        if (dbMatched) {
          setValues((prev) => {
            const next = { ...prev };
            let changed = false;
            if (dbPublisher && !prev.comicPublisher?.trim()) {
              next.comicPublisher = dbPublisher;
              changed = true;
            }
            if (dbCoverDate && !prev.comicCoverDate?.trim()) {
              next.comicCoverDate = dbCoverDate;
              changed = true;
            }
            if (changed) setHasDraftChanges(true);
            return changed ? next : prev;
          });
        }
        setScanSession((prev) => markScanSessionApplied(prev));
      }

      setStatus(
        dbMatched
          ? `Comic found in ${metronMatched ? "Metron" : "GCD"} database — details filled.`
          : finalConfidence !== "low"
            ? "Comic scan filled what it could."
            : "Comic scan was weak. Try a better scan or use image identify."
      );

      return finalConfidence !== "low";
    } catch (error) {
      const message = error instanceof Error ? error.message : "Comic scan failed.";
      setScanSession((prev) => markScanSessionFailed(prev, message));
      setStatus(message);
      return false;
    } finally {
      setIsComicLookupRunning(false);
    }
  }

  /** Real-database identification for a raw (ungraded) TCG single — the
   *  "Cards" analog of runComicLookupForFile above. Only wired for the two
   *  games with a free public card database (Magic via Scryfall, Pokemon via
   *  the Pokemon TCG API); anything else (Yu-Gi-Oh, Lorcana, One Piece, etc.)
   *  falls through to the existing generic OCR guess — no fake match.
   *
   *  Deliberately does NOT require the exact game to already be picked in
   *  Subcategory first — the whole point of Identify is to figure out what
   *  it is. Tries both Magic and Pokemon off the same OCR'd title/number and
   *  auto-corrects Category/Subcategory to whichever one actually matches
   *  (same "confirmed match overrides a blank/wrong pick" rule comics use). */
  async function runTcgCardLookupForFile(file: File) {
    setIsCardLookupRunning(true);
    setScanSession((prev) => markScanSessionScanning(prev));

    try {
      const [regionScan, fallbackOcr] = await Promise.all([
        scanTcgCardRegionsFromFile(file),
        runImageScanAutofill(file, "card"),
      ]);

      const titleGuess = regionScan.titleText || fallbackOcr.fields.title || "";
      const numberGuess = regionScan.collectorNumber || fallbackOcr.fields.number || "";

      let dbResult: CardLookupResult | null = null;

      if (regionScan.setCodeGuess && numberGuess) {
        dbResult = await lookupMtgCard({ set: regionScan.setCodeGuess, number: numberGuess }).catch(() => null);
      }

      if (!dbResult && titleGuess) {
        // Try both games off the same title guess — cheap (both APIs are
        // free/keyless) and lets Identify actually figure out which TCG this
        // is instead of requiring it to already be selected.
        const [mtgResult, pokemonResult] = await Promise.all([
          lookupMtgCard({ name: titleGuess }).catch(() => null),
          lookupPokemonCard({ name: titleGuess, number: numberGuess || undefined }).catch(() => null),
        ]);
        dbResult = mtgResult || pokemonResult;
      }

      const game: "mtg" | "pokemon" | null = dbResult?.game ?? null;

      const fields = {
        title: dbResult?.name || titleGuess || undefined,
        subtitle: dbResult?.setName || undefined,
        number: dbResult?.number || numberGuess || undefined,
        universe: game ? "TCG" : undefined,
        category: game ? categoryCode("TCG / CCG") : undefined,
        categoryLabel: game ? "TCG / CCG" : undefined,
        subcategoryLabel: game === "mtg" ? "Magic: The Gathering" : game === "pokemon" ? "Pokemon" : undefined,
        notes: dbResult
          ? `Matched via ${game === "mtg" ? "Scryfall" : "Pokemon TCG API"}: ${dbResult.sourceUrl}${
              dbResult.priceUsd ? ` (market $${dbResult.priceUsd})` : ""
            }`
          : undefined,
      };

      const confidence: "low" | "medium" | "high" = dbResult ? "high" : titleGuess ? "medium" : "low";
      const warnings = dbResult
        ? []
        : titleGuess
          ? ["Couldn't confirm this card against the Magic/Pokemon databases — check the title/number, or it may be a different TCG that isn't wired up yet."]
          : ["Couldn't read a title or collector number off this card."];

      setScanSession((prev) =>
        setScanSessionReview(prev, {
          source: "card_lookup",
          confidence,
          score: dbResult ? 92 : titleGuess ? 55 : 15,
          safeToAutofill: confidence !== "low",
          warnings,
          rawText: [
            dbResult ? `DB match: ${dbResult.name} — ${dbResult.setName} #${dbResult.number}` : "",
            regionScan.titleText,
            regionScan.numberRegionText,
          ]
            .filter(Boolean)
            .join("\n\n"),
          fields,
        })
      );

      if (confidence !== "low") {
        applyScanFieldsToEmpty(fields);
        if (dbResult?.rarity) {
          setValues((prev) => {
            if (prev.tcgRarity?.trim()) return prev;
            setHasDraftChanges(true);
            return { ...prev, tcgRarity: dbResult.rarity ?? "" };
          });
        }
        setScanSession((prev) => markScanSessionApplied(prev));
      }

      setStatus(
        dbResult
          ? `Matched in the ${game === "mtg" ? "Scryfall" : "Pokemon TCG"} database: ${dbResult.name}. Category/Subcategory set to TCG / ${
              game === "mtg" ? "Magic: The Gathering" : "Pokemon"
            }.`
          : titleGuess
            ? "Read a title off the card but couldn't confirm it in the Magic/Pokemon databases."
            : "Couldn't read this card clearly. Try a tighter, straighter photo."
      );

      return confidence !== "low";
    } catch (error) {
      const message = error instanceof Error ? error.message : "Card lookup failed.";
      setScanSession((prev) => markScanSessionFailed(prev, message));
      setStatus(message);
      return false;
    } finally {
      setIsCardLookupRunning(false);
    }
  }

  async function runPSALookupForCode(certRaw: string) {
    // Paused 2026-08-10 at EK's explicit request while barcode/QR decode
    // accuracy is being tested live -- every PSA lookup spends a real,
    // metered credit (100/day, shared across the whole app), and testing
    // scan reliability shouldn't risk burning through them. Covers all
    // three paths that can reach this function: the auto graded_card flow,
    // the generic auto-Identify fallback, and the manual "Look up" button.
    // Flip back to true once decode reliability is confirmed.
    const ENABLE_PSA_LOOKUP = false;
    if (!ENABLE_PSA_LOOKUP) {
      setStatus("PSA cert lookup is unavailable right now, so the cert number was not looked up. It is still saved with the item.");
      return false;
    }

    const certNumber = extractPSACertFromUrl(certRaw) ?? certRaw.replace(/\D/g, "").trim();
    if (!certNumber) return false;

    setIsComicLookupRunning(true);
    setScanSession((prev) => markScanSessionScanning(prev));

    try {
      const cert = await lookupPSACert(certNumber);

      if (!cert) {
        setScanSession((prev) => markScanSessionFailed(prev, "No PSA cert data found."));
        setStatus("PSA cert not found. Check the number and try again.");
        return false;
      }

      const grade = formatPSAGrade(cert);
      const setLabel = formatPSASet(cert);

      const fields: Partial<FormValues> = {
        title: setLabel ? `${setLabel} #${cert.cardNumber}`.trim() : cert.cardNumber,
        subject: cert.subject,
        subtitle: setLabel,
        grade,
        certNumber: cert.certNumber,
        universe: "SPORTS",
        category: "Sports Cards",
        categoryLabel: "Sports Cards",
        sportsGradingCompany: "PSA",
        sportsPop: cert.population && cert.totalPopulation
          ? `${cert.population} / ${cert.totalPopulation}`
          : cert.population || "",
      };

      setScanSession((prev) =>
        setScanSessionReview(prev, {
          source: "comic_lookup",
          confidence: "high",
          score: 97,
          safeToAutofill: true,
          warnings: [],
          rawText: `PSA ${cert.certNumber}: ${cert.subject} — ${setLabel} #${cert.cardNumber} | Grade: ${grade}`,
          fields,
        })
      );

      applyScanFieldsToEmpty(fields);

      setValues((prev) => {
        const next = { ...prev };
        let changed = false;
        const set = (k: keyof FormValues, v: string | undefined) => {
          if (v != null && v !== (prev[k] ?? "")) {
            (next as Record<string, string>)[k] = v;
            changed = true;
          }
        };
        set("grade", grade);
        set("certNumber", cert.certNumber);
        set("sportsGradingCompany", "PSA");
        if (cert.population && cert.totalPopulation) {
          set("sportsPop", `${cert.population} / ${cert.totalPopulation}`);
        }
        if (changed) setHasDraftChanges(true);
        return changed ? next : prev;
      });

      setScanSession((prev) => markScanSessionApplied(prev));
      setStatus(`PSA ${grade} — ${cert.subject} — details filled.`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "PSA lookup failed.";
      setScanSession((prev) => markScanSessionFailed(prev, message));
      setStatus(message);
      return false;
    } finally {
      setIsComicLookupRunning(false);
    }
  }

  async function runVinylLookupForFile(file: File, barcodeDigits?: string, barcodeRawValue?: string) {
    setIsComicLookupRunning(true); // reuse scanning state
    setScanSession((prev) => markScanSessionScanning(prev));

    try {
      const effectiveBarcode = barcodeDigits?.replace(/\D/g, "").trim() ?? "";
      // Discogs lookups now throw on a real failure (bad/missing token, rate
      // limit, outage) instead of silently returning null -- capture that so
      // "Discogs isn't working" and "this genuinely isn't in Discogs" don't
      // both show the same "No vinyl match found" message.
      let lookupError: string | null = null;
      const captureError = (err: unknown) => {
        lookupError = err instanceof Error ? err.message : "Discogs lookup failed.";
        return null;
      };

      // Run OCR and Discogs lookup in parallel
      const [fallbackOcr, discogsResult] = await Promise.all([
        runImageScanAutofill(file, "auto"),
        effectiveBarcode.length >= 12
          ? lookupVinylByBarcode(effectiveBarcode).catch(captureError)
          : Promise.resolve(null),
      ]);

      const matched = Boolean(discogsResult);

      // If no barcode hit, try text-based lookup from OCR title
      const textResult =
        !matched && fallbackOcr.fields?.title
          ? await lookupVinylByText(
              fallbackOcr.fields?.title ?? "",
              fallbackOcr.fields?.subtitle ?? ""
            ).catch(captureError)
          : null;

      const best = discogsResult ?? textResult;

      if (!best) {
        const message = lookupError
          ? `Discogs lookup failed: ${lookupError}`
          : "No vinyl match found — try image identify.";
        setScanSession((prev) => markScanSessionFailed(prev, message));
        setStatus(message);
        return false;
      }

      const fields: Partial<FormValues> = {
        title: best.albumTitle || fallbackOcr.fields?.title || "",
        subject: best.artist || "",
        subtitle: best.year ?? "",
        universe: "MUSIC",
        category: "Audio Formats",
        categoryLabel: "Audio Formats",
        subcategoryLabel: best.format ?? "Vinyl Records",
        vinylLabel: best.label ?? "",
        vinylCountry: best.country ?? "",
        vinylPressing: best.format ?? "",
      };

      if (barcodeRawValue || effectiveBarcode) {
        setScanSession((prev) =>
          setScanSessionBarcode(prev, barcodeRawValue || "", effectiveBarcode || "")
        );
      }

      setScanSession((prev) =>
        setScanSessionReview(prev, {
          source: "comic_lookup",
          confidence: "high",
          score: discogsResult ? 95 : 72,
          safeToAutofill: true,
          warnings: [],
          rawText: `Discogs: ${best.artist} — ${best.albumTitle}${best.year ? ` (${best.year})` : ""}${best.label ? ` · ${best.label}` : ""}`,
          fields,
        })
      );

      applyScanFieldsToEmpty(fields);

      setValues((prev) => {
        const next = { ...prev };
        let changed = false;
        const set = (k: keyof FormValues, v: string | undefined) => {
          if (v && v !== (prev[k] ?? "")) { (next as Record<string, string>)[k] = v; changed = true; }
        };
        set("vinylLabel", best.label ?? undefined);
        set("vinylCountry", best.country ?? undefined);
        set("vinylPressing", best.format ?? undefined);
        if (best.year && !prev.subtitle?.trim()) {
          set("subtitle", best.year);
        }
        if (changed) setHasDraftChanges(true);
        return changed ? next : prev;
      });

      setScanSession((prev) => markScanSessionApplied(prev));
      setStatus(
        discogsResult
          ? "Vinyl found in Discogs database — details filled."
          : "Vinyl matched by title — details filled."
      );
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Vinyl scan failed.";
      setScanSession((prev) => markScanSessionFailed(prev, message));
      setStatus(message);
      return false;
    } finally {
      setIsComicLookupRunning(false);
    }
  }

  async function runUpcLookupForCode(barcodeDigits?: string, barcodeRawValue?: string) {
    const digits = String(barcodeDigits ?? "").replace(/\D/g, "").trim();
    if (!digits) return false;

    setIsUpcLookupRunning(true);
    setScanSession((prev) => markScanSessionScanning(prev));

    try {
      const result = await lookupUpcItem(digits);

      if (!result) {
        setStatus("Barcode found, but no product details were returned.");
        return false;
      }

      const fields = {
        title: result.title,
        subtitle: result.subtitle || "",
        serialNumber: result.code,
        universe: result.universe || "",
        category: result.source === "openlibrary" ? "BOOKS" : "PRODUCTS",
        categoryLabel: result.categoryLabel || "",
        subcategoryLabel: result.subcategoryLabel || "",
        notes: result.notes || "",
      };

      setScanSession((prev) => {
        let next = prev;

        if (barcodeRawValue || digits) {
          next = setScanSessionBarcode(next, barcodeRawValue || digits, digits);
        }

        return setScanSessionReview(next, {
          source: "barcode_lookup",
          confidence: result.source === "openlibrary" ? "high" : "medium",
          score: result.source === "openlibrary" ? 92 : 74,
          safeToAutofill: true,
          warnings:
            result.source === "upcitemdb"
              ? ["Catalog product lookup matched. Check the title and category before saving."]
              : [],
          rawText: [
            `Barcode detected: ${digits}`,
            `Lookup source: ${result.source}`,
            result.notes || "",
          ]
            .filter(Boolean)
            .join("\n"),
          fields,
        });
      });

      applyScanFieldsToEmpty(fields);
      setScanSession((prev) => markScanSessionApplied(prev));
      setStatus(
        result.source === "openlibrary"
          ? "Book lookup filled what it could."
          : "Product lookup filled what it could."
      );
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "UPC lookup failed.";
      setScanSession((prev) => markScanSessionFailed(prev, message));
      setStatus(message);
      return false;
    } finally {
      setIsUpcLookupRunning(false);
    }
  }

  /** Fires once CameraCapturePanel's own free barcode-only lookup settles --
   *  it runs the lookup itself now (and shows the result right there in the
   *  camera view, since a status line on this page isn't visible while the
   *  camera's full-screen modal covers it). This just applies the already-
   *  resolved match to the form via the same scanSession machinery the
   *  after-a-photo lookups use -- no second network call. Deliberately
   *  skips PSA (metered/paused) and AI vision (metered, needs a real
   *  photo) -- those aren't part of this free-lookup layer. */
  function runLiveBarcodeLookup(barcode: { digits?: string; rawValue?: string }, match: BarcodeLookupResult | null) {
    const digits = String(barcode.digits ?? "").replace(/\D/g, "").trim();
    if (!digits) return;

    try {
      if (!match) {
        setScanSession((prev) => markScanSessionFailed(prev, "No match found for that barcode."));
        setStatus("Scanned — no match found for that code yet. Take a photo to try full Identify.");
        return;
      }

      const coreFields: ScanSessionReview["fields"] = {
        title: match.fields.title,
        subtitle: match.fields.subtitle,
        number: match.fields.number,
        universe: match.fields.universe,
        category: match.fields.category,
        categoryLabel: match.fields.categoryLabel,
        subcategoryLabel: match.fields.subcategoryLabel,
        notes: match.fields.notes,
      };

      setScanSession((prev) => {
        const withBarcode = setScanSessionBarcode(prev, barcode.rawValue || digits, digits);
        return setScanSessionReview(withBarcode, {
          source: "barcode_lookup",
          confidence: "high",
          score: 90,
          safeToAutofill: true,
          warnings: [],
          rawText: `Barcode scan: ${match.summary}`,
          fields: coreFields,
        });
      });

      applyScanFieldsToEmpty(coreFields);

      // Specialty fields with no generic ScanSessionFields slot -- same
      // direct-setValues pattern runVinylLookupForFile/runComicLookupForFile
      // already use for these (comicPublisher/vinylLabel etc. aren't part
      // of the shared ScanSessionFields shape applyScanFieldsToEmpty reads).
      setValues((prev) => {
        const next = { ...prev };
        let changed = false;
        const set = (k: keyof FormValues, v: string | undefined) => {
          if (v && !String(prev[k] ?? "").trim()) {
            (next as Record<string, string>)[k] = v;
            changed = true;
          }
        };
        if (match.source === "comic") {
          set("comicPublisher", match.fields.comicPublisher);
          set("comicCoverDate", match.fields.comicCoverDate);
        }
        if (match.source === "vinyl") {
          set("vinylLabel", match.fields.vinylLabel);
          set("vinylCountry", match.fields.vinylCountry);
          set("vinylPressing", match.fields.vinylPressing);
        }
        if (changed) setHasDraftChanges(true);
        return changed ? next : prev;
      });

      setScanSession((prev) => markScanSessionApplied(prev));
      setStatus(`Found via barcode: ${match.summary} — filled in what it could.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Barcode lookup failed.";
      setScanSession((prev) => markScanSessionFailed(prev, message));
      setStatus(message);
    }
  }

  /** Called when BarcodeScanCamera detects a barcode live from the camera. */
  async function handleLiveBarcodeScanned(result: { digits: string; rawValue: string }) {
    setIsBarcodeScanOpen(false);
    await runUpcLookupForCode(result.digits, result.rawValue);
  }

  async function runOcrAutofillForFile(file: File, forcedType: ScanItemType = scanType) {
    setIsScanning(true);
    setScanSession((prev) => markScanSessionScanning(prev));
    setStatus(
      forcedType === "auto"
        ? "Reading text from the image..."
        : `Reading text as ${forcedType.replaceAll("_", " ")}...`
    );

    try {
      const result = await runImageScanAutofill(file, forcedType);
      setScanSession((prev) =>
        setScanSessionReview(prev, {
          source: "ocr",
          confidence: result.quality.confidence,
          score: result.quality.score,
          safeToAutofill: result.quality.safeToAutofill,
          warnings: result.quality.warnings,
          rawText: result.rawText,
          fields: result.fields,
        })
      );

      if (result.quality.safeToAutofill) {
        applyScanFieldsToEmpty(result.fields);
        setScanSession((prev) => markScanSessionApplied(prev));
      }

      setStatus(
        result.quality.safeToAutofill
          ? "Text scan filled what it could."
          : "Text scan was weak. Trying image identify may work better."
      );

      return result.quality.safeToAutofill;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Text scan failed.";
      setScanSession((prev) => markScanSessionFailed(prev, message));
      setStatus(message);
      return false;
    } finally {
      setIsScanning(false);
    }
  }

  async function runVisionLookupForFile(file: File, forcedType: ScanItemType = scanType) {
    setIsVisionLookupRunning(true);
    setScanSession((prev) => markScanSessionScanning(prev));
    setStatus("Trying image identify...");

    try {
      const hintsByType: Record<ScanItemType, string> = {
        auto:
          "Identify what kind of collectible or product this is. If it is a trading card, comic, book, or graded slab, extract the visible title, number, grade, cert, and category.",
        comic:
          "This is likely a comic book or comic cover. Focus on title, issue number, subtitle, and comic-related category info.",
        card:
          "This is likely a trading card. Focus on player/character title, set/subtitle, card number, and category info.",
        graded_card:
          "This is likely a graded trading card in a slab. Focus on title, card number, grade, cert number, and category info.",
        book:
          "This is likely a book, manga, or media cover. Focus on title, subtitle, ISBN/barcode text, and book category info.",
      };

      const vision = await analyzeImageWithVision(file, {
        hints: hintsByType[forcedType],
        universe: values.universe,
        category: values.categoryLabel || values.category,
        subcategory: values.subcategoryLabel,
      });

      const safeToAutofill =
        vision.confidence >= 0.45 && Boolean(String(vision.title ?? "").trim());
      const visionCategoryLabel = vision.categoryLabel || vision.category || "";
      const fields = {
        title: vision.title,
        subtitle: vision.subtitle,
        number: vision.number,
        grade: vision.grade,
        conditionReason: vision.conditionReason || vision.condition,
        conditionSource: vision.grade || vision.conditionReason || vision.condition ? "ai" : "",
        certNumber: vision.certNumber,
        universe: vision.universe,
        category: visionCategoryLabel ? categoryCode(visionCategoryLabel) : undefined,
        categoryLabel: visionCategoryLabel,
        subcategoryLabel: vision.subcategoryLabel,
        notes: vision.description,
      };

      setScanSession((prev) =>
        setScanSessionReview(prev, {
          source: "vision",
          confidence:
            vision.confidence >= 0.72 ? "high" : vision.confidence >= 0.45 ? "medium" : "low",
          score: Math.max(0, Math.min(100, Math.round(vision.confidence * 100))),
          safeToAutofill,
          warnings: safeToAutofill
            ? []
            : ["Image identify was not confident enough to safely autofill everything."],
          rawText: vision.description || `AI detected: ${vision.title} (${vision.category})`,
          fields,
        })
      );

      if (safeToAutofill) {
        applyScanFieldsToEmpty(fields);
        // Always override taxonomy from AI — the vision result is more specific than any prior selection
        setValues((prev) => {
          const next = { ...prev };
          let changed = false;
          if (fields.universe?.trim()) { next.universe = fields.universe; changed = true; }
          if (fields.category?.trim()) { next.category = fields.category; changed = true; }
          if (fields.categoryLabel?.trim()) { next.categoryLabel = fields.categoryLabel; changed = true; }
          if (fields.subcategoryLabel?.trim()) { next.subcategoryLabel = fields.subcategoryLabel; changed = true; }
          if (changed) setHasDraftChanges(true);
          return changed ? next : prev;
        });
        setScanSession((prev) => markScanSessionApplied(prev));
      }

      setStatus(
        safeToAutofill
          ? "Image identify filled what it could."
          : "Image identify was not confident enough to fill fields."
      );

      return safeToAutofill;
    } catch (error) {
      const detail = error instanceof Error ? error.message.trim() : "";
      const message = error instanceof ScanRefusedError
        ? `${error.message.replace(/\.$/, "")}. You can fill in the details by hand.`
        : `Image identify failed${detail ? ` (${detail.replace(/\.$/, "")})` : ""}. Fill in the details by hand, or try again.`;
      setScanSession((prev) => markScanSessionFailed(prev, message));
      setStatus(message);
      return false;
    } finally {
      setIsVisionLookupRunning(false);
    }
  }

  async function handleIdentifyCurrentScan(file: File, barcode?: { digits?: string; rawValue?: string; format?: string }) {
    setUsedAutoIdentify(true);
    const currentBarcode =
      barcode ??
      (scanSession.barcodeDigits
        ? { digits: scanSession.barcodeDigits, rawValue: scanSession.barcodeRaw }
        : undefined);

    // MUSIC universe → Discogs vinyl lookup (barcode or OCR text fallback)
    if (values.universe === "MUSIC") {
      const vinylMatched = await runVinylLookupForFile(
        file,
        currentBarcode?.digits,
        currentBarcode?.rawValue
      );
      if (vinylMatched) return;
      await runVisionLookupForFile(file, "auto");
      return;
    }

    if (scanType === "book") {
      const bookMatched = await runBookLookupForFile(file);
      if (bookMatched) return;
      const ocrMatched = await runOcrAutofillForFile(file, "book");
      if (ocrMatched) return;
      await runVisionLookupForFile(file, "book");
      return;
    }

    if (scanType === "comic") {
      const comicMatched = await runComicLookupForFile(
        file,
        currentBarcode?.digits,
        currentBarcode?.rawValue
      );
      if (comicMatched) return;
      const ocrMatched = await runOcrAutofillForFile(file, "comic");
      if (ocrMatched) return;
      await runVisionLookupForFile(file, "comic");
      return;
    }

    if (scanType === "graded_card") {
      // graded_card: barcode IS the cert number — try PSA first
      if (currentBarcode?.rawValue || currentBarcode?.digits) {
        const psaMatched = await runPSALookupForCode(
          currentBarcode.rawValue || currentBarcode.digits || ""
        );
        if (psaMatched) return;
      }
      const ocrMatched = await runOcrAutofillForFile(file, scanType);
      if (ocrMatched) return;
      await runVisionLookupForFile(file, scanType);
      return;
    }

    if (scanType === "card") {
      // Real-database match for the TCGs we have a free public card DB for
      // (Magic/Pokemon) — tried first since it's an actual confirmed card,
      // not an OCR guess. Falls through untouched for Sports/other TCGs.
      if (values.universe === "TCG") {
        const cardMatched = await runTcgCardLookupForFile(file);
        if (cardMatched) return;
      }
      const ocrMatched = await runOcrAutofillForFile(file, scanType);
      if (ocrMatched) return;
      await runVisionLookupForFile(file, scanType);
      return;
    }

    if (currentBarcode?.digits) {
      const bookLike = looksLikeBookBarcode(currentBarcode.digits);

      if (bookLike) {
        const bookMatched = await runBookLookupForFile(file);
        if (bookMatched) return;
      }

      const productMatched = await runUpcLookupForCode(
        currentBarcode.digits,
        currentBarcode.rawValue
      );
      if (productMatched) return;

      const comicMatched = await runComicLookupForFile(
        file,
        currentBarcode.digits,
        currentBarcode.rawValue
      );
      if (comicMatched) return;

      // Also try Discogs — vinyl barcodes are standard UPCs too
      const vinylMatched = await runVinylLookupForFile(
        file,
        currentBarcode.digits,
        currentBarcode.rawValue
      );
      if (vinylMatched) return;

      // Last resort: PSA graded-slab cert lookup. Real bug fixed here — this
      // used to run FIRST on any bare 7-10 digit decode, before any of the
      // far more common UPC/book/comic/vinyl matches above ever got a
      // chance. EAN-8 (a completely ordinary retail barcode format) is
      // exactly 8 digits, so it collided head-on with the "looks like a PSA
      // cert" heuristic — scanning a normal product could silently burn a
      // real, metered PSA API call (and overwrite Universe/Category to
      // Sports Cards) before the correct UPC lookup ever ran. Now it's only
      // tried after every free/common lookup has already failed, and only
      // for barcode formats that are actually plausible for a slab's cert
      // code — a UPC/EAN-format code can never be a PSA cert, so those are
      // excluded outright rather than guessed at.
      const retailBarcodeFormats = new Set(["UPC_A", "UPC_E", "EAN_13", "EAN_8"]);
      const plausiblePSAFormat = !currentBarcode.format || !retailBarcodeFormats.has(currentBarcode.format);
      if (plausiblePSAFormat && looksLikePSACert(currentBarcode.digits)) {
        const psaMatched = await runPSALookupForCode(
          currentBarcode.rawValue || currentBarcode.digits
        );
        if (psaMatched) return;
      }
    }

    const ocrMatched = await runOcrAutofillForFile(file, "auto");
    if (ocrMatched) return;

    await runVisionLookupForFile(file, "auto");
  }

  async function handleScanImageSelection(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setStatus("That scan file is not an image.");
      return;
    }

    const added = addDraftMediaFiles([file]);
    replaceScanImage(file);
    setCropEditorTarget("scan");
    setCropMediaImageId("");
    setFreshCropMediaId(added[0]?.id ?? "");
    setIsCropEditorOpen(true);
    setStatus(aiAccess ? "Picture added. Crop if needed, then choose Identify with AI or save the item. Cancel in the crop step discards it." : "Picture added. Crop if needed, then fill in the details or save the item. Cancel in the crop step discards it.");
  }

  async function handleApplyScanCrop() {
    if (!scanFile) {
      setStatus("Take a photo first before cropping.");
      return;
    }

    setIsApplyingCrop(true);

    try {
      const fileToScan = isDefaultCrop(scanCrop)
        ? scanFile
        : await cropImageFile(scanFile, scanCrop);

      if (!isDefaultCrop(scanCrop)) {
        replaceScanImage(fileToScan);
      }

      setIsCropEditorOpen(false);
      // Choosing or cropping the picture only sets the picture. Nothing is looked up or sent to the AI until the person
      // chooses Auto Identify (handleScanAutofill); it used to start by itself here.
      setStatus(aiAccess ? "Picture ready. Choose Identify with AI to fill in the details, or fill them in yourself." : "Picture ready. Fill in the details yourself.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to crop scan image.");
    } finally {
      setIsApplyingCrop(false);
    }
  }

  async function handleApplyMediaCrop() {
    const image = draftMediaImages.find((entry) => entry.id === cropMediaImageId);
    if (!image) {
      setStatus("That photo is no longer available.");
      setIsCropEditorOpen(false);
      return;
    }

    setIsApplyingCrop(true);

    try {
      const croppedFile = isDefaultCrop(scanCrop) ? image.file : await cropImageFile(image.file, scanCrop);
      const nextPreviewUrl = URL.createObjectURL(croppedFile);

      if (image.previewUrl.startsWith("blob:")) {
        revokeImageObjectUrl(image.previewUrl);
      }

      setDraftMediaImages((prev) =>
        normalizeDraftMediaImages(
          prev.map((entry) =>
            entry.id === image.id
              ? {
                  ...entry,
                  file: croppedFile,
                  previewUrl: nextPreviewUrl,
                }
              : entry
          )
        )
      );
      markDraftChanged();

      if (activeMediaImageId === image.id) {
        replaceScanImage(croppedFile);
      } else {
        setIsCropEditorOpen(false);
        setScanCrop(DEFAULT_SCAN_CROP);
      }

      setStatus("Photo updated.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to edit photo.");
    } finally {
      setIsApplyingCrop(false);
    }
  }

  async function handleApplyCropEditor() {
    if (cropEditorTarget === "media") {
      await handleApplyMediaCrop();
      return;
    }

    await handleApplyScanCrop();
  }

  async function handleMediaImageSelection(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    addDraftMediaFiles(files);
  }

  async function handleScanAutofill() {
    if (!scanFile) {
      setStatus("Take or choose an item picture first.");
      return;
    }

    setStatus("Trying full auto-identify again...");
    const barcode = await scanBarcodeFromFile(scanFile);
    await handleIdentifyCurrentScan(scanFile, barcode ?? undefined);
  }

  function resetUnlockedFields() {
    const nextValues = resetUnlockedBulkValues(normalizeHierarchy(values), locks);
    setValues(nextValues);
    clearAllImages();
    clearPricing();
    setAiFilledFields(new Set());
    setHasDraftChanges(false);
    setStatus("Unlocked fields reset.");
    window.setTimeout(() => numberInputRef.current?.focus(), 0);
  }

  function resetAll() {
    setValues({ ...EMPTY_VALUES });
    setLocks({ ...DEFAULT_BULK_ADD_LOCKS });
    clearAllImages();
    clearPricing();
    setAiFilledFields(new Set());
    setHasDraftChanges(false);
    setStatus("Form reset.");
  }

  async function saveForm(saveAndNext: boolean) {
    const normalizedValues = normalizeHierarchy(values);
    const trimmedTitle = normalizedValues.title.trim();
    if (!trimmedTitle) {
      setStatus("Title / Series is required.");
      return;
    }
    // Typed amounts are checked here, in the save itself, not only in the box: letters, malformed numbers ("1e3", "1,5", "5-3") and
    // negatives are refused with a message; blank stays unknown and an explicit 0 stays 0 (src/lib/moneyInput.ts).
    const purchaseParsed = parseMoneyInput(normalizedValues.purchasePrice, { label: "Purchase price" });
    if (!purchaseParsed.ok) {
      setStatus(purchaseParsed.message);
      return;
    }
    const valueParsed = parseMoneyInput(normalizedValues.currentValue, { label: "Current value" });
    if (!valueParsed.ok) {
      setStatus(valueParsed.message);
      return;
    }

    setIsSaving(true);

    try {
      const now = Date.now();
      const id = newId();
      const activeProfileId = getActiveProfileId();

      let primaryImageKey: string | undefined;
      let images: VaultImage[] | undefined;
      let imageFrontUrl: string | undefined;
      let imageFrontStoragePath: string | undefined;

      const mediaToPersist = [
        ...draftMediaImages.map((image) => ({
          file: image.file,
          previewUrl: image.previewUrl,
          role: image.role,
        })),
        ...(saveScanAsPhoto && scanFile
          ? [
              {
                file: scanFile,
                previewUrl: scanSession.image?.previewUrl ?? "",
                role: "proof" as ImageRole,
              },
            ]
          : []),
      ];

      if (mediaToPersist.length) {
        images = [];

        for (let index = 0; index < mediaToPersist.length; index += 1) {
          const entry = mediaToPersist[index];
          const durableBlob = await prepareImageBlob(entry.file);

          if (navigator.onLine && hasSupabaseEnv()) {
            const uploaded = await uploadVaultImageToSupabase({
              itemId: id,
              file: durableBlob,
              fileName: entry.file.name || `image-${index + 1}.jpg`,
            });

            images.push({
              id: `${id}_img_${index}`,
              storageKey: uploaded.path,
              url: uploaded.publicUrl,
              order: index,
              localOnly: false,
              role: entry.role,
            });
          } else {
            const storageKey = generateVaultImageKey(id, index);
            await saveImageBlobToIndexedDb(durableBlob, storageKey);

            images.push({
              id: `${id}_img_${index}`,
              storageKey,
              url: entry.previewUrl || undefined,
              order: index,
              localOnly: true,
              role: entry.role,
            });
          }
        }

        const primaryImage =
          images.find((image) => image.role === "primary") ??
          images.find((image) => image.role === "detail") ??
          images[0];

        primaryImageKey = primaryImage?.storageKey;
        imageFrontUrl = primaryImage?.url;
        imageFrontStoragePath = primaryImage?.storageKey;
      }

      const purchasePrice = purchaseParsed.value;
      const pricingPatch = buildPricingPatch({
        estimatedValue: pricingValues.estimatedValue,
        lastCompValue: pricingValues.lastCompValue,
        priceSource: pricingValues.priceSource,
        priceConfidence: pricingValues.priceConfidence,
        priceNotes: pricingValues.priceNotes,
      });
      // Only a valuation the person typed (or a price source they chose) becomes the item's value. What was paid is NOT a valuation:
      // an item with no value stays unvalued and is shown "at cost" by the shared ghost-value rule (never saved), like Quick Add does.
      const currentValue =
        valueParsed.value ??
        pricingPatch.estimatedValue ??
        pricingPatch.lastCompValue;

      const item: VaultItem = {
        id,
        profile_id: activeProfileId || undefined,
        title: trimmedTitle,
        subtitle: normalizedValues.subtitle.trim() || undefined,
        number: normalizedValues.number.trim() || undefined,
        grade: normalizedValues.grade.trim() || undefined,
        conditionReason: normalizedValues.conditionReason.trim() || undefined,
        conditionSource:
          normalizedValues.conditionSource === "ai" || normalizedValues.conditionSource === "manual"
            ? normalizedValues.conditionSource
            : undefined,
        addedVia: usedAutoIdentify ? "scan" : "manual",
        purchasePrice,
        currentValue,
        universe: normalizedValues.universe.trim() || "MISC",
        category: normalizedValues.category.trim() || undefined,
        categoryLabel: normalizedValues.categoryLabel.trim() || undefined,
        subcategoryLabel: normalizedValues.subcategoryLabel.trim() || undefined,
        storageLocation: normalizedValues.storageLocation.trim() || undefined,
        purchaseSource: normalizedValues.purchaseSource.trim() || undefined,
        purchaseLocation: normalizedValues.purchaseLocation.trim() || undefined,
        subject: normalizedValues.subject.trim() || undefined,
        certNumber: normalizedValues.certNumber.trim() || undefined,
        serialNumber: normalizedValues.serialNumber.trim() || undefined,
        edition: normalizedValues.edition.trim() || undefined,
        variant: normalizedValues.variant.trim() || undefined,
        printRun: normalizedValues.printRun.trim() || undefined,
        isFirstEdition: normalizedValues.isFirstEdition === "true" || undefined,
        // TCG
        tcgParallelType: (normalizedValues.tcgParallelType ?? "").trim() || undefined,
        tcgSetCode: (normalizedValues.tcgSetCode ?? "").trim() || undefined,
        tcgHoloType: (normalizedValues.tcgHoloType ?? "").trim() || undefined,
        // Sports
        sportsParallelType: (normalizedValues.sportsParallelType ?? "").trim() || undefined,
        sportsIsRelic: boolFromForm(normalizedValues.sportsIsRelic),
        sportsRelicDescription: (normalizedValues.sportsRelicDescription ?? "").trim() || undefined,
        sportsIsAuto: boolFromForm(normalizedValues.sportsIsAuto),
        sportsSerialNumber: (normalizedValues.sportsSerialNumber ?? "").trim() || undefined,
        // Vinyl
        vinylPressing: (normalizedValues.vinylPressing ?? "").trim() || undefined,
        vinylLabel: (normalizedValues.vinylLabel ?? "").trim() || undefined,
        vinylMatrix: (normalizedValues.vinylMatrix ?? "").trim() || undefined,
        vinylSpeedRpm: (normalizedValues.vinylSpeedRpm ?? "") || undefined,
        vinylColor: (normalizedValues.vinylColor ?? "").trim() || undefined,
        // TCG additions
        tcgRarity: (normalizedValues.tcgRarity ?? "").trim() || undefined,
        tcgLanguage: (normalizedValues.tcgLanguage ?? "").trim() || undefined,
        tcgGradingCompany: (normalizedValues.tcgGradingCompany ?? "").trim() || undefined,
        // Sports additions
        sportsSport: (normalizedValues.sportsSport ?? "").trim() || undefined,
        sportsTeam: (normalizedValues.sportsTeam ?? "").trim() || undefined,
        sportsGradingCompany: (normalizedValues.sportsGradingCompany ?? "").trim() || undefined,
        sportsPop: (normalizedValues.sportsPop ?? "").trim() || undefined,
        sportsAutoAuth: (normalizedValues.sportsAutoAuth ?? "").trim() || undefined,
        // Memorabilia
        memorabiliaTeam: (normalizedValues.memorabiliaTeam ?? "").trim() || undefined,
        memorabiliaEvent: (normalizedValues.memorabiliaEvent ?? "").trim() || undefined,
        memorabiliaSigningDate: (normalizedValues.memorabiliaSigningDate ?? "").trim() || undefined,
        memorabiliaWitnessed: boolFromForm(normalizedValues.memorabiliaWitnessed),
        memorabiliaAuthCompany: (normalizedValues.memorabiliaAuthCompany ?? "").trim() || undefined,
        memorabiliaGameUsed: boolFromForm(normalizedValues.memorabiliaGameUsed),
        memorabiliaGameUsedDesc: (normalizedValues.memorabiliaGameUsedDesc ?? "").trim() || undefined,
        // Vinyl additions
        vinylCountry: (normalizedValues.vinylCountry ?? "").trim() || undefined,
        vinylSleeveCondition: (normalizedValues.vinylSleeveCondition ?? "").trim() || undefined,
        vinylInserts: boolFromForm(normalizedValues.vinylInserts),
        vinylGatefold: boolFromForm(normalizedValues.vinylGatefold),
        // Comics
        comicIssueNumber: (normalizedValues.comicIssueNumber ?? "").trim() || undefined,
        comicCoverVariant: (normalizedValues.comicCoverVariant ?? "").trim() || undefined,
        comicArcTitle: (normalizedValues.comicArcTitle ?? "").trim() || undefined,
        comicPublisher: (normalizedValues.comicPublisher ?? "").trim() || undefined,
        comicCoverDate: (normalizedValues.comicCoverDate ?? "").trim() || undefined,
        comicGradingCompany: (normalizedValues.comicGradingCompany ?? "").trim() || undefined,
        comicPageQuality: (normalizedValues.comicPageQuality ?? "").trim() || undefined,
        comicRestorationStatus: (normalizedValues.comicRestorationStatus ?? "").trim() || undefined,
        comicHolderType: (normalizedValues.comicHolderType ?? "").trim() || undefined,
        comicCensusRank: (normalizedValues.comicCensusRank ?? "").trim() || undefined,
        // Original Comic Art
        artPenciller: (normalizedValues.artPenciller ?? "").trim() || undefined,
        artInker: (normalizedValues.artInker ?? "").trim() || undefined,
        artColorist: (normalizedValues.artColorist ?? "").trim() || undefined,
        artType: (normalizedValues.artType ?? "").trim() || undefined,
        artFirstAppearance: (normalizedValues.artFirstAppearance ?? "").trim() || undefined,
        // Toys
        toyBrand: (normalizedValues.toyBrand ?? "").trim() || undefined,
        toyLine: (normalizedValues.toyLine ?? "").trim() || undefined,
        toyScale: (normalizedValues.toyScale ?? "").trim() || undefined,
        toyPackageCondition: (normalizedValues.toyPackageCondition ?? "").trim() || undefined,
        toyBoxIncluded: boolFromForm(normalizedValues.toyBoxIncluded),
        toyAccessoriesIncluded: boolFromForm(normalizedValues.toyAccessoriesIncluded),
        toyIsComplete: boolFromForm(normalizedValues.toyIsComplete),
        // Art Cards
        artCardArtist: (normalizedValues.artCardArtist ?? "").trim() || undefined,
        artCardSet: (normalizedValues.artCardSet ?? "").trim() || undefined,
        artCardType: (normalizedValues.artCardType ?? "").trim() || undefined,
        // Art & Prints
        artMedium: (normalizedValues.artMedium ?? "").trim() || undefined,
        artSurface: (normalizedValues.artSurface ?? "").trim() || undefined,
        artHeight: (normalizedValues.artHeight ?? "").trim() || undefined,
        artWidth: (normalizedValues.artWidth ?? "").trim() || undefined,
        artDepth: (normalizedValues.artDepth ?? "").trim() || undefined,
        artIsFramed: boolFromForm(normalizedValues.artIsFramed),
        artIsSigned: boolFromForm(normalizedValues.artIsSigned),
        artSignatureLocation: (normalizedValues.artSignatureLocation ?? "").trim() || undefined,
        artProvenance: (normalizedValues.artProvenance ?? "").trim() || undefined,
        artExhibitions: (normalizedValues.artExhibitions ?? "").trim() || undefined,
        // Watches
        watchBrand: (normalizedValues.watchBrand ?? "").trim() || undefined,
        watchReference: (normalizedValues.watchReference ?? "").trim() || undefined,
        watchMovement: (normalizedValues.watchMovement ?? "").trim() || undefined,
        watchCaseMaterial: (normalizedValues.watchCaseMaterial ?? "").trim() || undefined,
        watchCaseSize: (normalizedValues.watchCaseSize ?? "").trim() || undefined,
        watchDialColor: (normalizedValues.watchDialColor ?? "").trim() || undefined,
        watchBox: boolFromForm(normalizedValues.watchBox),
        watchPapers: boolFromForm(normalizedValues.watchPapers),
        watchFullSet: boolFromForm(normalizedValues.watchFullSet),
        // Bags
        bagBrand: (normalizedValues.bagBrand ?? "").trim() || undefined,
        bagColor: (normalizedValues.bagColor ?? "").trim() || undefined,
        bagMaterial: (normalizedValues.bagMaterial ?? "").trim() || undefined,
        bagHardware: (normalizedValues.bagHardware ?? "").trim() || undefined,
        bagAuthCard: boolFromForm(normalizedValues.bagAuthCard),
        bagDustbag: boolFromForm(normalizedValues.bagDustbag),
        bagBox: boolFromForm(normalizedValues.bagBox),
        // Apparel
        apparelSize: (normalizedValues.apparelSize ?? "").trim() || undefined,
        apparelColorway: (normalizedValues.apparelColorway ?? "").trim() || undefined,
        apparelWorn: boolFromForm(normalizedValues.apparelWorn),
        // Games
        gamePlatform: (normalizedValues.gamePlatform ?? "").trim() || undefined,
        gameRegion: (normalizedValues.gameRegion ?? "").trim() || undefined,
        gameGradingCompany: (normalizedValues.gameGradingCompany ?? "").trim() || undefined,
        gameIsSealed: boolFromForm(normalizedValues.gameIsSealed),
        gameIsCIB: boolFromForm(normalizedValues.gameIsCIB),
        gameHasManual: boolFromForm(normalizedValues.gameHasManual),
        gamePublisher: (normalizedValues.gamePublisher ?? "").trim() || undefined,
        // Coins
        coinDenomination: (normalizedValues.coinDenomination ?? "").trim() || undefined,
        coinCountry: (normalizedValues.coinCountry ?? "").trim() || undefined,
        coinMint: (normalizedValues.coinMint ?? "").trim() || undefined,
        coinMintMark: (normalizedValues.coinMintMark ?? "").trim() || undefined,
        coinGradingCompany: (normalizedValues.coinGradingCompany ?? "").trim() || undefined,
        coinPopulation: (normalizedValues.coinPopulation ?? "").trim() || undefined,
        coinError: (normalizedValues.coinError ?? "").trim() || undefined,
        coinKeyDate: boolFromForm(normalizedValues.coinKeyDate),
        // Universal type + attributes
        year: (normalizedValues.year ?? "").trim() || undefined,
        brand: (normalizedValues.brand ?? "").trim() || undefined,
        condition: (normalizedValues.condition ?? "").trim() || undefined,
        consoleControllerCount: (normalizedValues.consoleControllerCount ?? "").trim() || undefined,
        consoleCables: boolFromForm(normalizedValues.consoleCables),
        consoleBox: boolFromForm(normalizedValues.consoleBox),
        consoleTested: boolFromForm(normalizedValues.consoleTested),
        specs: parseFormSpecs(normalizedValues.specs),
        itemType: (normalizedValues.itemType ?? "").trim() || undefined,
        itemAttributes: (() => {
          const raw = (normalizedValues.itemAttributes ?? "").trim();
          if (!raw) return undefined;
          try { const parsed = JSON.parse(raw); if (Array.isArray(parsed)) return parsed.length ? parsed : undefined; } catch {}
          return raw.split(",").map(s => s.trim()).filter(Boolean);
        })(),
        notes: normalizedValues.notes.trim() || undefined,
        primaryImageKey,
        images,
        imageFrontUrl,
        imageFrontStoragePath,
        estimatedValue: pricingPatch.estimatedValue,
        lastCompValue: pricingPatch.lastCompValue,
        priceSource: pricingPatch.priceSource,
        priceConfidence: pricingPatch.priceConfidence,
        priceUpdatedAt: pricingPatch.priceUpdatedAt,
        priceNotes: pricingPatch.priceNotes,
        createdAt: now,
        isNew: true,
      };
      // Auto-tag with a few real, searchable tags (same suggestion engine
      // SocialExportSheet already used for caption hashtags) so this item
      // shows up in Halls search from the start, not just after a manual edit.
      item.tags = suggestAutoTags(item);

      appendItems([item]);
      enqueueVaultItemSync(item.id);
      emitVaultUpdate();
      await processVaultSyncQueue();
      setExistingItems((prev) => [item, ...prev]);

      if (dropMode && dropSession) {
        const nextDrop = addDropItem(
          dropSession,
          dropItemFromVaultItem(item, scanSession.review?.confidence)
        );
        saveDropSession(nextDrop);
        setDropSession(nextDrop);
      }

      setStatus(
        dropMode
          ? "✓ Saved to batch. Ready for the next item."
          : isSpecsDeviceOnly(item.id)
            ? `✓ Saved. ${SPECS_DEVICE_ONLY_NOTE}`
            : saveAndNext
              ? "✓ Saved. Ready for next item."
              : "✓ Saved!"
      );
      clearAllImages();
      clearPricing();

      const nextValues = resetUnlockedBulkValues(normalizedValues, locks);
      setValues(nextValues);
      setScanSession((prev) => clearScanSessionReview(prev));
      setAiFilledFields(new Set());
      setHasDraftChanges(false);

      // Scroll back to top so the user is ready to start the next item
      const scroller = document.querySelector<HTMLElement>(".vltd-content-wrap");
      if (scroller) scroller.scrollTop = 0;

      if (saveAndNext) {
        window.setTimeout(() => numberInputRef.current?.focus(), 0);
      }

      if (dropMode) {
        window.setTimeout(() => {
          openCameraFor("scan");
        }, 350);
      }
    } catch (error) {
      if (isFreeTierLimitError(error)) { setLimitHit(true); }
      else setStatus(error instanceof Error ? error.message : "Failed to save item.");
    } finally {
      setIsSaving(false);
    }
  }

  const cropMediaImage = draftMediaImages.find((image) => image.id === cropMediaImageId);
  const selectedMediaImage = draftMediaImages.find((image) => image.id === selectedMediaImageId);
  const cropEditorImageUrl =
    cropEditorTarget === "media" ? cropMediaImage?.previewUrl : scanSession.image?.previewUrl;

  return (
    <main className="bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className={`w-full px-4 py-3 sm:px-6 sm:py-4 ${dropMode ? "pb-24" : "pb-20 sm:pb-4"}`}>
        <div className="sticky top-0 z-20 mx-auto mb-3 w-full max-w-5xl rounded-[16px] border border-[color:var(--theme-border)] bg-[color:var(--surface)]/92 px-3 py-2 backdrop-blur">
          <div className="flex items-center justify-between gap-3 pr-24">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">Add</h1>
              {/* Required-to-save chips — only what actually blocks saving */}
              {!values.title.trim() ? (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(248,113,113,0.12)", color: "#f87171" }}>
                  Title required
                </span>
              ) : (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80" }}>
                  Ready to save
                </span>
              )}
            </div>
          </div>

          {limitHit ? (
            <div className="mt-2">
              <UpgradeNudge onDismiss={() => setLimitHit(false)} />
            </div>
          ) : null}

          {/* Only surface important alerts (saved / errors / limits) — not routine nudges */}
          {status && (status.startsWith("✓") || /limit|failed|error|required|unavailable|deleted|removed|negative|numbers only|not a number|enter an amount|enter one amount|decimal|not supported|too large|spaces inside|period for cents|not an image|not confident|paused|not found|no match|no isbn|couldn.?t|could not|unable|try again|no longer available|take a photo first|take or choose/i.test(status)) ? (
            <div
              role={status.startsWith("✓") ? "status" : "alert"}
              className="mt-2 rounded-xl px-3 py-2 text-sm ring-1"
              style={
                status.startsWith("✓")
                  ? { background: "rgba(74,222,128,0.10)", color: "#4ade80", borderColor: "rgba(74,222,128,0.30)" }
                  : { background: "rgba(248,113,113,0.10)", color: "#f87171", borderColor: "rgba(248,113,113,0.30)" }
              }
            >
              {status}
            </div>
          ) : null}
        </div>

        {/* Floating Save — always visible while scrolling */}
        {!dropMode && (
          <PillButton
            onClick={() => void saveForm(false)}
            disabled={!canSave}
            className="fixed right-4 z-[60] px-6 font-bold"
            style={{
              top: "calc(var(--topnav-h, 64px) + 12px)",
              background: "linear-gradient(135deg, #8C9298, #C8CDD2)",
              color: "#0B0B0B",
              boxShadow: "0 6px 22px rgba(203,208,213,0.45)",
            }}
          >
            {isSaving ? "Saving..." : "Save"}
          </PillButton>
        )}

        <div className="mb-3 w-full max-w-5xl mx-auto grid gap-3">
          <div className="grid gap-3">
            <div ref={scanStageRef}>
              <ScanPanel
                session={scanSession}
                isScanning={isScanning}
                isBookLookupRunning={isBookLookupRunning}
                isComicLookupRunning={isComicLookupRunning}
                isCardLookupRunning={isCardLookupRunning}
                isUpcLookupRunning={isUpcLookupRunning}
                isVisionLookupRunning={isVisionLookupRunning}
                saveScanAsPhoto={saveScanAsPhoto}
                onUseCamera={openScanCamera}
                onUploadImage={() => uploadInputRef.current?.click()}
                onScanAutofill={() => void handleScanAutofill()}
                onOpenImage={openActivePhotoOptions}
                onCropImage={openScanCropEditor}
                onClearImage={clearScanImage}
                onToggleSaveScanAsPhoto={handleToggleSaveScanAsPhoto}
                capturedPhotos={draftMediaImages.map((image) => ({
                  id: image.id,
                  previewUrl: image.previewUrl,
                  role: image.role,
                }))}
                activeCapturedPhotoId={activeMediaImageId}
                onSelectCapturedPhoto={setSelectedMediaImageId}
                titleValue={values.title}
                onTitleChange={(v) => setField("title", v)}
              />
            </div>

              <div className="rounded-[16px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-semibold tracking-[0.18em] text-[color:var(--muted2)]">
                    BASIC ITEM RECORD
                  </div>
                  <PillButton size="compact" onClick={resetUnlockedFields} disabled={isSaving} title="Clears every field that is not locked. Locked fields keep their values for the next item.">Clear Unlocked Fields</PillButton>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                  <Field label="Universe" locked={locks.universe} onToggleLock={() => handleToggleLock("universe")}>
                    <select
                      className={selectClass(aiFilledFields.has("universe"))}
                      value={selectedUniverse}
                      onChange={(e) => { setAiFilledFields(prev => { const n = new Set(prev); n.delete("universe"); return n; }); setUniverse(safeUniverse(e.target.value)); }}
                    >
                      {getUniverses().map((key) => (
                        <option key={key} value={key}>
                          {UNIVERSE_LABEL[key]}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Category" locked={locks.categoryLabel} onToggleLock={() => handleToggleLock("categoryLabel")}>
                    <select
                      className={selectClass(aiFilledFields.has("categoryLabel"))}
                      value={selectedCategory}
                      onChange={(e) => { setAiFilledFields(prev => { const n = new Set(prev); n.delete("categoryLabel"); return n; }); setCategoryLabel(e.target.value); }}
                    >
                      {categoryOptions.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Subcategory" locked={locks.subcategoryLabel} onToggleLock={() => handleToggleLock("subcategoryLabel")}>
                    {subcategoryOptions.length ? (
                      <select
                        className={selectClass(aiFilledFields.has("subcategoryLabel"))}
                        value={values.subcategoryLabel}
                        onChange={(e) => { setAiFilledFields(prev => { const n = new Set(prev); n.delete("subcategoryLabel"); return n; }); setField("subcategoryLabel", e.target.value); }}
                      >
                        <option value="">Optional</option>
                        {subcategoryOptions.map((subcategory) => (
                          <option key={subcategory} value={subcategory}>
                            {subcategory}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className={inputClass(aiFilledFields.has("subcategoryLabel"))}
                        value={values.subcategoryLabel}
                        onChange={(e) => { setAiFilledFields(prev => { const n = new Set(prev); n.delete("subcategoryLabel"); return n; }); setField("subcategoryLabel", e.target.value); }}
                        placeholder="Optional"
                      />
                    )}
                  </Field>

                  {typeOptions.length > 0 && (
                    <Field label="Type" locked={locks.itemType} onToggleLock={() => handleToggleLock("itemType")}>
                      <select
                        className={selectClass(false)}
                        value={values.itemType}
                        onChange={(e) => setField("itemType", e.target.value)}
                      >
                        <option value="">Select type...</option>
                        {typeOptions.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </Field>
                  )}

                  {checkboxOptions.length > 0 && (
                    <div className="sm:col-span-2 2xl:col-span-4">
                      <div className="mb-1.5 max-md:mb-3 flex items-center justify-between">
                        <span className="text-xs font-medium" style={{ color: "var(--fg-muted)" }}>Attributes</span>
                        {selectedAttributes.size > 0 && (
                          <PillButton size="compact" onClick={() => setField("itemAttributes", "")}>Clear</PillButton>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-md:gap-y-3">
                        {checkboxOptions.map((attr) => {
                          const active = selectedAttributes.has(attr);
                          return (
                            <PillButton key={attr} size="compact" variant={active ? "active" : "default"} pressed={active} onClick={() => toggleAttribute(attr)}>
                              {attr}
                            </PillButton>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
              </div>

          </div>

        </div>

        <section className="w-full max-w-5xl mx-auto rounded-[16px] bg-[color:var(--surface)] p-3 sm:p-4 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Field label={detailLabel("subtitle", "Subtitle / Set")} locked={locks.subtitle} onToggleLock={() => handleToggleLock("subtitle")}>
                <input
                  className={inputClass(aiFilledFields.has("subtitle"))}
                  value={values.subtitle}
                  onChange={(e) => { setAiFilledFields(prev => { const n = new Set(prev); n.delete("subtitle"); return n; }); setField("subtitle", e.target.value); }}
                  placeholder="Series / set / run"
                />
              </Field>

              <Field label={detailLabel("number", "Number / Issue")} locked={locks.number} onToggleLock={() => handleToggleLock("number")}>
                <input
                  ref={numberInputRef}
                  className={inputClass(aiFilledFields.has("number"))}
                  value={values.number}
                  onChange={(e) => { setAiFilledFields(prev => { const n = new Set(prev); n.delete("number"); return n; }); setField("number", e.target.value); }}
                  placeholder="#129"
                />
              </Field>

              <Field label={detailLabel("grade", "Grade")} locked={locks.grade} onToggleLock={() => handleToggleLock("grade")}>
                <input
                  className={inputClass(aiFilledFields.has("grade"))}
                  value={values.grade}
                  onChange={(e) => { setAiFilledFields(prev => { const n = new Set(prev); n.delete("grade"); return n; }); setField("grade", e.target.value); }}
                  placeholder="CGC 9.8"
                />
              </Field>

              <Field label="Purchase Price" locked={locks.purchasePrice} onToggleLock={() => handleToggleLock("purchasePrice")}>
                <input
                  className={inputClass()}
                  value={values.purchasePrice}
                  onChange={(e) => setField("purchasePrice", e.target.value)}
                  inputMode="decimal"
                  placeholder="25"
                />
              </Field>

              <Field label="Current Value" locked={locks.currentValue} onToggleLock={() => handleToggleLock("currentValue")}>
                <input
                  className={inputClass()}
                  value={values.currentValue}
                  onChange={(e) => setField("currentValue", e.target.value)}
                  inputMode="decimal"
                  placeholder="25"
                />
              </Field>

              <Field label="Storage Location" locked={locks.storageLocation} onToggleLock={() => handleToggleLock("storageLocation")}>
                <input
                  className={inputClass()}
                  value={values.storageLocation}
                  onChange={(e) => setField("storageLocation", e.target.value)}
                  placeholder="Long Box A"
                />
              </Field>

              <Field label="Purchase Source" locked={locks.purchaseSource} onToggleLock={() => handleToggleLock("purchaseSource")}>
                <input
                  className={inputClass()}
                  value={values.purchaseSource}
                  onChange={(e) => setField("purchaseSource", e.target.value)}
                  placeholder="Collection buy"
                />
              </Field>

              <Field label="Purchase Location" locked={locks.purchaseLocation} onToggleLock={() => handleToggleLock("purchaseLocation")}>
                <input
                  className={inputClass()}
                  value={values.purchaseLocation}
                  onChange={(e) => setField("purchaseLocation", e.target.value)}
                  placeholder="Dallas"
                />
              </Field>

              <Field label={detailLabel("subject", "Subject")} locked={locks.subject} onToggleLock={() => handleToggleLock("subject")}>
                <input
                  className={inputClass()}
                  value={values.subject}
                  onChange={(e) => setField("subject", e.target.value)}
                  placeholder={
                    values.universe === "SPORTS"
                      ? "Shohei Ohtani"
                      : values.universe === "TCG"
                        ? "Pikachu"
                        : values.universe === "MUSIC"
                          ? "David Bowie"
                          : values.universe === "GAMES"
                            ? "The Legend of Zelda"
                            : "Player, character, artist, franchise"
                  }
                />
                <p className="mt-1 text-[11px]" style={{ color: "var(--muted2)" }}>
                  Used for Vault Registry rankings.
                </p>
              </Field>

              <Field label={detailLabel("certNumber", "Cert #")} locked={locks.certNumber} onToggleLock={() => handleToggleLock("certNumber")}>
                <div className="flex items-center gap-2">
                  <input
                    className={`${inputClass(aiFilledFields.has("certNumber"))} min-w-0 flex-1`}
                    value={values.certNumber}
                    onChange={(e) => { setAiFilledFields(prev => { const n = new Set(prev); n.delete("certNumber"); return n; }); setField("certNumber", e.target.value); }}
                    placeholder="Certification number"
                  />
                  <PillButton onClick={() => void runPSALookupForCode(values.certNumber)} disabled={!values.certNumber.trim() || isComicLookupRunning} title="Look up this PSA cert number">
                    {isComicLookupRunning ? "Looking up…" : "Look up"}
                  </PillButton>
                </div>
                <p className="mt-1 text-[11px]" style={{ color: "var(--muted2)" }}>
                  PSA graded card? Type the cert number from the slab label and tap Look up.
                </p>
              </Field>

              <Field label={detailLabel("serialNumber", "Serial #")} locked={locks.serialNumber} onToggleLock={() => handleToggleLock("serialNumber")}>
                <input
                  className={inputClass()}
                  value={values.serialNumber}
                  onChange={(e) => setField("serialNumber", e.target.value)}
                  placeholder="Serial number / ISBN"
                />
              </Field>

              <Field label={detailLabel("edition", "Edition")} locked={locks.edition} onToggleLock={() => handleToggleLock("edition")}>
                <input
                  className={inputClass()}
                  value={values.edition}
                  onChange={(e) => setField("edition", e.target.value)}
                  placeholder="1st Edition, Unlimited, Shadowless"
                />
              </Field>

              <Field label={detailLabel("variant", "Variant / Finish")} locked={locks.variant} onToggleLock={() => handleToggleLock("variant")}>
                <input
                  className={inputClass()}
                  value={values.variant}
                  onChange={(e) => setField("variant", e.target.value)}
                  placeholder="Holo, Reverse Holo, Foil"
                />
              </Field>

              <Field label="Print Run" locked={locks.printRun} onToggleLock={() => handleToggleLock("printRun")}>
                <input
                  className={inputClass()}
                  value={values.printRun}
                  onChange={(e) => setField("printRun", e.target.value)}
                  placeholder="1/1, 47/250, Artist Proof"
                />
              </Field>

              <label className="flex min-h-11 md:min-h-9 items-center gap-3 rounded-xl bg-[color:var(--pill)] px-3 ring-1 ring-[color:var(--border)]">
                <input
                  type="checkbox"
                  checked={values.isFirstEdition === "true"}
                  onChange={(e) => setField("isFirstEdition", e.target.checked ? "true" : "")}
                  className="h-4 w-4 rounded accent-[color:var(--theme-gold)]"
                />
                <span className="text-sm" style={{ color: "var(--fg)" }}>
                  First Edition / First Print
                </span>
              </label>

              {/* Category-specific details: the fields that fit the chosen Universe / Category / Subcategory. */}
              <AddDetailFields
                values={values}
                setField={setField}
                universe={selectedUniverse}
                categoryLabel={selectedCategory}
                subcategoryLabel={values.subcategoryLabel}
              />

              <div className="sm:col-span-2 lg:col-span-3">
                <div className="grid gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-medium tracking-[0.14em] text-[color:var(--muted2)]">Notes</label>
                    <div className="flex items-center gap-1.5">
                      <PillButton
                        size="compact"
                        title="Auto-fill from filled fields"
                        onClick={() => {
                          const generated = generateNotesSummary(values);
                          if (generated) {
                            setField("notes", generated);
                            setAiFilledFields((prev) => { const n = new Set(prev); n.add("notes"); return n; });
                          }
                        }}
                      >
                        <AppIcon name="sun" size={14} strokeWidth={2} />
                        Auto
                      </PillButton>
                      <LockButton locked={locks.notes} onToggle={() => handleToggleLock("notes")} />
                    </div>
                  </div>
                  <textarea
                    className={textareaClass(aiFilledFields.has("notes"))}
                    value={values.notes}
                    onChange={(e) => { setAiFilledFields((prev) => { const n = new Set(prev); n.delete("notes"); return n; }); setField("notes", e.target.value); }}
                    placeholder="Notes, artist, run info, or anything repeated until dedicated fields exist."
                  />
                </div>
              </div>
          </div>
        </section>

        <input
          ref={mediaInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void handleMediaImageSelection(e.target.files)}
        />
        <input
          ref={mediaCameraInputRef}
          type="file"
          accept="image/*"
          className="fixed left-[-9999px] top-0 h-px w-px opacity-0"
          onChange={(e) => void handleScanImageSelection(e.target.files)}
        />
        <input
          ref={uploadInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleScanImageSelection(e.target.files)}
        />

        {selectedMediaImage ? (
          <div ref={photoDialogRef} className="fixed inset-0 z-[80] bg-black/75 p-2 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label="Photo options" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedMediaImageId(""); }}>
            <div className="mx-auto flex max-h-[calc(100dvh-1rem)] max-w-xl flex-col overflow-hidden rounded-[14px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] sm:max-h-[calc(100dvh-2rem)] sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">ITEM PHOTO</div>
                  <h2 className="mt-1 text-lg font-semibold text-[color:var(--fg)]">Photo Options</h2>
                </div>
                <PillButton onClick={() => setSelectedMediaImageId("")}>
                  Close
                </PillButton>
              </div>

              <div className="mt-3 min-h-0 overflow-hidden rounded-[16px] bg-[color:var(--theme-card)] p-2 ring-1 ring-[color:var(--border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedMediaImage.previewUrl}
                  alt={`${selectedMediaImage.role} item photo`}
                  className="max-h-[52dvh] w-full rounded-[12px] object-contain"
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <PillButton variant="active" onClick={() => selectDraftMediaImageForIdentify(selectedMediaImage.id)}>Use for Identify</PillButton>
                <PillButton onClick={() => openMediaCropEditor(selectedMediaImage.id)}>Edit / Crop</PillButton>
                <PillButton variant="danger" onClick={() => removeDraftMediaImage(selectedMediaImage.id)}>Delete Photo</PillButton>
                <PillButton onClick={() => setSelectedMediaImageId("")}>Close</PillButton>
              </div>
            </div>
          </div>
        ) : null}

        {mounted && isCropEditorOpen && cropEditorImageUrl && typeof document !== "undefined"
          ? createPortal(
              <div
                ref={cropDialogRef}
                className="fixed inset-0 z-[120] flex h-[100dvh] w-[100dvw] items-start justify-center overflow-y-auto bg-black/75 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-sm sm:px-4 sm:py-4"
                role="dialog"
                aria-modal="true"
                aria-label="Edit photo crop"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) cancelCropEditor();
                }}
              >
                <div className="w-full max-w-3xl">
                  <div className="flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-[14px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] sm:max-h-[calc(100dvh-2rem)] sm:p-4">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">EDIT PHOTO</div>
                        <h2 className="mt-1 text-lg font-semibold text-[color:var(--fg)]">
                          {cropEditorTarget === "media" ? "Adjust Item Photo" : "Adjust Identify Picture"}
                        </h2>
                      </div>
                      <PillButton onClick={() => cancelCropEditor()}>
                        {freshCropMediaId && cropEditorTarget === "scan" ? "Cancel" : "Close"}
                      </PillButton>
                    </div>
                    <div className="min-h-0 overflow-auto">
                      <ScanCropEditor
                        imageUrl={cropEditorImageUrl}
                        crop={scanCrop}
                        onChange={setScanCrop}
                        title="ADJUST PHOTO"
                        description="Drag the photo to frame it. Pinch or use Zoom to move closer."
                        applyLabel={cropEditorTarget === "media" ? "Save Photo" : "Use This Picture"}
                        onApply={() => void handleApplyCropEditor()}
                        onReset={() => setScanCrop(DEFAULT_SCAN_CROP)}
                        onUseFull={() => {
                          // The whole photo, as it is: close the step (the crop frame is back to full).
                          setScanCrop(DEFAULT_SCAN_CROP);
                          setIsCropEditorOpen(false);
                          setStatus(cropEditorTarget === "media" ? "Photo kept as it was." : aiAccess ? "Picture ready. Choose Identify with AI to fill in the details, or fill them in yourself." : "Picture ready. Fill in the details yourself.");
                        }}
                        onCancel={() => cancelCropEditor()}
                        isApplying={isApplyingCrop}
                        compact
                        viewportFixed={cropEditorTarget === "media"}
                      />
                    </div>
                  </div>
                </div>
              </div>,
              document.body
            )
          : null}

        {duplicateWarning ? (
          <div className="mx-auto mt-4 w-full max-w-5xl rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-200 ring-1 ring-amber-400/20">
            <span className="inline-flex items-start gap-2"><AppIcon name="warning" size={16} className="mt-0.5 shrink-0" /><span>{duplicateWarning}</span></span>
          </div>
        ) : null}

        {dropMode && dropSession && !showDropReview && typeof document !== "undefined" ? createPortal(
          // Portaled to document.body — NavShell renders this page inside
          // PullToRefresh, whose scrolling wrapper clips ANY fixed-position
          // descendant to its own box regardless of z-index (a z-index
          // bump alone, even above BottomNav's real rendered 9999, wasn't
          // enough — portaling escapes the clipping ancestor entirely,
          // same as MfaChallengeGate always does).
          <div className="fixed bottom-0 left-0 right-0 z-[10000] flex items-center justify-between gap-4 border-t border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-3 shadow-[0_-8px_32px_rgba(0,0,0,0.35)]">
            <div>
              <div className="text-sm font-bold">{dropSession.name}</div>
              <div className="text-xs text-[color:var(--muted)]">
                {dropSessionStats(dropSession).count} saved
                {dropSessionStats(dropSession).totalValue > 0
                  ? ` · ${dropSessionStats(dropSession).totalValue.toLocaleString(undefined, {
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: 0,
                    })} est. value`
                  : ""}
              </div>
            </div>
            <PillButton onClick={endDrop} style={{ background: "var(--theme-gold, #C8CDD2)", color: "#0A0800" }}>
              Done · Review
            </PillButton>
          </div>,
          document.body
        ) : null}

        {showDropReview && dropSession ? (
          <DropReviewSheet
            session={dropSession}
            onClose={() => setShowDropReview(false)}
            onFinish={finishDrop}
          />
        ) : null}

        {isBarcodeScanOpen ? (
          <BarcodeScanCamera
            onScan={(result) => void handleLiveBarcodeScanned(result)}
            onClose={() => setIsBarcodeScanOpen(false)}
          />
        ) : null}

        {isCameraPanelOpen ? (
          <CameraCapturePanel
            key={cameraPanelKey}
            title={cameraTarget === "scan" ? "Capture Item Picture" : "Capture Item Photo"}
            description={
              cameraTarget === "scan"
                ? "Take an item picture. It will be added to this item and used for identify/autofill."
                : "Capture a real item photo and add it to this item's saved photo list."
            }
            universe={values.universe}
            onCapture={handleCapturedPhoto}
            onLiveBarcodeScan={(result, match) => runLiveBarcodeLookup(result, match)}
            bulkToggle={false}
            onClose={() => setIsCameraPanelOpen(false)}
            onUseFileInstead={() => {
              setIsCameraPanelOpen(false);
              if (cameraTarget === "scan") {
                uploadInputRef.current?.click();
                return;
              }
              mediaInputRef.current?.click();
            }}
          />
        ) : null}
      </div>
    </main>
  );
}
