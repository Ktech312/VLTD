"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import ImageViewer from "@/components/ImageViewer";
import ScanCropEditor from "@/components/ScanCropEditor";
import { cropImageFile, type ScanCropRect } from "@/lib/scanners/cropImageFile";

type ImageRole = "primary" | "detail" | "proof";

type ItemMediaImageMeta = {
  id?: string;
  role?: ImageRole;
};

type ImageEntry = {
  url: string;
  originalIndex: number;
  id?: string;
  role: ImageRole;
};

const FULL_CROP: ScanCropRect = { left: 0, top: 0, right: 0, bottom: 0 };

function cropsEqual(a: ScanCropRect, b: ScanCropRect) {
  return (
    Math.abs(a.left - b.left) < 0.001 &&
    Math.abs(a.top - b.top) < 0.001 &&
    Math.abs(a.right - b.right) < 0.001 &&
    Math.abs(a.bottom - b.bottom) < 0.001
  );
}

async function renderRotatedImageBlob(
  file: File,
  rotation: number,
  options?: {
    quality?: number;
    maxLongEdge?: number;
  }
): Promise<File> {
  const normalizedRotation = ((rotation % 360) + 360) % 360;

  if (normalizedRotation === 0) {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image."));
      img.src = objectUrl;
    });

    const radians = (normalizedRotation * Math.PI) / 180;
    const quarterTurns = normalizedRotation / 90;
    const swapSides = quarterTurns % 2 === 1;

    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;

    const baseWidth = swapSides ? sourceHeight : sourceWidth;
    const baseHeight = swapSides ? sourceWidth : sourceHeight;

    const longEdge = Math.max(baseWidth, baseHeight);
    const maxLongEdge = Math.max(800, Math.min(2200, options?.maxLongEdge ?? 1800));
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

    ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", options?.quality ?? 0.88);
    });

    if (!blob) throw new Error("Failed to prepare image.");

    return new File([blob], file.name || "image.jpg", {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function roleTone(role: ImageRole) {
  if (role === "primary") {
    return "bg-cyan-500/20 text-cyan-100 ring-cyan-400/30";
  }
  if (role === "proof") {
    return "bg-amber-500/20 text-amber-100 ring-amber-400/30";
  }
  return "bg-white/10 text-white/80 ring-white/10";
}

function roleLabel(role: ImageRole) {
  if (role === "primary") return "Primary";
  if (role === "proof") return "Proof";
  return "Detail";
}

export default function ItemMedia({
  item,
  images,
  activeIndex,
  onSelect,
  onAddImages,
  onMoveImage,
  onDeleteImage,
  onReplaceImage,
  onRemoveBackground,
  onRevertBackground,
  onSetImageRole,
  canRevertBackground,
}: {
  item?: { images?: ItemMediaImageMeta[] } | null;
  images: string[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAddImages: (files: File[]) => void;
  onMoveImage: (fromIndex: number, toIndex: number) => void;
  onDeleteImage: (index: number) => void;
  onReplaceImage?: (index: number, file: File) => Promise<void> | void;
  onRemoveBackground?: (index: number) => void;
  onRevertBackground?: (index: number) => void;
  onSetImageRole?: (imageId: string, role: ImageRole) => void;
  canRevertBackground?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);

  const [mounted, setMounted] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [draftPreviewUrl, setDraftPreviewUrl] = useState<string>("");
  const [rotation, setRotation] = useState(0);
  const [isPreparing, setIsPreparing] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [editTarget, setEditTarget] = useState<{ index: number; url: string; crop: ScanCropRect } | null>(null);
  const [isEditingImage, setIsEditingImage] = useState(false);

  const imageMeta = useMemo(() => {
    return Array.isArray(item?.images) ? item!.images! : [];
  }, [item]);

  const allEntries = useMemo<ImageEntry[]>(() => {
    return images.map((url, index) => {
      const meta = imageMeta[index];
      const role: ImageRole = meta?.role ?? (index === 0 ? "primary" : "detail");
      return {
        url,
        originalIndex: index,
        id: meta?.id,
        role,
      };
    });
  }, [images, imageMeta]);

  const visibleEntries = useMemo(() => {
    return allEntries.filter((entry) => entry.role !== "proof");
  }, [allEntries]);

  const proofEntries = useMemo(() => {
    return allEntries.filter((entry) => entry.role === "proof");
  }, [allEntries]);

  const activeVisibleIndex = useMemo(() => {
    const direct = visibleEntries.findIndex((entry) => entry.originalIndex === activeIndex);
    if (direct >= 0) return direct;
    return visibleEntries.length > 0 ? 0 : -1;
  }, [visibleEntries, activeIndex]);

  const activeVisibleEntry = activeVisibleIndex >= 0 ? visibleEntries[activeVisibleIndex] : null;
  const activeImage = activeVisibleEntry?.url ?? "";
  const viewerEntries = allEntries;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      if (draftPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(draftPreviewUrl);
      }
    };
  }, [draftPreviewUrl]);

  function clearDraft() {
    if (draftPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(draftPreviewUrl);
    }
    setDraftFile(null);
    setDraftPreviewUrl("");
    setRotation(0);
    setIsPreparing(false);
  }

  function openRetakeCamera() {
    if (cameraRef.current) {
      cameraRef.current.value = "";
      cameraRef.current.click();
    }
  }

  function startDraftFromFile(file: File) {
    if (draftPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(draftPreviewUrl);
    }
    setDraftFile(file);
    setDraftPreviewUrl(URL.createObjectURL(file));
    setRotation(0);
  }

  async function confirmDraft() {
    if (!draftFile) return;

    setIsPreparing(true);

    try {
      const prepared = await renderRotatedImageBlob(draftFile, rotation, {
        quality: 0.88,
        maxLongEdge: 1800,
      });
      clearDraft();
      onAddImages([prepared]);
    } catch (error) {
      console.error(error);
      setIsPreparing(false);
    }
  }

  async function imageUrlToFile(url: string, index: number) {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Could not load this image for editing.");
    const blob = await response.blob();
    return new File([blob], `item-photo-${index + 1}.jpg`, {
      type: blob.type || "image/jpeg",
      lastModified: Date.now(),
    });
  }

  function openViewerForEntry(entry: ImageEntry) {
    const nextViewerIndex = viewerEntries.findIndex((candidate) => candidate.originalIndex === entry.originalIndex);
    setViewerIndex(Math.max(0, nextViewerIndex));
    setViewerOpen(true);
  }

  function openEditorForEntry(entry: ImageEntry) {
    if (!onReplaceImage) return;
    setViewerOpen(false);
    setEditTarget({
      index: entry.originalIndex,
      url: entry.url,
      crop: FULL_CROP,
    });
  }

  async function applyImageEdit() {
    if (!editTarget || !onReplaceImage) return;
    setIsEditingImage(true);
    try {
      const file = await imageUrlToFile(editTarget.url, editTarget.index);
      const cropped = await cropImageFile(file, editTarget.crop);
      await onReplaceImage(editTarget.index, cropped);
      setEditTarget(null);
    } catch (error) {
      console.error(error);
      window.alert(error instanceof Error ? error.message : "Could not edit this image.");
    } finally {
      setIsEditingImage(false);
    }
  }

  function requestCloseImageEdit() {
    if (editTarget && !cropsEqual(editTarget.crop, FULL_CROP)) {
      const ok = window.confirm("Discard unsaved photo crop changes?");
      if (!ok) return;
    }
    setEditTarget(null);
  }

  function renderRoleControls(entry: ImageEntry) {
    if (!onSetImageRole || !entry.id) return null;

    return (
      <div className="mt-1 grid grid-cols-3 gap-1">
        <button
          type="button"
          onClick={() => onSetImageRole(entry.id!, "primary")}
          className={[
            "rounded-full px-2 py-1 text-[10px] ring-1",
            entry.role === "primary"
              ? "bg-cyan-500/20 text-cyan-100 ring-cyan-400/30"
              : "bg-[color:var(--pill)] ring-[color:var(--border)]",
          ].join(" ")}
          title="Set as primary"
        >
          P
        </button>
        <button
          type="button"
          onClick={() => onSetImageRole(entry.id!, "detail")}
          className={[
            "rounded-full px-2 py-1 text-[10px] ring-1",
            entry.role === "detail"
              ? "bg-white/15 text-white ring-white/20"
              : "bg-[color:var(--pill)] ring-[color:var(--border)]",
          ].join(" ")}
          title="Set as detail"
        >
          D
        </button>
        <button
          type="button"
          onClick={() => onSetImageRole(entry.id!, "proof")}
          className={[
            "rounded-full px-2 py-1 text-[10px] ring-1",
            entry.role === "proof"
              ? "bg-amber-500/20 text-amber-100 ring-amber-400/30"
              : "bg-[color:var(--pill)] ring-[color:var(--border)]",
          ].join(" ")}
          title="Set as proof"
        >
          ✓
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[112px_minmax(0,1fr)]">
        <div className="order-2 flex gap-2 overflow-x-auto lg:order-1 lg:flex-col lg:overflow-visible">
          {visibleEntries.map((entry, visibleIndex) => (
            <div key={`${entry.url}-${entry.originalIndex}`} className="shrink-0">
              <button
                type="button"
                onClick={() => {
                  onSelect(entry.originalIndex);
                  openViewerForEntry(entry);
                }}
                className={[
                  "relative block h-[96px] w-[96px] overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] ring-1 transition",
                  entry.originalIndex === (activeVisibleEntry?.originalIndex ?? -1)
                    ? "ring-[color:var(--pill-active-bg)] shadow-[0_0_0_1px_rgba(104,220,255,0.15)]"
                    : "ring-[color:var(--border)] hover:ring-white/20",
                ].join(" ")}
              >
                <img
                  src={entry.url}
                  alt=""
                  className="h-full w-full object-contain bg-black/15 p-1.5"
                  draggable={false}
                />
                <div className="pointer-events-none absolute left-1.5 top-1.5">
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 backdrop-blur",
                      roleTone(entry.role),
                    ].join(" ")}
                  >
                    {roleLabel(entry.role)}
                  </span>
                </div>
              </button>

              <div className="mt-1 grid grid-cols-3 gap-1">
                <button
                  type="button"
                  disabled={visibleIndex === 0}
                  onClick={() =>
                    onMoveImage(entry.originalIndex, visibleEntries[visibleIndex - 1].originalIndex)
                  }
                  className="rounded-full bg-[color:var(--pill)] px-2 py-1 text-[10px] ring-1 ring-[color:var(--border)] disabled:opacity-30"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={visibleIndex === visibleEntries.length - 1}
                  onClick={() =>
                    onMoveImage(entry.originalIndex, visibleEntries[visibleIndex + 1].originalIndex)
                  }
                  className="rounded-full bg-[color:var(--pill)] px-2 py-1 text-[10px] ring-1 ring-[color:var(--border)] disabled:opacity-30"
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteImage(entry.originalIndex)}
                  className="rounded-full bg-red-600/85 px-2 py-1 text-[10px] text-white ring-1 ring-red-500/40"
                  title="Delete image"
                >
                  ×
                </button>
              </div>

              {renderRoleControls(entry)}
            </div>
          ))}

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-[96px] w-[96px] shrink-0 items-center justify-center rounded-2xl bg-[color:var(--pill)] text-sm ring-1 ring-[color:var(--border)]"
          >
            + Add
          </button>
        </div>

        <div className="order-1 lg:order-2">
          <div className="group relative aspect-[4/3] overflow-hidden rounded-[28px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),rgba(255,255,255,0.015)_45%,rgba(0,0,0,0.18)_100%)] ring-1 ring-[color:var(--border)]">
            {activeImage && activeVisibleEntry ? (
              <button
                type="button"
                onClick={() => {
                  const nextViewerIndex = viewerEntries.findIndex(
                    (entry) => entry.originalIndex === activeVisibleEntry.originalIndex
                  );
                  setViewerIndex(Math.max(0, nextViewerIndex));
                  setViewerOpen(true);
                }}
                className="block h-full w-full"
              >
                <img
                  src={activeImage}
                  alt=""
                  draggable={false}
                  className="h-full w-full object-contain bg-black/10 p-3 transition duration-300 group-hover:scale-[1.01]"
                />
              </button>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-[color:var(--muted)]">
                <div>No main collector image yet</div>
                {proofEntries.length > 0 ? (
                  <div className="text-xs text-[color:var(--muted)]">
                    Proof images are hidden from the main viewer below.
                  </div>
                ) : null}
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/25 to-transparent" />

            {activeVisibleEntry ? (
              <div className="absolute left-3 top-3">
                <span
                  className={[
                    "rounded-full px-3 py-1 text-xs font-medium ring-1 backdrop-blur",
                    roleTone(activeVisibleEntry.role),
                  ].join(" ")}
                >
                  {roleLabel(activeVisibleEntry.role)}
                </span>
              </div>
            ) : null}

            <div className="absolute bottom-3 right-3 flex flex-wrap gap-2">
              {onReplaceImage && activeVisibleEntry ? (
                <button
                  type="button"
                  onClick={() => openEditorForEntry(activeVisibleEntry)}
                  className="rounded-full bg-black/45 px-3 py-2 text-xs text-white ring-1 ring-white/15 backdrop-blur"
                >
                  Edit Photo
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-full bg-black/45 px-3 py-2 text-xs text-white ring-1 ring-white/15 backdrop-blur"
              >
                Add image
              </button>
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="rounded-full bg-black/45 px-3 py-2 text-xs text-white ring-1 ring-white/15 backdrop-blur"
              >
                Camera
              </button>
              {onRemoveBackground && activeVisibleEntry ? (
                <button
                  type="button"
                  onClick={() => onRemoveBackground(activeVisibleEntry.originalIndex)}
                  className="rounded-full bg-black/45 px-3 py-2 text-xs text-white ring-1 ring-white/15 backdrop-blur"
                >
                  Remove BG
                </button>
              ) : null}
              {onRevertBackground && canRevertBackground && activeVisibleEntry ? (
                <button
                  type="button"
                  onClick={() => onRevertBackground(activeVisibleEntry.originalIndex)}
                  className="rounded-full bg-black/45 px-3 py-2 text-xs text-white ring-1 ring-white/15 backdrop-blur"
                >
                  Revert
                </button>
              ) : null}
            </div>
          </div>

          {proofEntries.length > 0 ? (
            <div className="mt-3 rounded-[18px] bg-black/10 p-3 ring-1 ring-white/8">
              <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
                PROOF IMAGES
              </div>
              <div className="mt-2 text-xs text-[color:var(--muted)]">
                Receipts, certs, barcodes, provenance. Hidden from the main viewer on purpose.
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {proofEntries.map((entry) => (
                  <div
                    key={`proof-${entry.url}-${entry.originalIndex}`}
                    className="rounded-2xl bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-2 ring-1 ring-[color:var(--border)]"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(entry.originalIndex);
                        openViewerForEntry(entry);
                      }}
                      className="block h-[140px] w-full overflow-hidden rounded-xl"
                    >
                      <img
                        src={entry.url}
                        alt=""
                        className="h-full w-full object-contain bg-black/15 p-2"
                        draggable={false}
                      />
                    </button>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span
                        className={[
                          "rounded-full px-2 py-1 text-[10px] font-medium ring-1",
                          roleTone(entry.role),
                        ].join(" ")}
                      >
                        {roleLabel(entry.role)}
                      </span>

                      <button
                        type="button"
                        onClick={() => onDeleteImage(entry.originalIndex)}
                        className="rounded-full bg-red-600/85 px-2 py-1 text-[10px] text-white ring-1 ring-red-500/40"
                        title="Delete image"
                      >
                        Delete
                      </button>
                    </div>

                    {renderRoleControls(entry)}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length === 1) {
            startDraftFromFile(files[0]);
          } else if (files.length > 1) {
            onAddImages(files);
          }
          e.currentTarget.value = "";
        }}
      />

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files[0]) {
            startDraftFromFile(files[0]);
          }
          e.currentTarget.value = "";
        }}
      />

      {viewerOpen && viewerEntries.length > 0 ? (
        <ImageViewer
          images={viewerEntries.map((entry) => entry.url)}
          index={Math.max(0, viewerIndex)}
          onClose={() => setViewerOpen(false)}
          onEdit={
            onReplaceImage
              ? (index) => {
                  const entry = viewerEntries[index];
                  if (entry) openEditorForEntry(entry);
                }
              : undefined
          }
          onDelete={(index) => {
            const entry = viewerEntries[index];
            if (!entry) return;
            setViewerOpen(false);
            onDeleteImage(entry.originalIndex);
          }}
        />
      ) : null}

      {mounted && editTarget && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[95] flex h-[100dvh] w-[100dvw] items-start justify-center overflow-y-auto bg-black/90 px-3 pb-4 pt-3 backdrop-blur-sm sm:px-4 sm:pt-4"
              role="dialog"
              aria-modal="true"
              aria-label="Edit saved photo"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) requestCloseImageEdit();
              }}
            >
              <div className="w-full max-w-[min(94dvw,980px)]">
                <ScanCropEditor
                  imageUrl={editTarget.url}
                  crop={editTarget.crop}
                  onChange={(crop) => setEditTarget((prev) => (prev ? { ...prev, crop } : prev))}
                  onApply={() => void applyImageEdit()}
                  onReset={() => setEditTarget((prev) => (prev ? { ...prev, crop: FULL_CROP } : prev))}
                  onCancel={requestCloseImageEdit}
                  isApplying={isEditingImage}
                  title="EDIT PHOTO"
                  description="Crop and zoom this saved item photo. The edited version replaces the current photo."
                  applyLabel="Save Photo"
                  compact
                />
              </div>
            </div>,
            document.body
          )
        : null}

      {draftFile ? (
        <div className="fixed inset-0 z-[95] bg-black/90 backdrop-blur-sm">
          <div className="absolute inset-0 flex items-start justify-center overflow-auto px-4 pt-16 pb-8">
            <div className="w-full max-w-3xl rounded-[24px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)] shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
                    PHOTO REVIEW
                  </div>
                  <div className="mt-1 text-lg font-semibold text-[color:var(--fg)]">
                    Rotate it, use it, or retake it
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearDraft}
                  className="rounded-full bg-[color:var(--pill)] px-3 py-2 text-sm ring-1 ring-[color:var(--border)]"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 overflow-hidden rounded-[22px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),rgba(255,255,255,0.01)_50%,rgba(0,0,0,0.16)_100%)] ring-1 ring-[color:var(--border)]">
                <div className="aspect-[4/3]">
                  <img
                    src={draftPreviewUrl}
                    alt="Draft preview"
                    className="h-full w-full object-contain bg-black/10 p-3"
                    style={{ transform: `rotate(${rotation}deg)` }}
                    draggable={false}
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="rounded-full bg-[color:var(--pill)] px-3 py-2 text-xs ring-1 ring-[color:var(--border)]">
                  Rotate: {rotation}°
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setRotation((prev) => (prev + 90) % 360)}
                  disabled={isPreparing}
                  className="rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm ring-1 ring-[color:var(--border)]"
                >
                  Rotate 90°
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDraft()}
                  disabled={isPreparing}
                  className="rounded-full bg-[color:var(--pill-active-bg)] px-4 py-2 text-sm font-medium text-[color:var(--fg)] ring-1 ring-[color:var(--pill-active-bg)]"
                >
                  {isPreparing ? "Preparing..." : "Use Photo"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearDraft();
                    setTimeout(() => {
                      openRetakeCamera();
                    }, 0);
                  }}
                  disabled={isPreparing}
                  className="rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm ring-1 ring-[color:var(--border)]"
                >
                  Retake
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
