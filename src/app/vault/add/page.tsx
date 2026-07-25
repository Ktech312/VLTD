"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import UpgradeNudge, { isFreeTierLimitError } from "@/components/UpgradeNudge";

import CameraCapturePanel from "@/components/CameraCapturePanel";
import BarcodeScanCamera from "@/components/BarcodeScanCamera";
import DropReviewSheet from "@/components/DropReviewSheet";
import { type ImageRole } from "@/components/ImageRoleSelector";
import ScanCropEditor from "@/components/ScanCropEditor";
import ScanPanel from "@/components/ScanPanel";
import { PillButton } from "@/components/ui/PillButton";
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
import { lookupVinylByBarcode, lookupVinylByText } from "@/lib/discogLookup";
import { lookupPSACert, looksLikePSACert, extractPSACertFromUrl, formatPSAGrade, formatPSASet } from "@/lib/psaLookup";
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

const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";
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

function parseMoney(input: string) {
  const cleaned = input.replace(/[^0-9.-]/g, "").trim();
  if (!cleaned) return undefined;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : undefined;
}

function inputClass(isAiFilled?: boolean) {
  return [
    "h-11 rounded-xl px-3 text-sm focus:outline-none transition-all placeholder:text-[color:var(--muted)] placeholder:italic placeholder:text-xs",
    isAiFilled
      ? "bg-[rgba(245,181,72,0.18)] ring-2 ring-[rgba(245,181,72,0.7)] text-[#FFE08A] font-semibold"
      : "bg-[color:var(--pill)] ring-1 ring-[color:var(--border)]",
  ].join(" ");
}

function selectClass(isAiFilled?: boolean) {
  return [
    "h-11 w-full rounded-xl px-3 text-sm focus:outline-none transition-all",
    isAiFilled
      ? "bg-[rgba(245,181,72,0.18)] ring-2 ring-[rgba(245,181,72,0.7)] text-[#FFE08A] font-semibold"
      : "bg-[color:var(--pill)] ring-1 ring-[color:var(--border)]",
  ].join(" ");
}

