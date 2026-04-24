"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import BulkLockBar from "@/components/BulkLockBar";
import CameraCapturePanel from "@/components/CameraCapturePanel";
import ImageRoleSelector, { type ImageRole } from "@/components/ImageRoleSelector";
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
import { parseComicScanResult, scanComicRegionsFromFile } from "@/lib/scanners/comicParser";
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
import { emitVaultUpdate } from "@/lib/vaultEvents";
import { appendItems, type VaultImage, type VaultItem } from "@/lib/vaultModel";
import { enqueueVaultItemSync, processVaultSyncQueue } from "@/lib/vaultSyncQueue";
import { hasSupabaseEnv, uploadVaultImageToSupabase } from "@/lib/vaultCloud";
import {
  runImageScanAutofill,
  type ScanItemType,
} from "@/lib/scanAutofill";
import {
  generateVaultImageKey,
  prepareImageBlob,
  revokeImageObjectUrl,
  saveImageBlobToIndexedDb,
} from "@/lib/vaultImageStore";

const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";

type FormValues = BulkAddValues;

const EMPTY_VALUES: FormValues = { ...EMPTY_BULK_ADD_VALUES };

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

function reviewTitleFromSource(source?: ScanSessionReview["source"]) {
  if (source === "book_lookup") return "BOOK LOOKUP REVIEW";
  if (source === "comic_lookup") return "COMIC LOOKUP REVIEW";
  if (source === "barcode_lookup") return "BARCODE REVIEW";
  return "SCAN REVIEW";
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

  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);
  const [locks, setLocks] = useState<BulkAddLocks>({ ...DEFAULT_BULK_ADD_LOCKS });

  const [scanSession, setScanSession] = useState<ScanSessionState>(createScanSession());
  const [scanFile, setScanFile] = useState<File | null>(null);

  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string>("");
  const [mediaImageRole, setMediaImageRole] = useState<ImageRole>("primary");
  const [cameraTarget, setCameraTarget] = useState<"scan" | "item">("scan");
  const [isCameraPanelOpen, setIsCameraPanelOpen] = useState(false);

  const [saveScanAsPhoto, setSaveScanAsPhoto] = useState(false);

  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isBookLookupRunning, setIsBookLookupRunning] = useState(false);
  const [isComicLookupRunning, setIsComicLookupRunning] = useState(false);
  const [scanType, setScanType] = useState<ScanItemType>("auto");

  useEffect(() => {
    const state = readBulkAddState();
    setLocks(state.locks);
    setValues(applyBulkLockedValues(undefined, state.rememberedValues, state.locks));
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
    return () => {
      if (mediaPreviewUrl.startsWith("blob:")) revokeImageObjectUrl(mediaPreviewUrl);
    };
  }, [mediaPreviewUrl]);

  const canSave = useMemo(() => values.title.trim().length > 0 && !isSaving, [values.title, isSaving]);

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
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
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (uploadInputRef.current) uploadInputRef.current.value = "";
  }

  function clearMediaImage() {
    if (mediaPreviewUrl.startsWith("blob:")) revokeImageObjectUrl(mediaPreviewUrl);
    setMediaFile(null);
    setMediaPreviewUrl("");
    setMediaImageRole("primary");
    if (mediaInputRef.current) mediaInputRef.current.value = "";
    if (mediaCameraInputRef.current) mediaCameraInputRef.current.value = "";
  }

  function clearAllImages() {
    clearScanImage();
    clearMediaImage();
  }

  function openCameraFor(target: "scan" | "item") {
    setCameraTarget(target);
    setIsCameraPanelOpen(true);
  }

  function handleCapturedPhoto(file: File) {
    setIsCameraPanelOpen(false);

    if (cameraTarget === "item") {
      if (mediaPreviewUrl.startsWith("blob:")) revokeImageObjectUrl(mediaPreviewUrl);
      setMediaFile(file);
      setMediaPreviewUrl(URL.createObjectURL(file));
      setStatus("Item photo captured. It will save with this invited item.");
      return;
    }

    void handleScanImageSelection({
      0: file,
      length: 1,
      item: (index: number) => (index === 0 ? file : null),
    } as unknown as FileList);
  }

  async function handleScanImageSelection(fileList: FileList | null) {
  const file = fileList?.[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    setStatus("That scan file is not an image.");
    return;
  }

  const oldPreview = scanSession.image?.previewUrl ?? "";
  if (oldPreview.startsWith("blob:")) revokeImageObjectUrl(oldPreview);

  const previewUrl = URL.createObjectURL(file);

  setScanFile(file);

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

  setStatus("Scanning barcode...");

  try {
    const barcode = await scanBarcodeFromFile(file);

    if (barcode?.digits) {
      setScanSession((prev) =>
        setScanSessionBarcode(prev, barcode.rawValue, barcode.digits)
      );

      setStatus(`Barcode detected: ${barcode.digits}`);

      if (scanType === "book") {
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
            return;
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
            return;
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
          return;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Book lookup failed.";
          setScanSession((prev) => markScanSessionFailed(prev, message));
          setStatus(message);
          return;
        } finally {
          setIsBookLookupRunning(false);
        }
      }

      if (scanType === "comic") {
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
            barcodeDigits: barcode.digits || regionScan.barcode,
          });

          setScanSession((prev) => {
            let next = prev;
            if (barcode.rawValue || barcode.digits) {
              next = setScanSessionBarcode(next, barcode.rawValue, barcode.digits);
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
          return;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Comic scan failed.";
          setScanSession((prev) => markScanSessionFailed(prev, message));
          setStatus(message);
          return;
        } finally {
          setIsComicLookupRunning(false);
        }
      }

      setScanSession((prev) =>
        setScanSessionReview(prev, {
          source: "barcode_lookup",
          confidence: "high",
          score: 80,
          safeToAutofill: true,
          warnings: [],
          rawText: `Barcode detected: ${barcode.digits}`,
          fields: {
            serialNumber: barcode.digits,
          },
        })
      );

      setStatus(`Barcode detected: ${barcode.digits}`);
      return;
    }

    setStatus("No barcode found. Ready for OCR scan.");
  } catch (err) {
    console.error("Barcode scan failed:", err);
    setStatus("Barcode scan failed. You can still run OCR.");
  }
}

  async function handleMediaImageSelection(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setStatus("That media file is not an image.");
      return;
    }

    if (mediaPreviewUrl.startsWith("blob:")) revokeImageObjectUrl(mediaPreviewUrl);

    setMediaFile(file);
    setMediaPreviewUrl(URL.createObjectURL(file));
    setStatus("Item media photo attached.");
  }

  async function handleScanAutofill() {
    if (!scanFile) {
      setStatus("Attach a temporary scan image first.");
      return;
    }

    setIsScanning(true);
    setScanSession((prev) => markScanSessionScanning(prev));
    setStatus("Scanning image for text...");

    try {
      const result = await runImageScanAutofill(scanFile, scanType);
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
          ? "Scan complete. Review and apply the extracted fields."
          : "Low-confidence scan. Review raw OCR and try a better image."
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Scan failed.";
      setScanSession((prev) => markScanSessionFailed(prev, message));
      setStatus(message);
    } finally {
      setIsScanning(false);
    }
  }

  async function handleBookIsbnLookup() {
    if (!scanFile) {
      setStatus("Attach a temporary scan image first.");
      return;
    }

    setIsBookLookupRunning(true);
    setScanSession((prev) => markScanSessionScanning(prev));
    setStatus("Trying barcode / ISBN lookup...");

    try {
      let isbn = await detectBookIsbnFromFile(scanFile);
      let rawText = "";

      if (!isbn) {
        setStatus("No barcode detected. Falling back to OCR ISBN extraction...");
        const ocr = await runImageScanAutofill(scanFile, "book");
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
        return;
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
        return;
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Book lookup failed.";
      setScanSession((prev) => markScanSessionFailed(prev, message));
      setStatus(message);
    } finally {
      setIsBookLookupRunning(false);
    }
  }

  async function handleComicLookup() {
    if (!scanFile) {
      setStatus("Attach a temporary scan image first.");
      return;
    }

    setIsComicLookupRunning(true);
    setScanSession((prev) => markScanSessionScanning(prev));
    setStatus("Scanning comic regions...");

    try {
      const regionScan = await scanComicRegionsFromFile(scanFile);
      const fallbackOcr = await runImageScanAutofill(scanFile, "comic");
      const barcode = await scanBarcodeFromFile(scanFile);

      const parsed = parseComicScanResult({
        titleRegionText: regionScan.titleText,
        issueRegionText: regionScan.issueText,
        addonText: regionScan.addon,
        fallbackOcrText: fallbackOcr.rawText,
        barcodeDigits: barcode?.digits || regionScan.barcode,
      });

      setScanSession((prev) => {
        let next = prev;
        if (barcode?.rawValue || barcode?.digits) {
          next = setScanSessionBarcode(next, barcode.rawValue, barcode.digits);
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Comic scan failed.";
      setScanSession((prev) => markScanSessionFailed(prev, message));
      setStatus(message);
    } finally {
      setIsComicLookupRunning(false);
    }
  }

  function applyScanReview(mode: "all" | "emptyOnly") {
    const review = scanSession.review;
    if (!review || !review.safeToAutofill) return;

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

      return next;
    });

    setScanSession((prev) => markScanSessionApplied(prev));
    setStatus(mode === "all" ? "Scan fields applied." : "Scan fields applied to empty fields only.");
  }

  function resetUnlockedFields() {
    const nextValues = resetUnlockedBulkValues(values, locks);
    setValues(nextValues);
    clearAllImages();
    setStatus("Unlocked fields reset.");
    window.setTimeout(() => numberInputRef.current?.focus(), 0);
  }

  function resetAll() {
    setValues({ ...EMPTY_VALUES });
    setLocks({ ...DEFAULT_BULK_ADD_LOCKS });
    clearAllImages();
    setStatus("Form reset.");
  }

  async function saveForm(saveAndNext: boolean) {
    const trimmedTitle = values.title.trim();
    if (!trimmedTitle) {
      setStatus("Title / Series is required.");
      return;
    }

    setIsSaving(true);
    setIsPreparingImage(Boolean(mediaFile || (scanFile && saveScanAsPhoto)));

    try {
      const now = Date.now();
      const id = newId();
      const activeProfileId = getActiveProfileId();

      let primaryImageKey: string | undefined;
      let images: VaultImage[] | undefined;
      let imageFrontUrl: string | undefined;
      let imageFrontStoragePath: string | undefined;

      const fileToPersist = mediaFile || (saveScanAsPhoto ? scanFile : null);
      const previewToPersist =
        mediaPreviewUrl || (saveScanAsPhoto ? scanSession.image?.previewUrl ?? "" : "");

      const persistedRole: ImageRole = mediaFile
        ? mediaImageRole
        : saveScanAsPhoto
          ? "proof"
          : "primary";

      if (fileToPersist) {
        const durableBlob = await prepareImageBlob(fileToPersist);

        if (navigator.onLine && hasSupabaseEnv()) {
          const uploaded = await uploadVaultImageToSupabase({
            itemId: id,
            file: durableBlob,
            fileName: fileToPersist.name || "image.jpg",
          });

          primaryImageKey = uploaded.path;
          imageFrontUrl = uploaded.publicUrl;
          imageFrontStoragePath = uploaded.path;

          images = [
            {
              id: `${id}_img_0`,
              storageKey: uploaded.path,
              url: uploaded.publicUrl,
              order: 0,
              localOnly: false,
              role: persistedRole,
            },
          ];
        } else {
          primaryImageKey = generateVaultImageKey(id, 0);
          await saveImageBlobToIndexedDb(durableBlob, primaryImageKey);

          images = [
            {
              id: `${id}_img_0`,
              storageKey: primaryImageKey,
              order: 0,
              localOnly: true,
              role: persistedRole,
            },
          ];

          imageFrontUrl = previewToPersist || undefined;
          imageFrontStoragePath = primaryImageKey;
        }
      }

      const purchasePrice = parseMoney(values.purchasePrice);
      const currentValue = parseMoney(values.currentValue) ?? purchasePrice;

      const item: VaultItem = {
        id,
        profile_id: activeProfileId || undefined,
        title: trimmedTitle,
        subtitle: values.subtitle.trim() || undefined,
        number: values.number.trim() || undefined,
        grade: values.grade.trim() || undefined,
        purchasePrice,
        currentValue,
        universe: values.universe.trim() || undefined,
        category: values.category.trim() || undefined,
        categoryLabel: values.categoryLabel.trim() || undefined,
        subcategoryLabel: values.subcategoryLabel.trim() || undefined,
        storageLocation: values.storageLocation.trim() || undefined,
        purchaseSource: values.purchaseSource.trim() || undefined,
        purchaseLocation: values.purchaseLocation.trim() || undefined,
        certNumber: values.certNumber.trim() || undefined,
        serialNumber: values.serialNumber.trim() || undefined,
        notes: values.notes.trim() || undefined,
        primaryImageKey,
        images,
        imageFrontUrl,
        imageFrontStoragePath,
        createdAt: now,
        isNew: true,
      };

      appendItems([item]);
      enqueueVaultItemSync(item.id);
      emitVaultUpdate();
      await processVaultSyncQueue();

      setStatus(saveAndNext ? "Saved. Ready for next item." : "Saved.");
      clearAllImages();

      if (saveAndNext) {
        const nextValues = resetUnlockedBulkValues(values, locks);
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

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-[1500px] px-3 py-3 sm:px-4 sm:py-4">
        <div className="sticky top-0 z-20 mb-3 rounded-[16px] border border-white/8 bg-[color:var(--surface)]/92 p-3 backdrop-blur">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">VAULT ADD</div>
              <h1 className="mt-1 text-2xl font-semibold">Fast Entry</h1>
              <div className="mt-1 text-sm text-[color:var(--muted)]">
                Temporary scan image for autofill. Real item photo stays separate.
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
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

        <div className="mb-3">
          <BulkLockBar
            locks={locks}
            onToggleLock={handleToggleLock}
            onLockAll={handleLockAll}
            onUnlockAll={handleUnlockAll}
          />
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_360px]">
          <section className="rounded-[16px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
            <ScanResultPreview
              review={scanSession.review}
              title={reviewTitleFromSource(scanSession.review?.source)}
              onApplyEmptyOnly={() => applyScanReview("emptyOnly")}
              onApplyAll={() => applyScanReview("all")}
              onCancel={() => setScanSession((prev) => clearScanSessionReview(prev))}
            />

            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              <Field label="Title / Series" locked={locks.title} onToggleLock={() => handleToggleLock("title")}>
                <input
                  className={inputClass()}
                  value={values.title}
                  onChange={(e) => setField("title", e.target.value)}
                  placeholder="Amazing Spider-Man"
                />
              </Field>

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
                  placeholder="25"
                />
              </Field>

              <Field label="Current Value" locked={locks.currentValue} onToggleLock={() => handleToggleLock("currentValue")}>
                <input
                  className={inputClass()}
                  value={values.currentValue}
                  onChange={(e) => setField("currentValue", e.target.value)}
                  placeholder="25"
                />
              </Field>

              <Field label="Universe" locked={locks.universe} onToggleLock={() => handleToggleLock("universe")}>
                <select
                  className={selectClass()}
                  value={values.universe}
                  onChange={(e) => setField("universe", e.target.value)}
                >
                  <option value="">Select universe</option>
                  <option value="POP_CULTURE">Pop Culture</option>
                  <option value="SPORTS">Sports</option>
                  <option value="TCG">TCG</option>
                  <option value="MUSIC">Music</option>
                  <option value="JEWELRY_APPAREL">Jewelry / Apparel</option>
                  <option value="GAMES">Games</option>
                  <option value="MISC">Misc</option>
                </select>
              </Field>

              <Field label="Category" locked={locks.category} onToggleLock={() => handleToggleLock("category")}>
                <input
                  className={inputClass()}
                  value={values.category}
                  onChange={(e) => setField("category", e.target.value)}
                  placeholder="COMICS"
                />
              </Field>

              <Field label="Category Label" locked={locks.categoryLabel} onToggleLock={() => handleToggleLock("categoryLabel")}>
                <input
                  className={inputClass()}
                  value={values.categoryLabel}
                  onChange={(e) => setField("categoryLabel", e.target.value)}
                  placeholder="Comics"
                />
              </Field>

              <Field label="Subcategory" locked={locks.subcategoryLabel} onToggleLock={() => handleToggleLock("subcategoryLabel")}>
                <input
                  className={inputClass()}
                  value={values.subcategoryLabel}
                  onChange={(e) => setField("subcategoryLabel", e.target.value)}
                  placeholder="Silver Age"
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

          <div className="grid gap-3">
            <ScanPanel
              session={scanSession}
              scanType={scanType}
              isScanning={isScanning}
              isBookLookupRunning={isBookLookupRunning}
              isComicLookupRunning={isComicLookupRunning}
              saveScanAsPhoto={saveScanAsPhoto}
              onScanTypeChange={setScanType}
              onUseCamera={() => openCameraFor("scan")}
              onUploadImage={() => uploadInputRef.current?.click()}
              onScanAutofill={() => void handleScanAutofill()}
              onBookLookup={() => void handleBookIsbnLookup()}
              onComicLookup={() => void handleComicLookup()}
              onClearImage={clearScanImage}
              onToggleSaveScanAsPhoto={setSaveScanAsPhoto}
            />

            <section className="rounded-[16px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
              <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">SAVED ITEM PHOTO</div>
              <div className="mt-1 text-xs text-[color:var(--muted)]">
                This is the real item photo that saves with the invited item.
              </div>
              <div className="mt-2 overflow-hidden rounded-[14px] bg-[color:var(--pill)] p-2 ring-1 ring-[color:var(--border)]">
                <div className="flex h-[180px] items-center justify-center overflow-hidden rounded-[10px] bg-black/10">
                  {mediaPreviewUrl ? (
                    <img src={mediaPreviewUrl} alt="Item media preview" className="h-full w-full object-contain" />
                  ) : (
                    <div className="px-4 text-center text-xs text-[color:var(--muted)]">
                      No saved item photo selected yet
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3">
                <ImageRoleSelector
                  value={mediaImageRole}
                  onChange={setMediaImageRole}
                  compact
                  label="SAVED PHOTO ROLE"
                />
              </div>

              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  onClick={() => openCameraFor("item")}
                  className="rounded-xl bg-[color:var(--pill)] px-3 py-2.5 text-sm ring-1 ring-[color:var(--border)]"
                >
                  Open Camera
                </button>
                <button
                  type="button"
                  onClick={() => mediaInputRef.current?.click()}
                  className="rounded-xl bg-[color:var(--pill)] px-3 py-2.5 text-sm ring-1 ring-[color:var(--border)]"
                >
                  Choose Photo
                </button>
                <button
                  type="button"
                  onClick={clearMediaImage}
                  disabled={!mediaFile && !mediaPreviewUrl}
                  className="rounded-xl bg-[color:var(--pill)] px-3 py-2.5 text-sm ring-1 ring-[color:var(--border)] disabled:opacity-40"
                >
                  Clear Item Photo
                </button>
              </div>

              <input
                ref={mediaInputRef}
                type="file"
                accept="image/*"
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
            </section>

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

            {isCameraPanelOpen ? (
              <CameraCapturePanel
                title={cameraTarget === "scan" ? "Capture Scan Photo" : "Capture Item Photo"}
                description={
                  cameraTarget === "scan"
                    ? "Take one temporary photo for barcode and OCR autofill."
                    : "Capture the saved item photo for this invited item."
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
        </div>
      </div>
    </main>
  );
}
