import { NextRequest, NextResponse } from "next/server";
import { TAXONOMY, UNIVERSE_KEYS, UNIVERSE_LABEL } from "@/lib/taxonomy";
import { getServiceClient } from "@/lib/serverAdmin";

// Best-effort usage logging for the future per-user analytics EK asked for
// (Users admin page: AI calls + tokens per account, alongside the existing
// time-on-app presence tracking). Never blocks or fails the real response --
// void-called, own try/catch, no error surfaced to the caller either way.
async function logAiUsage(
  profileId: string | null,
  feature: string,
  usage?: { input_tokens?: number; output_tokens?: number },
): Promise<void> {
  try {
    const svc = getServiceClient();
    if (!svc) return;
    await svc.from("ai_usage_log").insert({
      profile_id: profileId,
      feature,
      input_tokens: usage?.input_tokens ?? null,
      output_tokens: usage?.output_tokens ?? null,
    });
  } catch {
    /* observability only -- never let logging break the real request */
  }
}

const UNIVERSE_OPTIONS = UNIVERSE_KEYS.map((k) => UNIVERSE_LABEL[k]).join(", ");

// The app's real Universe -> Category -> [Subcategories] tree, built straight from
// the source of truth so it can never drift. Given to the model so it classifies
// EVERY item type into valid options instead of guessing free-text.
const TAXONOMY_GUIDE = UNIVERSE_KEYS.map((k) => {
  const cats = Object.entries(TAXONOMY[k])
    .map(([cat, subs]) => `${cat} [${subs.join(", ")}]`)
    .join("; ");
  return `- ${UNIVERSE_LABEL[k]}: ${cats}`;
}).join("\n");

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
  conditionReason?: string;
  conditionConfidence?: number;
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
    notes: typeof raw.notes === "string" ? raw.notes.trim() : undefined,
    year: typeof raw.year === "string" ? raw.year.trim() : undefined,
    brand: typeof raw.brand === "string" ? raw.brand.trim() : undefined,
    condition: typeof raw.condition === "string" ? raw.condition.trim() : undefined,
    conditionReason: typeof raw.conditionReason === "string" ? raw.conditionReason.trim() : undefined,
    conditionConfidence:
      typeof raw.conditionConfidence === "number" && Number.isFinite(raw.conditionConfidence)
        ? Math.max(0, Math.min(1, raw.conditionConfidence))
        : undefined,
    barcode: typeof raw.barcode === "string" ? raw.barcode.trim() : undefined,
    universe: typeof rawAny(raw).universe === "string" ? (rawAny(raw).universe as string).trim() : undefined,
    categoryLabel: typeof rawAny(raw).category === "string" ? (rawAny(raw).category as string).trim() : undefined,
    subcategoryLabel: typeof rawAny(raw).subcategory === "string" ? (rawAny(raw).subcategory as string).trim() : undefined,
  };
}

function rawAny(raw: unknown): Record<string, unknown> {
  return (raw ?? {}) as Record<string, unknown>;
}

function gradingScaleInstructions(universe: string, category: string) {
  const u = universe.toUpperCase();
  const c = category.toLowerCase();

  if (u === "SPORTS" || u === "TCG") {
    return "Grading scale: PSA/BGS numeric 1-10 (10=Gem Mint, 9=Mint, 8=NM-MT, 7=NM, 6=EX-MT, 5=EX, 4=VG-EX, 3=VG, 2=Good, 1=Poor). If a slab label is visible, read the grade directly. If raw, estimate a grade range based on surface, corners, edges, and centering.";
  }

  if (u === "POP_CULTURE" || c.includes("comic")) {
    return "Grading scale: CGC/CBCS numeric comic scale from 0.5 to 10. Assess spine stress, staple rust, centerfold, water damage, tape, writing, and cover gloss. If raw, estimate a sensible grade range.";
  }

  if (u === "MUSIC") {
    return "Grading scale: Goldmine standard - M, NM, VG+, VG, G+, G, F, P. Assess sleeve condition separately from media condition when visible.";
  }

  if (u === "GAMES") {
    return "Grading scale for sealed games: WATA/VGA style. For opened games, use completeness terms like CIB, Loose, Manual Only, Box Only. Note visible box, manual, inserts, seals, and wear.";
  }

  if (u === "JEWELRY_APPAREL") {
    return "Describe condition in plain language: Mint/Unworn, Excellent, Very Good, Good, Fair, Poor. Note tags, packaging, visible wear, scratches, tarnish, missing stones, or hardware issues.";
  }

  return "Describe overall condition as Mint, Near Mint, Excellent, Very Good, Good, Fair, or Poor. Note visible defects such as scratches, tears, fading, stains, missing parts, or packaging wear.";
}

