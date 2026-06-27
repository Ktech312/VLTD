import { NextRequest, NextResponse } from "next/server";

export type CoaAnalysisResult = {
  certNumber: string;
  grade: string;
  authenticator: string;
  itemDescription: string;
  signerName: string;
  authDate: string;
  notes: string;
  confidence: number;
};

function extractJsonObject(raw: string) {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i)?.[1];
  const source = fenced || raw;
  const firstBrace = source.indexOf("{");
  const lastBrace = source.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) throw new Error("No JSON returned.");
  return JSON.parse(source.slice(firstBrace, lastBrace + 1)) as Partial<CoaAnalysisResult>;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI not configured." }, { status: 503 });
    }

    const formData = await req.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "Missing image." }, { status: 400 });
    }

    const arrayBuffer = await image.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const prompt = `This image is a Certificate of Authenticity, authentication label, grading slab label, or similar certification document for a collectible item.

Extract all available information and return ONLY a JSON object with this exact schema:

{
  "certNumber": "certification or authentication number (string)",
  "grade": "numeric or named grade e.g. PSA 9, BGS 9.5, CGC 9.8, NM, VG+ (string)",
  "authenticator": "company that issued the cert e.g. PSA, BGS, Beckett, CGC, CBCS, JSA, Beckett Authentication, SGC (string)",
  "itemDescription": "description of the item as written on the cert (string)",
  "signerName": "athlete, artist, or signer name if this is a signed item authentication (string)",
  "authDate": "date of authentication or certification as written (string)",
  "notes": "any other useful info from the cert — serial numbers, population data, special notations (string)",
  "confidence": 0.0
}

Rules:
- confidence is 0.0 to 1.0 — how clearly readable the document is
- Leave fields as empty string "" if not visible or not applicable
- Return ONLY the JSON object, no explanation, no markdown`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: image.type || "image/jpeg", data: base64 },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "AI request failed." }, { status: 502 });
    }

    const result = (await response.json()) as { content?: { type: string; text: string }[] };
    const rawText = result.content?.[0]?.text || "{}";
    const parsed = extractJsonObject(rawText);

    return NextResponse.json({
      certNumber: String(parsed.certNumber ?? "").trim(),
      grade: String(parsed.grade ?? "").trim(),
      authenticator: String(parsed.authenticator ?? "").trim(),
      itemDescription: String(parsed.itemDescription ?? "").trim(),
      signerName: String(parsed.signerName ?? "").trim(),
      authDate: String(parsed.authDate ?? "").trim(),
      notes: String(parsed.notes ?? "").trim(),
      confidence: typeof parsed.confidence === "number"
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.5,
    } satisfies CoaAnalysisResult);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error." },
      { status: 500 }
    );
  }
}
