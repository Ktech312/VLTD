"use client";
// v2 carousel layout
import { useState, type ChangeEvent } from "react";

import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { type ScanItemType } from "@/lib/scanAutofill";
import type { ScanSessionState } from "@/lib/scanners/scanSession";

function selectClass() {
  return "h-9 rounded-lg bg-[color:var(--pill)] px-2 text-xs ring-1 ring-[color:var(--border)] focus:outline-none";
}

function actionButtonClass(primary = false) {
  return primary
    ? "min-h-8 rounded-full bg-[color:var(--pill-active-bg)] px-3 py-1.5 text-xs font-medium text-[color:var(--fg)] ring-1 ring-[color:var(--pill-active-bg)] disabled:opacity-40"
    : "min-h-8 rounded-full bg-[color:var(--pill)] px-3 py-1.5 text-xs ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)] disabled:opacity-40";
}

function chipClass(active = false) {
  return active
    ? "rounded-full bg-[color:var(--pill-active-bg)] px-2.5 py-0.5 text-[10px] font-medium text-[color:var(--fg)] ring-1 ring-[color:var(--pill-active-bg)]"
    : "rounded-full bg-[color:var(--surface)] px-2.5 py-0.5 text-[10px] text-[color:var(--muted)] ring-1 ring-[color:var(--border)]";
}


