
"use client";

export default function CapturePreview({ src }: { src: string }) {
  return (
    <div className="rounded-xl overflow-hidden ring-1 ring-white/10">
      <img src={src} alt="preview" className="w-full" />
    </div>
  );
}
