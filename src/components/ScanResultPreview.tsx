"use client";

import { PillButton } from "@/components/ui/PillButton";
import type { ScanSessionReview } from "@/lib/scanners/scanSession";

function confidenceTone(confidence: "low" | "medium" | "high") {
  if (confidence === "high") return "bg-emerald-500/15 text-emerald-200 ring-emerald-400/20";
  if (confidence === "medium") return "bg-amber-500/15 text-amber-200 ring-amber-400/20";
  return "bg-red-500/15 text-red-200 ring-red-400/20";
}

function ReviewRow({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  if (!value) return null;

  return (
    <div className="grid gap-1 rounded-lg bg-black/10 p-2 ring-1 ring-white/8">
      <div className="text-[10px] tracking-[0.12em] text-[color:var(--muted2)]">
        {label}
      </div>
      <div className="text-sm text-[color:var(--fg)]">{value}</div>
    </div>
  );
}

export default function ScanResultPreview({
  review,
  title = "SCAN REVIEW",
  onApplyEmptyOnly,
  onApplyAll,
  onCancel,
}: {
  review: ScanSessionReview | null;
  title?: string;
  onApplyEmptyOnly: () => void;
  onApplyAll: () => void;
  onCancel: () => void;
}) {
  if (!review) return null;

  const isLow = review.confidence === "low";
  const isUnsafe = !review.safeToAutofill;

  return (
    <div className="mb-3 rounded-[14px] bg-black/10 p-3 ring-1 ring-white/8">
      {/* HEADER */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
            {title}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span
              className={[
                "rounded-full px-2.5 py-1 text-[11px] font-medium ring-1",
                confidenceTone(review.confidence),
              ].join(" ")}
            >
              {review.confidence.toUpperCase()} • {review.score}/100
            </span>

            {isUnsafe && (
              <span className="rounded-full bg-red-500/15 px-2 py-1 text-[10px] text-red-200 ring-1 ring-red-400/20">
                NOT SAFE
              </span>
            )}
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex flex-wrap gap-2">
          <PillButton
            onClick={onApplyEmptyOnly}
            disabled={isUnsafe}
          >
            Apply Empty Only
          </PillButton>

          <PillButton
            variant="primary"
            onClick={onApplyAll}
            disabled={isUnsafe || isLow}
          >
            Apply All
          </PillButton>

          <PillButton onClick={onCancel}>
            Cancel
          </PillButton>
        </div>
      </div>

      {/* HARD WARNING */}
      {isUnsafe && (
        <div className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-200 ring-1 ring-red-400/20">
          <div className="text-[11px] tracking-[0.14em] text-red-200/80">
            BLOCKED
          </div>
          <div className="mt-1">
            This scan is not safe to autofill. Data is likely incorrect.
          </div>
        </div>
      )}

      {/* WARNINGS */}
      {review.warnings.length > 0 && (
        <div className="mt-3 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-200 ring-1 ring-amber-400/20">
          <div className="text-[11px] tracking-[0.14em] text-amber-200/80">
            WARNINGS
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {review.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* EXTRACTED FIELDS */}
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        <ReviewRow label="Title" value={review.fields.title} />
        <ReviewRow label="Subtitle" value={review.fields.subtitle} />
        <ReviewRow label="Number" value={review.fields.number} />
        <ReviewRow label="Grade" value={review.fields.grade} />
        <ReviewRow label="Cert #" value={review.fields.certNumber} />
        <ReviewRow label="Serial / ISBN" value={review.fields.serialNumber} />
        <ReviewRow label="Universe" value={review.fields.universe} />
        <ReviewRow label="Category" value={review.fields.category} />
        <ReviewRow label="Category Label" value={review.fields.categoryLabel} />
        <ReviewRow label="Subcategory" value={review.fields.subcategoryLabel} />
      </div>

      {/* RAW TEXT */}
      <div className="mt-3">
        <div className="mb-1 text-[11px] tracking-[0.12em] text-[color:var(--muted2)]">
          RAW OCR SOURCE
        </div>

        <div className="max-h-[180px] overflow-auto rounded-lg bg-[color:var(--pill)] p-3 text-xs leading-5 ring-1 ring-[color:var(--border)]">
          {review.rawText || "No scan text returned."}
        </div>
      </div>

      {/* FOOTNOTE */}
      <div className="mt-3 rounded-lg bg-black/10 p-3 text-xs text-[color:var(--muted)] ring-1 ring-white/8">
        Autofill only works well with clean scans. If results look wrong, do not apply.
      </div>
    </div>
  );
}