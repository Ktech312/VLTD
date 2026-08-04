// Path: src/components/DocumentsSection.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { PillButton } from "@/components/ui/PillButton";
import { Glyph } from "@/components/ui/Glyph";
import {
  addDocument,
  removeDocument,
  listDocuments,
  getDocumentUrl,
  type VaultDocument,
} from "@/lib/vaultDocuments";

function formatBytesish(doc: VaultDocument) {
  const date = new Date(doc.addedAt);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function DocumentsSection({ itemId }: { itemId: string }) {
  const [docs, setDocs] = useState<VaultDocument[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDocs(listDocuments(itemId));
  }, [itemId]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setMessage("Saving...");
    try {
      for (const file of Array.from(files)) {
        await addDocument(itemId, file);
      }
      setDocs(listDocuments(itemId));
      setMessage("Saved — private to this device.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save document.");
    } finally {
      setBusy(false);
    }
  }

  async function handleView(doc: VaultDocument) {
    const url = await getDocumentUrl(doc);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleRemove(doc: VaultDocument) {
    setBusy(true);
    try {
      await removeDocument(itemId, doc.id);
      setDocs(listDocuments(itemId));
      setMessage("Document removed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-xs leading-5 text-[color:var(--muted2)]">
        Certificates, receipts, and IDs. Stored only on this device — private and
        locked, never shared with anyone or synced to the cloud.
      </p>

      {docs.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between gap-2 rounded-[10px] bg-[color:var(--pill)] px-3 py-2 ring-1 ring-[color:var(--border)]"
            >
              <button
                type="button"
                onClick={() => void handleView(doc)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                title="View document"
              >
                <Glyph name="frame" size={14} />
                <span className="min-w-0 flex-1 truncate text-sm text-[color:var(--fg)]">{doc.name}</span>
                <span className="shrink-0 text-[10px] text-[color:var(--muted2)]">{formatBytesish(doc)}</span>
              </button>
              <PillButton variant="danger" onClick={() => void handleRemove(doc)} disabled={busy} className="h-8 px-2.5 text-xs">
                Remove
              </PillButton>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <PillButton onClick={() => fileInputRef.current?.click()} disabled={busy}>
          Upload file
        </PillButton>
        <PillButton onClick={() => cameraInputRef.current?.click()} disabled={busy}>
          <span className="inline-flex items-center gap-1.5"><Glyph name="camera" size={14} /> Take photo</span>
        </PillButton>
      </div>

      {(busy || message) && (
        <div className="mt-2 text-xs text-[color:var(--muted)]">{busy ? "Saving..." : message}</div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
