
"use client";

export default function CaptureResult({ result }: { result: any }) {
  if (!result) return null;

  return (
    <div className="rounded-xl p-4 bg-black/20 ring-1 ring-white/10">
      <div>Detected: {result.detectedTitle}</div>
      <div>Category: {result.detectedCategory}</div>
      <div>Value Estimate: ${result.estimatedValue}</div>
    </div>
  );
}
