import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const PSA_BASE = "https://api.psacard.com/publicapi";

// Leave real headroom below PSA's actual 100/day cap -- if some other call
// (a webhook retry, a second developer testing, etc.) nudges the real count
// up, the app still stops itself before PSA ever has to say no.
const SAFE_DAILY_CAP = 90;

function getAuth(): string | null {
  const token = process.env.PSA_TOKEN?.trim() ?? "";
  if (!token) return null;
  return `bearer ${token}`;
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export type PSACertResult = {
  certNumber: string;
  subject: string;       // Player / character name
  brand: string;         // e.g. "Topps"
  series: string;        // e.g. "Traded"
  year: string;          // e.g. "1986"
  cardNumber: string;    // e.g. "41T"
  grade: string;         // e.g. "8"
  gradeDescription: string; // e.g. "NM-MT"
  population: string;    // e.g. "123"
  totalPopulation: string;
  frontImageUrl: string | null;
  reverseImageUrl: string | null;
  isDna: boolean;
  variety: string | null;
};

type PSAResponse = {
  IsValidRequest: boolean;
  ServerMessage: string;
  PSACert?: {
    CertNumber: string;
    Year: string;
    Brand: string;
    Series: string;
    CardNumber: string;
    Subject: string;
    "Variety/Label"?: string;
    GradeDescription: string;
    CardGrade: string;
    Population: string;
    PopulationHigher: string;
    TotalPopulation: string;
    TotalPopulationHigher: string;
    IsDualCert: boolean;
    ReverseImgURL: string | null;
    FrontImgURL: string | null;
    SpecID: string;
    IsPSADNA: boolean;
  };
};

export async function GET(req: NextRequest) {
  const auth = getAuth();
  if (!auth) {
    return NextResponse.json(
      { error: "PSA token not configured. Set PSA_TOKEN." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const cert = searchParams.get("cert")?.replace(/\D/g, "").trim() ?? "";

  if (!cert) {
    return NextResponse.json({ error: "Provide ?cert=<certNumber>" }, { status: 400 });
  }

  const supabase = getServiceClient();

  // ── 1. Permanent cache -- a PSA cert's data never changes once issued,
  // so once ANY user/dev has looked it up, we never ask PSA again, ever.
  // Zero real PSA calls for a repeat lookup of the same cert. ──
  if (supabase) {
    const { data: cached } = await supabase.rpc("psa_cache_get", { p_cert: cert });
    if (cached) {
      return NextResponse.json({ result: cached as PSACertResult, cached: true });
    }
  }

  // ── 2. Hard internal daily budget, enforced BEFORE calling PSA -- stops
  // short of PSA's real 100/day, and short-circuits instantly for the rest
  // of the day the moment PSA itself has said no once (see step 4 below). ──
  if (supabase) {
    const { data: reserved } = await supabase.rpc("psa_usage_try_reserve", {
      p_safe_cap: SAFE_DAILY_CAP,
    });
    const row = Array.isArray(reserved) ? reserved[0] : reserved;
    if (row && !row.allowed) {
      return NextResponse.json(
        {
          error:
            "PSA lookups are paused for today — the shared daily call budget is used up (this protects against exceeding PSA's own 100/day account cap). Fill this item in by hand, or try again tomorrow.",
          budgetPaused: true,
        },
        { status: 503 }
      );
    }
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${PSA_BASE}/cert/GetByCertNumber/${cert}`, {
      headers: {
        Authorization: auth,
        Accept: "application/json",
      },
      signal: controller.signal,
      next: { revalidate: 3600 }, // PSA cert data doesn't change frequently
    });

    clearTimeout(timeout);

    // Per PSA's own error-code docs (https://www.psacard.com/publicapi):
    // 500 usually means bad credentials (though could be their own server
    // error); 4xx usually means the request path/format itself is wrong,
    // NOT credentials; 204 means empty request data. None of that is
    // "401/403 = bad token," which was this route's original (wrong) guess
    // — that assumption sent EK to regenerate a token that was never the
    // real problem once, when the actual cause turned out to be the
    // account's daily call quota being exhausted. Always read PSA's actual
    // error text first; only fall back to a status-code-based guess (using
    // PSA's documented meanings, not an assumption) if that body is empty.
    if (res.status === 204) {
      return NextResponse.json({ result: null, message: "Empty request — no cert number reached PSA." });
    }

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      const psaMessage = bodyText.replace(/^"|"$/g, "").trim(); // PSA wraps some errors in a bare JSON string

      // ── 4. PSA itself said no -- mark today exhausted immediately so
      // every OTHER call the rest of today short-circuits at step 2 above
      // instead of spending another real call to find out the same way. ──
      if (supabase && /quota/i.test(psaMessage)) {
        await supabase.rpc("psa_usage_mark_exhausted");
      }

      const message = psaMessage
        ? /quota/i.test(psaMessage)
          ? `PSA API daily quota exceeded: "${psaMessage}" — this resets on PSA's own schedule (their message says "per Day"), or email collectors-apis@collectors.com to raise the limit. Not a token problem.`
          : `PSA API rejected the request: "${psaMessage}"`
        : res.status === 500
          ? "PSA API returned a server error (500) — per PSA's docs this usually means the token/credentials are bad, but could also be a PSA-side server issue. Worth a retry before assuming the token."
          : `PSA API rejected the request (${res.status}) — per PSA's docs this range usually means the request path/format itself is invalid, not necessarily the token.`;
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const data: PSAResponse = await res.json();

    if (!data.IsValidRequest || !data.PSACert) {
      // "No data found" or "Invalid CertNo" — not an error, just no match
      return NextResponse.json({ result: null, message: data.ServerMessage });
    }

    const c = data.PSACert;
    const result: PSACertResult = {
      certNumber: c.CertNumber,
      subject: c.Subject ?? "",
      brand: c.Brand ?? "",
      series: c.Series ?? "",
      year: c.Year ?? "",
      cardNumber: c.CardNumber ?? "",
      grade: c.CardGrade ?? "",
      gradeDescription: c.GradeDescription ?? "",
      population: c.Population ?? "",
      totalPopulation: c.TotalPopulation ?? "",
      frontImageUrl: c.FrontImgURL ?? null,
      reverseImageUrl: c.ReverseImgURL ?? null,
      isDna: c.IsPSADNA ?? false,
      variety: c["Variety/Label"] || null,
    };

    // Cache the real result -- this cert never needs to hit PSA again.
    if (supabase) {
      await supabase.rpc("psa_cache_put", { p_cert: cert, p_result: result });
    }

    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PSA lookup failed.";
    if (message.includes("abort")) {
      return NextResponse.json({ error: "PSA API timed out." }, { status: 504 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
