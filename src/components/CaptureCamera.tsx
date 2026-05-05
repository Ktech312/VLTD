"use client";

import { useRef, useState } from "react";

export default function CaptureCamera() {
  const ref = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");

  function capture() {
    ref.current?.click();
  }

  return (
    <div className="rounded-[30px] border border-[color:var(--border)] bg-[rgba(7,16,31,0.50)] p-4 shadow-[0_18px_56px_rgba(0,0,0,0.24)]">
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(event) => {
          const nextFile = event.target.files?.[0];
          setFileName(nextFile?.name ?? "");
        }}
      />

      <button
        type="button"
        onClick={capture}
        className="group relative flex min-h-[340px] w-full flex-col items-center justify-center overflow-hidden rounded-[24px] border border-dashed border-[rgba(82,214,244,0.38)] bg-[radial-gradient(circle_at_50%_0%,rgba(82,214,244,0.14),rgba(82,214,244,0.03)_38%,rgba(5,11,21,0.62)_100%)] px-5 text-center transition hover:-translate-y-0.5 hover:border-[rgba(82,214,244,0.58)] hover:bg-[radial-gradient(circle_at_50%_0%,rgba(82,214,244,0.20),rgba(82,214,244,0.04)_38%,rgba(5,11,21,0.70)_100%)]"
      >
        <div className="absolute inset-x-8 top-8 h-24 rounded-full bg-[rgba(82,214,244,0.12)] blur-3xl transition group-hover:bg-[rgba(82,214,244,0.18)]" />

        <div className="relative grid h-20 w-20 place-items-center rounded-[24px] border border-[rgba(82,214,244,0.28)] bg-[rgba(82,214,244,0.10)] text-3xl shadow-[0_18px_42px_rgba(82,214,244,0.12)]">
          ▣
        </div>
        <div className="relative mt-5 text-xl font-black tracking-[-0.03em] text-white">
          Capture Item Photo
        </div>
        <div className="relative mt-2 max-w-[260px] text-sm leading-6 text-[color:var(--muted)]">
          Use your camera on mobile or upload an image from desktop.
        </div>
        <div className="relative mt-5 inline-flex min-h-12 items-center justify-center rounded-full bg-[#52d6f4] px-6 text-sm font-black text-[#06101d] shadow-[0_16px_42px_rgba(82,214,244,0.20)]">
          Open camera / upload
        </div>
      </button>

      <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[rgba(9,20,36,0.72)] px-4 py-3 text-sm text-[color:var(--muted)]">
        {fileName ? (
          <span>
            Selected: <span className="font-semibold text-white">{fileName}</span>
          </span>
        ) : (
          "No photo selected yet."
        )}
      </div>
    </div>
  );
}
