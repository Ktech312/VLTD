"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import {
  confirmAdultContent,
  createPublicContentReport,
  hasConfirmedAdultContent,
  type ReportContentType,
} from "@/lib/publicSafety";
import { PillButton } from "@/components/ui/PillButton";
import { useDialogA11y } from "@/components/ui/useDialogA11y";

const REPORT_REASONS = [
  "Inappropriate content",
  "Adult content not labeled",
  "Harassment or hate",
  "Spam or scam",
  "Copyright or stolen content",
  "Other",
];

export function AdultContentGate({
  title = "Adult content warning",
  onConfirm,
}: {
  title?: string;
  onConfirm: () => void;
}) {
  function handleConfirm() {
    confirmAdultContent();
    onConfirm();
  }

  return (
    <main className="min-h-screen px-4 py-10 text-[color:var(--fg)]">
      <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
        <section className="w-full rounded-[14px] bg-[color:var(--surface)] p-6 text-center ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">18+ CONTENT</div>
          <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
            The owner marked this exhibition as intended for adults. Confirm that you are 18 or older to continue.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <PillButton variant="active" onClick={handleConfirm}>
              I am 18+ — Continue
            </PillButton>
            <a
              href="/"
              className="inline-flex min-h-[44px] items-center justify-center rounded-[8px] bg-[color:var(--pill)] px-5 py-2 text-sm font-medium text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]"
            >
              Leave
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}

export function useAdultGate(isAdultOnly?: boolean) {
  const [confirmed, setConfirmed] = useState(() => !isAdultOnly || hasConfirmedAdultContent());

  useEffect(() => {
    if (!isAdultOnly) {
      setConfirmed(true);
      return;
    }
    setConfirmed(hasConfirmedAdultContent());
  }, [isAdultOnly]);

  return {
    shouldGate: Boolean(isAdultOnly && !confirmed),
    confirm: () => setConfirmed(true),
  };
}

/**
 * The report form: reason, optional details, submit, and a confirmation. Opens as a dialog from the "•••" menu of the action bar.
 * (It replaces the old stand-alone Report button; the reasons, the submission and the confirmation are unchanged.)
 */
export function ReportDialog({
  open,
  onClose,
  contentType,
  contentId,
  contentTitle,
}: {
  open: boolean;
  onClose: () => void;
  contentType: ReportContentType;
  contentId: string;
  contentTitle?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const dialogRef = useDialogA11y<HTMLDivElement>(open, onClose);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) {
      setMessage("");
      setSubmitted(false);
    }
  }, [open]);

  if (!open || !mounted || typeof document === "undefined") return null;

  async function submitReport() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setMessage("");
    try {
      const result = await createPublicContentReport({ contentType, contentId, reason, details: details.trim() || undefined });
      if (!result.ok) {
        setMessage(result.error || "Report could not be submitted.");
        return;
      }
      setSubmitted(true);
      setMessage("Report submitted. Thank you for helping keep VLTD safe.");
      setDetails("");
      setReason(REPORT_REASONS[0]);
    } finally {
      setIsSubmitting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[10001] flex items-end justify-center sm:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Report this ${contentType === "item" ? "item" : "exhibition"}`}
        onClick={(event) => event.stopPropagation()}
        className="vltd-dark-surface relative z-10 w-full rounded-t-[26px] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-left text-sm text-[color:var(--fg)] shadow-2xl ring-1 ring-white/10 sm:max-w-[400px] sm:rounded-[14px]"
        style={{ background: "linear-gradient(180deg, rgba(26,31,39,0.98), rgba(13,16,21,0.99))" }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">REPORT CONTENT</div>
          <PillButton onClick={onClose} size="compact" ariaLabel="Close" title="Close">
            Close
          </PillButton>
        </div>
        {contentTitle ? <div className="mt-2 line-clamp-2 text-sm font-semibold">{contentTitle}</div> : null}
        {submitted ? (
          <div role="status" className="mt-4 rounded-[14px] bg-emerald-400/10 p-3 text-[13px] text-emerald-100 ring-1 ring-emerald-300/30">
            {message}
          </div>
        ) : (
          <>
            <label className="mt-3 grid gap-1.5">
              <span className="text-xs text-[color:var(--muted)]">Reason</span>
              <select
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="min-h-[44px] rounded-xl bg-[color:var(--input)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none md:min-h-[38px]"
              >
                {REPORT_REASONS.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 grid gap-1.5">
              <span className="text-xs text-[color:var(--muted)]">Details optional</span>
              <textarea
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                rows={3}
                className="rounded-xl bg-[color:var(--input)] px-3 py-2 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
                placeholder="Add context for the owner/moderator..."
              />
            </label>
            <button
              type="button"
              onClick={() => void submitReport()}
              disabled={isSubmitting}
              className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-[8px] bg-red-500/15 px-4 text-sm font-semibold text-red-100 ring-1 ring-red-400/30 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 md:min-h-[38px]"
            >
              {isSubmitting ? "Submitting..." : "Submit Report"}
            </button>
            {message ? (
              <div role="alert" className="mt-2 text-xs text-red-200">
                {message}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
