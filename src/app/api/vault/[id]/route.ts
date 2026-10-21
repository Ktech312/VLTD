// src/app/api/vault/[id]/route.ts
// Legacy in-memory item store. Nothing in the app calls it. It used to answer anyone (RC-33); it now answers only a signed-in person
// (a valid Supabase access token in `Authorization: Bearer <token>`), and the in-memory list is capped so it cannot grow without limit.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { VaultItem } from "@/lib/vaultModel";

declare global {
  // eslint-disable-next-line no-var
  var __vltd_items__: VaultItem[] | undefined;
}

const MAX_ITEMS = 200;

function getStore(): VaultItem[] {
  if (!globalThis.__vltd_items__) globalThis.__vltd_items__ = [];
  return globalThis.__vltd_items__;
}

async function signedIn(req: Request): Promise<boolean> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!token || !url || !key) return false;
  try {
    const { data, error } = await createClient(url, key, { auth: { persistSession: false } }).auth.getUser(token);
    return !error && Boolean(data.user?.id);
  } catch {
    return false;
  }
}

const refused = () => NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await signedIn(req))) return refused();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const item = body?.item as VaultItem | undefined;
  if (!item?.id) return NextResponse.json({ ok: false, error: "Missing item" }, { status: 400 });

  const store = getStore();
  globalThis.__vltd_items__ = [item, ...store.filter((x) => x.id !== id)].slice(0, MAX_ITEMS);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await signedIn(req))) return refused();
  const { id } = await ctx.params;
  const store = getStore();
  globalThis.__vltd_items__ = store.filter((x) => x.id !== id);
  return NextResponse.json({ ok: true });
}
