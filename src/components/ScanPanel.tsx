"use client";

import { useState, type ChangeEvent } from "react";

import { type ScanItemType } from "@/lib/scanAutofill";
import type { ScanSessionState } from "@/lib/scanners/scanSession";

function selectClass() {
  return "h-10 rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none";
}

function actionButtonClass(primary = false) {
  return primary
    ? "rounded-xl bg-[color:var(--pill-active-bg)] px-3 py-2.5 text-sm font-medium text-[color:var(--fg)] ring-1 ring-[color:var(--pill-active-bg)] disabled:opacity-40"
    : "rounded-xl bg-[color:var(--pill)] px-3 py-2.5 text-sm ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)] disabled:opacity-40";
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
}) {
  const previewUrl = session.image?.previewUrl ?? "";
  const hasImage = Boolean(previewUrl);
  const review = session.review;
  const isIdentifying =
    isScanning || isBookLookupRunning || isComicLookupRunning || isUpcLookupRunning || isVisionLookupRunning;
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <section className="rounded-[16px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">SMART SCAN</div>
          <div className="mt-1 text-xs text-[color:var(--muted)]">
            Take one photo. The app will try barcode, product or book match, text, then AI.
          </div>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-[14px] bg-black/20 p-2 ring-1 ring-[color:var(--border)]">
        <button
          type="button"
          onClick={previewUrl ? onCropImage : onUseCamera}
          className="flex h-[180px] w-full items-center justify-center overflow-hidden rounded-[10px] bg-black/20 text-left transition hover:bg-black/25 focus:outline-none focus:ring-2 focus:ring-[color:var(--pill-active-bg)]"
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Temporary scan preview"
              className="h-full w-full object-contain opacity-90"
            />
          ) : (
            <div className="px-4 text-center text-sm text-[color:var(--muted)]">
              Tap here to scan an item
            </div>
          )}
        </button>
        <div className="mt-2 text-center text-[11px] text-[color:var(--muted2)]">
          {previewUrl ? "Tap the photo to recrop it." : "Tap the square to open your camera."}
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={onUseCamera} className={actionButtonClass(true)}>
          Scan Item
        </button>
        <button type="button" onClick={onUploadImage} className={actionButtonClass()}>
          Choose Photo
        </button>
      </div>

      <div className="mt-2 grid gap-2">
        <button
          type="button"
          onClick={onScanAutofill}
          disabled={!hasImage || isIdentifying}
          className={actionButtonClass(hasImage)}
        >
          {isIdentifying ? "Reading the item..." : "Smart Identify"}
        </button>

        <button
          type="button"
          onClick={() => setShowAdvanced((prev) => !prev)}
          className={actionButtonClass()}
        >
          {showAdvanced ? "Hide More Tools" : "More Tools"}
        </button>
      </div>

      {showAdvanced ? (
        <div className="mt-3 grid gap-3 rounded-[14px] bg-black/10 p-3 ring-1 ring-white/8">
          <div className="grid gap-1.5">
            <label className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">SCAN MODE</label>
            <div className="text-xs text-[color:var(--muted)]">
              Leave this on Auto unless you already know the item type.
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

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={onBookLookup}
              disabled={!hasImage || isBookLookupRunning}
              className={actionButtonClass()}
            >
              {isBookLookupRunning ? "Looking up..." : "Book / ISBN"}
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
              {isUpcLookupRunning ? "Looking up..." : "Product Barcode"}
            </button>

            <button type="button" onClick={onClearImage} disabled={!hasImage} className={actionButtonClass()}>
              Clear Scan
            </button>
          </div>

          <label className="flex items-start gap-2 rounded-xl bg-red-500/10 p-3 text-sm ring-1 ring-red-500/20">
            <input
              type="checkbox"
              checked={saveScanAsPhoto}
              onChange={(e) => onToggleSaveScanAsPhoto(e.target.checked)}
              className="mt-1"
            />
            <span>
              Save this scan as a <strong>proof image</strong>
              <div className="mt-1 text-xs text-[color:var(--muted)]">
                Off by default. This keeps the scan separate from the main item photo.
              </div>
            </span>
          </label>
        </div>
      ) : null}

      {(session.status !== "idle" || review || session.errorMessage) && (
        <div className="mt-3 rounded-xl bg-black/10 p-3 ring-1 ring-white/8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] tracking-[0.16em] text-[color:var(--muted2)]">STATUS</span>
            <span className="text-xs text-[color:var(--fg)]">{prettyStatus(session.status)}</span>

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
            <div className="mt-2 text-xs text-red-200">{session.errorMessage}</div>
          ) : null}

          {!session.errorMessage && review?.warnings?.length ? (
            <div className="mt-2 text-xs text-[color:var(--muted)]">{review.warnings.join(" ")}</div>
          ) : null}
        </div>
      )}
    </section>
  );
}
