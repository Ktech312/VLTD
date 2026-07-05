"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import ScanCropEditor from "@/components/ScanCropEditor";
import ScanCapturePanel from "@/components/ScanCapturePanel";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { PillButton } from "@/components/ui/PillButton";
import { AI_ASSIST_SETUP_MESSAGE, analyzeImageWithVision } from "@/lib/ai/openaiVision";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { newId } from "@/lib/id";
import { emitVaultUpdate } from "@/lib/vaultEvents";
import { appendItems, type VaultImage, type VaultItem } from "@/lib/vaultModel";
import { enqueueVaultItemSync, processVaultSyncQueue } from "@/lib/vaultSyncQueue";
import { hasSupabaseEnv, uploadVaultImageToSupabase } from "@/lib/vaultCloud";
import { cropImageFile, type ScanCropRect } from "@/lib/scanners/cropImageFile";
import {
  generateVaultImageKey,
  getImageObjectUrlFromIndexedDb,
  prepareImageBlob,
  revokeImageObjectUrl,
  saveImageBlobToIndexedDb,
} from "@/lib/vaultImageStore";
import {
  UNIVERSE_LABEL,
  UNIVERSE_KEYS,
  type UniverseKey,
  isUniverseKey,
  getCategories,
  getSubcategories,
} from "@/lib/taxonomy";

const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";
const LAST_UNIVERSE_KEY = "vltd_last_universe";
const LAST_CATEGORY_KEY = "vltd_last_category_label";
const LAST_SUBCATEGORY_KEY = "vltd_last_subcategory_label";
const RECENT_LIMIT = 6;
const DEFAULT_SCAN_CROP: ScanCropRect = { left: 0, top: 0, right: 0, bottom: 0 };

function isDefaultCrop(crop: ScanCropRect) {
  return crop.left === 0 && crop.top === 0 && crop.right === 0 && crop.bottom === 0;
}

type SavedItemPreview = {
  id: string;
  title: string;
  purchasePrice?: number;
  primaryImageKey?: string;
  imageFrontUrl?: string;
  isNew?: boolean;
};

function parseMoney(input: string) {
  const cleaned = input.replace(/[^0-9.-]/g, "").trim();
  if (!cleaned) return undefined;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : undefined;
}

function parseQuantity(input: string) {
  const value = Number(input);
  if (!Number.isFinite(value)) return 1;
  return Math.min(250, Math.max(1, Math.floor(value)));
}

function getActiveProfileId() {
  if (typeof window === "undefined") return "";
  try {
    return String(window.localStorage.getItem(ACTIVE_PROFILE_KEY) ?? "").trim();
  } catch {
    return "";
  }
}

function getLastUsedCategory(): { universe: UniverseKey | ""; categoryLabel: string; subcategoryLabel: string } {
  if (typeof window === "undefined") return { universe: "", categoryLabel: "", subcategoryLabel: "" };
  try {
    const u = window.localStorage.getItem(LAST_UNIVERSE_KEY) ?? "";
    return {
      universe: isUniverseKey(u) ? u : "",
      categoryLabel: window.localStorage.getItem(LAST_CATEGORY_KEY) ?? "",
      subcategoryLabel: window.localStorage.getItem(LAST_SUBCATEGORY_KEY) ?? "",
    };
  } catch {
    return { universe: "", categoryLabel: "", subcategoryLabel: "" };
  }
}

function persistLastUsedCategory(universe: string, categoryLabel: string, subcategoryLabel: string) {
  if (typeof window === "undefined") return;
  try {
    if (universe) window.localStorage.setItem(LAST_UNIVERSE_KEY, universe);
    if (categoryLabel) window.localStorage.setItem(LAST_CATEGORY_KEY, categoryLabel);
    if (subcategoryLabel) window.localStorage.setItem(LAST_SUBCATEGORY_KEY, subcategoryLabel);
  } catch {
    // ignore
  }
}

function categoryCode(label: string) {
  return label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "COLLECTORS_CHOICE";
}

