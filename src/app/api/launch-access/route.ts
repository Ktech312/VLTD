import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const CAPACITY = 50;
const SEED_DOMAIN = "@vltd-seed.internal";

type LaunchAccessStatus = {
  capacity: number;
  claimed: number;
  remaining: number;
  isOpen: boolean;
};

function response(status: LaunchAccessStatus) {
  return NextResponse.json(status, {
    headers: {
      "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
    },
  });
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Once the launch migration is applied, this RPC is the source of truth.
  // It exposes only aggregate numbers and uses the same claim rows as the
  // database trigger that rejects account 51.
  const { data, error } = await supabase.rpc("get_launch_access_status");
  const row = Array.isArray(data) ? data[0] : data;
  if (!error && row) {
    return response({
      capacity: Number(row.capacity ?? CAPACITY),
      claimed: Number(row.claimed ?? 0),
      remaining: Number(row.remaining ?? CAPACITY),
      isOpen: Boolean(row.is_open),
    });
  }

  // Deployment-safe fallback: the homepage can show the truthful current
  // account count before the migration is applied. No user records leave this
  // server route. The migration is still required for atomic cap enforcement.
  let page = 1;
  let claimed = 0;
  while (claimed < CAPACITY) {
    const { data: usersPage, error: usersError } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (usersError) {
      return NextResponse.json({ error: "count_unavailable" }, { status: 503 });
    }
    const users = usersPage.users ?? [];
    claimed += users.filter((user) => !String(user.email ?? "").endsWith(SEED_DOMAIN)).length;
    if (users.length < 100) break;
    page += 1;
  }

  claimed = Math.min(CAPACITY, claimed);
  return response({
    capacity: CAPACITY,
    claimed,
    remaining: CAPACITY - claimed,
    isOpen: claimed < CAPACITY,
  });
}

