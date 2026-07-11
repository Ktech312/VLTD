import { NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role client — SERVER ONLY. Bypasses RLS. Never import into client code.
export function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
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

  const ownerEmail = (process.env.NEXT_PUBLIC_OWNER_EMAIL ?? "").toLowerCase();
  if (ownerEmail && email === ownerEmail) return email;

  const { data: role } = await svc
    .from("user_roles")
    .select("role")
    .eq("email", email)
    .maybeSingle();

  return role ? email : null;
}
