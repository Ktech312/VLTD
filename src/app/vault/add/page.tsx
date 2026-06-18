"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import CameraCapturePanel from "@/components/CameraCapturePanel";
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
    "h-11 rounded-xl px-3 text-sm focus:outline-none transition-all",
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
  const titleInputRef = useRef<HTMLInputElement | null>(null);
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

  const [pricingValues, setPricingValues] = useState<PricingMvpFields>(EMPTY_PRICING_VALUES);

  const [saveScanAsPhoto, setSaveScanAsPhoto] = useState(false);

  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasDraftChanges, setHasDraftChanges] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isBookLookupRunning, setIsBookLookupRunning] = useState(false);
  const [isComicLookupRunning, setIsComicLookupRunning] = useState(false);
  const [isUpcLookupRunning, setIsUpcLookupRunning] = useState(false);
  const [isVisionLookupRunning, setIsVisionLookupRunning] = useState(false);
  const [aiFilledFields, setAiFilledFields] = useState<Set<keyof FormValues>>(new Set());
  const [scanType, setScanType] = useState<ScanItemType>("auto");
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

  // Completeness score for nudge bar
  const completeness = useMemo(() => {
    const hasTitle     = values.title.trim().length > 0;
    const hasPhoto     = draftMediaImages.length > 0;
    const hasGrade     = values.grade.trim().length > 0;
    const hasPrice     = values.purchasePrice.trim().length > 0 || values.currentValue.trim().length > 0;
    const hasSubject   = values.subject.trim().length > 0;
    const hasNotes     = values.notes.trim().length > 0;
    const hasNumber    = values.number.trim().length > 0;
    const hasCert      = values.certNumber.trim().length > 0;
    const fields = [hasTitle, hasPhoto, hasGrade, hasPrice, hasSubject, hasNotes, hasNumber, hasCert];
    const filled = fields.filter(Boolean).length;
    return { pct: Math.round((filled / fields.length) * 100), filled, total: fields.length, hasPhoto, hasGrade, hasPrice };
  }, [values, draftMediaImages]);
  useUnsavedChangesGuard(hasDraftChanges && !isSaving);

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

      apply("title", fields.title);
      apply("subtitle", fields.subtitle);
      apply("number", fields.number);
      apply("grade", fields.grade);
      apply("conditionReason", fields.conditionReason);
      apply("conditionSource", fields.conditionSource);
      apply("certNumber", fields.certNumber);
      apply("universe", fields.universe);
      apply("category", fields.category);
      apply("categoryLabel", fields.categoryLabel);
      apply("subcategoryLabel", fields.subcategoryLabel);
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

  function handleCapturedPhoto(file: File) {
    setIsCameraPanelOpen(false);

    if (cameraTarget === "item") {
      addDraftMediaFiles([file]);
      return;
    }

    addDraftMediaFiles([file]);
    replaceScanImage(file);
    setStatus("Picture added. Run Auto Identify or save the item.");
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
      const regionScan = await scanComicRegionsFromFile(file);
      const fallbackOcr = await runImageScanAutofill(file, "comic");

      const parsed = parseComicScanResult({
        titleRegionText: regionScan.titleText,
        issueRegionText: regionScan.issueText,
        addonText: regionScan.addon,
        fallbackOcrText: fallbackOcr.rawText,
        barcodeDigits: barcodeDigits || regionScan.barcode,
      });
      const fields = {
        title: parsed.title,
        subtitle: parsed.subtitle,
        number: parsed.issueNumber,
        universe: "POP_CULTURE",
        category: "COMICS",
        categoryLabel: "Comics",
        subcategoryLabel: "Comic Book",
        notes: parsed.notes || undefined,
      };

      setScanSession((prev) => {
        let next = prev;

        if (barcodeRawValue || barcodeDigits) {
          next = setScanSessionBarcode(next, barcodeRawValue || "", barcodeDigits || "");
        }

        return setScanSessionReview(next, {
          source: "comic_lookup",
          confidence: parsed.confidence,
          score:
            parsed.confidence === "high"
              ? 88
              : parsed.confidence === "medium"
                ? 62
                : 20,
          safeToAutofill: parsed.confidence !== "low",
          warnings:
            parsed.confidence === "low"
              ? [
                  ...parsed.warnings,
                  "Try a straighter, tighter scan with the title band, issue box, and barcode all visible.",
                ]
              : parsed.warnings,
          rawText: parsed.notes || fallbackOcr.rawText || "",
          fields,
        });
      });

      if (parsed.confidence !== "low") {
        applyScanFieldsToEmpty(fields);
        setScanSession((prev) => markScanSessionApplied(prev));
      }

      setStatus(
        parsed.confidence !== "low"
          ? "Comic scan filled what it could."
          : "Comic scan was weak. Try a better scan or use image identify."
      );

      return parsed.confidence !== "low";
    } catch (error) {
      const message = error instanceof Error ? error.message : "Comic scan failed.";
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

    if (scanType === "card" || scanType === "graded_card") {
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

  async function handleUpcLookup() {
    const manualDigits = String(values.serialNumber ?? "").replace(/\D/g, "").trim();
    if (manualDigits) {
      setStatus("Trying product lookup...");
      await runUpcLookupForCode(manualDigits, manualDigits);
      return;
    }

    if (!scanFile) {
      setStatus("Attach a scan image or enter a serial/barcode first.");
      return;
    }

    setStatus("Trying product lookup...");
    const barcode = await scanBarcodeFromFile(scanFile);
    if (!barcode?.digits) {
      setStatus("No barcode found for product lookup.");
      return;
    }

    await runUpcLookupForCode(barcode.digits, barcode.rawValue);
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

  async function handleBookIsbnLookup() {
    if (!scanFile) {
      setStatus("Take or choose an item picture first.");
      return;
    }

    setStatus("Trying book / ISBN lookup...");
    await runBookLookupForFile(scanFile);
  }

  async function handleComicLookup() {
    if (!scanFile) {
      setStatus("Take or choose an item picture first.");
      return;
    }

    setStatus("Scanning comic regions...");
    const barcode = await scanBarcodeFromFile(scanFile);
    await runComicLookupForFile(scanFile, barcode?.digits, barcode?.rawValue);
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
        // Comics
        comicIssueNumber: (normalizedValues.comicIssueNumber ?? "").trim() || undefined,
        comicCoverVariant: (normalizedValues.comicCoverVariant ?? "").trim() || undefined,
        comicArcTitle: (normalizedValues.comicArcTitle ?? "").trim() || undefined,
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
          ? "Saved to batch. Ready for the next item."
          : saveAndNext
            ? "Saved. Ready for next item."
            : "Saved."
      );
      clearAllImages();
      clearPricing();

      const nextValues = resetUnlockedBulkValues(normalizedValues, locks);
      setValues(nextValues);
      setScanSession((prev) => clearScanSessionReview(prev));
      setAiFilledFields(new Set());
      setHasDraftChanges(false);

      if (saveAndNext) {
        window.setTimeout(() => numberInputRef.current?.focus(), 0);
      }

      if (dropMode) {
        window.setTimeout(() => {
          openCameraFor("scan");
        }, 350);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save item.");
    } finally {
      setIsSaving(false);
    }
  }

  const cropMediaImage = draftMediaImages.find((image) => image.id === cropMediaImageId);
  const selectedMediaImage = draftMediaImages.find((image) => image.id === selectedMediaImageId);
  const cropEditorImageUrl =
    cropEditorTarget === "media" ? cropMediaImage?.previewUrl : scanSession.image?.previewUrl;

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className={`w-full px-4 py-3 sm:px-6 sm:py-4 ${dropMode ? "pb-24" : "pb-20 sm:pb-4"}`}>
        <div className="sticky top-0 z-20 mx-auto mb-3 w-full max-w-5xl rounded-[16px] border border-[color:var(--theme-border)] bg-[color:var(--surface)]/92 p-3 backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">VAULT ADD</div>
              <h1 className="mt-1 text-2xl font-semibold">Add</h1>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/vault/quick"
                className="inline-flex h-10 items-center rounded-full bg-[color:var(--pill)] px-4 text-sm font-medium ring-1 ring-[color:var(--border)]"
              >
                Switch to Quick Add
              </Link>
              <button
                type="button"
                onClick={() => void saveForm(false)}
                disabled={!canSave}
                className="inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 sm:h-10"
                style={{ background: "linear-gradient(135deg, #8B6914, #F5B548)", color: "#0B0B0B", boxShadow: "0 4px 18px rgba(245,181,72,0.28)" }}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          {status ? (
            <div className="mt-3 rounded-xl bg-[color:var(--pill)] px-3 py-2 text-sm ring-1 ring-[color:var(--border)]">
              {status}
            </div>
          ) : null}

          {/* Completeness nudge */}
          {hasDraftChanges && completeness.pct < 100 && (
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="relative h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--pill)" }}>
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                    style={{
                      width: `${completeness.pct}%`,
                      background: completeness.pct >= 75 ? "#4ade80" : completeness.pct >= 50 ? "var(--theme-gold)" : "rgba(245,181,72,0.5)",
                    }}
                  />
                </div>
                <span className="shrink-0 text-[10px] font-semibold tabular-nums" style={{ color: "var(--muted)" }}>
                  {completeness.pct}%
                </span>
              </div>
              {(!completeness.hasPhoto || !completeness.hasGrade) && (
                <div className="flex flex-wrap gap-1.5">
                  {!completeness.hasPhoto && (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(248,113,113,0.12)", color: "#f87171" }}>📷 add photo</span>
                  )}
                  {!completeness.hasGrade && (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(248,113,113,0.12)", color: "#f87171" }}>🏅 add grade</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mb-3 w-full max-w-5xl mx-auto grid gap-3">
          <div className="grid gap-3">
            <div ref={scanStageRef}>
              <ScanPanel
                session={scanSession}
                scanType={scanType}
                isScanning={isScanning}
                isBookLookupRunning={isBookLookupRunning}
                isComicLookupRunning={isComicLookupRunning}
                isUpcLookupRunning={isUpcLookupRunning}
                isVisionLookupRunning={isVisionLookupRunning}
                saveScanAsPhoto={saveScanAsPhoto}
                onScanTypeChange={setScanType}
                onUseCamera={openScanCamera}
                onUploadImage={() => uploadInputRef.current?.click()}
                onScanAutofill={() => void handleScanAutofill()}
                onOpenImage={openActivePhotoOptions}
                onCropImage={openScanCropEditor}
                onBookLookup={() => void handleBookIsbnLookup()}
                onComicLookup={() => void handleComicLookup()}
                onUpcLookup={() => void handleUpcLookup()}
                onClearImage={clearScanImage}
                onToggleSaveScanAsPhoto={handleToggleSaveScanAsPhoto}
                onSaveItem={() => void saveForm(false)}
                canSaveItem={canSave}
                capturedPhotos={draftMediaImages.map((image) => ({
                  id: image.id,
                  previewUrl: image.previewUrl,
                  role: image.role,
                }))}
                activeCapturedPhotoId={activeMediaImageId}
                onSelectCapturedPhoto={setSelectedMediaImageId}
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

                  <Field label="Title" locked={locks.title} onToggleLock={() => handleToggleLock("title")}>
                    <input
                      ref={titleInputRef}
                      className={inputClass(aiFilledFields.has("title"))}
                      value={values.title}
                      onChange={(e) => { setAiFilledFields(prev => { const n = new Set(prev); n.delete("title"); return n; }); setField("title", e.target.value); }}
                      placeholder="Batman"
                    />
                  </Field>
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

              {/* TCG-specific fields */}
              {values.universe === "TCG" && (<>
                <Field label="Parallel Type" locked={false} onToggleLock={() => {}}>
                  <input
                    className={inputClass()}
                    value={values.tcgParallelType ?? ""}
                    onChange={(e) => setField("tcgParallelType", e.target.value)}
                    placeholder="Holo Rare, Rainbow Rare, Gold, Secret Rare…"
                  />
                </Field>
                <Field label="Holo / Foil Type" locked={false} onToggleLock={() => {}}>
                  <input
                    className={inputClass()}
                    value={values.tcgHoloType ?? ""}
                    onChange={(e) => setField("tcgHoloType", e.target.value)}
                    placeholder="Cosmos Holo, Reverse Holo, Cracked Ice…"
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
              </>)}

              {/* Sports-specific fields */}
              {values.universe === "SPORTS" && (<>
                <Field label="Parallel Type" locked={false} onToggleLock={() => {}}>
                  <input
                    className={inputClass()}
                    value={values.sportsParallelType ?? ""}
                    onChange={(e) => setField("sportsParallelType", e.target.value)}
                    placeholder="Prizm Silver, Mosaic Reactive Blue, Refractor…"
                  />
                </Field>
                <Field label="Serial Number" locked={false} onToggleLock={() => {}}>
                  <input
                    className={inputClass()}
                    value={values.sportsSerialNumber ?? ""}
                    onChange={(e) => setField("sportsSerialNumber", e.target.value)}
                    placeholder="/25, /10, 1/1…"
                  />
                </Field>
                <label className="flex min-h-10 items-center gap-3 rounded-xl bg-[color:var(--pill)] px-3 ring-1 ring-[color:var(--border)]">
                  <input
                    type="checkbox"
                    checked={values.sportsIsRelic === "true"}
                    onChange={(e) => setField("sportsIsRelic", e.target.checked ? "true" : "")}
                    className="h-4 w-4 rounded accent-[color:var(--theme-gold)]"
                  />
                  <span className="text-sm" style={{ color: "var(--fg)" }}>Relic / Patch Card</span>
                </label>
                {values.sportsIsRelic === "true" && (
                  <Field label="Relic Description" locked={false} onToggleLock={() => {}}>
                    <input
                      className={inputClass()}
                      value={values.sportsRelicDescription ?? ""}
                      onChange={(e) => setField("sportsRelicDescription", e.target.value)}
                      placeholder="Game-used jersey, 3-color patch…"
                    />
                  </Field>
                )}
                <label className="flex min-h-10 items-center gap-3 rounded-xl bg-[color:var(--pill)] px-3 ring-1 ring-[color:var(--border)]">
                  <input
                    type="checkbox"
                    checked={values.sportsIsAuto === "true"}
                    onChange={(e) => setField("sportsIsAuto", e.target.checked ? "true" : "")}
                    className="h-4 w-4 rounded accent-[color:var(--theme-gold)]"
                  />
                  <span className="text-sm" style={{ color: "var(--fg)" }}>Autograph</span>
                </label>
              </>)}

              {/* Vinyl / Music-specific fields */}
              {values.universe === "MUSIC" && (<>
                <Field label="Pressing" locked={false} onToggleLock={() => {}}>
                  <input
                    className={inputClass()}
                    value={values.vinylPressing ?? ""}
                    onChange={(e) => setField("vinylPressing", e.target.value)}
                    placeholder="Original Press, Reissue, 180g, Limited…"
                  />
                </Field>
                <Field label="Label" locked={false} onToggleLock={() => {}}>
                  <input
                    className={inputClass()}
                    value={values.vinylLabel ?? ""}
                    onChange={(e) => setField("vinylLabel", e.target.value)}
                    placeholder="Blue Note, Impulse!, Motown, Columbia…"
                  />
                </Field>
                <Field label="Speed (RPM)" locked={false} onToggleLock={() => {}}>
                  <select
                    className={inputClass()}
                    value={values.vinylSpeedRpm ?? ""}
                    onChange={(e) => setField("vinylSpeedRpm", e.target.value)}
                  >
                    <option value="">—</option>
                    <option value="33">33 RPM</option>
                    <option value="45">45 RPM</option>
                    <option value="78">78 RPM</option>
                  </select>
                </Field>
                <Field label="Vinyl Color" locked={false} onToggleLock={() => {}}>
                  <input
                    className={inputClass()}
                    value={values.vinylColor ?? ""}
                    onChange={(e) => setField("vinylColor", e.target.value)}
                    placeholder="Black, Clear, Red, Picture Disc…"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Matrix / Runout" locked={false} onToggleLock={() => {}}>
                    <input
                      className={inputClass()}
                      value={values.vinylMatrix ?? ""}
                      onChange={(e) => setField("vinylMatrix", e.target.value)}
                      placeholder="Etched matrix info from the dead wax"
                    />
                  </Field>
                </div>
              </>)}

              {/* Comics-specific fields */}
              {values.universe === "POP_CULTURE" && (<>
                <Field label="Issue Number" locked={false} onToggleLock={() => {}}>
                  <input
                    className={inputClass()}
                    value={values.comicIssueNumber ?? ""}
                    onChange={(e) => setField("comicIssueNumber", e.target.value)}
                    placeholder="#1, Vol 2 #4, Annual #1…"
                  />
                </Field>
                <Field label="Cover Variant" locked={false} onToggleLock={() => {}}>
                  <input
                    className={inputClass()}
                    value={values.comicCoverVariant ?? ""}
                    onChange={(e) => setField("comicCoverVariant", e.target.value)}
                    placeholder="Variant A, Incentive, Sketch, Foil…"
                  />
                </Field>
                <Field label="Arc / Story Title" locked={false} onToggleLock={() => {}}>
                  <input
                    className={inputClass()}
                    value={values.comicArcTitle ?? ""}
                    onChange={(e) => setField("comicArcTitle", e.target.value)}
                    placeholder="The Dark Phoenix Saga, Knightfall…"
                  />
                </Field>
              </>)}

              <div className="sm:col-span-2 lg:col-span-3">
                <Field label="Notes" locked={locks.notes} onToggleLock={() => handleToggleLock("notes")}>
                  <textarea
                    className={textareaClass(aiFilledFields.has("notes"))}
                    value={values.notes}
                    onChange={(e) => { setAiFilledFields(prev => { const n = new Set(prev); n.delete("notes"); return n; }); setField("notes", e.target.value); }}
                    placeholder="Notes, artist, run info, or anything repeated until dedicated fields exist."
                  />
                </Field>
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

        {/* Mobile bottom save bar — only when not in drop mode */}
        {!dropMode && (
          <div
            className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-3 border-t border-[color:var(--border)] px-4 py-3 sm:hidden"
            style={{ background: "var(--surface)", paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            <div className="min-w-0 text-xs truncate" style={{ color: "var(--muted)" }}>
              {values.title
                ? <span className="font-semibold" style={{ color: "var(--fg)" }}>{values.title}</span>
                : <span>No title yet</span>}
            </div>
            <button
              type="button"
              onClick={() => void saveForm(false)}
              disabled={!canSave}
              className="shrink-0 rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #8B6914, #F5B548)", color: "#0B0B0B" }}
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
          </div>
        )}

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
            onClose={() => { setIsCameraPanelOpen(false); router.back(); }}
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
