import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/serverAdmin";
import { callVision, guardedScan } from "@/lib/server/scanGuard";

// The paid call sits behind lib/server/scanGuard.ts (signed in, image checked, membership and one scan reserved from the existing allowance before the provider is called).
export const maxDuration = 60;

// Same best-effort usage logging as analyze-item/route.ts -- see that file
// for the reasoning (EK's Users-admin-page analytics ask, 2026-08-23).
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
    /* observability only */
  }
}

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
  return guardedScan(req, "coa", async ({ base64, mime, profileId, apiKey }) => {
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

    const call = await callVision(apiKey, base64, mime, prompt, 512);
    if (call.kind === "network") return { ok: false, status: 503, body: { error: "AI request failed.", code: "provider_unreachable" }, refund: true };
    if (call.kind === "busy") return { ok: false, status: 429, body: { error: "AI is busy right now. Please wait a moment and try again.", code: "busy" }, refund: true };
    if (call.kind === "failed") return { ok: false, status: 502, body: { error: "AI request failed.", code: "provider_failed" }, refund: true };

    let parsed: Partial<CoaAnalysisResult>;
    try {
      parsed = extractJsonObject(call.text);
    } catch (err) {
      // The provider answered (and charged), so the scan stays spent.
      void logAiUsage(profileId, "analyze-coa", call.usage);
      return { ok: false, status: 502, body: { error: err instanceof Error ? err.message : "No JSON returned.", code: "unreadable_answer" }, refund: false };
    }

    void logAiUsage(profileId, "analyze-coa", call.usage);

    return {
      ok: true,
      body: {
        certNumber: String(parsed.certNumber ?? "").trim(),
        grade: String(parsed.grade ?? "").trim(),
        authenticator: String(parsed.authenticator ?? "").trim(),
        itemDescription: String(parsed.itemDescription ?? "").trim(),
        signerName: String(parsed.signerName ?? "").trim(),
        authDate: String(parsed.authDate ?? "").trim(),
        notes: String(parsed.notes ?? "").trim(),
        confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
      } satisfies CoaAnalysisResult,
    };
  });
}
