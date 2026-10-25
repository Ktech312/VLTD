import { ScanRefusedError, postScan, type ScanAllowance } from "@/lib/ai/scanRequest";

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
  conditionReason: string;
  conditionConfidence: number;
  description: string;
  confidence: number;
  barcode: string;
  number: string;
  categoryLabel: string;
  subcategoryLabel: string;
  estimatedValue?: number;
  /** The profile's AI scans after this one, as the server counted them (the server spends the scan; the browser never charges it). */
  allowance?: ScanAllowance;
};

export const AI_ASSIST_SETUP_MESSAGE =
  "AI Assist is unavailable. Please set the ANTHROPIC_API_KEY environment variable in Vercel.";

export async function analyzeImageWithVision(
  file: File,
  options?: { hints?: string; universe?: string; category?: string; subcategory?: string }
): Promise<VisionAnalysisResult> {
  const formData = new FormData();
  formData.append("image", file);
  if (options?.hints?.trim()) {
    formData.append("hints", options.hints.trim());
  }
  if (options?.universe?.trim()) formData.append("universe", options.universe.trim());
  if (options?.category?.trim()) formData.append("category", options.category.trim());
  if (options?.subcategory?.trim()) formData.append("subcategory", options.subcategory.trim());
  // The sign-in token, the profile and a request id are added by postScan; the server checks them before anything is paid for.
  let payload: Partial<VisionAnalysisResult>;
  let allowance: ScanAllowance | undefined;
  try {
    const sent = await postScan<Partial<VisionAnalysisResult>>("/api/ai/analyze-item", formData);
    payload = sent.data;
    allowance = sent.allowance;
  } catch (err) {
    if (err instanceof ScanRefusedError && err.code === "not_configured") throw new Error(AI_ASSIST_SETUP_MESSAGE);
    throw err;
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
    conditionReason: String(payload.conditionReason ?? "").trim(),
    conditionConfidence: Number(payload.conditionConfidence ?? 0),
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
    allowance,
  };
}
