// Path: src/lib/vaultDocuments.ts
// Documents (certificates, receipts, IDs) are private & locked by design:
// stored only in this browser's IndexedDB, never uploaded to Supabase, never
// part of VaultItem.images — so none of the photo carousels/exports/public
// share pages that read item.images can ever surface one.
import {
  saveImageBlobToIndexedDb,
  getImageObjectUrlFromIndexedDb,
  deleteImageFromIndexedDb,
} from "@/lib/vaultImageStore";

export type VaultDocument = {
  id: string;
  name: string;
  storageKey: string;
  contentType: string;
  addedAt: number;
};

function docsKey(itemId: string) {
  return `vltd_documents_v1_${itemId}`;
}

export function listDocuments(itemId: string): VaultDocument[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(docsKey(itemId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as VaultDocument[]) : [];
  } catch {
    return [];
  }
}

function saveDocumentsList(itemId: string, docs: VaultDocument[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(docsKey(itemId), JSON.stringify(docs));
  } catch {
    // ignore quota errors — the file itself is already durably in IndexedDB
  }
}

export async function addDocument(itemId: string, file: File): Promise<VaultDocument> {
  const storageKey = `doc_${itemId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await saveImageBlobToIndexedDb(file, storageKey);

  const doc: VaultDocument = {
    id: storageKey,
    name: file.name || "Document",
    storageKey,
    contentType: file.type || "application/octet-stream",
    addedAt: Date.now(),
  };

  saveDocumentsList(itemId, [...listDocuments(itemId), doc]);
  return doc;
}

export async function removeDocument(itemId: string, documentId: string) {
  saveDocumentsList(itemId, listDocuments(itemId).filter((d) => d.id !== documentId));
  await deleteImageFromIndexedDb(documentId).catch(() => {});
}

export function getDocumentUrl(doc: VaultDocument): Promise<string | undefined> {
  return getImageObjectUrlFromIndexedDb(doc.storageKey);
}
