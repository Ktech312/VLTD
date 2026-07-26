"use client";

import { useEffect, useState } from "react";
import { generateItemCopy, type CopyMode } from "@/lib/generateItemCopy";
import type { VaultItem } from "@/lib/vaultModel";

// ─── workspace prefs helper ────────────────────────────────────────────────────

function getWorkspacePrefs() {
  if (typeof window === "undefined") return { showConfidence: true };
  try {
    const raw = localStorage.getItem("vltd_workspace_prefs");
    const p = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    return { showConfidence: p.showConfidence !== false };
  } catch {
    return { showConfidence: true };
  }
}

// ─── ConfidencePip ─────────────────────────────────────────────────────────────

function ConfidencePip({ score }: { score: number }) {
  const color =
    score >= 75 ? "#4ade80" : score >= 50 ? "var(--theme-gold)" : "#f87171";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1"
      style={{
        background: `${color}18`,
        color,
        borderColor: `${color}40`,
      }}
    >
      {score}% confidence
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  item: VaultItem;
  mode: CopyMode;
  /** Called when user accepts — save the text however the parent prefers */
  onAccept: (text: string) => void;
  /** Label shown on the trigger button */
  triggerLabel?: string;
  className?: string;
};

// ─── States ───────────────────────────────────────────────────────────────────

type PanelState = "idle" | "generating" | "review" | "accepted";

// ─── GenerateCopyPanel ────────────────────────────────────────────────────────

export default function GenerateCopyPanel({
  item,
  mode,
  onAccept,
  triggerLabel,
  className = "",
}: Props) {
  const [state, setState] = useState<PanelState>("idle");
  const [draft, setDraft] = useState("");
  const [confidence, setConfidence] = useState(0);
  const [showConfidence, setShowConfidence] = useState(true);

  useEffect(() => {
    setShowConfidence(getWorkspacePrefs().showConfidence);
  }, []);

  const label =
    triggerLabel ??
    (mode === "description"
      ? "✦ Generate description"
      : mode === "listing"
      ? "✦ Generate listing copy"
      : "✦ Generate caption");

  function handleGenerate() {
    setState("generating");
    // Simulate a brief generation delay (swap this for an async API call later)
    setTimeout(() => {
      const result = generateItemCopy(item, mode);
      setDraft(result.text);
      setConfidence(result.confidence);
      setState("review");
    }, 650);
  }

  function handleAccept() {
    onAccept(draft);
    setState("accepted");
    setTimeout(() => setState("idle"), 2000);
  }

  function handleDiscard() {
    setDraft("");
    setState("idle");
  }

  // ── idle ───────────────────────────────────────────────────────────────────
  if (state === "idle") {
    return (
      <button
        type="button"
        onClick={handleGenerate}
        className={[
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition",
          "hover:ring-[color:var(--theme-gold)] hover:text-[color:var(--theme-gold)]",
          className,
        ].join(" ")}
        style={{
          background: "var(--pill)",
          color: "var(--muted)",
          borderColor: "var(--border)",
        }}
      >
        {label}
      </button>
    );
  }

  // ── generating ─────────────────────────────────────────────────────────────
  if (state === "generating") {
    return (
      <div
        className={["rounded-2xl ring-1 px-4 py-3", className].join(" ")}
        style={{ background: "var(--pill)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-t-transparent"
            style={{ borderColor: "var(--theme-gold)", borderTopColor: "transparent" }}
          />
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            Generating…
          </span>
        </div>
      </div>
    );
  }

  // ── accepted ───────────────────────────────────────────────────────────────
  if (state === "accepted") {
    return (
      <div
        className={["rounded-2xl ring-1 px-4 py-3", className].join(" ")}
        style={{
          background: "rgba(74,222,128,0.06)",
          borderColor: "rgba(74,222,128,0.25)",
        }}
      >
        <span className="text-xs font-semibold" style={{ color: "#4ade80" }}>
          ✓ Copy applied
        </span>
      </div>
    );
  }

  // ── review ─────────────────────────────────────────────────────────────────
  return (
    <div
      className={["rounded-2xl ring-1 overflow-hidden", className].join(" ")}
      style={{
        background: "rgba(203,208,213,0.04)",
        borderColor: "rgba(203,208,213,0.25)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-2.5 border-b"
        style={{ borderColor: "rgba(203,208,213,0.18)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "rgba(203,208,213,0.8)" }}>
            AI draft — review before saving
          </span>
          {showConfidence && <ConfidencePip score={confidence} />}
        </div>
        <button
          type="button"
          onClick={handleDiscard}
          className="text-[11px] transition hover:opacity-70"
          style={{ color: "var(--muted)" }}
        >
          ✕ Discard
        </button>
      </div>

      {/* Editable draft */}
      <div className="px-4 py-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={mode === "social" ? 4 : 3}
          className="w-full resize-none rounded-xl px-3 py-2.5 text-sm leading-6 ring-1 focus:outline-none"
          style={{
            background: "var(--pill)",
            color: "var(--fg)",
            borderColor: "var(--border)",
          }}
        />
        <p className="mt-1 text-[10px]" style={{ color: "var(--muted2)" }}>
          Edit freely — nothing saves until you click Accept.
        </p>
      </div>

      {/* Actions */}
      <div
        className="flex items-center justify-between gap-3 px-4 pb-4"
      >
        <button
          type="button"
          onClick={handleAccept}
          disabled={!draft.trim()}
          className="rounded-full px-4 py-2 text-xs font-bold transition hover:-translate-y-0.5 disabled:opacity-40"
          style={{ background: "linear-gradient(180deg,#79E7FB,#41C6E4 55%,#2CB1D1)", color: "#06171d" }}
        >
          Accept — apply to item
        </button>
        <button
          type="button"
          onClick={handleGenerate}
          className="rounded-full px-3 py-2 text-xs font-semibold ring-1 transition hover:ring-[color:var(--theme-gold)]"
          style={{ background: "var(--pill)", color: "var(--muted)", borderColor: "var(--border)" }}
        >
          Regenerate
        </button>
      </div>
    </div>
  );
}
