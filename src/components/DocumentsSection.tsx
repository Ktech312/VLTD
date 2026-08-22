// Path: src/components/DocumentsSection.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { PillButton } from "@/components/ui/PillButton";
import { Glyph } from "@/components/ui/Glyph";
import {
  addDocument,
  removeDocument,
  listDocuments,
  getDocumentViewUrl,
  shareDocument,
  type VaultDocument,
} from "@/lib/vaultDocuments";

function formatBytesish(doc: VaultDocument) {
  const date = new Date(doc.addedAt);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function DocumentsSection({ itemId }: { itemId: string }) {
  const [docs, setDocs] = useState<VaultDocument[]>([]);
  const [busy, setBusy] = useState(false);
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  async function refresh() {
    setDocs(await listDocuments(itemId));
  }

  useEffect(() => {
    void refresh();
  }, [itemId]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setMessage("Uploading...");
    try {
      for (const file of Array.from(files)) {
        await addDocument(itemId, file);
      }
      await refresh();
      setMessage("Saved — private, not visible to anyone else.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to upload document.");
    } finally {
      setBusy(false);
    }
  }

  async function handleView(doc: VaultDocument) {
    const url = await getDocumentViewUrl(doc);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else setMessage("Couldn't open that document.");
  }

  async function handleShare(doc: VaultDocument) {
    setSharingId(doc.id);
    setMessage("");
    try {
      const url = await shareDocument(doc);
      if (!url) {
        setMessage("Couldn't create a share link.");
        return;
      }
      await navigator.clipboard.writeText(url).catch(() => {});
      setMessage("Share link copied — works for 7 days, then stops working on its own.");
    } finally {
      setSharingId(null);
    }
  }

  async function handleRemove(doc: VaultDocument) {
    setBusy(true);
    try {
      await removeDocument(doc);
      await refresh();
      setMessage("Document removed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-xs leading-5 text-[color:var(--muted2)]">
        Certificates, receipts, and IDs. Private by default — synced securely
        to your account, but never visible to anyone else unless you tap
        Share on a specific document.
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
              <PillButton onClick={() => void handleShare(doc)} disabled={busy || sharingId === doc.id} className="h-8 px-2.5 text-xs">
                {sharingId === doc.id ? "Sharing…" : "Share"}
              </PillButton>
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
        <div className="mt-2 text-xs text-[color:var(--muted)]">{busy ? "Working..." : message}</div>
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
