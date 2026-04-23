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
};

function extractTextFromAnthropicContent(content: unknown) {
  if (!Array.isArray(content)) return "";

  return content
    .map((entry) => {
      if (!entry || typeof entry !== "object") return "";
      const block = entry as { type?: string; text?: string };
      return block.type === "text" ? String(block.text ?? "") : "";
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
    throw new Error("Claude Vision did not return JSON.");
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
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "AI Assist is not set up yet. Add ANTHROPIC_API_KEY to your server environment.",
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
    const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest";

    const prompt = [
      "Analyze this collectible/item photo and return JSON only.",
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
      hints ? `Extra hints from app: ${hints}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 700,
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

    if (!response.ok) {
      const details = await response.text();
      return NextResponse.json(
        { error: "Claude Vision request failed.", details },
        { status: 502 }
      );
    }

    const payload = (await response.json()) as { content?: unknown };
    const rawText = extractTextFromAnthropicContent(payload.content);
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
