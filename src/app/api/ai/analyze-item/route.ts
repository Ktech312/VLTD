import { NextRequest, NextResponse } from "next/server";

import { AI_ASSIST_SETUP_MESSAGE } from "@/lib/ai/openaiVision";

type VisionRouteResult = {
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

function extractTextFromGeminiPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";

  const candidates = (payload as { candidates?: unknown[] }).candidates;
  if (!Array.isArray(candidates)) return "";

  return candidates
    .flatMap((candidate) => {
      if (!candidate || typeof candidate !== "object") return [];
      const content = (candidate as { content?: { parts?: unknown[] } }).content;
      const parts = content?.parts;
      if (!Array.isArray(parts)) return [];

      return parts.map((part) => {
        if (!part || typeof part !== "object") return "";
        return typeof (part as { text?: string }).text === "string"
          ? String((part as { text?: string }).text ?? "")
          : "";
      });
    })
    .join("\n")
    .trim();
}

function extractJsonObject(raw: string) {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const source = fenced || raw;

  const firstBrace = source.indexOf("{");
  const lastBrace = source.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error("Gemini did not return JSON.");
  }

  return JSON.parse(source.slice(firstBrace, lastBrace + 1)) as Partial<VisionRouteResult>;
}

function sanitizeVisionResult(raw: Partial<VisionRouteResult>): VisionRouteResult {
  return {
    detectedTitle: String(raw.detectedTitle ?? "").trim() || "Unknown Item",
    detectedCategory: String(raw.detectedCategory ?? "").trim() || "Unknown",
    estimatedValue:
      typeof raw.estimatedValue === "number" && Number.isFinite(raw.estimatedValue)
        ? raw.estimatedValue
        : undefined,
    confidence:
      typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
        ? Math.max(0, Math.min(1, raw.confidence))
        : 0.45,
    subtitle: typeof raw.subtitle === "string" ? raw.subtitle.trim() : undefined,
    number: typeof raw.number === "string" ? raw.number.trim() : undefined,
    grade: typeof raw.grade === "string" ? raw.grade.trim() : undefined,
    certNumber: typeof raw.certNumber === "string" ? raw.certNumber.trim() : undefined,
    categoryLabel: typeof raw.categoryLabel === "string" ? raw.categoryLabel.trim() : undefined,
    subcategoryLabel:
      typeof raw.subcategoryLabel === "string" ? raw.subcategoryLabel.trim() : undefined,
    universe: typeof raw.universe === "string" ? raw.universe.trim() : undefined,
    notes: typeof raw.notes === "string" ? raw.notes.trim() : undefined,
  };
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error: AI_ASSIST_SETUP_MESSAGE,
        },
        { status: 503 }
      );
    }

    const formData = await req.formData();
    const image = formData.get("image");
    const hints = String(formData.get("hints") ?? "").trim();

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "Missing image upload." }, { status: 400 });
    }

    const arrayBuffer = await image.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

    const prompt = [
      "Analyze this collectible or product photo and return JSON only.",
      "Use this exact schema:",
      JSON.stringify(
        {
          detectedTitle: "string",
          detectedCategory: "string",
          estimatedValue: 0,
          confidence: 0.0,
          subtitle: "string",
          number: "string",
          grade: "string",
          certNumber: "string",
          categoryLabel: "string",
          subcategoryLabel: "string",
          universe: "string",
          notes: "string",
        },
        null,
        2
      ),
      "Confidence must be between 0 and 1.",
      "If you are unsure, leave optional fields empty and lower the confidence.",
      "Prefer concise category labels like Comics, Trading Cards, Books, Games, Music, Jewelry / Apparel, Misc, or Products.",
      hints ? `Extra hints from app: ${hints}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: prompt,
                },
                {
                  inline_data: {
                    mime_type: image.type || "image/jpeg",
                    data: base64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 700,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const details = await response.text();
      return NextResponse.json(
        { error: "Gemini Vision request failed.", details },
        { status: 502 }
      );
    }

    const payload = (await response.json()) as unknown;
    const rawText = extractTextFromGeminiPayload(payload);
    const parsed = sanitizeVisionResult(extractJsonObject(rawText));

    return NextResponse.json(parsed);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown AI analysis error.",
      },
      { status: 500 }
    );
  }
}
