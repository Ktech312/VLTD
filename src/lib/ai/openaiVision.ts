export type VisionAnalysisResult = {
  detectedTitle: string;
  detectedCategory: string;
  estimatedValue?: number;
  confidence: number;
  subtitle?: string;
  number?: string;
  grade?: string;
  certNumber?: string;
  categoryLabel?: string;
  subcategoryLabel?: string;
  universe?: string;
  notes?: string;
};

export const AI_ASSIST_SETUP_MESSAGE =
  "AI Assist is unavailable until GEMINI_API_KEY or GOOGLE_API_KEY is set in Vercel.";

export async function analyzeImageWithVision(
  file: File,
  options?: { hints?: string }
): Promise<VisionAnalysisResult> {
  const formData = new FormData();
  formData.append("image", file);
  if (options?.hints?.trim()) {
    formData.append("hints", options.hints.trim());
  }

  const response = await fetch("/api/ai/analyze-item", {
    method: "POST",
    body: formData,
  });

  const payload = (await response.json()) as Partial<VisionAnalysisResult> & {
    error?: string;
    details?: string;
  };

  if (!response.ok) {
    const message =
      payload.error || payload.details || "Vision analysis failed.";

    if (/GEMINI_API_KEY|GOOGLE_API_KEY|AI Assist is not set up/i.test(message)) {
      throw new Error(AI_ASSIST_SETUP_MESSAGE);
    }

    throw new Error(
      message
    );
  }

  return {
    detectedTitle: String(payload.detectedTitle ?? "").trim() || "Unknown Item",
    detectedCategory: String(payload.detectedCategory ?? "").trim() || "Unknown",
    estimatedValue:
      typeof payload.estimatedValue === "number" && Number.isFinite(payload.estimatedValue)
        ? payload.estimatedValue
        : undefined,
    confidence:
      typeof payload.confidence === "number" && Number.isFinite(payload.confidence)
        ? payload.confidence
        : 0.45,
    subtitle: typeof payload.subtitle === "string" ? payload.subtitle.trim() : undefined,
    number: typeof payload.number === "string" ? payload.number.trim() : undefined,
    grade: typeof payload.grade === "string" ? payload.grade.trim() : undefined,
    certNumber:
      typeof payload.certNumber === "string" ? payload.certNumber.trim() : undefined,
    categoryLabel:
      typeof payload.categoryLabel === "string" ? payload.categoryLabel.trim() : undefined,
    subcategoryLabel:
      typeof payload.subcategoryLabel === "string"
        ? payload.subcategoryLabel.trim()
        : undefined,
    universe: typeof payload.universe === "string" ? payload.universe.trim() : undefined,
    notes: typeof payload.notes === "string" ? payload.notes.trim() : undefined,
  };
}
