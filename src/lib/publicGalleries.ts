// Public pages read exhibitions through the sanitised view public_galleries (RC-05, stage 3), never through the galleries table:
// the view leaves out visitor identifiers, curator notes and unknown nested data, and shows no profile id for an exhibition that uses an alias.
// If the view does not exist yet (the SQL has not been applied) the table is used instead, so the site works before and after the SQL.
// Members reading their OWN exhibitions (builder, Exhibitions list) still use the table: that is not a public read.

export const PUBLIC_GALLERIES_VIEW = "public_galleries";

/** True when a request failed only because the view is not there. */
export function isMissingViewError(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!error) return false;
  const code = String(error.code ?? "");
  const text = String(error.message ?? "").toLowerCase();
  return code === "PGRST205" || code === "42P01" || (text.includes(PUBLIC_GALLERIES_VIEW) && (text.includes("schema cache") || text.includes("does not exist")));
}

/**
 * Runs a public-exhibition query on the view; falls back to the table only if the view is missing.
 * `build` adds the filters, e.g. (q) => q.eq("visibility", "PUBLIC").limit(100).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function queryPublicGalleries<T = Array<Record<string, unknown>>>(supabase: any, columns: string, build: (query: any) => any): Promise<{ data: T | null; error: { code?: string; message?: string } | null }> {
  const viaView = await build(supabase.from(PUBLIC_GALLERIES_VIEW).select(columns));
  if (!isMissingViewError(viaView?.error)) return viaView;
  return build(supabase.from("galleries").select(columns));
}

/** Server-side REST version for page titles and preview images: view first, table only if the view answers 404 (missing). */
export async function fetchPublicGalleriesRest(base: string, headers: Record<string, string>, query: string, init: RequestInit = {}): Promise<Response> {
  const viaView = await fetch(`${base}/rest/v1/${PUBLIC_GALLERIES_VIEW}?${query}`, { ...init, headers });
  if (viaView.status !== 404) return viaView;
  return fetch(`${base}/rest/v1/galleries?${query}`, { ...init, headers });
}
