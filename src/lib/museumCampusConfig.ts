"use client";

// Admin-controlled config for the VLTD Museum public campus — EK's ask
// (2026-09-02): "I need to control this" for the Spotlight room's
// rotating programs, the Store room's items, and how many items show per
// category room, since these will change and grow over time. Managed at
// /admin/museum-campus. Backing tables are in
// 20260902_museum_campus_config.sql — EK runs migrations manually, so
// every fetch here falls back to a sane default if the table doesn't
// exist yet rather than breaking the campus page.

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export const DEFAULT_ITEMS_PER_ROOM = 8;

export type SpotlightProgram = {
  id: string;
  title: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
};

export type StoreItem = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price_label: string | null;
  link_url: string | null;
  enabled: boolean;
  sort_order: number;
};

export async function getItemsPerRoom(): Promise<number> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return DEFAULT_ITEMS_PER_ROOM;
  try {
    const { data } = await supabase
      .from("museum_campus_config")
      .select("items_per_room")
      .limit(1)
      .maybeSingle();
    const value = data?.items_per_room;
    return typeof value === "number" && value > 0 ? value : DEFAULT_ITEMS_PER_ROOM;
  } catch {
    return DEFAULT_ITEMS_PER_ROOM;
  }
}

export async function getActiveSpotlightPrograms(): Promise<SpotlightProgram[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from("museum_spotlight_programs")
      .select("id, title, description, is_active, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    return (data ?? []) as SpotlightProgram[];
  } catch {
    return [];
  }
}

export async function getEnabledStoreItems(): Promise<StoreItem[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  try {
    const { data } = await supabase
      .from("museum_store_items")
      .select("id, name, description, image_url, price_label, link_url, enabled, sort_order")
      .eq("enabled", true)
      .order("sort_order", { ascending: true });
    return (data ?? []) as StoreItem[];
  } catch {
    return [];
  }
}
