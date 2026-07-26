"use client";

import { useRef, useState } from "react";
import type { CoaAnalysisResult } from "@/app/api/ai/analyze-coa/route";

type Props = {
  onApply: (data: CoaAnalysisResult, imageFile: File) => void;
};

type Phase = "idle" | "scanning" | "review" | "error";

export default function CoaScanButton({ onApply }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<CoaAnalysisResult | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleFile(file: File) {
    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setPhase("scanning");
    setErrorMsg("");

    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch("/api/ai/analyze-coa", { method: "POST", body: form });
      if (!res.ok) throw new Error("Scan failed.");
      const data = (await res.json()) as CoaAnalysisResult;
      setResult(data);
      setPhase("review");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not read certificate.");
      setPhase("error");
    }
  }

  function handleApply() {
    if (result && imageFile) {
      onApply(result, imageFile);
      setPhase("idle");
      setResult(null);
      setPreviewUrl(null);
    }
  }

  function reset() {
    setPhase("idle");
    setResult(null);
    setPreviewUrl(null);
    setErrorMsg("");
  }

  const confidenceColor =
    (result?.confidence ?? 0) >= 0.7
      ? "#22C55E"
      : (result?.confidence ?? 0) >= 0.4
      ? "#C8CDD2"
      : "#EF4444";

  const fields: { label: string; value: string }[] = result
    ? [
        { label: "Cert #", value: result.certNumber },
        { label: "Grade", value: result.grade },
        { label: "Authenticator", value: result.authenticator },
        { label: "Item", value: result.itemDescription },
        { label: "Signer", value: result.signerName },
        { label: "Date", value: result.authDate },
        { label: "Notes", value: result.notes },
      ].filter((f) => f.value)
    : [];

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = "";
          if (file) void handleFile(file);
        }}
      />

      {/* Trigger button */}
      {phase === "idle" && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold ring-1 ring-[color:var(--border)] transition hover:ring-[color:var(--theme-gold)] hover:text-[color:var(--theme-gold)]"
          style={{ color: "var(--muted)" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M3 9h18M9 21V9"/>
          </svg>
          Scan Certificate
        </button>
      )}

      {/* Scanning state */}
      {phase === "scanning" && (
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-[color:var(--theme-elevated)] px-4 py-3 ring-1 ring-[color:var(--theme-border)]">
          <span
            className="h-2.5 w-2.5 animate-pulse rounded-full"
            style={{ background: "var(--theme-gold, #C8CDD2)" }}
          />
          <span className="text-xs font-semibold text-[color:var(--muted)]">Reading certificate…</span>
        </div>
      )}

      {/* Error state */}
      {phase === "error" && (
        <div className="mt-3 rounded-2xl bg-[color:var(--theme-elevated)] p-4 ring-1 ring-red-500/20">
          <p className="text-xs font-semibold text-red-400">{errorMsg || "Could not read certificate."}</p>
          <p className="mt-1 text-[11px] text-[color:var(--muted)]">Try a cleaner, brighter photo with less glare.</p>
          <button
            type="button"
            onClick={reset}
            className="mt-3 text-[11px] font-semibold text-[color:var(--muted)] underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Review panel */}
      {phase === "review" && result && (
        <div className="mt-3 rounded-2xl bg-[color:var(--theme-elevated)] p-4 ring-1 ring-[color:var(--theme-border)]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted2)]">
              Certificate Scanned
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
              style={{
                background: `${confidenceColor}20`,
                color: confidenceColor,
              }}
            >
              {Math.round((result.confidence ?? 0) * 100)}% confidence
            </span>
          </div>

          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="CoA scan"
              className="mt-3 max-h-32 w-full rounded-xl object-contain"
              style={{ background: "rgba(0,0,0,0.3)" }}
            />
          )}

          {fields.length > 0 ? (
            <dl className="mt-3 grid gap-y-2">
              {fields.map(({ label, value }) => (
                <div key={label} className="flex gap-2 text-xs">
                  <dt className="w-24 shrink-0 font-semibold text-[color:var(--muted2)]">{label}</dt>
                  <dd className="text-[color:var(--fg)]">{value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-3 text-xs text-[color:var(--muted)]">
              No fields detected — image may be too blurry. You can still save the scan image.
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex h-9 items-center rounded-full px-4 text-xs font-bold text-black"
              style={{ background: "var(--theme-gold, #C8CDD2)" }}
            >
              Apply to Item
            </button>
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-9 items-center rounded-full px-3 text-xs font-semibold text-[color:var(--muted)] ring-1 ring-[color:var(--border)]"
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </>
  );
}
