"use client";

import { useDialogA11y } from "@/components/ui/useDialogA11y";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CollectionGoal, GoalWriteResult } from "@/lib/collectionGoals";
import { validateGoalTarget, type GoalKind } from "@/lib/goalRules";
import { UNIVERSE_KEYS, UNIVERSE_LABEL } from "@/lib/taxonomy";
import { useSaveFeedback } from "@/lib/useSaveFeedback";
import { AppIcon } from "@/components/ui/AppIcon";
import { PillButton } from "@/components/ui/PillButton";

type GoalFields = Omit<CollectionGoal, "id" | "createdAt">;

export default function AddGoalSheet({
  onClose,
  onSave,
  initial,
}: {
  onClose: () => void;
  /** Resolves once the goal is stored (and the account has answered). `id` is the same for every attempt from this sheet, so a retry or repeated click never makes a second goal. */
  onSave: (fields: GoalFields, id: string) => Promise<GoalWriteResult>;
  initial?: Partial<GoalFields>;
}) {
  const dialogRef = useDialogA11y<HTMLDivElement>(true, onClose);
  const [name, setName] = useState(initial?.name ?? "");
  // How the goal is measured is always the person's explicit choice (never read from the name).
  const [kind, setKind] = useState<GoalKind>(initial?.goalType ?? "count");
  const [targetCount, setTargetCount] = useState(String(initial?.targetCount ?? ""));
  const [universe, setUniverse] = useState(initial?.universe ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const { justSaved, flashSaved } = useSaveFeedback();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState(false);
  // One id per sheet: every attempt from this sheet writes the same goal.
  const goalId = useRef(`goal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  const canSave = !!name.trim() && targetCount.trim() !== "";

  async function handleSave() {
    if (!canSave || busy || justSaved) return;
    const target = validateGoalTarget(targetCount, kind);
    if (!target.ok) {
      // The form stays exactly as typed.
      setError(target.message);
      return;
    }
    setError("");
    setBusy(true);
    const result = await onSave(
      {
        name: name.trim(),
        targetCount: target.value,
        goalType: kind,
        universe: universe || undefined,
        subject: subject.trim() || undefined,
        notes: notes.trim() || undefined,
      },
      goalId.current
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // "Saved" only now that the goal is stored: either the account has it, or it is safely on this device and uploading is pending.
    setWaiting(result.pending);
    flashSaved();
    setTimeout(onClose, result.pending ? 1400 : 450);
  }

  if (typeof document === "undefined") return null;

  // Portaled to document.body — NavShell renders this component's caller
  // inside PullToRefresh, whose scrolling wrapper (position:fixed +
  // overflow-y:auto, bottom pinned to var(--bottomnav-h)) clips ANY
  // fixed-position descendant to its own box regardless of z-index.
  // Portaling escapes that clipping ancestor entirely, the same way
  // MfaChallengeGate (mounted outside PullToRefresh) always does.
  return createPortal(
    <>
      <div className="fixed inset-0 z-[10000] bg-black/50" onClick={onClose} aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Goal"
        className="fixed bottom-0 left-0 right-0 z-[10001] mx-auto max-w-xl rounded-t-[24px] px-5 pb-10 pt-6"
        style={{ background: "var(--surface)", boxShadow: "0 -4px 40px rgba(0,0,0,0.4)" }}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-[18px] font-bold" style={{ color: "var(--fg)" }}>
            New Collection Goal
          </h2>
          <PillButton onClick={onClose} ariaLabel="Close" title="Close" className="px-0! w-11 md:w-9">
            <AppIcon name="close" size={16} />
          </PillButton>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold" style={{ color: "var(--muted)" }}>
              Goal Name *
            </span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Pokemon Base Set, All Ohtani Rookies"
              className="w-full rounded-xl px-3 py-2.5 text-[14px] outline-none ring-1"
              style={{ background: "var(--pill)", borderColor: "var(--border)", color: "var(--fg)" }}
            />
          </label>

          <div role="group" aria-label="How is this goal measured?">
            <span className="mb-1.5 block text-[12px] font-semibold" style={{ color: "var(--muted)" }}>
              How is this goal measured? *
            </span>
            <div className="flex flex-wrap gap-2">
              <PillButton variant={kind === "count" ? "active" : "default"} pressed={kind === "count"} onClick={() => { setKind("count"); setError(""); }}>Number of items</PillButton>
              <PillButton variant={kind === "value" ? "active" : "default"} pressed={kind === "value"} onClick={() => { setKind("value"); setError(""); }}>Collection value ($)</PillButton>
            </div>
            <p className="mt-1 text-[11px]" style={{ color: "var(--muted2)" }} data-testid="goal-kind-help">
              {kind === "value" ? "Progress is what the matching items you own are worth, in dollars." : "Progress is how many of the matching items you own."}
            </p>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold" style={{ color: "var(--muted)" }}>
              {kind === "value" ? "Target Value (US dollars) *" : "Total Items In Complete Set *"}
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={targetCount}
              onChange={(event) => { setTargetCount(event.target.value); setError(""); }}
              placeholder={kind === "value" ? "2,000" : "102"}
              aria-invalid={error ? true : undefined}
              className="w-full rounded-xl px-3 py-2.5 text-[14px] outline-none ring-1"
              style={{ background: "var(--pill)", borderColor: "var(--border)", color: "var(--fg)" }}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold" style={{ color: "var(--muted)" }}>
              Category
            </span>
            <select
              value={universe}
              onChange={(event) => setUniverse(event.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-[14px] outline-none ring-1"
              style={{ background: "var(--pill)", borderColor: "var(--border)", color: universe ? "var(--fg)" : "var(--muted)" }}
            >
              <option value="">All categories</option>
              {UNIVERSE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {UNIVERSE_LABEL[key]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold" style={{ color: "var(--muted)" }}>
              Subject Tag
            </span>
            <input
              type="text"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Pikachu, Shohei Ohtani"
              className="w-full rounded-xl px-3 py-2.5 text-[14px] outline-none ring-1"
              style={{ background: "var(--pill)", borderColor: "var(--border)", color: "var(--fg)" }}
            />
            <p className="mt-1 text-[11px]" style={{ color: "var(--muted2)" }}>
              Match item Subject tags to auto-count progress.
            </p>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold" style={{ color: "var(--muted)" }}>
              Notes
            </span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="min-h-20 w-full rounded-xl px-3 py-2.5 text-[14px] outline-none ring-1"
              style={{ background: "var(--pill)", borderColor: "var(--border)", color: "var(--fg)" }}
            />
          </label>
        </div>

        {error ? (
          <p role="alert" data-testid="goal-error" className="mt-4 text-[13px] font-semibold text-red-400">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!canSave || justSaved || busy}
          className="mt-6 w-full rounded-full py-3.5 text-[14px] font-bold transition"
          style={{
            background: justSaved ? "rgba(16,185,129,0.92)" : canSave ? "var(--theme-gold)" : "var(--pill)",
            color: justSaved ? "#ffffff" : canSave ? "var(--ink, #0A0800)" : "var(--muted2)",
          }}
        >
          {justSaved ? (waiting ? "Saved on this device. Sync pending" : "Saved ✓") : busy ? "Saving…" : "Save Goal"}
        </button>
      </div>
    </>,
    document.body
  );
}
