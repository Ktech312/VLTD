"use client";

import { useState } from "react";
import type { CollectionGoal } from "@/lib/collectionGoals";
import { UNIVERSE_KEYS, UNIVERSE_LABEL } from "@/lib/taxonomy";
import { useSaveFeedback } from "@/lib/useSaveFeedback";

type GoalFields = Omit<CollectionGoal, "id" | "createdAt">;

export default function AddGoalSheet({
  onClose,
  onSave,
  initial,
}: {
  onClose: () => void;
  onSave: (fields: GoalFields) => void;
  initial?: Partial<GoalFields>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [targetCount, setTargetCount] = useState(String(initial?.targetCount ?? ""));
  const [universe, setUniverse] = useState(initial?.universe ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const { justSaved, flashSaved } = useSaveFeedback();

  const canSave = !!name.trim() && Number(targetCount) > 0;

  function handleSave() {
    if (!canSave) return;
    const fields = {
      name: name.trim(),
      targetCount: Math.max(1, Math.round(Number(targetCount))),
      universe: universe || undefined,
      subject: subject.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    flashSaved();
    // Hold the sheet open briefly so the green "Saved" state is visible
    // before the parent closes it via onSave.
    setTimeout(() => onSave(fields), 450);
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} aria-hidden />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-xl rounded-t-[24px] px-5 pb-10 pt-6"
        style={{ background: "var(--surface)", boxShadow: "0 -4px 40px rgba(0,0,0,0.4)" }}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-[18px] font-bold" style={{ color: "var(--fg)" }}>
            New Collection Goal
          </h2>
          <button type="button" onClick={onClose} className="text-[20px] leading-none" style={{ color: "var(--muted2)" }}>
            x
          </button>
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

          <label className="block">
            <span className="mb-1.5 block text-[12px] font-semibold" style={{ color: "var(--muted)" }}>
              Total Items In Complete Set *
            </span>
            <input
              type="number"
              value={targetCount}
              onChange={(event) => setTargetCount(event.target.value)}
              placeholder="102"
              min={1}
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

        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || justSaved}
          className="mt-6 w-full rounded-full py-3.5 text-[14px] font-bold transition"
          style={{
            background: justSaved ? "rgba(16,185,129,0.92)" : canSave ? "var(--theme-gold)" : "var(--pill)",
            color: justSaved ? "#ffffff" : canSave ? "var(--ink, #0A0800)" : "var(--muted2)",
          }}
        >
          {justSaved ? "Saved ✓" : "Save Goal"}
        </button>
      </div>
    </>
  );
}
