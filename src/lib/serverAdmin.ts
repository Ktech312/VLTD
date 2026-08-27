import { NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role client — SERVER ONLY. Bypasses RLS. Never import into client code.
export function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Reads the `aal` (Authenticator Assurance Level) claim straight out of the
// access token's own JWT payload — "aal2" means this session actually
// completed an MFA/2FA challenge, "aal1" means password-only (or no MFA
// factor enrolled at all, which never advances past aal1). Written with
// atob() rather than Buffer so it works the same whether this route ever
// ends up on the Node or Edge runtime. `getUser()` (called just before
// this) already verified the token's signature/validity server-side, so
// decoding this one extra claim from the same already-trusted token isn't
// a new trust boundary — just reading a field out of data already proven
// authentic.
function getSessionAal(token: string): string | null {
  try {
    const payloadB64Url = token.split(".")[1];
    if (!payloadB64Url) return null;
    const base64 = payloadB64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { aal?: string };
    return payload.aal ?? null;
  } catch {
    return null;
  }
}

// Verify the caller is an admin. The browser sends its Supabase access token as
// `Authorization: Bearer <token>`; we validate it and check owner email / user_roles.
export async function getAdminEmail(req: NextRequest, svc: SupabaseClient): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  const { data, error } = await svc.auth.getUser(token);
  const email = data.user?.email?.toLowerCase() ?? "";
  if (error || !email) return null;

  // EK's ask (2026-08-27), after an outside security researcher's earlier
  // disclosure made real people-are-watching concrete: admin API routes
  // now require the caller's session to have actually completed an MFA
  // challenge, not just a valid password login — same requirement added
  // to the client-side check in adminAuth.ts (see that file for the full
  // reasoning). A stolen/replayed session token alone is no longer
  // enough to reach an admin endpoint.
  if (getSessionAal(token) !== "aal2") return null;

  const ownerEmail = (process.env.NEXT_PUBLIC_OWNER_EMAIL ?? "").toLowerCase();
  if (ownerEmail && email === ownerEmail) return email;

  const { data: role } = await svc
    .from("user_roles")
    .select("role")
    .eq("email", email)
    .maybeSingle();

  return role ? email : null;
}
