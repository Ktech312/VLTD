
"use client";

export default function CaptureResult({ result }: { result: any }) {
  if (!result) return null;

  return (
    <div className="rounded-xl p-4 bg-[color:var(--surface)] ring-1 ring-[color:var(--border)]">
      <div>Detected: {result.detectedTitle}</div>
      <div>Category: {result.detectedCategory}</div>
      <div>Value Estimate: ${result.estimatedValue}</div>
    </div>
  );
}
