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
    if (!raw) return seedDemos();
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

function seedDemos(): AICatalogDraft[] {
  const demos: AICatalogDraft[] = [
    {
      id: "demo_1",
      workspaceId: "default",
      createdByLabel: "Camera Capture",
      status: "READY_FOR_REVIEW",
      confidenceLabel: "High",
      confidenceScore: 91,
      title: "1986 Fleer Michael Jordan Rookie Card",
      subtitle: "Chicago Bulls",
      category: "SPORTS",
      categoryLabel: "Sports Cards",
      universe: "SPORTS",
      number: "57",
      grade: "PSA 7",
      certNumber: "12345678",
      subject: "Michael Jordan",
      currentValue: 3800,
      missingFields: ["Purchase price", "Storage location"],
      createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    },
    {
      id: "demo_2",
      workspaceId: "default",
      createdByLabel: "Barcode Scan",
      status: "NEEDS_REVIEW",
      confidenceLabel: "Good",
      confidenceScore: 68,
      title: "Amazing Spider-Man #300",
      subtitle: "First appearance of Venom",
      category: "COMICS",
      categoryLabel: "Comics",
      universe: "POP_CULTURE",
      number: "300",
      grade: "VF/NM 9.0",
      subject: "Venom",
      missingFields: ["Publisher variant", "Cert number", "Purchase price"],
      notes: "Publisher uncertain — could be direct or newsstand edition.",
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: "demo_3",
      workspaceId: "default",
      createdByLabel: "Photo Upload",
      status: "READY_FOR_REVIEW",
      confidenceLabel: "Good",
      confidenceScore: 74,
      title: "1st Edition Charizard Base Set",
      subtitle: "Pokémon TCG",
      category: "TCG",
      categoryLabel: "Trading Card Game",
      universe: "TCG",
      number: "4",
      grade: "",
      subject: "Charizard",
      currentValue: 12000,
      missingFields: ["Condition / grade", "Purchase price"],
      createdAt: new Date(Date.now() - 3 * 3600000).toISOString(),
    },
  ];
  saveDrafts(demos);
  return demos;
}

// Legacy compat
export function getPlaceholderDrafts(_workspaceId: string): AICatalogDraft[] {
  return loadDrafts().slice(0, 3);
}
