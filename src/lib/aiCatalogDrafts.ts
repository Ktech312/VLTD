export type AIDraftStatus = "READY_FOR_REVIEW" | "NEEDS_REVIEW" | "APPROVED" | "REJECTED" | "CONVERTED";

export type AICatalogDraft = {
  id: string;
  workspaceId: string;
  createdByLabel: string;
  status: AIDraftStatus;
  confidenceLabel: "High" | "Good" | "Low" | "Unknown";
  confidenceScore: number; // 0–100
  // Item fields (pre-filled by AI, editable by human)
  title: string;
  subtitle?: string;
  category?: string;
  categoryLabel?: string;
  universe?: string;
  number?: string;
  grade?: string;
  certNumber?: string;
  subject?: string;
  notes?: string;
  purchasePrice?: number;
  currentValue?: number;
  frontImageUrl?: string;
  backImageUrl?: string;
  missingFields: string[];
  reviewNotes?: string;
  createdAt: string;
  reviewedAt?: string;
};

const STORAGE_KEY = "vltd_ai_drafts_v1";

export function loadDrafts(): AICatalogDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AICatalogDraft[]) : [];
  } catch {
    return [];
  }
}

export function saveDrafts(drafts: AICatalogDraft[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

export function upsertDraft(draft: AICatalogDraft) {
  const drafts = loadDrafts();
  const idx = drafts.findIndex((d) => d.id === draft.id);
  if (idx >= 0) {
    drafts[idx] = draft;
  } else {
    drafts.unshift(draft);
  }
  saveDrafts(drafts);
}

export function deleteDraft(id: string) {
  saveDrafts(loadDrafts().filter((d) => d.id !== id));
}

export function getDraft(id: string): AICatalogDraft | undefined {
  return loadDrafts().find((d) => d.id === id);
}

// Legacy compat
export function getPlaceholderDrafts(_workspaceId: string): AICatalogDraft[] {
  return loadDrafts().slice(0, 3);
}