export default function ScanPanel({
  session,
  scanType,
  isScanning,
  isBookLookupRunning,
  isComicLookupRunning,
  isUpcLookupRunning = false,
  isVisionLookupRunning = false,
  saveScanAsPhoto,
  onScanTypeChange,
  onUseCamera,
  onUploadImage,
  onScanAutofill,
  onOpenImage,
  onCropImage = () => {},
  onBookLookup,
  onComicLookup,
  onUpcLookup = () => {},
  onClearImage,
  onToggleSaveScanAsPhoto,
  onSaveItem,
  canSaveItem = false,
  capturedPhotos = [],
  activeCapturedPhotoId = "",
  onSelectCapturedPhoto,
}: {
  session: ScanSessionState;
  scanType: ScanItemType;
  isScanning: boolean;
  isBookLookupRunning: boolean;
  isComicLookupRunning: boolean;
  isUpcLookupRunning?: boolean;
  isVisionLookupRunning?: boolean;
  saveScanAsPhoto: boolean;
  onScanTypeChange: (value: ScanItemType) => void;
  onUseCamera: () => void;
  onUploadImage: () => void;
  onScanAutofill: () => void;
  onOpenImage?: () => void;
  onCropImage?: () => void;
  onBookLookup: () => void;
  onComicLookup: () => void;
  onUpcLookup?: () => void;
  onClearImage: () => void;
  onToggleSaveScanAsPhoto: (checked: boolean) => void;
  onSaveItem?: () => void;
  canSaveItem?: boolean;
  capturedPhotos?: Array<{
    id: string;
    previewUrl: string;
    role: string;
  }>;
  activeCapturedPhotoId?: string;
  onSelectCapturedPhoto?: (id: string) => void;
}) {
  const previewUrl = session.image?.previewUrl ?? "";
  const hasImage = Boolean(previewUrl);
  const review = session.review;
  const isIdentifying =
    isScanning || isBookLookupRunning || isComicLookupRunning || isUpcLookupRunning || isVisionLookupRunning;
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <section className="rounded-[22px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">CAPTURE AND IDENTIFY</div>
          <div className="mt-1 text-xs text-[color:var(--muted)]">
            Take item pictures here. Use one picture to identify/autofill, then save the item.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className={chipClass(hasImage)}>1. Photo</span>
          <span className={chipClass(Boolean(review) || isIdentifying)}>2. Review</span>
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_188px]">
        {/* Photo carousel — replaces the old left thumbnail panel + center preview */}
        {capturedPhotos.length > 0 ? (
          <div className="flex min-h-[160px] gap-2 overflow-x-auto rounded-[20px] bg-[color:var(--surface)] p-2 ring-1 ring-[color:var(--border)] [scrollbar-width:none]">
            {capturedPhotos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => {
                  if (activeCapturedPhotoId === photo.id) {
                    (onOpenImage ?? onCropImage)?.();
                  } else {
                    onSelectCapturedPhoto?.(photo.id);
                  }
                }}
                className={[
                  "relative shrink-0 overflow-hidden rounded-[14px] ring-2 transition",
                  activeCapturedPhotoId === photo.id
                    ? "scale-[1.02] ring-[color:var(--pill-active-bg)]"
                    : "ring-transparent hover:ring-[color:var(--border)]",
                ].join(" ")}
                style={{ width: 120, minHeight: 144 }}
                title={activeCapturedPhotoId === photo.id ? "Click to edit photo" : `Select ${photo.role} photo`}
              >
                <ProgressiveImage
                  src={photo.previewUrl}
                  alt={`${photo.role} item photo`}
                  className="h-full w-full"
                  imageClassName="object-cover"
                  draggable={false}
                />
                {activeCapturedPhotoId === photo.id ? (
                  <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/50 to-transparent pb-2">
                    <span className="rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-bold text-white/90 backdrop-blur-sm">
                      Active
                    </span>
                  </div>
                ) : null}
              </button>
            ))}
            {/* Add another photo */}
            <button
              type="button"
              onClick={onUseCamera}
              className="flex shrink-0 items-center justify-center rounded-[14px] border border-dashed border-white/20 text-[color:var(--muted)] transition hover:border-white/40"
              style={{ width: 60, minHeight: 144 }}
              title="Take another picture"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onUseCamera}
            className="flex min-h-[160px] items-center justify-center overflow-hidden rounded-[20px] bg-[color:var(--surface)] p-2 text-center ring-1 ring-[color:var(--border)] transition hover:bg-black/25 focus:outline-none"
            title="Take a new picture"
          >
            <span
              className="pointer-events-none relative z-10 flex items-center justify-center rounded-full p-3 transition"
              style={{ background: "linear-gradient(135deg, #8B6914, #F5B548)", color: "#0B0B0B" }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </span>
          </button>
        )}

        <div className="grid content-start gap-1.5 rounded-[16px] bg-[color:var(--surface)] p-2 ring-1 ring-[color:var(--border)]">
          {/* Gold folder-upload icon — centered */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onUploadImage}
              title="Upload from file"
              className="flex items-center justify-center rounded-full p-0.5 transition hover:opacity-90 active:scale-95 focus:outline-none"
            >
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <defs>
                  <radialGradient id="spBg" cx="38%" cy="32%" r="62%">
                    <stop offset="0%" stopColor="#1c1100" />
                    <stop offset="100%" stopColor="#040200" />
                  </radialGradient>
                  <linearGradient id="spRing" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#5C3D08" />
                    <stop offset="28%" stopColor="#F5D070" />
                    <stop offset="62%" stopColor="#C89020" />
                    <stop offset="100%" stopColor="#5C3D08" />
                  </linearGradient>
                  <linearGradient id="spFolder" x1="0.2" y1="0" x2="0.8" y2="1">
                    <stop offset="0%" stopColor="#FFE080" />
                    <stop offset="55%" stopColor="#F5B548" />
                    <stop offset="100%" stopColor="#8B6010" />
                  </linearGradient>
                  <linearGradient id="spShine" x1="0" y1="0" x2="0.7" y2="0.7">
                    <stop offset="0%" stopColor="white" stopOpacity="0.52" />
                    <stop offset="100%" stopColor="white" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Dark glossy circle */}
                <circle cx="24" cy="24" r="23" fill="url(#spBg)" />
                {/* Gold ring */}
                <circle cx="24" cy="24" r="22.2" fill="none" stroke="url(#spRing)" strokeWidth="2.4" />
                {/* Folder body */}
                <path d="M9 27a2 2 0 0 1 2-2h6.5l2 2.5H37a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V27z" fill="url(#spFolder)" />
                {/* Upload arrow pointing up out of folder */}
                <path d="M24 14v14" stroke="#0B0700" strokeWidth="2.2" strokeLinecap="round" />
                <path d="M20 18l4-4 4 4" stroke="#0B0700" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                {/* Shine arc upper-left */}
                <ellipse cx="15" cy="12" rx="10" ry="5.5" fill="url(#spShine)" transform="rotate(-22 15 12)" />
              </svg>
            </button>
          </div>

          <button
            type="button"
            onClick={onScanAutofill}
            disabled={!hasImage || isIdentifying}
            className="flex w-full items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-bold transition disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #8B6914, #F5B548)", color: "#0B0B0B", boxShadow: "0 4px 18px rgba(245,181,72,0.28)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
            {isIdentifying ? "Reading..." : "Auto Identify"}
          </button>

          <button
            type="button"
            onClick={() => setShowAdvanced((prev) => !prev)}
            className={actionButtonClass()}
          >
            More Identify Options
          </button>

          {onSaveItem ? (
            <button
              type="button"
              onClick={onSaveItem}
              disabled={!canSaveItem}
              className={actionButtonClass()}
            >
              Save
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-2 rounded-[12px] bg-[color:var(--surface)] px-3 py-1.5 text-[11px] leading-5 text-[color:var(--muted2)] ring-1 ring-[color:var(--border)]">
        Auto Identify reads the selected picture for barcode, text, and AI clues. Barcode/OCR can work without AI; Gemini needs `Gemini_API_Key` set in Vercel environment variables.
      </div>

      {/* Identify Options overlay popup */}
      {showAdvanced ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)" }}
          onClick={() => setShowAdvanced(false)}
        >
          <div
            className="w-full max-w-sm rounded-[22px] bg-[color:var(--surface)] p-4 shadow-2xl ring-1 ring-[color:var(--border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-[0.18em] text-[color:var(--muted2)]">IDENTIFY OPTIONS</span>
              <button
                type="button"
                onClick={() => setShowAdvanced(false)}
                className="rounded-full bg-[color:var(--pill)] px-3 py-1 text-xs ring-1 ring-[color:var(--border)] hover:bg-[color:var(--pill-hover)]"
              >
                ✕
              </button>
            </div>

            <label className="mb-1 block text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">IDENTIFY MODE</label>
            <select
              className={selectClass()}
              value={scanType}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                onScanTypeChange(e.target.value as ScanItemType)
              }
            >
              <option value="auto">Auto Detect</option>
              <option value="comic">Comic</option>
              <option value="card">Trading Card</option>
              <option value="graded_card">Graded Card</option>
              <option value="book">Book</option>
            </select>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onBookLookup}
                disabled={!hasImage || isBookLookupRunning}
                className={actionButtonClass()}
              >
                {isBookLookupRunning ? "Looking Up..." : "Book / ISBN"}
              </button>
              <button
                type="button"
                onClick={onComicLookup}
                disabled={!hasImage || isComicLookupRunning}
                className={actionButtonClass()}
              >
                {isComicLookupRunning ? "Scanning..." : "Comic Scan"}
              </button>
              <button
                type="button"
                onClick={onUpcLookup}
                disabled={(!hasImage && !session.barcodeDigits) || isUpcLookupRunning}
                className={actionButtonClass()}
              >
                {isUpcLookupRunning ? "Looking Up..." : "Product Barcode"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
