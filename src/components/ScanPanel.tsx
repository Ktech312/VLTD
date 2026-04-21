"use client";

import type { ChangeEvent } from "react";

import { type ScanItemType } from "@/lib/scanAutofill";
import type { ScanSessionState } from "@/lib/scanners/scanSession";

function selectClass() {
  return "h-10 rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none";
}

function actionButtonClass(primary = false) {
  return primary
    ? "rounded-xl bg-[color:var(--pill-active-bg)] px-3 py-2.5 text-sm font-medium text-[color:var(--fg)] ring-1 ring-[color:var(--pill-active-bg)] disabled:opacity-40"
    : "rounded-xl bg-[color:var(--pill)] px-3 py-2.5 text-sm ring-1 ring-[color:var(--border)] disabled:opacity-40";
}

function confidenceTone(confidence: "low" | "medium" | "high") {
  if (confidence === "high") return "bg-emerald-500/15 text-emerald-200 ring-emerald-400/20";
  if (confidence === "medium") return "bg-amber-500/15 text-amber-200 ring-amber-400/20";
  return "bg-red-500/15 text-red-200 ring-red-400/20";
}

export default function ScanPanel({
  session,
  scanType,
  isScanning,
  isBookLookupRunning,
  isComicLookupRunning,
  isUpcLookupRunning = false,
  saveScanAsPhoto,
  onScanTypeChange,
  onUseCamera,
  onUploadImage,
  onScanAutofill,
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
  saveScanAsPhoto: boolean;
  onScanTypeChange: (value: ScanItemType) => void;
  onUseCamera: () => void;
  onUploadImage: () => void;
  onScanAutofill: () => void;
  onBookLookup: () => void;
  onComicLookup: () => void;
  onUpcLookup?: () => void;
  onClearImage: () => void;
  onToggleSaveScanAsPhoto: (checked: boolean) => void;
}) {
  const previewUrl = session.image?.previewUrl ?? "";
  const hasImage = Boolean(previewUrl);
  const review = session.review;

  return (
    <section className="rounded-[16px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
          SCAN (TEMPORARY)
        </div>
        <div className="text-[10px] text-red-300">
          NOT SAVED BY DEFAULT
        </div>
      </div>

      {/* PREVIEW */}
      <div className="mt-2 overflow-hidden rounded-[14px] bg-black/20 p-2 ring-1 ring-red-500/20">
        <div className="flex h-[180px] items-center justify-center overflow-hidden rounded-[10px] bg-black/20">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Temporary scan preview"
              className="h-full w-full object-contain opacity-90"
            />
          ) : (
            <div className="px-4 text-center text-xs text-[color:var(--muted)]">
              No scan image (used for OCR / barcode only)
            </div>
          )}
        </div>
      </div>

      {/* CONTROLS */}
      <div className="mt-3 grid gap-2">
        <div className="grid gap-1.5">
          <label className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">
            SCAN TYPE
          </label>
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

        <button onClick={onUseCamera} className={actionButtonClass()}>
          Use Camera
        </button>

        <button onClick={onUploadImage} className={actionButtonClass()}>
          Upload Scan Image
        </button>

        <button
          onClick={onScanAutofill}
          disabled={!hasImage || isScanning}
          className={actionButtonClass(true)}
        >
          {isScanning ? "Scanning..." : "Run OCR Autofill"}
        </button>

        <button
          onClick={onBookLookup}
          disabled={!hasImage || isBookLookupRunning}
          className={actionButtonClass()}
        >
          {isBookLookupRunning ? "Looking up..." : "ISBN Lookup"}
        </button>

        <button
          onClick={onComicLookup}
          disabled={!hasImage || isComicLookupRunning}
          className={actionButtonClass()}
        >
          {isComicLookupRunning ? "Scanning..." : "Comic Scan"}
        </button>

        <button
          onClick={onUpcLookup}
          disabled={(!hasImage && !session.barcodeDigits) || isUpcLookupRunning}
          className={actionButtonClass()}
        >
          {isUpcLookupRunning ? "Looking up..." : "UPC Lookup"}
        </button>

        <button
          onClick={onClearImage}
          disabled={!hasImage}
          className={actionButtonClass()}
        >
          Clear Scan
        </button>
      </div>

      {/* SAVE TO VAULT TOGGLE */}
      <label className="mt-3 flex items-start gap-2 rounded-xl bg-red-500/10 p-3 text-sm ring-1 ring-red-500/20">
        <input
          type="checkbox"
          checked={saveScanAsPhoto}
          onChange={(e) => onToggleSaveScanAsPhoto(e.target.checked)}
          className="mt-1"
        />
        <span>
          Save this scan as a <strong>PROOF image</strong>
          <div className="mt-1 text-xs text-[color:var(--muted)]">
            Off by default. This will NOT replace your main item photo.
          </div>
        </span>
      </label>

      {/* STATUS */}
      {session.status !== "idle" && (
        <div className="mt-3 rounded-xl bg-black/10 p-3 ring-1 ring-white/8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] tracking-[0.16em] text-[color:var(--muted2)]">
              STATUS
            </span>

            <span className="text-xs text-[color:var(--fg)]">
              {session.status.replaceAll("_", " ")}
            </span>

            {review && (
              <span
                className={[
                  "rounded-full px-2.5 py-1 text-[11px] font-medium ring-1",
                  confidenceTone(review.confidence),
                ].join(" ")}
              >
                {review.confidence.toUpperCase()} • {review.score}/100
              </span>
            )}
          </div>

          {session.barcodeDigits && (
            <div className="mt-2 text-xs text-[color:var(--fg)]">
              Barcode: <span className="font-medium">{session.barcodeDigits}</span>
            </div>
          )}

          {session.errorMessage && (
            <div className="mt-2 text-xs text-red-200">
              {session.errorMessage}
            </div>
          )}

          {review?.warnings?.length && (
            <div className="mt-2 text-xs text-[color:var(--muted)]">
              {review.warnings.join(" ")}
            </div>
          )}
        </div>
      )}

      {/* FOOTNOTE */}
      <div className="mt-4 rounded-xl bg-black/10 p-3 text-xs text-[color:var(--muted)] ring-1 ring-white/8">
        This image is for scanning only (OCR / barcode). It is NOT part of your collection unless explicitly saved.
      </div>
    </section>
  );
}