/** Try to match a free-text universe string from AI to a known UniverseKey. */
function matchVisionUniverse(visionUniverse: string): UniverseKey | "" {
  if (!visionUniverse) return "";
  const upper = visionUniverse.toUpperCase().replace(/[\s-]+/g, "_");
  if (isUniverseKey(upper)) return upper;
  // Label match
  for (const key of UNIVERSE_KEYS) {
    if (UNIVERSE_LABEL[key].toLowerCase() === visionUniverse.toLowerCase()) return key;
  }
  // Keyword heuristics
  const v = visionUniverse.toLowerCase();
  if (v.includes("comic") || v.includes("pop_culture") || v.includes("toy") || v.includes("figure") || v.includes("funko")) return "POP_CULTURE";
  if (v.includes("sport") || v.includes("jersey") || v.includes("trading card")) return "SPORTS";
  if (v.includes("tcg") || v.includes("pokemon") || v.includes("magic") || v.includes("yu-gi-oh") || v.includes("lorcana")) return "TCG";
  if (v.includes("music") || v.includes("vinyl") || v.includes("record") || v.includes("album")) return "MUSIC";
  if (v.includes("game") || v.includes("video game") || v.includes("console") || v.includes("nintendo") || v.includes("playstation")) return "GAMES";
  if (v.includes("auto") || v.includes("car") || v.includes("motorcycle") || v.includes("vehicle")) return "AUTOMOTIVE";
  if (v.includes("art") || v.includes("painting") || v.includes("sculpture")) return "ART";
  if (v.includes("jewelry") || v.includes("watch") || v.includes("apparel") || v.includes("sneaker")) return "JEWELRY_APPAREL";
  if (v.includes("plant") || v.includes("whisky") || v.includes("bourbon") || v.includes("handmade")) return "BUILT_BOTANY";
  return "";
}

/** Try to match a free-text category from AI to a valid category for the given universe. */
function matchVisionCategory(universe: UniverseKey, visionCategory: string): string {
  if (!universe || !visionCategory) return "";
  const cats = getCategories(universe);
  const lower = visionCategory.toLowerCase().trim();
  // Exact match
  const exact = cats.find((c) => c.toLowerCase() === lower);
  if (exact) return exact;
  // Substring match
  const partial = cats.find((c) => c.toLowerCase().includes(lower) || lower.includes(c.toLowerCase()));
  return partial ?? "";
}

function buildRecent(): SavedItemPreview[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem("vltd_vault_items_v1");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .sort((a, b) => Number(b?.createdAt ?? 0) - Number(a?.createdAt ?? 0))
      .slice(0, RECENT_LIMIT)
      .map((item) => ({
        id: String(item?.id ?? ""),
        title: String(item?.title ?? ""),
        purchasePrice: Number.isFinite(Number(item?.purchasePrice))
          ? Number(item.purchasePrice)
          : undefined,
        primaryImageKey:
          typeof item?.primaryImageKey === "string" ? item.primaryImageKey : undefined,
        imageFrontUrl:
          typeof item?.imageFrontUrl === "string" ? item.imageFrontUrl : undefined,
        isNew: typeof item?.isNew === "boolean" ? item.isNew : true,
      }));
  } catch {
    return [];
  }
}

async function buildDurableImageBlob(file: File | Blob): Promise<Blob> {
  try {
    const prepared = await prepareImageBlob(file as File);
    if (prepared) return prepared;
  } catch {
    // ignore and fall back
  }
  return file;
}

