import { createClient } from "@supabase/supabase-js";
import { learnVideoResponse } from "@/lib/learnVideoAccess";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return learnVideoResponse(req, process.env.LEARN_VIDEO_LINKS_JSON, async token => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Account verification unavailable");
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.getUser(token);
    return !error && Boolean(data.user?.id);
  });
}
