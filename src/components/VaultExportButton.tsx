"use client";

import { useState } from "react";

import InsurancePdfButton from "@/components/InsurancePdfButton";
import { exportVaultCsv, exportVaultJson } from "@/lib/vaultExport";
import { loadItems } from "@/lib/vaultModel";
import { getVaultImagePublicUrl } from "@/lib/vaultCloud";
import type { VaultItem } from "@/lib/vaultModel";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    JSZip?: any;
  }
}

function getPrimaryImageUrl(item: VaultItem): string {
  if (item.images && item.images.length > 0) {
    const primary = item.images.find((img) => img.role === "primary") ?? item.images[0];
    if (primary.url) return primary.url;
    if (primary.storageKey) return getVaultImagePublicUrl(primary.storageKey);
  }
  if (item.imageFrontUrl) return item.imageFrontUrl;
  if (item.imageFrontStoragePath) return getVaultImagePublicUrl(item.imageFrontStoragePath);
  return "";
}

async function loadJSZip(): Promise<unknown> {
  if (window.JSZip) return window.JSZip;
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load JSZip"));
    document.head.appendChild(script);
  });
  return window.JSZip;
}

async function downloadPhotosZip(
  items: VaultItem[],
  onProgress: (msg: string) => void
) {
  onProgress("Loading JSZip...");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const JSZip = (await loadJSZip()) as any;
  const zip = new JSZip();

  const withImages = items.filter((item) => getPrimaryImageUrl(item));
  if (withImages.length === 0) {
    alert("No items with photos found.");
    return;
  }

  onProgress("Fetching " + withImages.length + " photos...");

  let done = 0;
  await Promise.all(
    withImages.map(async (item) => {
      const url = getPrimaryImageUrl(item);
      try {
        const response = await fetch(url);
        if (!response.ok) return;
        const blob = await response.blob();
        const ext = blob.type.includes("png")
          ? "png"
          : blob.type.includes("webp")
          ? "webp"
          : "jpg";
        const safeName = (item.title ?? "item")
          .replace(/[^a-z0-9_ -]/gi, "")
          .trim()
          .replace(/\s+/g, "_")
          .slice(0, 60);
        const filename = safeName + "_" + item.id.slice(0, 8) + "." + ext;
        const universe = (item.universe ?? "Other").replace(/[^a-z0-9]/gi, "_");
        zip.folder(universe).file(filename, blob);
        done++;
        onProgress(done + " / " + withImages.length + " fetched...");
      } catch {
        // skip failed images silently
      }
    })
  );

  onProgress("Building ZIP...");
  const content = await zip.generateAsync({ type: "blob" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(content);
  link.download = "vltd-photos-" + new Date().toISOString().slice(0, 10) + ".zip";
  link.click();
  URL.revokeObjectURL(link.href);
  onProgress("Done");
}

export default function VaultExportButton() {
  const [open, setOpen] = useState(false);
  const [zipStatus, setZipStatus] = useState<string | null>(null);
  const items = open ? loadItems({ includeAllProfiles: true }) : [];

  const isZipping = zipStatus !== null && zipStatus !== "Done";

  async function handlePhotoZip() {
    setOpen(false);
    const allItems = loadItems({ includeAllProfiles: true });
    try {
      await downloadPhotosZip(allItems, setZipStatus);
    } catch (err) {
      console.error("Photo ZIP failed:", err);
      setZipStatus("Error - check console");
    } finally {
      setTimeout(() => setZipStatus(null), 2500);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-[38px] items-center justify-center rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-[color:var(--border)] transition hover:brightness-110"
        style={{ background: "var(--pill)", color: "var(--muted)" }}
      >
        {isZipping ? zipStatus : "Export"}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 z-20 mt-2 w-52 rounded-2xl p-2 shadow-xl ring-1 ring-[color:var(--border)]"
            style={{ background: "var(--surface)" }}
          >
            <button
              type="button"
              onClick={() => { exportVaultCsv(); setOpen(false); }}
              className="w-full rounded-xl px-4 py-2.5 text-left text-sm transition hover:brightness-110"
              style={{ color: "var(--fg)" }}
            >
              Download CSV
            </button>
            <button
              type="button"
              onClick={() => { exportVaultJson(); setOpen(false); }}
              className="w-full rounded-xl px-4 py-2.5 text-left text-sm transition hover:brightness-110"
              style={{ color: "var(--fg)" }}
            >
              Download JSON
            </button>
            <InsurancePdfButton
              items={items}
              label="Insurance PDF"
              className="w-full rounded-xl px-4 py-2.5 text-left text-sm transition hover:brightness-110"
            />
            <button
              type="button"
              onClick={() => { window.open("/vault/print", "_blank"); setOpen(false); }}
              className="w-full rounded-xl px-4 py-2.5 text-left text-sm transition hover:brightness-110"
              style={{ color: "var(--fg)" }}
            >
              Collection Report
            </button>
            <button
              type="button"
              onClick={handlePhotoZip}
              disabled={isZipping}
              className="w-full rounded-xl px-4 py-2.5 text-left text-sm transition hover:brightness-110 disabled:opacity-50"
              style={{ color: "var(--fg)" }}
            >
              Download Photos (ZIP)
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
