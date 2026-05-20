"use client";

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

function confidenceTone(confidence: "low" | "medium" | "high") {
  if (confidence === "high") return "bg-emerald-500/15 text-emerald-200 ring-emerald-400/20";
  if (confidence === "medium") return "bg-amber-500/15 text-amber-200 ring-amber-400/20";
  return "bg-red-500/15 text-red-200 ring-red-400/20";
}

function prettyStatus(status: ScanSessionState["status"]) {
  if (status === "image_attached") return "Photo ready";
  if (status === "review_ready") return "Review ready";
  if (status === "applied") return "Applied";
  if (status === "failed") return "Needs attention";
  if (status === "scanning") return "Working";
  return "Waiting";
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
          <div className="grid grid-cols-2 gap-2">
            {/* Camera icon */}
            <button type="button" onClick={onUseCamera} className={actionButtonClass(true)} title="Take a picture">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </button>
            {/* Upload icon */}
            <button type="button" onClick={onUploadImage} className={actionButtonClass()} title="Upload from file">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
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
            {showAdvanced ? "Hide Options" : "More Identify Options"}
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

      {showAdvanced ? (
        <div className="mt-2 grid gap-3 rounded-[16px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] md:grid-cols-[220px_minmax(0,1fr)]">
          <div className="grid gap-1.5">
            <label className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">IDENTIFY MODE</label>
            <div className="text-xs text-[color:var(--muted)]">
              Optional. Leave this on Auto unless you already know the item type.
            </div>
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
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
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

          <label className="flex items-start gap-3 rounded-2xl bg-red-500/10 p-3 text-sm ring-1 ring-red-500/20 md:col-span-2">
            <input
              type="checkbox"
              checked={saveScanAsPhoto}
              onChange={(e) => onToggleSaveScanAsPhoto(e.target.checked)}
              className="mt-1"
            />
            <span>
              Also mark the selected picture as a <strong>proof photo</strong>
              <div className="mt-1 text-xs text-[color:var(--muted)]">
                Optional. Normal captured pictures already save with the item.
              </div>
            </span>
          </label>
        </div>
      ) : null}

      {(session.status !== "idle" || review || session.errorMessage) && (
        <div className="mt-2 rounded-[16px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] tracking-[0.16em] text-[color:var(--muted2)]">STATUS</span>
            <span className="text-sm text-[color:var(--fg)]">{prettyStatus(session.status)}</span>

            {review ? (
              <span
                className={[
                  "rounded-full px-2.5 py-1 text-[11px] font-medium ring-1",
                  confidenceTone(review.confidence),
                ].join(" ")}
              >
                {review.confidence.toUpperCase()} / {review.score}/100
              </span>
            ) : null}
          </div>

          {session.barcodeDigits ? (
            <div className="mt-2 text-xs text-[color:var(--fg)]">
              Barcode: <span className="font-medium">{session.barcodeDigits}</span>
            </div>
          ) : null}

          {session.errorMessage ? (
            <div className="mt-2 text-sm text-red-200">{session.errorMessage}</div>
          ) : null}

          {!session.errorMessage && review?.warnings?.length ? (
            <div className="mt-2 text-sm text-[color:var(--muted)]">{review.warnings.join(" ")}</div>
          ) : null}
        </div>
      )}
    </section>
  );
}
