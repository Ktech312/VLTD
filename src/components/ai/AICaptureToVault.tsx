"use client";

import { useState } from "react";
import { runRecognitionPipeline } from "@/lib/ai/recognitionPipeline";
import { buildVaultItemFromAI } from "@/lib/ai/aiVaultFlow";
import { loadItems, saveItems } from "@/lib/vaultModel";

export default function AICaptureToVault() {
  const [result, setResult] = useState<any>(null);

  async function handleFile(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;

    const analysis = await runRecognitionPipeline(file);
    setResult(analysis);
  }

  function addToVault() {
    if (!result) return;

    const newItem = buildVaultItemFromAI(result);

    const existing = loadItems();
    saveItems([...existing, newItem]);

    window.dispatchEvent(new Event("vltd:vault-updated"));

    alert("Item added to vault");
  }

  return (
    <div className="flex flex-col gap-4">
      <input type="file" accept="image/*" onChange={handleFile} />

      {result && (
        <div className="p-4 rounded-xl bg-black/20 ring-1 ring-white/10">
          <div>Detected: {result.title}</div>
          <div>Category: {result.category}</div>
          <div>Value: ${result.estimatedValue}</div>

          <button
            onClick={addToVault}
            className="mt-3 px-4 py-2 rounded ring-1 ring-white/20"
          >
            Add to Vault
          </button>
        </div>
      )}
    </div>
  );
}