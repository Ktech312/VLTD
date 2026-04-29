"use client";

import { useEffect, useState } from "react";

import {
  confirmAdultContent,
  createPublicContentReport,
  hasConfirmedAdultContent,
  type ReportContentType,
} from "@/lib/publicSafety";

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
    <main className="min-h-screen bg-[color:var(--bg)] px-4 py-10 text-[color:var(--fg)]">
      <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
        <section className="w-full rounded-[28px] bg-[color:var(--surface)] p-6 text-center ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">18+ CONTENT</div>
          <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
            The owner marked this gallery as intended for adults. Confirm that you are 18 or older to continue.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={handleConfirm}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[color:var(--pill-active-bg)] px-5 py-2 text-sm font-semibold text-[color:var(--fg)]"
            >
              I am 18+ — Continue
            </button>
            <a
              href="/"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[color:var(--pill)] px-5 py-2 text-sm font-medium text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]"
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

export function ReportContentButton({
  contentType,
  contentId,
  label = "Report",
}: {
  contentType: ReportContentType;
  contentId: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [message, setMessage] = useState("");

  function submitReport() {
    createPublicContentReport({
      contentType,
      contentId,
      reason,
      details: details.trim() || undefined,
    });
    setMessage("Report submitted. Thank you for helping keep VLTD safe.");
    setDetails("");
    setOpen(false);
  }

  return (
    <div className="relative z-30">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex min-h-[34px] items-center justify-center rounded-full bg-black/45 px-3 py-1 text-xs font-semibold text-white/85 ring-1 ring-white/15 backdrop-blur transition hover:bg-black/65"
      >
        {label}
      </button>

      {open ? (
        <div className="absolute right-0 top-full mt-2 w-[min(320px,calc(100vw-2rem))] rounded-2xl bg-[color:var(--surface)] p-4 text-left text-sm text-[color:var(--fg)] ring-1 ring-[color:var(--border)] shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">REPORT CONTENT</div>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-[color:var(--muted)]">Close</button>
          </div>
          <label className="mt-3 grid gap-1.5">
            <span className="text-xs text-[color:var(--muted)]">Reason</span>
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="min-h-[38px] rounded-xl bg-[color:var(--input)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
            >
              {REPORT_REASONS.map((entry) => (
                <option key={entry} value={entry}>{entry}</option>
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
            onClick={submitReport}
            className="mt-3 inline-flex min-h-[38px] w-full items-center justify-center rounded-full bg-red-500/15 px-4 text-sm font-semibold text-red-100 ring-1 ring-red-400/30"
          >
            Submit Report
          </button>
        </div>
      ) : null}

      {message ? <div className="mt-2 text-right text-xs text-[color:var(--muted)]">{message}</div> : null}
    </div>
  );
}
