import { NextRequest, NextResponse } from "next/server";

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
  year?: string;
  brand?: string;
  condition?: string;
  barcode?: string;
};

function extractJsonObject(raw: string) {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const source = fenced || raw;

  const firstBrace = source.indexOf("{");
  const lastBrace = source.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error("AI did not return JSON.");
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
    year: typeof raw.year === "string" ? raw.year.trim() : undefined,
    brand: typeof raw.brand === "string" ? raw.brand.trim() : undefined,
    condition: typeof raw.condition === "string" ? raw.condition.trim() : undefined,
    barcode: typeof raw.barcode === "string" ? raw.barcode.trim() : undefined,
  };
}

export async function POST(req: NextRequest) {
  try {
    console.log("=== ANALYZE ITEM CALLED ===");
    console.log("ANTHROPIC_API_KEY exists:", !!process.env.ANTHROPIC_API_KEY);
    console.log("All env keys available:", Object.keys(process.env).filter(k => k.includes("ANTHROP") || k.includes("API")));

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI identification is not configured." },
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

    const prompt = [
      "Analyze this collectible or product photo and return JSON only.",
      "Use this exact schema:",
      JSON.stringify(
        {
          detectedTitle: "string — full item name",
          detectedCategory: "string — e.g. Comics, Trading Cards, Books, Games, Music, Jewelry / Apparel, Misc, or Products",
          confidence: 0.0,
          subtitle: "string — series name, set name, or subtitle if applicable",
          number: "string — issue number, card number, or item number",
          grade: "string — grading score if visible e.g. 9.8, NM, Mint",
          certNumber: "string — PSA/CGC/BCCG cert number if visible",
          categoryLabel: "string — concise display label",
          subcategoryLabel: "string — sub-type within category",
          universe: "string — franchise, brand universe, or series e.g. Marvel, Pokemon, Star Wars",
          notes: "string — brief description of the item",
          year: "string — publication or release year if visible",
          brand: "string — manufacturer or publisher",
          condition: "string — overall condition e.g. Near Mint, Very Fine, Good",
          barcode: "string — UPC or barcode digits if clearly visible, else empty",
        },
        null,
        2
      ),
      "confidence must be between 0 and 1. Lower it if unsure.",
      "Leave fields as empty string if not visible or not applicable.",
      "Return ONLY the JSON object. No explanation, no markdown, no extra text.",
      hints ? `Extra hints from app: ${hints}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    let response: Response;
    try {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY || "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: image.type || "image/jpeg",
                    data: base64,
                  },
                },
                {
                  type: "text",
                  text: prompt,
                },
              ],
            },
          ],
        }),
      });
    } catch (err) {
      console.error("Claude fetch error:", err);
      return NextResponse.json(
        { error: "AI request failed", detail: String(err) },
        { status: 503 }
      );
    }

    if (response.status === 429) {
      return NextResponse.json(
        { error: "AI is busy right now. Please wait a moment and try again." },
        { status: 429 }
      );
    }

    if (!response.ok) {
      const details = await response.text();
      console.error("Claude non-OK response:", response.status, details);
      return NextResponse.json(
        { error: "AI Vision request failed.", details },
        { status: 502 }
      );
    }

    const result = (await response.json()) as { content?: { type: string; text: string }[] };
    const rawText = result.content?.[0]?.text || "{}";
    const parsed = sanitizeVisionResult(extractJsonObject(rawText));

    return NextResponse.json({
      title: parsed.detectedTitle,
      subtitle: parsed.subtitle ?? "",
      category: parsed.detectedCategory,
      universe: parsed.universe ?? "",
      year: parsed.year ?? "",
      brand: parsed.brand ?? "",
      grade: parsed.grade ?? "",
      certNumber: parsed.certNumber ?? "",
      condition: parsed.condition ?? "",
      description: parsed.notes ?? "",
      confidence: parsed.confidence,
      barcode: parsed.barcode ?? "",
      number: parsed.number ?? "",
      categoryLabel: parsed.categoryLabel ?? "",
      subcategoryLabel: parsed.subcategoryLabel ?? "",
      estimatedValue: parsed.estimatedValue,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown AI analysis error.",
      },
      { status: 500 }
    );
  }
}
