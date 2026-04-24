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
    <div className="grid gap-1 rounded-xl bg-black/10 p-3 ring-1 ring-white/8">
      <div className="text-[10px] tracking-[0.12em] text-[color:var(--muted2)]">{label}</div>
      <div className="break-words text-sm text-[color:var(--fg)]">{value}</div>
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
  const hasAnyFields = Object.values(review.fields).some((value) => String(value ?? "").trim().length > 0);

  return (
    <div className="mb-3 rounded-[18px] bg-black/10 p-3 ring-1 ring-white/8 sm:p-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">{title}</div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={[
                  "rounded-full px-2.5 py-1 text-[11px] font-medium ring-1",
                  confidenceTone(review.confidence),
                ].join(" ")}
              >
                {review.confidence.toUpperCase()} / {review.score}/100
              </span>

              {isUnsafe ? (
                <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[10px] text-amber-200 ring-1 ring-amber-400/20">
                  PARTIAL ONLY
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2 sm:min-w-[220px]">
            <PillButton onClick={onApplyEmptyOnly} disabled={!hasAnyFields}>
              Use Partial Info
            </PillButton>

            <PillButton variant="primary" onClick={onApplyAll} disabled={isUnsafe || isLow}>
              Apply All
            </PillButton>

            <PillButton onClick={onCancel}>Cancel</PillButton>
          </div>
        </div>

        <div className="rounded-[16px] bg-[color:var(--pill)] p-3 text-sm ring-1 ring-[color:var(--border)]">
          {isUnsafe || isLow
            ? "This scan has useful clues, but it is not strong enough to trust every field at once."
            : "This looks strong enough to apply if the title, number, and category match what you see."}
        </div>
      </div>

      {review.warnings.length > 0 ? (
        <div className="mt-3 rounded-[16px] bg-amber-500/10 p-3 text-sm text-amber-200 ring-1 ring-amber-400/20">
          <div className="text-[11px] tracking-[0.14em] text-amber-200/80">WARNINGS</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {review.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

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

      <details className="mt-3 rounded-[16px] bg-black/10 p-3 ring-1 ring-white/8">
        <summary className="cursor-pointer text-[11px] tracking-[0.12em] text-[color:var(--muted2)]">
          Show scan text
        </summary>

        <div className="mt-3 max-h-[220px] overflow-auto rounded-xl bg-[color:var(--pill)] p-3 text-xs leading-5 ring-1 ring-[color:var(--border)]">
          {review.rawText || "No scan text returned."}
        </div>
      </details>
    </div>
  );
}
