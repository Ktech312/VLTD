export type VisionAnalysisResult = {
  title: string;
  subtitle: string;
  category: string;
  universe: string;
  year: string;
  brand: string;
  grade: string;
  certNumber: string;
  condition: string;
  description: string;
  confidence: number;
  barcode: string;
  number: string;
  categoryLabel: string;
  subcategoryLabel: string;
  estimatedValue?: number;
};

export const AI_ASSIST_SETUP_MESSAGE =
  "AI Assist is unavailable. Please set the Gemini_API_Key environment variable in Vercel.";

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

    if (/Gemini_API_Key|GEMINI_API_KEY|GOOGLE_API_KEY|AI Assist is not set up|unavailable/i.test(message)) {
      throw new Error(AI_ASSIST_SETUP_MESSAGE);
    }

    throw new Error(message);
  }

  return {
    title: String(payload.title ?? "").trim() || "Unknown Item",
    subtitle: String(payload.subtitle ?? "").trim(),
    category: String(payload.category ?? "").trim() || "Unknown",
    universe: String(payload.universe ?? "").trim(),
    year: String(payload.year ?? "").trim(),
    brand: String(payload.brand ?? "").trim(),
    grade: String(payload.grade ?? "").trim(),
    certNumber: String(payload.certNumber ?? "").trim(),
    condition: String(payload.condition ?? "").trim(),
    description: String(payload.description ?? "").trim(),
    confidence:
      typeof payload.confidence === "number" && Number.isFinite(payload.confidence)
        ? Math.max(0, Math.min(1, payload.confidence))
        : 0.45,
    barcode: String(payload.barcode ?? "").trim(),
    number: String(payload.number ?? "").trim(),
    categoryLabel: String(payload.categoryLabel ?? "").trim(),
    subcategoryLabel: String(payload.subcategoryLabel ?? "").trim(),
    estimatedValue:
      typeof payload.estimatedValue === "number" && Number.isFinite(payload.estimatedValue)
        ? payload.estimatedValue
        : undefined,
  };
}
