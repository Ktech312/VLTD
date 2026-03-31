export type AIDraftStatus = "DRAFTING" | "READY_FOR_REVIEW" | "NEEDS_REVIEW" | "APPROVED" | "CONVERTED_TO_ITEM";

export type AICatalogDraft = {
  id: string;
  workspaceId: string;
  createdByLabel: string;
  status: AIDraftStatus;
  category: string;
  confidenceLabel: "High confidence" | "Good match" | "Needs review" | "Low confidence";
  title: string;
  subtitle: string;
  missingFields: string[];
  frontImageUrl?: string;
  backImageUrl?: string;
  createdAt: string;
};

export function getPlaceholderDrafts(workspaceId: string): AICatalogDraft[] {
  return [
    {
      id: `${workspaceId}:1`,
      workspaceId,
      createdByLabel: "Camera Capture",
      status: "READY_FOR_REVIEW",
      category: "SPORTS",
      confidenceLabel: "Good match",
      title: "Placeholder: 1990s Sports Card Draft",
      subtitle: "PSA label detected • cert number partially readable",
      missingFields: ["Purchase source", "Storage location"],
      createdAt: new Date().toISOString(),
    },
    {
      id: `${workspaceId}:2`,
      workspaceId,
      createdByLabel: "Barcode / Photo",
      status: "NEEDS_REVIEW",
      category: "COMICS",
      confidenceLabel: "Needs review",
      title: "Placeholder: Comic Draft Review",
      subtitle: "Issue number found • publisher uncertain",
      missingFields: ["Publisher", "Issue variant", "Condition notes"],
      createdAt: new Date().toISOString(),
    },
  ];
}
