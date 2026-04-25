"use client";

import { useState, type ChangeEvent } from "react";

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
    : "rounded-full bg-black/10 px-2.5 py-0.5 text-[10px] text-[color:var(--muted)] ring-1 ring-white/8";
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
    <section className="rounded-[24px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
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

      <div className="mt-3 grid gap-3 lg:grid-cols-[112px_minmax(0,1fr)_180px]">
        <div className="min-h-[118px] rounded-[18px] bg-[color:var(--pill)] p-2 ring-1 ring-[color:var(--border)] sm:min-h-[142px] lg:min-h-0">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-[10px] tracking-[0.16em] text-[color:var(--muted2)]">PICTURES TAKEN</div>
            <div className="rounded-full bg-black/15 px-2 py-0.5 text-[10px] text-[color:var(--muted)]">
              {capturedPhotos.length}
            </div>
          </div>

          {capturedPhotos.length ? (
            <div className="grid max-h-[126px] grid-cols-3 gap-1.5 overflow-auto pr-1">
              {capturedPhotos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => onSelectCapturedPhoto?.(photo.id)}
                  className={[
                    "overflow-hidden rounded-xl bg-black/20 p-1 ring-1 transition",
                    activeCapturedPhotoId === photo.id
                      ? "ring-[color:var(--pill-active-bg)]"
                      : "ring-white/10",
                  ].join(" ")}
                  title={`Use ${photo.role} photo for identify`}
                >
                  <span className="block aspect-square overflow-hidden rounded-md">
                    <img src={photo.previewUrl} alt={`${photo.role} item photo`} className="h-full w-full object-cover" />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={onUseCamera}
              className="flex h-[84px] w-full items-center justify-center rounded-[14px] border border-dashed border-white/20 text-xs text-[color:var(--muted)]"
            >
              No pictures yet
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={previewUrl ? onCropImage : onUseCamera}
          className="flex min-h-[118px] items-center justify-center overflow-hidden rounded-[24px] bg-black/20 p-2 text-center ring-1 ring-[color:var(--border)] transition hover:bg-black/25 focus:outline-none focus:ring-2 focus:ring-[color:var(--pill-active-bg)] sm:min-h-[142px] lg:min-h-0"
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Selected item photo for identify"
              className="h-full max-h-[160px] w-full object-contain opacity-95"
            />
          ) : (
            <span className="rounded-full border border-white/60 px-4 py-2 text-xs text-[color:var(--fg)]">
              Take New Picture
            </span>
          )}
        </button>

        <div className="grid content-start gap-2 rounded-[18px] bg-black/10 p-2 ring-1 ring-white/8">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onUseCamera} className={actionButtonClass(true)}>
              Camera
            </button>
            <button type="button" onClick={onUploadImage} className={actionButtonClass()}>
              File
            </button>
          </div>

          {hasImage ? (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={onCropImage} className={actionButtonClass()}>
                Crop
              </button>
              <button type="button" onClick={onClearImage} className={actionButtonClass()}>
                Clear
              </button>
            </div>
          ) : null}

          <button
            type="button"
            onClick={onScanAutofill}
            disabled={!hasImage || isIdentifying}
            className={actionButtonClass(true)}
          >
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

      <div className="mt-2 rounded-[12px] bg-black/10 px-3 py-2 text-[11px] leading-5 text-[color:var(--muted2)] ring-1 ring-white/8">
        Auto Identify reads the selected picture for barcode, text, and AI clues. Barcode/OCR can work without AI; Gemini needs
        {" "}
        `GEMINI_API_KEY`
        {" "}
        or `GOOGLE_API_KEY` on the server.
      </div>

      {showAdvanced ? (
        <div className="mt-2 grid gap-3 rounded-[16px] bg-black/10 p-3 ring-1 ring-white/8 md:grid-cols-[220px_minmax(0,1fr)]">
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
        <div className="mt-2 rounded-[16px] bg-black/10 p-3 ring-1 ring-white/8">
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
