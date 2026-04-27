"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import BulkLockBar from "@/components/BulkLockBar";
import CameraCapturePanel from "@/components/CameraCapturePanel";
import { type ImageRole } from "@/components/ImageRoleSelector";
import ScanCropEditor from "@/components/ScanCropEditor";
import ScanPanel from "@/components/ScanPanel";
import ScanResultPreview from "@/components/ScanResultPreview";
import { PillButton } from "@/components/ui/PillButton";
import {
  applyBulkLockedValues,
  buildRememberedValues,
  createDefaultBulkAddState,
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
import { buildDuplicateWarning } from "@/lib/duplicateDetector";
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

function inputClass() {
  return "h-10 rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none";
}

function selectClass() {
  return "h-10 rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none";
}

function textareaClass() {
  return "min-h-[78px] rounded-xl bg-[color:var(--pill)] px-3 py-2.5 text-sm ring-1 ring-[color:var(--border)] focus:outline-none";
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

function reviewTitleFromSource(source?: ScanSessionReview["source"]) {
  if (source === "book_lookup") return "BOOK LOOKUP REVIEW";
  if (source === "comic_lookup") return "COMIC LOOKUP REVIEW";
  if (source === "barcode_lookup") return "BARCODE REVIEW";
  if (source === "vision") return "AI IDENTIFY REVIEW";
  return "SCAN REVIEW";
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
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[11px] font-medium tracking-[0.14em] text-[color:var(--muted2)]">
          {label}
        </label>
        <button
          type="button"
          onClick={onToggleLock}
          className={[
            "inline-flex h-6 min-w-[44px] items-center justify-center rounded-full px-2 text-[10px] font-semibold ring-1 transition",
            locked
              ? "bg-[color:var(--pill-active-bg)] text-[color:var(--fg)] ring-[color:var(--pill-active-bg)]"
              : "bg-[color:var(--pill)] text-[color:var(--muted)] ring-[color:var(--border)]",
          ].join(" ")}
          title={locked ? "Locked for next item" : "Unlocked for next item"}
        >
          {locked ? "LOCK" : "OPEN"}
        </button>
      </div>
      {children}
    </div>
  );
}

export default function AddPage() {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const mediaCameraInputRef = useRef<HTMLInputElement | null>(null);
  const numberInputRef = useRef<HTMLInputElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const scanStageRef = useRef<HTMLDivElement | null>(null);
  const reviewRef = useRef<HTMLDivElement | null>(null);
  const mediaImagesRef = useRef<DraftMediaImage[]>([]);

  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);
  const [locks, setLocks] = useState<BulkAddLocks>({ ...DEFAULT_BULK_ADD_LOCKS });

  const [scanSession, setScanSession] = useState<ScanSessionState>(createScanSession());
  const [scanFile, setScanFile] = useState<File | null>(null);
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

  const [pricingValues, setPricingValues] = useState<PricingMvpFields>(EMPTY_PRICING_VALUES);

  const [saveScanAsPhoto, setSaveScanAsPhoto] = useState(false);

  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isBookLookupRunning, setIsBookLookupRunning] = useState(false);
  const [isComicLookupRunning, setIsComicLookupRunning] = useState(false);
  const [isUpcLookupRunning, setIsUpcLookupRunning] = useState(false);
  const [isVisionLookupRunning, setIsVisionLookupRunning] = useState(false);
  const [scanType, setScanType] = useState<ScanItemType>("auto");
  const [existingItems, setExistingItems] = useState<VaultItem[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState("");

  useEffect(() => {
    const state = readBulkAddState();
    setLocks(state.locks);
    setValues(applyBulkLockedValues(undefined, state.rememberedValues, state.locks));
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
    return () => {
      mediaImagesRef.current.forEach((image) => {
        if (image.previewUrl.startsWith("blob:")) {
          revokeImageObjectUrl(image.previewUrl);
        }
      });
    };
  }, []);

  useEffect(() => {
    setDuplicateWarning(
      buildDuplicateWarning(
        {
          title: values.title,
          number: values.number,
          certNumber: values.certNumber,
        },
        existingItems
      )
    );
  }, [existingItems, values.certNumber, values.number, values.title]);

  useEffect(() => {
    if (!scanSession.review) return;
    window.setTimeout(() => {
      reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, [scanSession.review]);

  const canSave = useMemo(() => values.title.trim().length > 0 && !isSaving, [values.title, isSaving]);
  const hasDraftProgress = useMemo(() => {
    const hasFormValues = Object.values(values).some((value) => String(value ?? "").trim().length > 0);
    const hasPricingValues = Object.values(pricingValues).some((value) =>
      String(value ?? "").trim().length > 0
    );

    return (
      hasFormValues ||
      hasPricingValues ||
      Boolean(scanFile || scanSession.image || scanSession.review || isCropEditorOpen) ||
      draftMediaImages.length > 0
    );
  }, [draftMediaImages.length, isCropEditorOpen, pricingValues, scanFile, scanSession.image, scanSession.review, values]);

  useUnsavedChangesGuard(hasDraftProgress && !isSaving);

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

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function setUniverse(nextUniverse: UniverseKey) {
    const nextCategory = getDefaultCategory(nextUniverse);
    setValues((prev) => ({
      ...prev,
      universe: nextUniverse,
      category: categoryCode(nextCategory),
      categoryLabel: nextCategory,
      subcategoryLabel: "",
    }));
  }

  function setCategoryLabel(nextCategory: string) {
    setValues((prev) => ({
      ...prev,
      category: categoryCode(nextCategory),
      categoryLabel: nextCategory,
      subcategoryLabel: "",
    }));
  }

  function handleToggleLock(key: BulkAddFieldKey) {
    setLocks((prev) => toggleBulkAddLock(prev, key));
  }

  function handleLockAll() {
    const next = createDefaultBulkAddState().locks;
    (Object.keys(next) as BulkAddFieldKey[]).forEach((key) => {
      next[key] = true;
    });
    setLocks(next);
  }

  function handleUnlockAll() {
    const next = createDefaultBulkAddState().locks;
    (Object.keys(next) as BulkAddFieldKey[]).forEach((key) => {
      next[key] = false;
    });
    setLocks(next);
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
    setIsCameraPanelOpen(true);
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
        setScanSession((prev) =>
          setScanSessionReview(prev, {
            source: "book_lookup",
            confidence: "medium",
            score: 45,
            safeToAutofill: true,
            warnings: ["ISBN found, but no metadata source returned a book match."],
            rawText: rawText || `ISBN detected: ${isbn}`,
            fields: {
              serialNumber: isbn,
            },
          })
        );
        setStatus("ISBN found, but no metadata was returned.");
        return false;
      }

      const notes = book.notes || `ISBN: ${book.isbn}`;

      setScanSession((prev) =>
        setScanSessionReview(prev, {
          source: "book_lookup",
          confidence: "high",
          score: 92,
          safeToAutofill: true,
          warnings: [],
          rawText: rawText || `ISBN detected: ${book.isbn}`,
          fields: {
            title: book.title,
            subtitle: book.subtitle || "",
            universe: "POP_CULTURE",
            category: "BOOKS",
            categoryLabel: "Books",
            subcategoryLabel: "Book",
            serialNumber: book.isbn,
            notes,
          },
        })
      );

      setStatus("Book metadata found. Review and apply.");
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
          fields: {
            title: parsed.title,
            subtitle: parsed.subtitle,
            number: parsed.issueNumber,
            universe: "POP_CULTURE",
            category: "COMICS",
            categoryLabel: "Comics",
            subcategoryLabel: "Comic Book",
            notes: parsed.notes || undefined,
          },
        });
      });

      setStatus(
        parsed.confidence !== "low"
          ? "Comic scan complete. Review and apply."
          : "Comic scan was weak. Review and try a better scan."
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
              ? ["Catalog product lookup matched. Review the title and category before applying."]
              : [],
          rawText: [
            `Barcode detected: ${digits}`,
            `Lookup source: ${result.source}`,
            result.notes || "",
          ]
            .filter(Boolean)
            .join("\n"),
          fields: {
            title: result.title,
            subtitle: result.subtitle || "",
            serialNumber: result.code,
            universe: result.universe || "",
            category: result.source === "openlibrary" ? "BOOKS" : "PRODUCTS",
            categoryLabel: result.categoryLabel || "",
            subcategoryLabel: result.subcategoryLabel || "",
            notes: result.notes || "",
          },
        });
      });

      setStatus(
        result.source === "openlibrary"
          ? "Book lookup found. Review and apply."
          : "Product lookup found. Review and apply."
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

      setStatus(
        result.quality.safeToAutofill
          ? "Text scan found something useful. Review and apply."
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
      });

      const safeToAutofill =
        vision.confidence >= 0.45 && Boolean(String(vision.detectedTitle ?? "").trim());

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
          rawText: vision.notes || `AI detected: ${vision.detectedTitle} (${vision.detectedCategory})`,
          fields: {
            title: vision.detectedTitle,
            subtitle: vision.subtitle,
            number: vision.number,
            grade: vision.grade,
            certNumber: vision.certNumber,
            universe: vision.universe,
            categoryLabel: vision.categoryLabel || vision.detectedCategory,
            subcategoryLabel: vision.subcategoryLabel,
            notes: vision.notes,
          },
        })
      );

      setStatus(
        safeToAutofill
          ? "Image identify found a likely match. Review and apply."
          : "Image identify was not confident. Review before applying anything."
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

  function requestCloseCropEditor() {
    if (!isDefaultCrop(scanCrop)) {
      const ok = window.confirm("Discard unsaved photo crop changes?");
      if (!ok) return;
    }
    setIsCropEditorOpen(false);
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

  function applyScanReview(mode: "all" | "emptyOnly") {
    const review = scanSession.review;
    if (!review) return;
    if (mode === "all" && (!review.safeToAutofill || review.confidence === "low")) return;

    setValues((prev) => {
      const next = { ...prev };
      const fields = review.fields;

      const apply = (key: keyof FormValues, value?: string) => {
        if (!value) return;
        if (mode === "emptyOnly" && String(next[key] ?? "").trim()) return;
        next[key] = value;
      };

      apply("title", fields.title);
      apply("subtitle", fields.subtitle);
      apply("number", fields.number);
      apply("grade", fields.grade);
      apply("certNumber", fields.certNumber);
      apply("universe", fields.universe);
      apply("category", fields.category);
      apply("categoryLabel", fields.categoryLabel);
      apply("subcategoryLabel", fields.subcategoryLabel);
      apply("serialNumber", fields.serialNumber);
      apply("notes", fields.notes);

      return normalizeHierarchy(next);
    });

    setScanSession((prev) => markScanSessionApplied(prev));
    setStatus(mode === "all" ? "Scan fields applied." : "Scan fields applied to empty fields only.");
    window.setTimeout(() => {
      titleInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      titleInputRef.current?.focus();
    }, 60);
  }

  function resetUnlockedFields() {
    const nextValues = resetUnlockedBulkValues(normalizeHierarchy(values), locks);
    setValues(nextValues);
    clearAllImages();
    clearPricing();
    setStatus("Unlocked fields reset.");
    window.setTimeout(() => numberInputRef.current?.focus(), 0);
  }

  function resetAll() {
    setValues({ ...EMPTY_VALUES });
    setLocks({ ...DEFAULT_BULK_ADD_LOCKS });
    clearAllImages();
    clearPricing();
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
    setIsPreparingImage(Boolean(draftMediaImages.length || (scanFile && saveScanAsPhoto)));

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
        purchasePrice,
        currentValue,
        universe: normalizedValues.universe.trim() || "MISC",
        category: normalizedValues.category.trim() || undefined,
        categoryLabel: normalizedValues.categoryLabel.trim() || undefined,
        subcategoryLabel: normalizedValues.subcategoryLabel.trim() || undefined,
        storageLocation: normalizedValues.storageLocation.trim() || undefined,
        purchaseSource: normalizedValues.purchaseSource.trim() || undefined,
        purchaseLocation: normalizedValues.purchaseLocation.trim() || undefined,
        certNumber: normalizedValues.certNumber.trim() || undefined,
        serialNumber: normalizedValues.serialNumber.trim() || undefined,
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

      setStatus(saveAndNext ? "Saved. Ready for next item." : "Saved.");
      clearAllImages();
      clearPricing();

      if (saveAndNext) {
        const nextValues = resetUnlockedBulkValues(normalizedValues, locks);
        setValues(nextValues);
        window.setTimeout(() => numberInputRef.current?.focus(), 0);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save item.");
    } finally {
      setIsSaving(false);
      setIsPreparingImage(false);
    }
  }

  const cropMediaImage = draftMediaImages.find((image) => image.id === cropMediaImageId);
  const selectedMediaImage = draftMediaImages.find((image) => image.id === selectedMediaImageId);
  const cropEditorImageUrl =
    cropEditorTarget === "media" ? cropMediaImage?.previewUrl : scanSession.image?.previewUrl;

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-[1500px] px-3 py-3 sm:px-4 sm:py-4">
        <div className="sticky top-0 z-20 mb-3 rounded-[16px] border border-white/8 bg-[color:var(--surface)]/92 p-3 backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">VAULT ADD</div>
              <h1 className="mt-1 text-2xl font-semibold">Fast Entry</h1>
              <div className="mt-1 text-sm text-[color:var(--muted)]">
                Capture item pictures, identify from the best one, then save the item.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Link
                href="/vault"
                className="inline-flex h-10 items-center rounded-full bg-[color:var(--pill)] px-4 text-sm font-medium ring-1 ring-[color:var(--border)]"
              >
                Vault
              </Link>
              <Link
                href="/vault/quick"
                className="inline-flex h-10 items-center rounded-full bg-[color:var(--pill)] px-4 text-sm font-medium ring-1 ring-[color:var(--border)]"
              >
                Quick Add
              </Link>
              <PillButton onClick={() => void saveForm(false)} disabled={!canSave}>
                {isSaving && !isPreparingImage ? "Saving..." : "Save"}
              </PillButton>
              <PillButton variant="primary" onClick={() => void saveForm(true)} disabled={!canSave}>
                {isSaving ? "Saving..." : "Save & Next"}
              </PillButton>
              <PillButton onClick={resetUnlockedFields} disabled={isSaving}>
                Reset Unlocked
              </PillButton>
              <PillButton onClick={resetAll} disabled={isSaving}>
                Reset All
              </PillButton>
            </div>
          </div>

          {status ? (
            <div className="mt-3 rounded-xl bg-[color:var(--pill)] px-3 py-2 text-sm ring-1 ring-[color:var(--border)]">
              {status}
            </div>
          ) : null}
        </div>

        <div className="mb-3 grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_360px]">
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
                onUseCamera={() => openCameraFor("scan")}
                onUploadImage={() => uploadInputRef.current?.click()}
                onScanAutofill={() => void handleScanAutofill()}
                onCropImage={openScanCropEditor}
                onBookLookup={() => void handleBookIsbnLookup()}
                onComicLookup={() => void handleComicLookup()}
                onUpcLookup={() => void handleUpcLookup()}
                onClearImage={clearScanImage}
                onToggleSaveScanAsPhoto={setSaveScanAsPhoto}
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
                <div className="text-[11px] font-semibold tracking-[0.18em] text-[color:var(--muted2)]">
                  BASIC ITEM RECORD
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                  <Field label="Universe" locked={locks.universe} onToggleLock={() => handleToggleLock("universe")}>
                    <select
                      className={selectClass()}
                      value={selectedUniverse}
                      onChange={(e) => setUniverse(safeUniverse(e.target.value))}
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
                      className={selectClass()}
                      value={selectedCategory}
                      onChange={(e) => setCategoryLabel(e.target.value)}
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
                        className={selectClass()}
                        value={values.subcategoryLabel}
                        onChange={(e) => setField("subcategoryLabel", e.target.value)}
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
                        className={inputClass()}
                        value={values.subcategoryLabel}
                        onChange={(e) => setField("subcategoryLabel", e.target.value)}
                        placeholder="Optional"
                      />
                    )}
                  </Field>

                  <Field label="Title" locked={locks.title} onToggleLock={() => handleToggleLock("title")}>
                    <div className="grid gap-2">
                      <input
                        ref={titleInputRef}
                        className={inputClass()}
                        value={values.title}
                        onChange={(e) => setField("title", e.target.value)}
                        placeholder="Batman"
                      />
                      {duplicateWarning ? (
                        <div className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-400/20">
                          {duplicateWarning}
                        </div>
                      ) : null}
                    </div>
                  </Field>
                </div>
              </div>

          </div>

          <div ref={reviewRef} className="grid gap-3 content-start">
            {scanSession.review ? (
              <ScanResultPreview
                review={scanSession.review}
                title={reviewTitleFromSource(scanSession.review?.source)}
                onApplyEmptyOnly={() => applyScanReview("emptyOnly")}
                onApplyAll={() => applyScanReview("all")}
                onCancel={() => setScanSession((prev) => clearScanSessionReview(prev))}
              />
            ) : (
              <section className="rounded-[16px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
                <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">SCAN REVIEW</div>
                <div className="mt-2 text-sm text-[color:var(--muted)]">
                  Run Auto Identify and the review will appear here.
                </div>
              </section>
            )}
          </div>
        </div>

        <div className="mb-3">
          <BulkLockBar
            locks={locks}
            onToggleLock={handleToggleLock}
            onLockAll={handleLockAll}
            onUnlockAll={handleUnlockAll}
          />
        </div>

        <section className="rounded-[16px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              <Field label="Subtitle / Set" locked={locks.subtitle} onToggleLock={() => handleToggleLock("subtitle")}>
                <input
                  className={inputClass()}
                  value={values.subtitle}
                  onChange={(e) => setField("subtitle", e.target.value)}
                  placeholder="Series / set / run"
                />
              </Field>

              <Field label="Number / Issue" locked={locks.number} onToggleLock={() => handleToggleLock("number")}>
                <input
                  ref={numberInputRef}
                  className={inputClass()}
                  value={values.number}
                  onChange={(e) => setField("number", e.target.value)}
                  placeholder="#129"
                />
              </Field>

              <Field label="Grade" locked={locks.grade} onToggleLock={() => handleToggleLock("grade")}>
                <input
                  className={inputClass()}
                  value={values.grade}
                  onChange={(e) => setField("grade", e.target.value)}
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

              <Field label="Cert #" locked={locks.certNumber} onToggleLock={() => handleToggleLock("certNumber")}>
                <input
                  className={inputClass()}
                  value={values.certNumber}
                  onChange={(e) => setField("certNumber", e.target.value)}
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

              <div className="lg:col-span-2 xl:col-span-3">
                <Field label="Notes" locked={locks.notes} onToggleLock={() => handleToggleLock("notes")}>
                  <textarea
                    className={textareaClass()}
                    value={values.notes}
                    onChange={(e) => setField("notes", e.target.value)}
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
          capture="environment"
          className="hidden"
          onChange={(e) => void handleMediaImageSelection(e.target.files)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
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

              <div className="mt-3 min-h-0 overflow-hidden rounded-[16px] bg-black/30 p-2 ring-1 ring-[color:var(--border)]">
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

        {isCropEditorOpen && cropEditorImageUrl ? (
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-black/75 px-2 py-3 backdrop-blur-sm sm:px-4 sm:py-4"
            role="dialog"
            aria-modal="true"
            aria-label="Edit photo crop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) requestCloseCropEditor();
            }}
          >
            <div className="w-full max-w-3xl">
              <ScanCropEditor
                imageUrl={cropEditorImageUrl}
                crop={scanCrop}
                onChange={setScanCrop}
                title={cropEditorTarget === "media" ? "ADJUST ITEM PHOTO" : "ADJUST IDENTIFY PICTURE"}
                description="Drag the photo to frame it. Pinch to zoom. Pull any white edge or corner to crop each side."
                applyLabel={cropEditorTarget === "media" ? "Save Photo" : "Use This Picture"}
                onApply={() => void handleApplyCropEditor()}
                onReset={() => setScanCrop(DEFAULT_SCAN_CROP)}
                onCancel={requestCloseCropEditor}
                isApplying={isApplyingCrop}
                compact
              />
            </div>
          </div>
        ) : null}

        {isCameraPanelOpen ? (
          <CameraCapturePanel
            title={cameraTarget === "scan" ? "Capture Item Picture" : "Capture Item Photo"}
            description={
              cameraTarget === "scan"
                ? "Take an item picture. It will be added to this item and used for identify/autofill."
                : "Capture a real item photo and add it to this item's saved photo list."
            }
            onCapture={handleCapturedPhoto}
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
