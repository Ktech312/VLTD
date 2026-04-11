"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { getGalleryByPublicToken } from "@/lib/galleryModel";
import { getPrimaryImageUrl, VaultItem } from "@/lib/vaultModel";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function PublicGalleryPage() {
  const params = useParams();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [gallery, setGallery] = useState<any>(null);
  const [items, setItems] = useState<VaultItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!token) return;

      setLoading(true);

      const g = await getGalleryByPublicToken(token);

      if (!g) {
        setGallery(null);
        setLoading(false);
        return;
      }

      // 🔥 CRITICAL: fetch items from Supabase
      const supabase = getSupabaseBrowserClient();

      let fetchedItems: VaultItem[] = [];

      if (supabase && g.itemIds?.length) {
        const { data, error } = await supabase
          .from("vault_items")
          .select("*")
          .in("id", g.itemIds);

        if (!error && data) {
          fetchedItems = data;
        } else {
          console.error("Failed to load gallery items:", error);
        }
      }

      if (!cancelled) {
        setGallery(g);
        setItems(fetchedItems);
        setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // ---------------- STATES ----------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-white">
        Loading gallery...
      </div>
    );
  }

  if (!gallery) {
    return (
      <div className="flex items-center justify-center h-screen text-white">
        Gallery not found
      </div>
    );
  }

  // ---------------- UI ----------------

  return (
    <div className="min-h-screen text-white p-10">
      <h1 className="text-3xl mb-8">{gallery.title}</h1>

      {items.length === 0 && (
        <div className="opacity-60">
          No items in this gallery.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {items.map((item) => {
          const image = getPrimaryImageUrl(item);

          return (
            <div key={item.id} className="border p-3 rounded">
              {image ? (
                <img
                  src={image}
                  className="w-full h-40 object-cover mb-2"
                />
              ) : (
                <div className="h-40 bg-gray-800 mb-2 flex items-center justify-center text-xs">
                  No Image
                </div>
              )}

              <div className="text-sm">{item.title}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}