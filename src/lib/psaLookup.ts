import type { PSACertResult } from "@/app/api/psa-lookup/route";

export type { PSACertResult };

/**
 * Returns true if a barcode string looks like a PSA cert number.
 * PSA certs are 7–10 digit numeric strings — shorter than a UPC (12–13)
 * and not a book ISBN-13 (13 digits).
 */
export function looksLikePSACert(barcode: string): boolean {
  const digits = barcode.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 10;
}

/**
 * Extracts a PSA cert number from a QR-code URL.
 * PSA QR codes link to: https://www.psacard.com/cert/<certNumber>
 */
export function extractPSACertFromUrl(raw: string): string | null {
  // Match psacard.com/cert/<digits>
  const m = raw.match(/psacard\.com\/cert\/([0-9]+)/i);
  return m ? m[1] : null;
}

export async function lookupPSACert(certNumber: string): Promise<PSACertResult | null> {
  const digits = certNumber.replace(/\D/g, "").trim();
  if (!digits) return null;

  const res = await fetch(`/api/psa-lookup?cert=${encodeURIComponent(digits)}`);
  const payload = (await res.json().catch(() => ({}))) as { result?: PSACertResult | null; error?: string };

  if (!res.ok) {
    // Throw instead of silently returning null -- an invalid/expired
    // PSA_TOKEN (401/403) was previously indistinguishable from a genuine
    // "cert not found," which showed the wrong message ("check the number
    // and try again") for what's actually a token problem only EK can fix.
    throw new Error(payload.error || `PSA lookup failed (${res.status}).`);
  }

  return payload.result ?? null;
}

/**
 * Builds a display-friendly grade string.
 * e.g. grade="8", gradeDescription="NM-MT" → "PSA 8 (NM-MT)"
 */
export function formatPSAGrade(cert: PSACertResult): string {
  if (!cert.grade) return "PSA";
  if (cert.gradeDescription) return `PSA ${cert.grade} (${cert.gradeDescription})`;
  return `PSA ${cert.grade}`;
}

/**
 * Builds a subtitle string from brand + series.
 * e.g. "1986 Topps Traded"
 */
export function formatPSASet(cert: PSACertResult): string {
  const parts = [cert.year, cert.brand, cert.series].filter(Boolean);
  return parts.join(" ");
}
