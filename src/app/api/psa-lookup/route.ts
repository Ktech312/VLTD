import { NextRequest, NextResponse } from "next/server";

const PSA_BASE = "https://api.psacard.com/publicapi";

function getAuth(): string | null {
  const token = process.env.PSA_TOKEN?.trim() ?? "";
  if (!token) return null;
  return `bearer ${token}`;
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

    if (!res.ok) {
      // 401/403 almost always means the token is invalid/expired/revoked, not
      // that this specific cert lookup failed — PSA's public API requires a
      // developer account + access token from https://www.psacard.com/publicapi,
      // it's not something that "just works" once PSA_TOKEN is set once and
      // forgotten. Say that plainly instead of a bare status code.
      const message =
        res.status === 401 || res.status === 403
          ? "PSA_TOKEN is set but PSA rejected it (expired/invalid/revoked). Get a fresh token from https://www.psacard.com/publicapi and update it in Vercel."
          : `PSA API ${res.status}`;
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

    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PSA lookup failed.";
    if (message.includes("abort")) {
      return NextResponse.json({ error: "PSA API timed out." }, { status: 504 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