export async function POST(req: NextRequest) {
  try {
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
    const universe = String(formData.get("universe") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    const subcategory = String(formData.get("subcategory") ?? "").trim();
    const profileId = String(formData.get("profileId") ?? "").trim() || null;

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "Missing image upload." }, { status: 400 });
    }

    const arrayBuffer = await image.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const gradingInstructions = gradingScaleInstructions(universe, category);

    const preClassified = Boolean(universe || category || subcategory);
    const prompt = [
      "Analyze this collectible or product photo and return JSON only.",
      preClassified
        ? `Context: This item has been pre-classified as:\nUniverse: ${universe || "unknown"}\nCategory: ${category || "unknown"}\nSubcategory: ${subcategory || "unknown"}\nUse this context to focus your identification on the specific item name, set name, number, year, grade, and condition. Do not return universe or category fields.`
        : `Also classify the item. Pick "universe", "category", and "subcategory" using EXACTLY the names from this taxonomy (do not invent your own — copy the label verbatim, and only pick a category/subcategory that belongs to the universe you chose):
${TAXONOMY_GUIDE}

Universe must be one of: ${UNIVERSE_OPTIONS}. If you can identify the universe and category but not the exact subcategory, fill those two and leave subcategory empty rather than guessing.

Comic books are commonly confused with trading cards -- look for these
visual cues before guessing a card game: a rectangular cover roughly
6.6 x 10.2 inches (much larger than a card), a publisher logo (Marvel,
DC, Image, Dark Horse, IDW, Boom!, Valiant, Archie), an issue number
in a small box near a corner, cover-copy/dialogue captions, and (on a
back/spine photo) visible staples. If the item matches this format,
classify it as universe "Pop Culture", category "Comics" even if the
specific issue or series isn't readable.

Sports cards vs. game cards: if the card shows a REAL athlete or team
(soccer/football, basketball, baseball, hockey, etc.), a club crest or
league logo (UEFA, Champions League, Premier League, NBA, NFL, MLB, FIFA,
Panini, Topps, Prizm), a photo of a person in a uniform, or real-world
stats, classify it as universe "Sports" -- NOT "TCG & Non Sport Card".
Only use "TCG & Non Sport Card" for game cards with play mechanics on them
(mana/energy symbols, HP, attack/defense numbers, ability rules text), e.g.
Pokemon, Magic, Yu-Gi-Oh, Lorcana. A slabbed/graded card is still a sports
card if it pictures an athlete.`,
      gradingInstructions,
      "If the item's title/text is not clearly legible in the photo, do NOT invent a specific name, set, or series -- use a generic but honest title instead (e.g. \"Comic book (title not legible)\", \"Trading card (illegible)\") and keep confidence below 0.3. A vague-but-honest guess is far more useful than a confident wrong one.",
      "Use this exact schema:",
      JSON.stringify(
        {
          detectedTitle: "string - full item name",
          confidence: 0.0,
          ...(preClassified ? {} : {
            universe: "string - one universe label from the provided list, or empty",
            category: "string - best-guess category, or empty",
            subcategory: "string - best-guess subcategory / specific game or set family, or empty",
          }),
          subtitle: "string - series name, set name, or subtitle if applicable",
          number: "string - issue number, card number, or item number",
          grade: "string - grading score or named grade, e.g. PSA 9, 9.8, NM, VG+, CIB",
          certNumber: "string - PSA/CGC/BCCG cert number if visible",
          notes: "string - brief description of the item",
          year: "string - publication or release year if visible",
          brand: "string - manufacturer or publisher",
          condition: "string - named condition tier, e.g. Near Mint, Very Fine, Good",
          conditionReason: "string - 1-2 sentences explaining visible condition evidence",
          conditionConfidence: 0.0,
          barcode: "string - UPC or barcode digits if clearly visible, else empty",
        },
        null,
        2
      ),
      "confidence and conditionConfidence must be between 0 and 1. Lower them if unsure.",
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
          "x-api-key": apiKey,
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

    const result = (await response.json()) as {
      content?: { type: string; text: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const rawText = result.content?.[0]?.text || "{}";
    const parsed = sanitizeVisionResult(extractJsonObject(rawText));

    void logAiUsage(profileId, "analyze-item", result.usage);

    return NextResponse.json({
      title: parsed.detectedTitle,
      subtitle: parsed.subtitle ?? "",
      year: parsed.year ?? "",
      brand: parsed.brand ?? "",
      grade: parsed.grade ?? "",
      certNumber: parsed.certNumber ?? "",
      condition: parsed.condition ?? "",
      conditionReason: parsed.conditionReason ?? "",
      conditionConfidence: parsed.conditionConfidence ?? 0,
      description: parsed.notes ?? "",
      confidence: parsed.confidence,
      barcode: parsed.barcode ?? "",
      number: parsed.number ?? "",
      estimatedValue: parsed.estimatedValue,
      universe: parsed.universe ?? "",
      category: parsed.categoryLabel ?? "",
      categoryLabel: parsed.categoryLabel ?? "",
      subcategoryLabel: parsed.subcategoryLabel ?? "",
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