async function renderRotatedImageBlob(
  file: File,
  rotation: number,
  options?: {
    quality?: number;
    maxLongEdge?: number;
  }
): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image."));
      img.src = objectUrl;
    });

    const normalizedRotation = ((rotation % 360) + 360) % 360;
    if (normalizedRotation === 0) {
      const passthrough = await buildDurableImageBlob(file);
      return passthrough;
    }

    const radians = (normalizedRotation * Math.PI) / 180;
    const quarterTurns = normalizedRotation / 90;
    const swapSides = quarterTurns % 2 === 1;

    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;

    const baseWidth = swapSides ? sourceHeight : sourceWidth;
    const baseHeight = swapSides ? sourceWidth : sourceHeight;

    const longEdge = Math.max(baseWidth, baseHeight);
    const maxLongEdge = Math.max(800, Math.min(2200, options?.maxLongEdge ?? 1600));
    const scale = longEdge > maxLongEdge ? maxLongEdge / longEdge : 1;

    const outputWidth = Math.max(1, Math.round(baseWidth * scale));
    const outputHeight = Math.max(1, Math.round(baseHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available.");

    ctx.save();
    ctx.translate(outputWidth / 2, outputHeight / 2);
    ctx.rotate(radians);

    const drawWidth = Math.round(sourceWidth * scale);
    const drawHeight = Math.round(sourceHeight * scale);

    ctx.drawImage(
      image,
      -drawWidth / 2,
      -drawHeight / 2,
      drawWidth,
      drawHeight
    );
    ctx.restore();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", options?.quality ?? 0.86);
    });

    if (!blob) throw new Error("Failed to render edited image.");
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function RecentItemCard({ item }: { item: SavedItemPreview }) {
  const [imageUrl, setImageUrl] = useState<string | undefined>(item.imageFrontUrl);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    let revokeUrl: string | undefined;

    async function load() {
      if (item.primaryImageKey) {
        const url = await getImageObjectUrlFromIndexedDb(item.primaryImageKey);
        if (!active) {
          revokeImageObjectUrl(url);
          return;
        }
        revokeUrl = url;
        if (url) {
          setImageUrl(url);
          return;
        }
      }
      setImageUrl(item.imageFrontUrl);
    }

    void load();

    return () => {
      active = false;
      if (revokeUrl) revokeImageObjectUrl(revokeUrl);
    };
  }, [item.primaryImageKey, item.imageFrontUrl]);

  function handleShare(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/vault/item/${item.id}`;
    if (navigator.share) {
      void navigator.share({ title: item.title, url });
    } else {
      void navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }

  return (
    <Link
      href={`/vault/item/${item.id}`}
      className="relative flex items-center gap-3 rounded-2xl bg-[color:var(--pill)] p-3 ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]"
    >
      {item.isNew ? (
        <div className="absolute right-10 top-3 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-text-primary">
          NEW
        </div>
      ) : null}
      {imageUrl ? (
        <ProgressiveImage
          src={imageUrl}
          alt={item.title}
          className="h-16 w-16 rounded-2xl bg-[color:var(--surface)]"
          imageClassName="object-contain"
          draggable={false}
        />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[color:var(--surface)] text-xs text-[color:var(--muted2)] ring-1 ring-[color:var(--border)]">
          No Img
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{item.title}</div>
      </div>
      <button
        type="button"
        onClick={handleShare}
        title={copied ? "Copied!" : "Copy share link"}
        className="ml-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--surface)]"
        style={{ color: copied ? "var(--theme-gold, #F5B548)" : "var(--muted)" }}
      >
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
        )}
      </button>
    </Link>
  );
}

export default function QuickAddClient() {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [frontImage, setFrontImage] = useState<string | undefined>(undefined);
  const [draftPreviewUrl, setDraftPreviewUrl] = useState<string | undefined>(undefined);
  const [rotation, setRotation] = useState(0);
  const [isCropEditorOpen, setIsCropEditorOpen] = useState(false);
  const [isScanPanelOpen, setIsScanPanelOpen] = useState(false);
  const [scanCrop, setScanCrop] = useState<ScanCropRect>(DEFAULT_SCAN_CROP);
  const [isApplyingCrop, setIsApplyingCrop] = useState(false);
  const [isAiAssisting, setIsAiAssisting] = useState(false);

  const [title, setTitle] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [notes, setNotes] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [universe, setUniverse] = useState<UniverseKey | "">(() => getLastUsedCategory().universe);
  const [categoryLabel, setCategoryLabel] = useState(() => getLastUsedCategory().categoryLabel);
  const [subcategoryLabel, setSubcategoryLabel] = useState(() => getLastUsedCategory().subcategoryLabel);
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [showMoreFields, setShowMoreFields] = useState(false);
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [recentItems, setRecentItems] = useState<SavedItemPreview[]>([]);

  const categoryOptions = useMemo(() => (universe ? getCategories(universe) : []), [universe]);
  const subcategoryOptions = useMemo(
    () => (universe && categoryLabel ? getSubcategories(universe, categoryLabel) : []),
    [universe, categoryLabel]
  );
  const quantityValue = useMemo(() => parseQuantity(quantity), [quantity]);
  const parsedPrice = useMemo(() => parseMoney(purchasePrice), [purchasePrice]);
  const canSave = title.trim().length > 0 && !isSaving;
  const activePreview = frontImage || draftPreviewUrl;
  const hasQuickAddDraft =
    Boolean(selectedFile || activePreview || isCropEditorOpen) ||
    title.trim().length > 0 ||
    purchasePrice.trim().length > 0 ||
    notes.trim().length > 0 ||
    quantity.trim() !== "1";

  useUnsavedChangesGuard(hasQuickAddDraft && !isSaving);

  useEffect(() => {
    setRecentItems(buildRecent());
    void processVaultSyncQueue();

    const onOnline = () => {
      void processVaultSyncQueue();
    };

    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  useEffect(() => {
    return () => {
      if (frontImage && frontImage.startsWith("blob:")) {
        revokeImageObjectUrl(frontImage);
      }
    };
  }, [frontImage]);

  useEffect(() => {
    return () => {
      if (draftPreviewUrl && draftPreviewUrl.startsWith("blob:")) {
        revokeImageObjectUrl(draftPreviewUrl);
      }
    };
  }, [draftPreviewUrl]);

  function replaceWorkingImage(file: File) {
    if (draftPreviewUrl && draftPreviewUrl.startsWith("blob:")) {
      revokeImageObjectUrl(draftPreviewUrl);
    }
    if (frontImage && frontImage.startsWith("blob:")) {
      revokeImageObjectUrl(frontImage);
    }

    setSelectedFile(file);
    setDraftPreviewUrl(URL.createObjectURL(file));
    setFrontImage(undefined);
  }

  async function handleImageSelection(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setStatus("That file is not an image.");
      return;
    }

    replaceWorkingImage(file);
    setRotation(0);
    setScanCrop(DEFAULT_SCAN_CROP);
    setIsCropEditorOpen(true);
    setStatus("Photo ready. Adjust it, then save the image.");

    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (uploadInputRef.current) uploadInputRef.current.value = "";
  }

  async function confirmPreparedImage() {
    if (!selectedFile) return;

    setIsPreparingImage(true);

    try {
      const fileToPrepare = isDefaultCrop(scanCrop)
        ? selectedFile
        : await cropImageFile(selectedFile, scanCrop);

      const editedBlob = await renderRotatedImageBlob(fileToPrepare, rotation, {
        quality: 0.86,
        maxLongEdge: 1600,
      });

      const previewUrl = URL.createObjectURL(editedBlob);

      if (frontImage && frontImage.startsWith("blob:")) {
        revokeImageObjectUrl(frontImage);
      }
      if (draftPreviewUrl && draftPreviewUrl.startsWith("blob:")) {
        revokeImageObjectUrl(draftPreviewUrl);
      }

      setFrontImage(previewUrl);
      setDraftPreviewUrl(previewUrl);

      const finalFile = new File([editedBlob], selectedFile.name || "capture.jpg", {
        type: "image/jpeg",
        lastModified: Date.now(),
      });

      setSelectedFile(finalFile);
      setIsCropEditorOpen(false);
      setScanCrop(DEFAULT_SCAN_CROP);
      setRotation(0);
      setStatus("Photo saved. Ready for details.");
      window.setTimeout(() => {
        titleInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        titleInputRef.current?.focus();
      }, 60);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to save photo.");
    } finally {
      setIsPreparingImage(false);
    }
  }

  function retakeImage() {
    if (frontImage && frontImage.startsWith("blob:")) {
      revokeImageObjectUrl(frontImage);
    }
    if (draftPreviewUrl && draftPreviewUrl.startsWith("blob:")) {
      revokeImageObjectUrl(draftPreviewUrl);
    }

    setSelectedFile(null);
    setFrontImage(undefined);
    setDraftPreviewUrl(undefined);
    setRotation(0);
    setIsCropEditorOpen(false);
    setScanCrop(DEFAULT_SCAN_CROP);
    setStatus("Take another photo.");

    if (cameraInputRef.current) cameraInputRef.current.value = "";
    setIsScanPanelOpen(true);
  }

  function resetForm() {
    if (frontImage && frontImage.startsWith("blob:")) {
      revokeImageObjectUrl(frontImage);
    }
    if (draftPreviewUrl && draftPreviewUrl.startsWith("blob:")) {
      revokeImageObjectUrl(draftPreviewUrl);
    }
    setSelectedFile(null);
    setFrontImage(undefined);
    setDraftPreviewUrl(undefined);
    setRotation(0);
    setIsCropEditorOpen(false);
    setScanCrop(DEFAULT_SCAN_CROP);
    setTitle("");
    setPurchasePrice("");
    setNotes("");
    setQuantity("1");
    // Restore last-used category so the next item starts pre-categorized
    const lu = getLastUsedCategory();
    setUniverse(lu.universe);
    setCategoryLabel(lu.categoryLabel);
    setSubcategoryLabel(lu.subcategoryLabel);
  }

  async function handleApplyCrop() {
    setIsApplyingCrop(true);
    try {
      await confirmPreparedImage();
    } finally {
      setIsApplyingCrop(false);
    }
  }

  async function handleAiAssist() {
    if (!selectedFile) {
      setStatus("Add a photo first so AI can read it.");
      return;
    }

    setIsAiAssisting(true);

    try {
      const vision = await analyzeImageWithVision(selectedFile, {
        hints:
          "Identify the collectible or product in this quick add photo. Return the clearest likely title and any visible number, grade, cert, category, or short notes.",
      });

      if (vision.title?.trim()) {
        setTitle(vision.title.trim());
      }

      // Auto-fill universe and category from AI detection
      const detectedUniverse = matchVisionUniverse(vision.universe);
      if (detectedUniverse) {
        setUniverse(detectedUniverse);
        const visionCatText = vision.categoryLabel || vision.category || "";
        const matchedCategory = matchVisionCategory(detectedUniverse, visionCatText);
        if (matchedCategory) {
          setCategoryLabel(matchedCategory);
          // Try to match subcategory too
          if (vision.subcategoryLabel) {
            const subs = getSubcategories(detectedUniverse, matchedCategory);
            const lower = vision.subcategoryLabel.toLowerCase();
            const matchedSub =
              subs.find((s) => s.toLowerCase() === lower) ??
              subs.find((s) => s.toLowerCase().includes(lower) || lower.includes(s.toLowerCase())) ??
              "";
            if (matchedSub) setSubcategoryLabel(matchedSub);
          }
          // Show More fields so user can see what AI picked
          setShowMoreFields(true);
        }
      }

      const detailLines = [
        vision.subtitle ? `Subtitle: ${vision.subtitle}` : "",
        vision.number ? `Number: ${vision.number}` : "",
        vision.grade ? `Grade: ${vision.grade}` : "",
        vision.certNumber ? `Cert: ${vision.certNumber}` : "",
        vision.description || "",
      ]
        .filter(Boolean)
        .join("\n");

      if (detailLines) {
        setNotes((prev) => {
          const current = prev.trim();
          if (!current) return detailLines;
          if (current.includes(detailLines)) return current;
          return `${current}\n\n${detailLines}`;
        });
      }

      setStatus("AI filled in details. Review before saving.");
    } catch (error) {
      setStatus(
        error instanceof Error &&
        /GEMINI_API_KEY|GOOGLE_API_KEY|AI Assist is unavailable/i.test(error.message)
          ? AI_ASSIST_SETUP_MESSAGE
          : error instanceof Error
            ? error.message
            : "AI assist failed."
      );
    } finally {
      setIsAiAssisting(false);
    }
  }

  async function saveQuickAdd() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setStatus("Title is required.");
      return;
    }

    setIsSaving(true);

    try {
      const now = Date.now();
      const activeProfileId = getActiveProfileId();
      const durableBlob = selectedFile ? await buildDurableImageBlob(selectedFile) : null;
      const created: VaultItem[] = [];

      for (let index = 0; index < quantityValue; index += 1) {
        const id = newId();
        let primaryImageKey: string | undefined;
        let images: VaultImage[] | undefined;
        let imageFrontUrl: string | undefined;
        let imageFrontStoragePath: string | undefined;

        if (durableBlob) {
          if (navigator.onLine && hasSupabaseEnv()) {
            const uploaded = await uploadVaultImageToSupabase({
              itemId: id,
              file: durableBlob,
              fileName: selectedFile?.name || "image.jpg",
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
              },
            ];

            imageFrontUrl = frontImage || URL.createObjectURL(durableBlob);
            imageFrontStoragePath = primaryImageKey;
          }
        }

        const item: VaultItem = {
          id,
          profile_id: activeProfileId || undefined,
          title: trimmedTitle,
          purchasePrice: parsedPrice,
          currentValue: parsedPrice,
          notes: notes.trim() || undefined,
          universe: universe || undefined,
          category: categoryLabel ? categoryCode(categoryLabel) : undefined,
          categoryLabel: categoryLabel || undefined,
          subcategoryLabel: subcategoryLabel || undefined,
          primaryImageKey,
          images,
          imageFrontUrl,
          imageFrontStoragePath,
          createdAt: now + index,
          isNew: true,
        };

        created.push(item);
      }

      // Persist last-used category before resetting the form
      persistLastUsedCategory(universe, categoryLabel, subcategoryLabel);

      appendItems(created);

      for (const item of created) {
        enqueueVaultItemSync(item.id);
      }

      emitVaultUpdate();
      const syncResult = await processVaultSyncQueue();
      setRecentItems(buildRecent());

      setStatus(
        syncResult.processed > 0
          ? `Saved and synced ${created.length} item(s).`
          : `Saved ${created.length} item(s).`
      );

      resetForm();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Quick Add failed.");
    } finally {
      setIsSaving(false);
    }
  }

  const selectClass = "h-11 w-full rounded-2xl bg-[color:var(--pill)] px-4 ring-1 ring-[color:var(--border)] appearance-none";

  return (
    <main className="bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto flex w-full max-w-2xl flex-col px-3 py-2 sm:px-4">
        <div className="flex items-start gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-[color:var(--muted2)]">
              VLTD Quick Add
            </div>
            <h1 className="mt-0.5 text-xl font-semibold">Image first. Save fast.</h1>
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-2">
          {!activePreview && (
            <button
              type="button"
              onClick={() => setIsScanPanelOpen(true)}
              className="group relative flex w-full flex-col items-center justify-center gap-2 rounded-[18px] transition active:scale-[0.99]"
              style={{
                minHeight: 170,
                background: "rgba(12,20,38,0.7)",
                border: "1.5px dashed rgba(245,181,72,0.28)",
                backdropFilter: "blur(8px)",
              }}
            >
              <div
                className="flex items-center justify-center rounded-full transition-transform group-hover:scale-105"
                style={{
                  width: 54,
                  height: 54,
                  background: "rgba(245,181,72,0.10)",
                  border: "1.5px solid rgba(245,181,72,0.30)",
                  boxShadow: "0 0 20px rgba(245,181,72,0.12)",
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F5B548" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>

              <div>
                <div className="text-center text-base font-bold" style={{ color: "var(--theme-gold, #F5B548)" }}>
                  Tap to scan
                </div>
                <div className="mt-1 text-center text-[12px]" style={{ color: "rgba(160,149,107,0.6)" }}>
                  Auto-locks and snaps when ready
                </div>
                <div className="mt-2 text-center text-[12px]" style={{ color: "rgba(160,149,107,0.65)" }}>
                  or{" "}
                  <span
                    className="underline underline-offset-2"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      uploadInputRef.current?.click();
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    upload from file
                  </span>
                </div>
              </div>
            </button>
          )}

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => void handleImageSelection(event.target.files)}
          />
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => void handleImageSelection(event.target.files)}
          />

          {activePreview ? (
            <div className="mt-3 overflow-hidden rounded-[18px] bg-[color:var(--pill)] p-3 ring-1 ring-[color:var(--border)]">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[color:var(--surface)] px-3 py-1 text-xs ring-1 ring-black/10">
                  {frontImage ? "Locked In" : "Draft"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsCropEditorOpen(true)}
                className="block aspect-[16/10] max-h-[300px] w-full overflow-hidden rounded-[14px] bg-[color:var(--input)] focus:outline-none focus:ring-2 focus:ring-[color:var(--pill-active-bg)]"
              >
                <ProgressiveImage
                  src={activePreview}
                  alt="Item preview"
                  className="h-full w-full bg-[color:var(--surface)]"
                  imageClassName="object-contain"
                  draggable={false}
                />
              </button>

              <div className="mt-2 text-center text-[11px] text-[color:var(--muted2)]">
                Tap the photo to edit it again.
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <PillButton onClick={() => setIsCropEditorOpen(true)} disabled={isSaving}>
                  Edit Photo
                </PillButton>

                <PillButton
                  onClick={() => void handleAiAssist()}
                  disabled={isAiAssisting || isSaving || !selectedFile}
                >
                  {isAiAssisting ? "Reading..." : "AI Assist"}
                </PillButton>

                <PillButton onClick={retakeImage} disabled={isPreparingImage || isSaving}>
                  Retake
                </PillButton>
              </div>

              <div className="mt-3 rounded-[14px] bg-[color:var(--surface)] px-3 py-2 text-[11px] text-[color:var(--muted2)] ring-1 ring-[color:var(--border)]">
                AI Assist needs `Gemini_API_Key` set in Vercel environment variables.
                If it is not set yet, crop and manual save still work.
              </div>
            </div>
          ) : null}

          {isCropEditorOpen && draftPreviewUrl ? (
            <div className="fixed inset-0 z-[80] bg-black/75 p-2 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label="Edit item photo">
              <div className="mx-auto flex max-h-[calc(100dvh-1rem)] max-w-3xl flex-col overflow-hidden rounded-[22px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] sm:max-h-[calc(100dvh-2rem)] sm:p-4">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">EDIT PHOTO</div>
                    <h2 className="mt-1 text-lg font-semibold text-[color:var(--fg)]">Adjust Item Picture</h2>
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
                    imageUrl={draftPreviewUrl}
                    crop={scanCrop}
                    rotation={rotation}
                    onChange={setScanCrop}
                    title="ADJUST PHOTO BEFORE SAVE"
                    description="Drag the photo to frame it. Pinch or use Zoom to move closer."
                    applyLabel="Save"
                    onRotate={() => setRotation((prev) => (prev + 90) % 360)}
                    onApply={() => void handleApplyCrop()}
                    onReset={() => {
                      setScanCrop(DEFAULT_SCAN_CROP);
                      setRotation(0);
                    }}
                    onCancel={() => setIsCropEditorOpen(false)}
                    isApplying={isApplyingCrop || isPreparingImage}
                    compact
                  />
                </div>
              </div>
            </div>
          ) : null}

          {isScanPanelOpen ? (
            <ScanCapturePanel onClose={() => setIsScanPanelOpen(false)} />
          ) : null}


          <div className="mt-2 grid gap-2">
            <input
              ref={titleInputRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title *"
              className="h-11 rounded-2xl bg-[color:var(--pill)] px-4 ring-1 ring-[color:var(--border)]"
            />
            <input
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              placeholder="Purchase Price"
              inputMode="decimal"
              className="h-11 rounded-2xl bg-[color:var(--pill)] px-4 ring-1 ring-[color:var(--border)]"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowMoreFields((v) => !v)}
            className="mt-2 flex w-full items-center gap-2 rounded-2xl px-4 py-2 text-sm ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)]"
            style={{ color: "var(--muted)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: showMoreFields ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
            <span className="flex-1 text-left">
              {showMoreFields ? "Hide extra fields" : "More fields — Category, Quantity, Notes"}
            </span>
            {universe || categoryLabel ? (
              <span className="max-w-[160px] truncate text-right text-[11px]" style={{ color: "var(--theme-gold, #F5B548)" }}>
                {[universe ? UNIVERSE_LABEL[universe] : "", categoryLabel].filter(Boolean).join(" › ")}
              </span>
            ) : null}
          </button>

          {showMoreFields ? (
            <div className="mt-3 grid gap-3">
              {/* Universe */}
              <div className="relative">
                <select
                  value={universe}
                  onChange={(e) => {
                    setUniverse(e.target.value as UniverseKey | "");
                    setCategoryLabel("");
                    setSubcategoryLabel("");
                  }}
                  className={selectClass}
                >
                  <option value="">Universe — any</option>
                  {UNIVERSE_KEYS.map((k) => (
                    <option key={k} value={k}>{UNIVERSE_LABEL[k]}</option>
                  ))}
                </select>
              </div>

              {/* Category */}
              {categoryOptions.length > 0 ? (
                <div className="relative">
                  <select
                    value={categoryLabel}
                    onChange={(e) => {
                      setCategoryLabel(e.target.value);
                      setSubcategoryLabel("");
                    }}
                    className={selectClass}
                  >
                    <option value="">Category — any</option>
                    {categoryOptions.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              ) : null}

              {/* Subcategory */}
              {subcategoryOptions.length > 0 ? (
                <div className="relative">
                  <select
                    value={subcategoryLabel}
                    onChange={(e) => setSubcategoryLabel(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">Subcategory — any</option>
                    {subcategoryOptions.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              ) : null}

              <input
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Quantity"
                inputMode="numeric"
                className="h-12 rounded-2xl bg-[color:var(--pill)] px-4 ring-1 ring-[color:var(--border)]"
              />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes"
                className="min-h-[100px] rounded-2xl bg-[color:var(--pill)] px-4 py-3 ring-1 ring-[color:var(--border)]"
              />
            </div>
          ) : null}

          {status ? (
            <div className="mt-2 rounded-[18px] bg-[color:var(--pill)] px-4 py-2.5 text-sm ring-1 ring-[color:var(--border)]">
              {status}
            </div>
          ) : null}

          <div className="mt-3 grid gap-2">
            <button
              type="button"
              onClick={() => void saveQuickAdd()}
              disabled={!canSave || isPreparingImage}
              className="flex w-full items-center justify-center rounded-full py-3.5 text-sm font-bold transition disabled:opacity-40 active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #8B6914, #F5B548)", color: "#0B0B0B", boxShadow: "0 4px 18px rgba(245,181,72,0.28)" }}
            >
              {isSaving ? "Saving..." : "Save Item"}
            </button>
            <button
              type="button"
              onClick={() => void saveQuickAdd()}
              disabled={!canSave || isPreparingImage}
              className="flex w-full items-center justify-center rounded-full py-3 text-sm font-semibold ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)] disabled:opacity-40"
              style={{ color: "var(--fg)" }}
            >
              {isSaving ? "Saving..." : "Save & Add Another"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              disabled={isSaving || isPreparingImage}
              className="w-full rounded-full py-2.5 text-xs ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)] disabled:opacity-40"
              style={{ color: "var(--muted)" }}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-[24px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[color:var(--muted2)]">
            Recent Saves
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {recentItems.length === 0 ? (
              <div className="rounded-2xl bg-[color:var(--pill)] p-4 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
                No recent items yet.
              </div>
            ) : (
              recentItems.map((item) => <RecentItemCard key={item.id} item={item} />)
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
