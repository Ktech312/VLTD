import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import PublicVaultPage from "@/app/v/[profileId]/page";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

function getServerSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

async function resolveUsername(username: string): Promise<string | null> {
  const supabase = getServerSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username.toLowerCase())
    .maybeSingle();

  return data?.id ?? null;
}

type Params = { username: string };

export async function generateMetadata(
  { params }: { params: Promise<Params> }
): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `@${username} · VLTD`,
    description: `View @${username}'s vault on VLTD.`,
    alternates: {
      canonical: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://vltd.vercel.app"}/@${username}`,
    },
  };
}

export default async function UsernameVaultPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { username } = await params;
  const profileId = await resolveUsername(username);

  if (!profileId) notFound();

  // Delegate to the existing client vault page, passing the resolved profileId
  return <PublicVaultPage params={Promise.resolve({ profileId })} />;
}
