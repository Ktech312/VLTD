// src/app/api/vault/[id]/route.ts
import { NextResponse } from "next/server";
import type { VaultItem } from "@/lib/vaultModel";

declare global {
  // eslint-disable-next-line no-var
  var __vltd_items__: VaultItem[] | undefined;
}

function getStore(): VaultItem[] {
  if (!globalThis.__vltd_items__) globalThis.__vltd_items__ = [];
  return globalThis.__vltd_items__;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const item = body?.item as VaultItem | undefined;
  if (!item?.id) return NextResponse.json({ ok: false, error: "Missing item" }, { status: 400 });

  const store = getStore();
  globalThis.__vltd_items__ = [item, ...store.filter((x) => x.id !== id)];
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const store = getStore();
  globalThis.__vltd_items__ = store.filter((x) => x.id !== id);
  return NextResponse.json({ ok: true });
}