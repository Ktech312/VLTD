
"use client";

import { useRef } from "react";

export default function CaptureCamera() {
  const ref = useRef<HTMLInputElement>(null);

  function capture() {
    ref.current?.click();
  }

  return (
    <div className="flex flex-col gap-4">
      <input ref={ref} type="file" accept="image/*" capture="environment" hidden />
      <button onClick={capture} className="rounded-full px-5 py-3 ring-1 ring-white/20">
        Capture Item Photo
      </button>
    </div>
  );
}