function textareaClass(isAiFilled?: boolean) {
  return [
    "min-h-[78px] rounded-xl px-3 py-2.5 text-sm focus:outline-none transition-all placeholder:text-[color:var(--muted)] placeholder:italic placeholder:text-xs",
    isAiFilled
      ? "bg-[rgba(245,181,72,0.18)] ring-2 ring-[rgba(245,181,72,0.7)] text-[#FFE08A] font-semibold"
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
    values.categoryLabel || values.category
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

function Field({
  label,
  locked,
  onToggleLock,
  children,
}: {
  label: string;
  locked: boolean;
  onToggleLock: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium tracking-[0.14em] text-[color:var(--muted2)]">
          {label}
        </label>
        <button
          type="button"
          onClick={onToggleLock}
          className={[
            "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 transition",
            locked
              ? "bg-[color:var(--pill-active-bg)] text-[color:var(--fg)] ring-[color:var(--pill-active-bg)]"
              : "bg-[color:var(--pill)] text-[color:var(--muted)] ring-[color:var(--border)]",
          ].join(" ")}
          title={locked ? "Locked for next item" : "Unlocked for next item"}
        >
          {locked ? (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--theme-gold, #F5B548)" }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--muted)" }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
            </svg>
          )}
        </button>
      </div>
      {children}
    </div>
  );
}

export default function AddPage() {
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
  const [mounted, setMounted] = useState(false);
  const [isCropEditorOpen, setIsCropEditorOpen] = useState(false);
  const [cropEditorTarget, setCropEditorTarget] = useState<"scan" | "media">("scan");
  const [cropMediaImageId, setCropMediaImageId] = useState("");
  const [scanCrop, setScanCrop] = useState<ScanCropRect>(DEFAULT_SCAN_CROP);
  const [isApplyingCrop, setIsApplyingCrop] = useState(false);

  const [draftMediaImages, setDraftMediaImages] = useState<DraftMediaImage[]>([]);
  const [activeMediaImageId, setActiveMediaImageId] = useState("");
  const [selectedMediaImageId, setSelectedMediaImageId] = useState("");
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

  // Camera open and ready right away — skip the empty photo-box tap
  const autoOpenedCameraRef = useRef(false);
  useEffect(() => {
    if (autoOpenedCameraRef.current) return;
    autoOpenedCameraRef.current = true;
    openCameraFor("scan");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const selectedCategory = safeCategoryForUniverse(
    selectedUniverse,
    values.categoryLabel || values.category
  );
  const baseCategoryOptions = getCategories(selectedUniverse);
  const categoryOptions =
    selectedCategory && !baseCategoryOptions.includes(selectedCategory)
      ? [selectedCategory, ...baseCategoryOptions]
      : baseCategoryOptions;
  const subcategoryOptions = getSubcategories(selectedUniverse, selectedCategory);
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
      setStatus("Picture + barcode captured. Run Auto Identify or save the item.");
    } else {
      setStatus("Picture added. Run Auto Identify or save the item.");
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
    setStatus("Selected picture ready. Crop if needed, then run Auto Identify.");
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

  async function runPSALookupForCode(certRaw: string) {
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

      // Run OCR and Discogs lookup in parallel
      const [fallbackOcr, discogsResult] = await Promise.all([
        runImageScanAutofill(file, "auto"),
        effectiveBarcode.length >= 12
          ? lookupVinylByBarcode(effectiveBarcode).catch(() => null)
          : Promise.resolve(null),
      ]);

      const matched = Boolean(discogsResult);

      // If no barcode hit, try text-based lookup from OCR title
      const textResult =
        !matched && fallbackOcr.fields?.title
          ? await lookupVinylByText(
              fallbackOcr.fields?.title ?? "",
              fallbackOcr.fields?.subtitle ?? ""
            ).catch(() => null)
          : null;

      const best = discogsResult ?? textResult;

      if (!best) {
        setScanSession((prev) => markScanSessionFailed(prev, "No vinyl match found."));
        setStatus("No vinyl match found — try image identify.");
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
      const message =
        error instanceof Error ? error.message : "Image identify failed.";
      setScanSession((prev) => markScanSessionFailed(prev, message));
      setStatus(message);
      return false;
    } finally {
      setIsVisionLookupRunning(false);
    }
  }

  async function handleIdentifyCurrentScan(file: File, barcode?: { digits?: string; rawValue?: string }) {
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
      const ocrMatched = await runOcrAutofillForFile(file, scanType);
      if (ocrMatched) return;
      await runVisionLookupForFile(file, scanType);
      return;
    }

    if (currentBarcode?.digits) {
      // Short numeric barcode (7-10 digits) = likely a graded slab cert number
      if (looksLikePSACert(currentBarcode.digits)) {
        const psaMatched = await runPSALookupForCode(
          currentBarcode.rawValue || currentBarcode.digits
        );
        if (psaMatched) return;
      }

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

    addDraftMediaFiles([file]);
    replaceScanImage(file);
    setCropEditorTarget("scan");
    setCropMediaImageId("");
    setIsCropEditorOpen(true);
    setStatus("Picture added. Crop if needed, then run Auto Identify or save the item.");
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
      setStatus("Reading the photo now...");
      const barcode = await scanBarcodeFromFile(fileToScan);
      await handleIdentifyCurrentScan(fileToScan, barcode ?? undefined);
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

      const purchasePrice = parseMoney(normalizedValues.purchasePrice);
      const pricingPatch = buildPricingPatch({
        estimatedValue: pricingValues.estimatedValue,
        lastCompValue: pricingValues.lastCompValue,
        priceSource: pricingValues.priceSource,
        priceConfidence: pricingValues.priceConfidence,
        priceNotes: pricingValues.priceNotes,
      });
      const currentValue =
        parseMoney(normalizedValues.currentValue) ??
        pricingPatch.estimatedValue ??
        pricingPatch.lastCompValue ??
        purchasePrice;

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
        sportsIsRelic: normalizedValues.sportsIsRelic === "true" ? true : undefined,
        sportsRelicDescription: (normalizedValues.sportsRelicDescription ?? "").trim() || undefined,
        sportsIsAuto: normalizedValues.sportsIsAuto === "true" ? true : undefined,
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
        memorabiliaWitnessed: normalizedValues.memorabiliaWitnessed === "true" ? true : undefined,
        memorabiliaAuthCompany: (normalizedValues.memorabiliaAuthCompany ?? "").trim() || undefined,
        memorabiliaGameUsed: normalizedValues.memorabiliaGameUsed === "true" ? true : undefined,
        memorabiliaGameUsedDesc: (normalizedValues.memorabiliaGameUsedDesc ?? "").trim() || undefined,
        // Vinyl additions
        vinylCountry: (normalizedValues.vinylCountry ?? "").trim() || undefined,
        vinylSleeveCondition: (normalizedValues.vinylSleeveCondition ?? "").trim() || undefined,
        vinylInserts: normalizedValues.vinylInserts === "true" ? true : undefined,
        vinylGatefold: normalizedValues.vinylGatefold === "true" ? true : undefined,
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
        toyBoxIncluded: normalizedValues.toyBoxIncluded === "true" ? true : undefined,
        toyAccessoriesIncluded: normalizedValues.toyAccessoriesIncluded === "true" ? true : undefined,
        toyIsComplete: normalizedValues.toyIsComplete === "true" ? true : undefined,
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
        artIsFramed: normalizedValues.artIsFramed === "true" ? true : undefined,
        artIsSigned: normalizedValues.artIsSigned === "true" ? true : undefined,
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
        watchBox: normalizedValues.watchBox === "true" ? true : undefined,
        watchPapers: normalizedValues.watchPapers === "true" ? true : undefined,
        watchFullSet: normalizedValues.watchFullSet === "true" ? true : undefined,
        // Bags
        bagBrand: (normalizedValues.bagBrand ?? "").trim() || undefined,
        bagColor: (normalizedValues.bagColor ?? "").trim() || undefined,
        bagMaterial: (normalizedValues.bagMaterial ?? "").trim() || undefined,
        bagHardware: (normalizedValues.bagHardware ?? "").trim() || undefined,
        bagAuthCard: normalizedValues.bagAuthCard === "true" ? true : undefined,
        bagDustbag: normalizedValues.bagDustbag === "true" ? true : undefined,
        bagBox: normalizedValues.bagBox === "true" ? true : undefined,
        // Apparel
        apparelSize: (normalizedValues.apparelSize ?? "").trim() || undefined,
        apparelColorway: (normalizedValues.apparelColorway ?? "").trim() || undefined,
        apparelWorn: normalizedValues.apparelWorn === "true" ? true : undefined,
        // Games
        gamePlatform: (normalizedValues.gamePlatform ?? "").trim() || undefined,
        gameRegion: (normalizedValues.gameRegion ?? "").trim() || undefined,
        gameGradingCompany: (normalizedValues.gameGradingCompany ?? "").trim() || undefined,
        gameIsSealed: normalizedValues.gameIsSealed === "true" ? true : undefined,
        gameIsCIB: normalizedValues.gameIsCIB === "true" ? true : undefined,
        gameHasManual: normalizedValues.gameHasManual === "true" ? true : undefined,
        gamePublisher: (normalizedValues.gamePublisher ?? "").trim() || undefined,
        // Coins
        coinDenomination: (normalizedValues.coinDenomination ?? "").trim() || undefined,
        coinCountry: (normalizedValues.coinCountry ?? "").trim() || undefined,
        coinMint: (normalizedValues.coinMint ?? "").trim() || undefined,
        coinMintMark: (normalizedValues.coinMintMark ?? "").trim() || undefined,
        coinGradingCompany: (normalizedValues.coinGradingCompany ?? "").trim() || undefined,
        coinPopulation: (normalizedValues.coinPopulation ?? "").trim() || undefined,
        coinError: (normalizedValues.coinError ?? "").trim() || undefined,
        coinKeyDate: normalizedValues.coinKeyDate === "true" ? true : undefined,
        // Universal type + attributes
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
          {status && (status.startsWith("✓") || /limit|failed|error|required|unavailable|deleted|removed/i.test(status)) ? (
            <div
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
          <button
            type="button"
            onClick={() => void saveForm(false)}
            disabled={!canSave}
            className="fixed right-4 z-[60] inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-45"
            style={{
              top: "calc(var(--topnav-h, 64px) + 12px)",
              background: "linear-gradient(135deg, #8B6914, #F5B548)",
              color: "#0B0B0B",
              boxShadow: "0 6px 22px rgba(245,181,72,0.45)",
            }}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        )}

        <div className="mb-3 w-full max-w-5xl mx-auto grid gap-3">
          <div className="grid gap-3">
            <div ref={scanStageRef}>
              <ScanPanel
                session={scanSession}
                isScanning={isScanning}
                isBookLookupRunning={isBookLookupRunning}
                isComicLookupRunning={isComicLookupRunning}
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
                  <button
                    type="button"
                    onClick={resetUnlockedFields}
                    disabled={isSaving}
                    className="rounded-full bg-[color:var(--pill)] px-2.5 py-1 text-[10px] ring-1 ring-[color:var(--border)] disabled:opacity-40"
                  >
                    Unlock All
                  </button>
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
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs font-medium" style={{ color: "var(--fg-muted)" }}>Attributes</span>
                        {selectedAttributes.size > 0 && (
                          <button
                            type="button"
                            onClick={() => setField("itemAttributes", "")}
                            className="text-xs"
                            style={{ color: "var(--fg-muted)" }}
                          >Clear</button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {checkboxOptions.map((attr) => {
                          const active = selectedAttributes.has(attr);
                          return (
                            <button
                              key={attr}
                              type="button"
                              onClick={() => toggleAttribute(attr)}
                              className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                              style={{
                                background: active ? "var(--theme-gold)" : "var(--pill)",
                                color: active ? "#000" : "var(--fg)",
                                border: "1px solid",
                                borderColor: active ? "var(--theme-gold)" : "var(--border)",
                              }}
                            >
                              {attr}
                            </button>
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
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Subtitle / Set" locked={locks.subtitle} onToggleLock={() => handleToggleLock("subtitle")}>
                <input
                  className={inputClass(aiFilledFields.has("subtitle"))}
                  value={values.subtitle}
                  onChange={(e) => { setAiFilledFields(prev => { const n = new Set(prev); n.delete("subtitle"); return n; }); setField("subtitle", e.target.value); }}
                  placeholder="Series / set / run"
                />
              </Field>

              <Field label="Number / Issue" locked={locks.number} onToggleLock={() => handleToggleLock("number")}>
                <input
                  ref={numberInputRef}
                  className={inputClass(aiFilledFields.has("number"))}
                  value={values.number}
                  onChange={(e) => { setAiFilledFields(prev => { const n = new Set(prev); n.delete("number"); return n; }); setField("number", e.target.value); }}
                  placeholder="#129"
                />
              </Field>

              <Field label="Grade" locked={locks.grade} onToggleLock={() => handleToggleLock("grade")}>
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

              <Field label="Subject" locked={locks.subject} onToggleLock={() => handleToggleLock("subject")}>
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

              <Field label="Cert #" locked={locks.certNumber} onToggleLock={() => handleToggleLock("certNumber")}>
                <input
                  className={inputClass(aiFilledFields.has("certNumber"))}
                  value={values.certNumber}
                  onChange={(e) => { setAiFilledFields(prev => { const n = new Set(prev); n.delete("certNumber"); return n; }); setField("certNumber", e.target.value); }}
                  placeholder="Certification number"
                />
              </Field>

              <Field label="Serial #" locked={locks.serialNumber} onToggleLock={() => handleToggleLock("serialNumber")}>
                <input
                  className={inputClass()}
                  value={values.serialNumber}
                  onChange={(e) => setField("serialNumber", e.target.value)}
                  placeholder="Serial number / ISBN"
                />
              </Field>

              <Field label="Edition" locked={locks.edition} onToggleLock={() => handleToggleLock("edition")}>
                <input
                  className={inputClass()}
                  value={values.edition}
                  onChange={(e) => setField("edition", e.target.value)}
                  placeholder="1st Edition, Unlimited, Shadowless"
                />
              </Field>

              <Field label="Variant / Finish" locked={locks.variant} onToggleLock={() => handleToggleLock("variant")}>
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

              <label className="flex min-h-10 items-center gap-3 rounded-xl bg-[color:var(--pill)] px-3 ring-1 ring-[color:var(--border)]">
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

              {/* ── TCG fields ───────────────────────────────────── */}
              {values.universe === "TCG" && (<>
                <Field label="Rarity" locked={false} onToggleLock={() => {}}>
                  <input
                    className={inputClass()}
                    value={values.tcgRarity ?? ""}
                    onChange={(e) => setField("tcgRarity", e.target.value)}
                    placeholder="Holo Rare, Secret Rare, Ultra Rare, Common…"
                  />
                </Field>
                <Field label="Parallel / Finish" locked={false} onToggleLock={() => {}}>
                  <input
                    className={inputClass()}
                    value={values.tcgParallelType ?? ""}
                    onChange={(e) => setField("tcgParallelType", e.target.value)}
                    placeholder="Rainbow Rare, Gold, Reverse Holo…"
                  />
                </Field>
                <Field label="Holo / Foil Type" locked={false} onToggleLock={() => {}}>
                  <input
                    className={inputClass()}
                    value={values.tcgHoloType ?? ""}
                    onChange={(e) => setField("tcgHoloType", e.target.value)}
                    placeholder="Cosmos Holo, Cracked Ice, Crosshatch…"
                  />
                </Field>
                <Field label="Set Code" locked={false} onToggleLock={() => {}}>
                  <input
                    className={inputClass()}
                    value={values.tcgSetCode ?? ""}
                    onChange={(e) => setField("tcgSetCode", e.target.value)}
                    placeholder="SV3pt5, BW1, EX Dragon…"
                  />
                </Field>
                <Field label="Language" locked={false} onToggleLock={() => {}}>
                  <select
                    className={inputClass()}
                    value={values.tcgLanguage ?? ""}
                    onChange={(e) => setField("tcgLanguage", e.target.value)}
                  >
                    <option value="">—</option>
                    <option>English</option>
                    <option>Japanese</option>
                    <option>Korean</option>
                    <option>Chinese</option>
                    <option>German</option>
                    <option>French</option>
                    <option>Spanish</option>
                    <option>Italian</option>
                    <option>Portuguese</option>
                  </select>
                </Field>
                <Field label="Grading Company" locked={false} onToggleLock={() => {}}>
                  <select
                    className={inputClass()}
                    value={values.tcgGradingCompany ?? ""}
                    onChange={(e) => setField("tcgGradingCompany", e.target.value)}
                  >
                    <option value="">Raw (Ungraded)</option>
                    <option>PSA</option>
                    <option>BGS / Beckett</option>
                    <option>CGC</option>
                    <option>SGC</option>
                    <option>ACE</option>
                  </select>
                </Field>
              </>)}

              {/* ── Sports Cards fields ───────────────────────────── */}
              {values.universe === "SPORTS" && selectedCategory === "Sports Cards" && (<>
                <Field label="Sport" locked={false} onToggleLock={() => {}}>
                  <select
                    className={inputClass()}
                    value={values.sportsSport ?? ""}
                    onChange={(e) => setField("sportsSport", e.target.value)}
                  >
                    <option value="">—</option>
                    <option>Baseball</option>
                    <option>Basketball</option>
                    <option>Football</option>
                    <option>Soccer</option>
                    <option>Hockey</option>
                    <option>Golf</option>
                    <option>Tennis</option>
                    <option>UFC / MMA</option>
                    <option>Racing</option>
                    <option>Multi-Sport</option>
                    <option>Other</option>
                  </select>
                </Field>
                <Field label="Team" locked={false} onToggleLock={() => {}}>
                  <input
                    className={inputClass()}
                    value={values.sportsTeam ?? ""}
                    onChange={(e) => setField("sportsTeam", e.target.value)}
                    placeholder="Lakers, Yankees, Chiefs…"
                  />
                </Field>
                <Field label="Parallel / Color" locked={false} onToggleLock={() => {}}>
                  <input
                    className={inputClass()}
                    value={values.sportsParallelType ?? ""}
                    onChange={(e) => setField("sportsParallelType", e.target.value)}
                    placeholder="Prizm Silver, Reactive Blue, Gold Refractor…"
                  />
                </Field>
                <Field label="Serial / Print Run" locked={false} onToggleLock={() => {}}>
                  <input
                    className={inputClass()}
                    value={values.sportsSerialNumber ?? ""}
                    onChange={(e) => setField("sportsSerialNumber", e.target.value)}
                    placeholder="/25, /10, 1/1…"
                  />
                </Field>
                <Field label="Grading Company" locked={false} onToggleLock={() => {}}>
                  <select
                    className={inputClass()}
                    value={values.sportsGradingCompany ?? ""}
                    onChange={(e) => setField("sportsGradingCompany", e.target.value)}
                  >
                    <option value="">Raw (Ungraded)</option>
                    <option>PSA</option>
                    <option>BGS / Beckett</option>
                    <option>SGC</option>
                    <option>CGC</option>
                    <option>HGA</option>
                    <option>KSA</option>
                  </select>
                </Field>
                <Field label="Pop Report" locked={false} onToggleLock={() => {}}>
                  <input
                    className={inputClass()}
                    value={values.sportsPop ?? ""}
                    onChange={(e) => setField("sportsPop", e.target.value)}
                    placeholder="e.g., 12 at this grade, 3 higher"
                  />
                </Field>
                <label className="flex min-h-10 items-center gap-3 rounded-xl bg-[color:var(--pill)] px-3 ring-1 ring-[color:var(--border)]">
                  <input type="checkbox" checked={values.sportsIsRelic === "true"}
                    onChange={(e) => setField("sportsIsRelic", e.target.checked ? "true" : "")}
                    className="h-4 w-4 rounded accent-[color:var(--theme-gold)]" />
                  <span className="text-sm" style={{ color: "var(--fg)" }}>Relic / Patch Card</span>
                </label>
                {values.sportsIsRelic === "true" && (
                  <Field label="Relic Description" locked={false} onToggleLock={() => {}}>
                    <input className={inputClass()} value={values.sportsRelicDescription ?? ""}
                      onChange={(e) => setField("sportsRelicDescription", e.target.value)}
                      placeholder="Game-used jersey, 3-color patch…" />
                  </Field>
                )}
                <label className="flex min-h-10 items-center gap-3 rounded-xl bg-[color:var(--pill)] px-3 ring-1 ring-[color:var(--border)]">
                  <input type="checkbox" checked={values.sportsIsAuto === "true"}
                    onChange={(e) => setField("sportsIsAuto", e.target.checked ? "true" : "")}
                    className="h-4 w-4 rounded accent-[color:var(--theme-gold)]" />
                  <span className="text-sm" style={{ color: "var(--fg)" }}>Autograph</span>
                </label>
                {values.sportsIsAuto === "true" && (
                  <Field label="Auto Authenticator" locked={false} onToggleLock={() => {}}>
                    <select className={inputClass()} value={values.sportsAutoAuth ?? ""}
                      onChange={(e) => setField("sportsAutoAuth", e.target.value)}>
                      <option value="">—</option>
                      <option>On-Card (PSA/DNA)</option>
                      <option>On-Card (JSA)</option>
                      <option>On-Card (Beckett)</option>
                      <option>Stickered</option>
                      <option>Unverified</option>
                    </select>
                  </Field>
                )}
              </>)}

              {/* ── Sports Memorabilia fields ─────────────────────── */}
              {values.universe === "SPORTS" && selectedCategory === "Memorabilia" && (<>
                <Field label="Sport / Team" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.memorabiliaTeam ?? ""}
                    onChange={(e) => setField("memorabiliaTeam", e.target.value)}
                    placeholder="Lakers, Yankees, Team USA…" />
                </Field>
                <Field label="Event / Season" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.memorabiliaEvent ?? ""}
                    onChange={(e) => setField("memorabiliaEvent", e.target.value)}
                    placeholder="2000 Finals, 1998 World Series, Super Bowl LV…" />
                </Field>
                <Field label="Signing Date" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.memorabiliaSigningDate ?? ""}
                    onChange={(e) => setField("memorabiliaSigningDate", e.target.value)}
                    placeholder="March 12, 2023" />
                </Field>
                <Field label="Auth Company" locked={false} onToggleLock={() => {}}>
                  <select className={inputClass()} value={values.memorabiliaAuthCompany ?? ""}
                    onChange={(e) => setField("memorabiliaAuthCompany", e.target.value)}>
                    <option value="">—</option>
                    <option>PSA/DNA</option><option>JSA</option><option>Beckett</option>
                    <option>Steiner</option><option>Fanatics</option><option>Unverified</option>
                  </select>
                </Field>
                <label className="flex min-h-10 items-center gap-3 rounded-xl bg-[color:var(--pill)] px-3 ring-1 ring-[color:var(--border)]">
                  <input type="checkbox" checked={values.memorabiliaWitnessed === "true"}
                    onChange={(e) => setField("memorabiliaWitnessed", e.target.checked ? "true" : "")}
                    className="h-4 w-4 rounded accent-[color:var(--theme-gold)]" />
                  <span className="text-sm" style={{ color: "var(--fg)" }}>Signing witnessed</span>
                </label>
                <label className="flex min-h-10 items-center gap-3 rounded-xl bg-[color:var(--pill)] px-3 ring-1 ring-[color:var(--border)]">
                  <input type="checkbox" checked={values.memorabiliaGameUsed === "true"}
                    onChange={(e) => setField("memorabiliaGameUsed", e.target.checked ? "true" : "")}
                    className="h-4 w-4 rounded accent-[color:var(--theme-gold)]" />
                  <span className="text-sm" style={{ color: "var(--fg)" }}>Game used / match worn</span>
                </label>
                {values.memorabiliaGameUsed === "true" && (
                  <Field label="Game-Used Description" locked={false} onToggleLock={() => {}}>
                    <input className={inputClass()} value={values.memorabiliaGameUsedDesc ?? ""}
                      onChange={(e) => setField("memorabiliaGameUsedDesc", e.target.value)}
                      placeholder="Jersey worn Game 7, bat used 2002 ALCS…" />
                  </Field>
                )}
              </>)}

              {/* ── Vinyl / Music fields ──────────────────────────── */}
              {values.universe === "MUSIC" && (<>
                <Field label="Pressing" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.vinylPressing ?? ""}
                    onChange={(e) => setField("vinylPressing", e.target.value)}
                    placeholder="Original Press, Reissue, 180g, Limited…" />
                </Field>
                <Field label="Label" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.vinylLabel ?? ""}
                    onChange={(e) => setField("vinylLabel", e.target.value)}
                    placeholder="Blue Note, Impulse!, Motown, Columbia…" />
                </Field>
                <Field label="Country of Pressing" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.vinylCountry ?? ""}
                    onChange={(e) => setField("vinylCountry", e.target.value)}
                    placeholder="US, UK, Japan, Germany…" />
                </Field>
                <Field label="Speed (RPM)" locked={false} onToggleLock={() => {}}>
                  <select className={inputClass()} value={values.vinylSpeedRpm ?? ""}
                    onChange={(e) => setField("vinylSpeedRpm", e.target.value)}>
                    <option value="">—</option>
                    <option value="33">33 RPM</option>
                    <option value="45">45 RPM</option>
                    <option value="78">78 RPM</option>
                  </select>
                </Field>
                <Field label="Vinyl Color" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.vinylColor ?? ""}
                    onChange={(e) => setField("vinylColor", e.target.value)}
                    placeholder="Black, Clear, Red, Picture Disc…" />
                </Field>
                <Field label="Sleeve Condition" locked={false} onToggleLock={() => {}}>
                  <select className={inputClass()} value={values.vinylSleeveCondition ?? ""}
                    onChange={(e) => setField("vinylSleeveCondition", e.target.value)}>
                    <option value="">—</option>
                    <option>Mint (M)</option><option>Near Mint (NM)</option>
                    <option>Very Good Plus (VG+)</option><option>Very Good (VG)</option>
                    <option>Good Plus (G+)</option><option>Good (G)</option><option>Fair (F)</option>
                  </select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Matrix / Runout" locked={false} onToggleLock={() => {}}>
                    <input className={inputClass()} value={values.vinylMatrix ?? ""}
                      onChange={(e) => setField("vinylMatrix", e.target.value)}
                      placeholder="Etched matrix info from the dead wax" />
                  </Field>
                </div>
                <label className="flex min-h-10 items-center gap-3 rounded-xl bg-[color:var(--pill)] px-3 ring-1 ring-[color:var(--border)]">
                  <input type="checkbox" checked={values.vinylInserts === "true"}
                    onChange={(e) => setField("vinylInserts", e.target.checked ? "true" : "")}
                    className="h-4 w-4 rounded accent-[color:var(--theme-gold)]" />
                  <span className="text-sm" style={{ color: "var(--fg)" }}>Inserts / lyric sheet included</span>
                </label>
                <label className="flex min-h-10 items-center gap-3 rounded-xl bg-[color:var(--pill)] px-3 ring-1 ring-[color:var(--border)]">
                  <input type="checkbox" checked={values.vinylGatefold === "true"}
                    onChange={(e) => setField("vinylGatefold", e.target.checked ? "true" : "")}
                    className="h-4 w-4 rounded accent-[color:var(--theme-gold)]" />
                  <span className="text-sm" style={{ color: "var(--fg)" }}>Gatefold sleeve</span>
                </label>
              </>)}

              {/* ── Comics fields ─────────────────────────────────── */}
              {values.universe === "POP_CULTURE" && selectedCategory === "Comics" && (<>
                <Field label="Publisher" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.comicPublisher ?? ""}
                    onChange={(e) => setField("comicPublisher", e.target.value)}
                    placeholder="Marvel, DC, Image, Dark Horse, IDW, Indie…" />
                </Field>
                <Field label="Issue Number" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.comicIssueNumber ?? ""}
                    onChange={(e) => setField("comicIssueNumber", e.target.value)}
                    placeholder="#1, Vol 2 #4, Annual #1…" />
                </Field>
                <Field label="Cover Date" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.comicCoverDate ?? ""}
                    onChange={(e) => setField("comicCoverDate", e.target.value)}
                    placeholder="July 1962, Dec 1939 (as printed on cover)" />
                </Field>
                <Field label="Cover Variant" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.comicCoverVariant ?? ""}
                    onChange={(e) => setField("comicCoverVariant", e.target.value)}
                    placeholder="Variant A, Incentive, Sketch, Foil…" />
                </Field>
                <Field label="Arc / Story Title" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.comicArcTitle ?? ""}
                    onChange={(e) => setField("comicArcTitle", e.target.value)}
                    placeholder="The Dark Phoenix Saga, Knightfall…" />
                </Field>
                <Field label="Grading Company" locked={false} onToggleLock={() => {}}>
                  <select className={inputClass()} value={values.comicGradingCompany ?? ""}
                    onChange={(e) => setField("comicGradingCompany", e.target.value)}>
                    <option value="">Raw (Ungraded)</option>
                    <option>CGC</option><option>CBCS</option><option>PGX</option><option>CGS</option>
                  </select>
                </Field>
                {values.comicGradingCompany && values.comicGradingCompany !== "Raw (Ungraded)" && (<>
                  <Field label="Page Quality" locked={false} onToggleLock={() => {}}>
                    <select className={inputClass()} value={values.comicPageQuality ?? ""}
                      onChange={(e) => setField("comicPageQuality", e.target.value)}>
                      <option value="">—</option>
                      <option>White</option><option>Off-White/White</option><option>Off-White</option>
                      <option>Light Tan</option><option>Tan</option><option>Cream</option><option>Yellow</option>
                    </select>
                  </Field>
                  <Field label="Restoration Status" locked={false} onToggleLock={() => {}}>
                    <select className={inputClass()} value={values.comicRestorationStatus ?? ""}
                      onChange={(e) => setField("comicRestorationStatus", e.target.value)}>
                      <option value="">—</option>
                      <option>None / Unrestored</option><option>Slight</option>
                      <option>Moderate</option><option>Extensive</option><option>Qualified</option>
                    </select>
                  </Field>
                  <Field label="Holder Type" locked={false} onToggleLock={() => {}}>
                    <select className={inputClass()} value={values.comicHolderType ?? ""}
                      onChange={(e) => setField("comicHolderType", e.target.value)}>
                      <option value="">—</option>
                      <option>Universal</option><option>Signature Series</option>
                      <option>Pedigree</option><option>Conserved</option><option>Restored</option>
                    </select>
                  </Field>
                  <Field label="Census Rank" locked={false} onToggleLock={() => {}}>
                    <input className={inputClass()} value={values.comicCensusRank ?? ""}
                      onChange={(e) => setField("comicCensusRank", e.target.value)}
                      placeholder="e.g., Highest Graded — 1 of 4" />
                  </Field>
                </>)}
              </>)}

              {/* ── Toys fields ───────────────────────────────────── */}
              {values.universe === "POP_CULTURE" && selectedCategory === "Toys" && (<>
                <Field label="Brand / Manufacturer" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.toyBrand ?? ""}
                    onChange={(e) => setField("toyBrand", e.target.value)}
                    placeholder="Hasbro, Mattel, NECA, McFarlane, Hot Toys, Funko…" />
                </Field>
                <Field label="Toy Line / Series" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.toyLine ?? ""}
                    onChange={(e) => setField("toyLine", e.target.value)}
                    placeholder="Marvel Legends, Star Wars Black Series, MOTU…" />
                </Field>
                <Field label="Scale" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.toyScale ?? ""}
                    onChange={(e) => setField("toyScale", e.target.value)}
                    placeholder='1:6, 1:12, 3.75", 6", 12", Life-Size' />
                </Field>
                <Field label="Package Condition" locked={false} onToggleLock={() => {}}>
                  <select className={inputClass()} value={values.toyPackageCondition ?? ""}
                    onChange={(e) => setField("toyPackageCondition", e.target.value)}>
                    <option value="">—</option>
                    <option>MOC (Mint on Card)</option><option>MIB (Mint in Box)</option>
                    <option>MISB (Mint in Sealed Box)</option><option>C-9</option>
                    <option>C-8</option><option>Loose</option>
                  </select>
                </Field>
                <label className="flex min-h-10 items-center gap-3 rounded-xl bg-[color:var(--pill)] px-3 ring-1 ring-[color:var(--border)]">
                  <input type="checkbox" checked={values.toyBoxIncluded === "true"}
                    onChange={(e) => setField("toyBoxIncluded", e.target.checked ? "true" : "")}
                    className="h-4 w-4 rounded accent-[color:var(--theme-gold)]" />
                  <span className="text-sm" style={{ color: "var(--fg)" }}>Box included</span>
                </label>
                <label className="flex min-h-10 items-center gap-3 rounded-xl bg-[color:var(--pill)] px-3 ring-1 ring-[color:var(--border)]">
                  <input type="checkbox" checked={values.toyAccessoriesIncluded === "true"}
                    onChange={(e) => setField("toyAccessoriesIncluded", e.target.checked ? "true" : "")}
                    className="h-4 w-4 rounded accent-[color:var(--theme-gold)]" />
                  <span className="text-sm" style={{ color: "var(--fg)" }}>All accessories / inserts present</span>
                </label>
                <label className="flex min-h-10 items-center gap-3 rounded-xl bg-[color:var(--pill)] px-3 ring-1 ring-[color:var(--border)]">
                  <input type="checkbox" checked={values.toyIsComplete === "true"}
                    onChange={(e) => setField("toyIsComplete", e.target.checked ? "true" : "")}
                    className="h-4 w-4 rounded accent-[color:var(--theme-gold)]" />
                  <span className="text-sm" style={{ color: "var(--fg)" }}>Complete — all parts accounted for</span>
                </label>
              </>)}

              {/* ── Art Cards fields ──────────────────────────────── */}
              {values.universe === "POP_CULTURE" && selectedCategory === "Art Cards" && (<>
                <Field label="Artist" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.artCardArtist ?? ""}
                    onChange={(e) => setField("artCardArtist", e.target.value)}
                    placeholder="Artist name" />
                </Field>
                <Field label="Card Set / Event" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.artCardSet ?? ""}
                    onChange={(e) => setField("artCardSet", e.target.value)}
                    placeholder="SDCC 2024, Artist Alley, Convention sketch…" />
                </Field>
                <Field label="Card Type" locked={false} onToggleLock={() => {}}>
                  <select className={inputClass()} value={values.artCardType ?? ""}
                    onChange={(e) => setField("artCardType", e.target.value)}>
                    <option value="">—</option>
                    <option>Sketch Card</option><option>Artist Proof</option>
                    <option>Limited Print</option><option>Original Art</option>
                  </select>
                </Field>
              </>)}

              {/* ── Art & Prints (Fine Art) fields ────────────────── */}
              {values.universe === "MISC" && selectedCategory === "Art & Prints" && (<>
                <Field label="Medium" locked={false} onToggleLock={() => {}}>
                  <select className={inputClass()} value={values.artMedium ?? ""}
                    onChange={(e) => setField("artMedium", e.target.value)}>
                    <option value="">—</option>
                    <option>Oil on Canvas</option><option>Acrylic on Canvas</option>
                    <option>Watercolor</option><option>Pen &amp; Ink</option><option>Pencil</option>
                    <option>Mixed Media</option><option>Digital Print</option>
                    <option>Screenprint</option><option>Lithograph</option>
                    <option>Etching</option><option>Photography</option><option>Sculpture</option>
                    <option>Other</option>
                  </select>
                </Field>
                <Field label="Surface" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.artSurface ?? ""}
                    onChange={(e) => setField("artSurface", e.target.value)}
                    placeholder="Canvas, Panel, Bristol, Paper, Illustration Board…" />
                </Field>
                <Field label="Width (in)" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.artWidth ?? ""}
                    onChange={(e) => setField("artWidth", e.target.value)} placeholder='e.g., 11"' />
                </Field>
                <Field label="Height (in)" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.artHeight ?? ""}
                    onChange={(e) => setField("artHeight", e.target.value)} placeholder='e.g., 17"' />
                </Field>
                <Field label="Depth (in)" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.artDepth ?? ""}
                    onChange={(e) => setField("artDepth", e.target.value)}
                    placeholder='e.g., 1.5" (optional)' />
                </Field>
                <label className="flex min-h-10 items-center gap-3 rounded-xl bg-[color:var(--pill)] px-3 ring-1 ring-[color:var(--border)]">
                  <input type="checkbox" checked={values.artIsSigned === "true"}
                    onChange={(e) => setField("artIsSigned", e.target.checked ? "true" : "")}
                    className="h-4 w-4 rounded accent-[color:var(--theme-gold)]" />
                  <span className="text-sm" style={{ color: "var(--fg)" }}>Signed by artist</span>
                </label>
                {values.artIsSigned === "true" && (
                  <Field label="Signature Location" locked={false} onToggleLock={() => {}}>
                    <input className={inputClass()} value={values.artSignatureLocation ?? ""}
                      onChange={(e) => setField("artSignatureLocation", e.target.value)}
                      placeholder="Lower right, lower left, verso…" />
                  </Field>
                )}
                <label className="flex min-h-10 items-center gap-3 rounded-xl bg-[color:var(--pill)] px-3 ring-1 ring-[color:var(--border)]">
                  <input type="checkbox" checked={values.artIsFramed === "true"}
                    onChange={(e) => setField("artIsFramed", e.target.checked ? "true" : "")}
                    className="h-4 w-4 rounded accent-[color:var(--theme-gold)]" />
                  <span className="text-sm" style={{ color: "var(--fg)" }}>Framed</span>
                </label>
                <div className="sm:col-span-2">
                  <Field label="Provenance" locked={false} onToggleLock={() => {}}>
                    <textarea className={textareaClass(false)} value={values.artProvenance ?? ""}
                      onChange={(e) => setField("artProvenance", e.target.value)}
                      placeholder="Purchased from gallery / artist directly, collection history…" />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Exhibition History" locked={false} onToggleLock={() => {}}>
                    <textarea className={textareaClass(false)} value={values.artExhibitions ?? ""}
                      onChange={(e) => setField("artExhibitions", e.target.value)}
                      placeholder="Shows, galleries, or publications this piece has appeared in…" />
                  </Field>
                </div>
              </>)}

              {/* ── Watches fields ────────────────────────────────── */}
              {values.universe === "JEWELRY_APPAREL" && selectedCategory === "Watches" && (<>
                <Field label="Brand" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.watchBrand ?? ""}
                    onChange={(e) => setField("watchBrand", e.target.value)}
                    placeholder="Rolex, Patek Philippe, AP, Omega, Seiko…" />
                </Field>
                <Field label="Reference / Model" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.watchReference ?? ""}
                    onChange={(e) => setField("watchReference", e.target.value)}
                    placeholder="116610LN, 5711/1A-010…" />
                </Field>
                <Field label="Movement" locked={false} onToggleLock={() => {}}>
                  <select className={inputClass()} value={values.watchMovement ?? ""}
                    onChange={(e) => setField("watchMovement", e.target.value)}>
                    <option value="">—</option>
                    <option>Automatic</option><option>Manual Wind</option>
                    <option>Quartz</option><option>Solar</option><option>Spring Drive</option>
                  </select>
                </Field>
                <Field label="Case Material" locked={false} onToggleLock={() => {}}>
                  <select className={inputClass()} value={values.watchCaseMaterial ?? ""}
                    onChange={(e) => setField("watchCaseMaterial", e.target.value)}>
                    <option value="">—</option>
                    <option>Stainless Steel</option><option>Yellow Gold</option>
                    <option>White Gold</option><option>Rose Gold</option>
                    <option>Titanium</option><option>Platinum</option><option>Ceramic</option><option>Other</option>
                  </select>
                </Field>
                <Field label="Case Size (mm)" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.watchCaseSize ?? ""}
                    onChange={(e) => setField("watchCaseSize", e.target.value)}
                    placeholder="40mm, 36mm, 41mm…" />
                </Field>
                <Field label="Dial Color" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.watchDialColor ?? ""}
                    onChange={(e) => setField("watchDialColor", e.target.value)}
                    placeholder="Black, Blue, White, Champagne, Green…" />
                </Field>
                <label className="flex min-h-10 items-center gap-3 rounded-xl bg-[color:var(--pill)] px-3 ring-1 ring-[color:var(--border)]">
                  <input type="checkbox" checked={values.watchBox === "true"}
                    onChange={(e) => setField("watchBox", e.target.checked ? "true" : "")}
                    className="h-4 w-4 rounded accent-[color:var(--theme-gold)]" />
                  <span className="text-sm" style={{ color: "var(--fg)" }}>Original box included</span>
                </label>
                <label className="flex min-h-10 items-center gap-3 rounded-xl bg-[color:var(--pill)] px-3 ring-1 ring-[color:var(--border)]">
                  <input type="checkbox" checked={values.watchPapers === "true"}
                    onChange={(e) => setField("watchPapers", e.target.checked ? "true" : "")}
                    className="h-4 w-4 rounded accent-[color:var(--theme-gold)]" />
                  <span className="text-sm" style={{ color: "var(--fg)" }}>Papers / warranty card included</span>
                </label>
                <label className="flex min-h-10 items-center gap-3 rounded-xl bg-[color:var(--pill)] px-3 ring-1 ring-[color:var(--border)]">
                  <input type="checkbox" checked={values.watchFullSet === "true"}
                    onChange={(e) => setField("watchFullSet", e.target.checked ? "true" : "")}
                    className="h-4 w-4 rounded accent-[color:var(--theme-gold)]" />
                  <span className="text-sm" style={{ color: "var(--fg)" }}>Full set (box + papers + all accessories)</span>
                </label>
              </>)}

              {/* ── Bags / Handbags fields ────────────────────────── */}
              {values.universe === "JEWELRY_APPAREL" && selectedCategory === "Bags" && (<>
                <Field label="Brand" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.bagBrand ?? ""}
                    onChange={(e) => setField("bagBrand", e.target.value)}
                    placeholder="Hermès, Chanel, Louis Vuitton, Gucci, Prada…" />
                </Field>
                <Field label="Color" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.bagColor ?? ""}
                    onChange={(e) => setField("bagColor", e.target.value)}
                    placeholder="Black, Togo Étoupe, Rose Gold…" />
                </Field>
                <Field label="Material / Leather" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.bagMaterial ?? ""}
                    onChange={(e) => setField("bagMaterial", e.target.value)}
                    placeholder="Togo, Clemence, Epsom, Canvas, Patent…" />
                </Field>
                <Field label="Hardware" locked={false} onToggleLock={() => {}}>
                  <select className={inputClass()} value={values.bagHardware ?? ""}
                    onChange={(e) => setField("bagHardware", e.target.value)}>
                    <option value="">—</option>
                    <option>Gold Hardware (GHW)</option><option>Silver Hardware (SHW)</option>
                    <option>Palladium Hardware (PHW)</option><option>Rose Gold Hardware (RGHW)</option>
                    <option>Brushed Gold</option><option>Ruthenium</option>
                  </select>
                </Field>
                <label className="flex min-h-10 items-center gap-3 rounded-xl bg-[color:var(--pill)] px-3 ring-1 ring-[color:var(--border)]">
                  <input type="checkbox" checked={values.bagAuthCard === "true"}
                    onChange={(e) => setField("bagAuthCard", e.target.checked ? "true" : "")}
                    className="h-4 w-4 rounded accent-[color:var(--theme-gold)]" />
                  <span className="text-sm" style={{ color: "var(--fg)" }}>Authentication card included</span>
                </label>
                <label className="flex min-h-10 items-center gap-3 rounded-xl bg-[color:var(--pill)] px-3 ring-1 ring-[color:var(--border)]">
                  <input type="checkbox" checked={values.bagDustbag === "true"}
                    onChange={(e) => setField("bagDustbag", e.target.checked ? "true" : "")}
                    className="h-4 w-4 rounded accent-[color:var(--theme-gold)]" />
                  <span className="text-sm" style={{ color: "var(--fg)" }}>Dust bag included</span>
                </label>
                <label className="flex min-h-10 items-center gap-3 rounded-xl bg-[color:var(--pill)] px-3 ring-1 ring-[color:var(--border)]">
                  <input type="checkbox" checked={values.bagBox === "true"}
                    onChange={(e) => setField("bagBox", e.target.checked ? "true" : "")}
                    className="h-4 w-4 rounded accent-[color:var(--theme-gold)]" />
                  <span className="text-sm" style={{ color: "var(--fg)" }}>Original box included</span>
                </label>
              </>)}

              {/* ── Apparel / Streetwear fields ───────────────────── */}
              {values.universe === "JEWELRY_APPAREL" && selectedCategory === "Apparel" && (<>
                <Field label="Size" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.apparelSize ?? ""}
                    onChange={(e) => setField("apparelSize", e.target.value)}
                    placeholder="S, M, L, XL, XXL, 32W 30L, US 10…" />
                </Field>
                <Field label="Colorway" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.apparelColorway ?? ""}
                    onChange={(e) => setField("apparelColorway", e.target.value)}
                    placeholder="Triple White, University Red, Black/Gum…" />
                </Field>
                <label className="flex min-h-10 items-center gap-3 rounded-xl bg-[color:var(--pill)] px-3 ring-1 ring-[color:var(--border)]">
                  <input type="checkbox" checked={values.apparelWorn === "true"}
                    onChange={(e) => setField("apparelWorn", e.target.checked ? "true" : "")}
                    className="h-4 w-4 rounded accent-[color:var(--theme-gold)]" />
                  <span className="text-sm" style={{ color: "var(--fg)" }}>Worn / used</span>
                </label>
              </>)}

              {/* ── Games / Video Games fields ────────────────────── */}
              {values.universe === "GAMES" && selectedCategory === "Video Games" && (<>
                <Field label="Platform" locked={false} onToggleLock={() => {}}>
                  <select className={inputClass()} value={values.gamePlatform ?? ""}
                    onChange={(e) => setField("gamePlatform", e.target.value)}>
                    <option value="">—</option>
                    <option>NES</option><option>SNES</option><option>N64</option><option>GameCube</option>
                    <option>Wii</option><option>Wii U</option><option>Nintendo Switch</option>
                    <option>Game Boy</option><option>GBA</option><option>DS</option><option>3DS</option>
                    <option>Sega Genesis</option><option>Sega Saturn</option><option>Dreamcast</option>
                    <option>PlayStation</option><option>PS2</option><option>PS3</option>
                    <option>PS4</option><option>PS5</option>
                    <option>Xbox</option><option>Xbox 360</option><option>Xbox One</option><option>Xbox Series</option>
                    <option>Atari 2600</option><option>PC</option><option>Other</option>
                  </select>
                </Field>
                <Field label="Region" locked={false} onToggleLock={() => {}}>
                  <select className={inputClass()} value={values.gameRegion ?? ""}
                    onChange={(e) => setField("gameRegion", e.target.value)}>
                    <option value="">—</option>
                    <option>NTSC-U (North America)</option><option>PAL (Europe/Australia)</option>
                    <option>NTSC-J (Japan)</option><option>Other</option>
                  </select>
                </Field>
                <Field label="Publisher" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.gamePublisher ?? ""}
                    onChange={(e) => setField("gamePublisher", e.target.value)}
                    placeholder="Nintendo, Capcom, Konami, Square…" />
                </Field>
                <Field label="Grading Company" locked={false} onToggleLock={() => {}}>
                  <select className={inputClass()} value={values.gameGradingCompany ?? ""}
                    onChange={(e) => setField("gameGradingCompany", e.target.value)}>
                    <option value="">Raw (Ungraded)</option>
                    <option>WATA</option><option>VGA</option><option>CGC</option>
                  </select>
                </Field>
                <label className="flex min-h-10 items-center gap-3 rounded-xl bg-[color:var(--pill)] px-3 ring-1 ring-[color:var(--border)]">
                  <input type="checkbox" checked={values.gameIsSealed === "true"}
                    onChange={(e) => setField("gameIsSealed", e.target.checked ? "true" : "")}
                    className="h-4 w-4 rounded accent-[color:var(--theme-gold)]" />
                  <span className="text-sm" style={{ color: "var(--fg)" }}>Sealed / factory sealed</span>
                </label>
                <label className="flex min-h-10 items-center gap-3 rounded-xl bg-[color:var(--pill)] px-3 ring-1 ring-[color:var(--border)]">
                  <input type="checkbox" checked={values.gameIsCIB === "true"}
                    onChange={(e) => setField("gameIsCIB", e.target.checked ? "true" : "")}
                    className="h-4 w-4 rounded accent-[color:var(--theme-gold)]" />
                  <span className="text-sm" style={{ color: "var(--fg)" }}>CIB (Complete In Box)</span>
                </label>
                <label className="flex min-h-10 items-center gap-3 rounded-xl bg-[color:var(--pill)] px-3 ring-1 ring-[color:var(--border)]">
                  <input type="checkbox" checked={values.gameHasManual === "true"}
                    onChange={(e) => setField("gameHasManual", e.target.checked ? "true" : "")}
                    className="h-4 w-4 rounded accent-[color:var(--theme-gold)]" />
                  <span className="text-sm" style={{ color: "var(--fg)" }}>Manual included</span>
                </label>
              </>)}

              {/* ── Coins & Currency fields ───────────────────────── */}
              {values.universe === "MISC" && selectedCategory === "Coins & Currency" && (<>
                <Field label="Denomination" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.coinDenomination ?? ""}
                    onChange={(e) => setField("coinDenomination", e.target.value)}
                    placeholder="Morgan Dollar, Lincoln Cent, Double Eagle…" />
                </Field>
                <Field label="Country" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.coinCountry ?? ""}
                    onChange={(e) => setField("coinCountry", e.target.value)}
                    placeholder="USA, UK, Germany, Japan…" />
                </Field>
                <Field label="Mint" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.coinMint ?? ""}
                    onChange={(e) => setField("coinMint", e.target.value)}
                    placeholder="Philadelphia, Denver, San Francisco, Carson City…" />
                </Field>
                <Field label="Mint Mark" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.coinMintMark ?? ""}
                    onChange={(e) => setField("coinMintMark", e.target.value)}
                    placeholder="P, D, S, CC, O, W — or none" />
                </Field>
                <Field label="Grading Company" locked={false} onToggleLock={() => {}}>
                  <select className={inputClass()} value={values.coinGradingCompany ?? ""}
                    onChange={(e) => setField("coinGradingCompany", e.target.value)}>
                    <option value="">Raw (Ungraded)</option>
                    <option>PCGS</option><option>NGC</option><option>ANACS</option><option>ICG</option>
                  </select>
                </Field>
                <Field label="Pop / Census" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.coinPopulation ?? ""}
                    onChange={(e) => setField("coinPopulation", e.target.value)}
                    placeholder="e.g., 12 at this grade, 3 finer" />
                </Field>
                <Field label="Error Type" locked={false} onToggleLock={() => {}}>
                  <input className={inputClass()} value={values.coinError ?? ""}
                    onChange={(e) => setField("coinError", e.target.value)}
                    placeholder="Doubled Die, Off-Center, Struck Through… (blank if none)" />
                </Field>
                <label className="flex min-h-10 items-center gap-3 rounded-xl bg-[color:var(--pill)] px-3 ring-1 ring-[color:var(--border)]">
                  <input type="checkbox" checked={values.coinKeyDate === "true"}
                    onChange={(e) => setField("coinKeyDate", e.target.checked ? "true" : "")}
                    className="h-4 w-4 rounded accent-[color:var(--theme-gold)]" />
                  <span className="text-sm" style={{ color: "var(--fg)" }}>Key date / semi-key</span>
                </label>
              </>)}


              <div className="sm:col-span-2 lg:col-span-3">
                <div className="grid gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-medium tracking-[0.14em] text-[color:var(--muted2)]">Notes</label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        title="Auto-fill from filled fields"
                        onClick={() => {
                          const generated = generateNotesSummary(values);
                          if (generated) {
                            setField("notes", generated);
                            setAiFilledFields((prev) => { const n = new Set(prev); n.add("notes"); return n; });
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 transition bg-[color:var(--pill)] text-[color:var(--theme-gold,#F5B548)] ring-[color:var(--border)] hover:ring-[color:var(--theme-gold,#F5B548)]"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v1M18.364 5.636l-.707.707M21 12h-1M18.364 18.364l-.707-.707M12 21v-1M5.636 18.364l.707-.707M3 12h1M5.636 5.636l.707.707"/><circle cx="12" cy="12" r="4"/></svg>
                        Auto
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleLock("notes")}
                        className={[
                          "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 transition",
                          locks.notes
                            ? "bg-[color:var(--pill-active-bg)] text-[color:var(--fg)] ring-[color:var(--pill-active-bg)]"
                            : "bg-[color:var(--pill)] text-[color:var(--muted)] ring-[color:var(--border)]",
                        ].join(" ")}
                        title={locks.notes ? "Locked for next item" : "Unlocked for next item"}
                      >
                        {locks.notes ? (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--theme-gold, #F5B548)" }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        ) : (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--muted)" }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                        )}
                      </button>
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
          <div className="fixed inset-0 z-[80] bg-black/75 p-2 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label="Photo options">
            <div className="mx-auto flex max-h-[calc(100dvh-1rem)] max-w-xl flex-col overflow-hidden rounded-[22px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] sm:max-h-[calc(100dvh-2rem)] sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">ITEM PHOTO</div>
                  <h2 className="mt-1 text-lg font-semibold text-[color:var(--fg)]">Photo Options</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMediaImageId("")}
                  className="rounded-full bg-[color:var(--pill)] px-3 py-2 text-sm ring-1 ring-[color:var(--border)]"
                >
                  Close
                </button>
              </div>

              <div className="mt-3 min-h-0 overflow-hidden rounded-[16px] bg-[color:var(--theme-card)] p-2 ring-1 ring-[color:var(--border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedMediaImage.previewUrl}
                  alt={`${selectedMediaImage.role} item photo`}
                  className="max-h-[52dvh] w-full rounded-[12px] object-contain"
                />
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => selectDraftMediaImageForIdentify(selectedMediaImage.id)}
                  className="min-h-11 rounded-2xl bg-[color:var(--pill-active-bg)] px-4 py-2 text-sm font-medium ring-1 ring-[color:var(--pill-active-bg)]"
                >
                  Use for Identify
                </button>
                <button
                  type="button"
                  onClick={() => openMediaCropEditor(selectedMediaImage.id)}
                  className="min-h-11 rounded-2xl bg-[color:var(--pill)] px-4 py-2 text-sm ring-1 ring-[color:var(--border)]"
                >
                  Edit / Crop
                </button>
                <button
                  type="button"
                  onClick={() => removeDraftMediaImage(selectedMediaImage.id)}
                  className="min-h-11 rounded-2xl bg-red-500/15 px-4 py-2 text-sm text-red-100 ring-1 ring-red-400/25"
                >
                  Delete Photo
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMediaImageId("")}
                  className="min-h-11 rounded-2xl bg-[color:var(--pill)] px-4 py-2 text-sm ring-1 ring-[color:var(--border)]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {mounted && isCropEditorOpen && cropEditorImageUrl && typeof document !== "undefined"
          ? createPortal(
              <div
                className="fixed inset-0 z-[120] flex h-[100dvh] w-[100dvw] items-start justify-center overflow-y-auto bg-black/75 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-sm sm:px-4 sm:py-4"
                role="dialog"
                aria-modal="true"
                aria-label="Edit photo crop"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) setIsCropEditorOpen(false);
                }}
              >
                <div className="w-full max-w-3xl">
                  <div className="flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-[22px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] sm:max-h-[calc(100dvh-2rem)] sm:p-4">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">EDIT PHOTO</div>
                        <h2 className="mt-1 text-lg font-semibold text-[color:var(--fg)]">
                          {cropEditorTarget === "media" ? "Adjust Item Photo" : "Adjust Identify Picture"}
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsCropEditorOpen(false)}
                        className="rounded-full bg-[color:var(--pill)] px-3 py-2 text-sm ring-1 ring-[color:var(--border)]"
                      >
                        Close
                      </button>
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
                        onCancel={() => setIsCropEditorOpen(false)}
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
            ⚠ {duplicateWarning}
          </div>
        ) : null}

        {dropMode && dropSession && !showDropReview ? (
          <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-4 border-t border-[color:var(--border)] bg-[color:var(--surface)] px-5 py-3 shadow-[0_-8px_32px_rgba(0,0,0,0.35)]">
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
            <button
              type="button"
              onClick={endDrop}
              className="rounded-full px-4 py-2 text-sm font-bold"
              style={{ background: "var(--theme-gold, #F5B548)", color: "#0A0800" }}
            >
              Done · Review
            </button>
          </div>
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
