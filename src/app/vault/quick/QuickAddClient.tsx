"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import ScanCropEditor from "@/components/ScanCropEditor";
import { PillButton } from "@/components/ui/PillButton";
import { analyzeImageWithVision } from "@/lib/ai/openaiVision";
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

const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";
const RECENT_LIMIT = 6;
const DEFAULT_SCAN_CROP: ScanCropRect = { left: 0, top: 0, right: 0, bottom: 0 };

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

  return (
    <Link
      href={`/vault/item/${item.id}`}
      className="relative flex items-center gap-3 rounded-2xl bg-[color:var(--pill)] p-3 ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]"
    >
      {item.isNew ? (
        <div className="absolute right-3 top-3 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
          NEW
        </div>
      ) : null}
      {imageUrl ? (
        <img src={imageUrl} alt={item.title} className="h-16 w-16 rounded-2xl object-contain bg-black/10" />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[color:var(--surface)] text-xs text-[color:var(--muted2)] ring-1 ring-[color:var(--border)]">
          No Img
        </div>
      )}
      <div className="min-w-0 flex-1 pr-10">
        <div className="truncate text-sm font-medium">{item.title}</div>
      </div>
    </Link>
  );
}

export default function QuickAddClient() {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [frontImage, setFrontImage] = useState<string | undefined>(undefined);
  const [draftPreviewUrl, setDraftPreviewUrl] = useState<string | undefined>(undefined);
  const [rotation, setRotation] = useState(0);
  const [isCropEditorOpen, setIsCropEditorOpen] = useState(false);
  const [scanCrop, setScanCrop] = useState<ScanCropRect>(DEFAULT_SCAN_CROP);
  const [isApplyingCrop, setIsApplyingCrop] = useState(false);
  const [isAiAssisting, setIsAiAssisting] = useState(false);

  const [title, setTitle] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [notes, setNotes] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [recentItems, setRecentItems] = useState<SavedItemPreview[]>([]);

  const quantityValue = useMemo(() => parseQuantity(quantity), [quantity]);
  const parsedPrice = useMemo(() => parseMoney(purchasePrice), [purchasePrice]);
  const canSave = title.trim().length > 0 && !isSaving;

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
    setStatus("Photo ready. Crop it, rotate if needed, then save the image.");

    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (uploadInputRef.current) uploadInputRef.current.value = "";
  }

  async function confirmPreparedImage() {
    if (!selectedFile) return;

    setIsPreparingImage(true);

    try {
      const editedBlob = await renderRotatedImageBlob(selectedFile, rotation, {
        quality: 0.86,
        maxLongEdge: 1600,
      });

      const previewUrl = URL.createObjectURL(editedBlob);

      if (frontImage && frontImage.startsWith("blob:")) {
        revokeImageObjectUrl(frontImage);
      }

      setFrontImage(previewUrl);

      const finalFile = new File([editedBlob], selectedFile.name || "capture.jpg", {
        type: "image/jpeg",
        lastModified: Date.now(),
      });

      setSelectedFile(finalFile);
      setIsCropEditorOpen(false);
      setStatus("Photo locked in. Ready to save.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to prepare photo.");
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

    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
      cameraInputRef.current.click();
    }
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
  }

  async function handleApplyCrop() {
    if (!selectedFile) {
      setStatus("Take a photo first before cropping.");
      return;
    }

    setIsApplyingCrop(true);

    try {
      const cropped = await cropImageFile(selectedFile, scanCrop);
      replaceWorkingImage(cropped);
      setScanCrop(DEFAULT_SCAN_CROP);
      setIsCropEditorOpen(false);
      setRotation(0);
      setStatus("Crop applied. Rotate if needed, then save the image.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to crop photo.");
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

      if (vision.detectedTitle?.trim()) {
        setTitle(vision.detectedTitle.trim());
      }

      const detailLines = [
        vision.subtitle ? `Subtitle: ${vision.subtitle}` : "",
        vision.number ? `Number: ${vision.number}` : "",
        vision.grade ? `Grade: ${vision.grade}` : "",
        vision.certNumber ? `Cert: ${vision.certNumber}` : "",
        vision.categoryLabel || vision.detectedCategory
          ? `Category: ${vision.categoryLabel || vision.detectedCategory}`
          : "",
        vision.notes || "",
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

      setStatus("AI filled in basic details. Review them before saving.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "AI assist failed.");
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
          primaryImageKey,
          images,
          imageFrontUrl,
          imageFrontStoragePath,
          createdAt: now + index,
          isNew: true,
        };

        created.push(item);
      }

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

  const activePreview = frontImage || draftPreviewUrl;

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-3 py-4 sm:px-5 sm:py-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted2)]">
              VLTD Quick Add
            </div>
            <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Image first. Save fast.</h1>
          </div>
          <Link
            href="/"
            className="inline-flex h-11 items-center rounded-full px-4 text-sm font-medium ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)]"
          >
            Home
          </Link>
        </div>

        <div className="mt-4 rounded-[24px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="rounded-[22px] bg-[color:var(--pill)] p-4 ring-1 ring-[color:var(--border)]"
            >
              Use Camera
            </button>
            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              className="rounded-[22px] bg-[color:var(--pill)] p-4 ring-1 ring-[color:var(--border)]"
            >
              Upload Image
            </button>
          </div>

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
            <div className="mt-4 overflow-hidden rounded-[20px] bg-[color:var(--pill)] p-3 ring-1 ring-[color:var(--border)]">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-black/10 px-3 py-1 text-xs ring-1 ring-black/10">
                  {frontImage ? "Locked In" : "Draft"}
                </span>
                <span className="rounded-full bg-black/10 px-3 py-1 text-xs ring-1 ring-black/10">
                  Rotate: {rotation}°
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsCropEditorOpen(true)}
                className="block w-full overflow-hidden rounded-[14px] bg-[color:var(--input)] aspect-[4/3] focus:outline-none focus:ring-2 focus:ring-[color:var(--pill-active-bg)]"
              >
                <img
                  src={activePreview}
                  alt="Item preview"
                  className="h-full w-full object-contain bg-black/10"
                  style={{ transform: `rotate(${rotation}deg)` }}
                />
              </button>

              <div className="mt-2 text-center text-[11px] text-[color:var(--muted2)]">
                Tap the photo to reopen crop.
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <PillButton
                  onClick={() => setRotation((prev) => (prev + 90) % 360)}
                  disabled={isPreparingImage || isSaving}
                >
                  Rotate 90°
                </PillButton>

                {!frontImage ? (
                  <PillButton
                    variant="primary"
                    onClick={() => void confirmPreparedImage()}
                    disabled={isPreparingImage || isSaving}
                  >
                    {isPreparingImage ? "Preparing..." : "Use Photo"}
                  </PillButton>
                ) : null}

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

              {!frontImage ? (
                <div className="mt-2 text-xs text-[color:var(--muted)]">
                  Review the shot, rotate if needed, then tap Use Photo.
                </div>
              ) : null}
            </div>
          ) : null}

          {isCropEditorOpen && draftPreviewUrl ? (
            <div className="mt-4">
              <ScanCropEditor
                imageUrl={draftPreviewUrl}
                crop={scanCrop}
                onChange={setScanCrop}
                onApply={() => void handleApplyCrop()}
                onReset={() => setScanCrop(DEFAULT_SCAN_CROP)}
                onCancel={() => setIsCropEditorOpen(false)}
                isApplying={isApplyingCrop}
              />
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title *"
              className="h-12 rounded-2xl bg-[color:var(--pill)] px-4 ring-1 ring-[color:var(--border)]"
            />
            <input
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              placeholder="Purchase Price"
              className="h-12 rounded-2xl bg-[color:var(--pill)] px-4 ring-1 ring-[color:var(--border)]"
            />
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Quantity"
              className="h-12 rounded-2xl bg-[color:var(--pill)] px-4 ring-1 ring-[color:var(--border)]"
            />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes"
              className="min-h-[112px] rounded-2xl bg-[color:var(--pill)] px-4 py-3 ring-1 ring-[color:var(--border)] sm:col-span-2"
            />
          </div>

          {status ? (
            <div className="mt-4 rounded-[18px] bg-[color:var(--pill)] px-4 py-3 text-sm ring-1 ring-[color:var(--border)]">
              {status}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <PillButton
              variant="primary"
              onClick={() => void saveQuickAdd()}
              disabled={!canSave || isPreparingImage}
            >
              {isSaving ? "Saving..." : "Save Item"}
            </PillButton>
            <PillButton onClick={resetForm} disabled={isSaving || isPreparingImage}>
              Reset
            </PillButton>
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
