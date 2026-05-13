"use client";

import { useRef, useState } from "react";

type CaptureCameraProps = {
  onCapture?: (file: File) => void;
};

export default function CaptureCamera({ onCapture }: CaptureCameraProps = {}) {
  const ref = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");

  function capture() {
    ref.current?.click();
  }

  return (
    <div className="rounded-[30px] border border-[color:var(--border)] bg-vault-card p-4 shadow-[0_18px_56px_rgba(0,0,0,0.24)]">
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(event) => {
          const nextFile = event.target.files?.[0];
          setFileName(nextFile?.name ?? "");
          if (nextFile && onCapture) {
            onCapture(nextFile);
          }
        }}
      />

      <button
        type="button"
        onClick={capture}
        className="group relative flex min-h-[340px] w-full flex-col items-center justify-center overflow-hidden rounded-[24px] border border-dashed px-5 text-center transition hover:-translate-y-0.5"
        style={{
          borderColor: 'var(--theme-gold-border, rgba(245,181,72,0.35))',
          background: 'radial-gradient(circle at 50% 0%, var(--theme-gold-subtle, rgba(245,181,72,0.08)), rgba(5,11,21,0.62) 100%)',
        }}
      >
        <div className="absolute inset-x-8 top-8 h-24 rounded-full blur-3xl transition"
          style={{ background: 'var(--theme-gold-subtle, rgba(245,181,72,0.10))' }} />

        <div className="relative grid h-20 w-20 place-items-center rounded-[24px] text-3xl"
          style={{
            border: '1px solid var(--theme-gold-border, rgba(245,181,72,0.25))',
            background: 'var(--theme-gold-subtle, rgba(245,181,72,0.08))',
            boxShadow: '0 18px 42px rgba(245,181,72,0.10)',
          }}>
          ▣
        </div>
        <div className="relative mt-5 text-xl font-black tracking-[-0.03em] text-text-primary">
          Capture Item Photo
        </div>
        <div className="relative mt-2 max-w-[260px] text-sm leading-6 text-[color:var(--muted)]">
          Use your camera on mobile or upload an image from desktop.
        </div>
        <div className="relative mt-5 inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-black text-[#0B0B0B]"
          style={{ background: 'var(--theme-gold-gradient)', boxShadow: 'var(--theme-gold-glow)' }}>
          Open camera / upload
        </div>
      </button>

      <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-vault-card px-4 py-3 text-sm text-[color:var(--muted)]">
        {fileName ? (
          <span>
            Selected: <span className="font-semibold text-text-primary">{fileName}</span>
          </span>
        ) : (
          "No photo selected yet."
        )}
      </div>
    </div>
  );
}
