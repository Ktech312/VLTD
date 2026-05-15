"use client";

import { useState } from "react";

import type { VaultItem } from "@/lib/vaultModel";

const CONDITION_OPTIONS = [
  "Gem Mint / PSA 10",
  "Mint / PSA 9",
  "Near Mint-Mint / PSA 8",
  "Near Mint / PSA 7",
  "Excellent-Mint / PSA 6",
  "Excellent / PSA 5",
  "Very Good-Excellent / PSA 4",
  "Very Good / PSA 3",
  "Good / PSA 2",
  "Poor / PSA 1",
  "Sealed / Factory Sealed",
  "CIB (Complete in Box)",
  "Loose",
  "Near Mint (NM)",
  "Very Good Plus (VG+)",
  "Very Good (VG)",
  "Good (G+)",
  "Fair",
];

export default function ConditionAssessmentPanel({
  item,
  onUpdate,
}: {
  item: VaultItem;
  onUpdate: (patch: {
    grade?: string;
    conditionReason?: string;
    conditionSource?: "ai" | "manual";
  }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [gradeInput, setGradeInput] = useState(item.grade ?? "");
  const [reasonInput, setReasonInput] = useState(item.conditionReason ?? "");

  const hasAiGrade = Boolean(item.grade) && item.conditionSource === "ai";
  const hasManualGrade = Boolean(item.grade) && item.conditionSource === "manual";
  const hasGrade = Boolean(item.grade);

  function handleSave() {
    onUpdate({
      grade: gradeInput.trim() || undefined,
      conditionReason: reasonInput.trim() || undefined,
      conditionSource: "manual",
    });
    setEditing(false);
  }

  return (
    <div className="overflow-hidden rounded-[24px] bg-[color:var(--surface)] ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border)] px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-bold text-[color:var(--fg)]">Condition</span>
          {hasAiGrade ? (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1"
              style={{
                background: "var(--theme-gold-subtle)",
                borderColor: "var(--theme-gold-border)",
                color: "var(--theme-gold)",
              }}
            >
              AI assessed
            </span>
          ) : null}
          {hasManualGrade ? (
            <span className="rounded-full bg-[color:var(--pill)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
              Manual
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setEditing((value) => !value)}
          className="text-[12px] font-semibold text-[color:var(--theme-gold)] transition-opacity hover:opacity-75"
        >
          {editing ? "Cancel" : hasGrade ? "Edit" : "Set grade"}
        </button>
      </div>

      {!editing ? (
        <div className="px-5 py-4">
          {hasGrade ? (
            <>
              <div className="text-[22px] font-semibold text-[color:var(--fg)]">{item.grade}</div>
              {item.conditionReason ? (
                <div className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                  {item.conditionReason}
                </div>
              ) : null}
            </>
          ) : (
            <div className="text-sm text-[color:var(--muted)]">
              No grade recorded. Set one manually or run AI identification from the capture flow.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3 px-5 py-4">
          <label className="grid gap-1.5">
            <span className="text-[11px] font-semibold tracking-[0.16em] text-[color:var(--muted2)]">
              Grade / Condition
            </span>
            <input
              type="text"
              value={gradeInput}
              onChange={(event) => setGradeInput(event.target.value)}
              placeholder="e.g. PSA 9, NM, Near Mint, Sealed"
              list="condition-options"
              className="h-10 rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
            />
            <datalist id="condition-options">
              {CONDITION_OPTIONS.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </label>

          <label className="grid gap-1.5">
            <span className="text-[11px] font-semibold tracking-[0.16em] text-[color:var(--muted2)]">
              Notes
            </span>
            <textarea
              value={reasonInput}
              onChange={(event) => setReasonInput(event.target.value)}
              placeholder="e.g. Light corner wear on two corners. Surface clean."
              rows={3}
              className="resize-none rounded-xl bg-[color:var(--pill)] px-3 py-2 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
            />
          </label>

          <button
            type="button"
            onClick={handleSave}
            className="h-10 w-full rounded-full bg-[color:var(--theme-gold)] px-4 text-sm font-bold text-black"
          >
            Save Grade
          </button>
        </div>
      )}
    </div>
  );
}
