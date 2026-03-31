
"use client";

import { useState } from "react";
import { analyzeItemImage } from "@/lib/aiItemAnalyzer";

export default function AICaptureAssistant() {
  const [result, setResult] = useState<any>(null);

  async function handleFile(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;

    const analysis = await analyzeItemImage(file);
    setResult(analysis);
  }

  return (
    <div className="flex flex-col gap-4">
      <input type="file" accept="image/*" onChange={handleFile} />

      {result && (
        <div className="p-4 rounded-xl bg-black/20 ring-1 ring-white/10">
          <div>Detected: {result.detectedTitle}</div>
          <div>Category: {result.detectedCategory}</div>
          <div>Estimated Value: ${result.estimatedValue}</div>
        </div>
      )}
    </div>
  );
}
