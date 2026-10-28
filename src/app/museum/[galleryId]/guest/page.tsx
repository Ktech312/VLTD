"use client";

import { publicItemsTable } from "@/lib/publicItemsSource";
import { vaultItemFromPublicSnapshot as vaultItemFromGallerySnapshot } from "@/lib/hiddenItems";
import { publicRowToItem as rowToVaultItem } from "@/lib/publicProfile";
import { PUBLIC_ITEM_COLUMNS } from "@/lib/publicItemColumns";
import Link from "next/link";
import { isSupplyItem } from "@/lib/vaultStats";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

import GuestGalleryRenderer from "@/components/gallery/GuestGalleryRenderer";
import {
  getGalleryById,
  normalizeSupabaseGallery,
  recordGalleryView,
  type Gallery,
  type GalleryPublicItemSnapshot,
} from "@/lib/galleryModel";
import { resolveGuestGalleryViewModel } from "@/lib/guestGalleryViewModel";
import { loadItems, syncVaultItemsFromSupabase, type VaultItem } from "@/lib/vaultModel";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { queryPublicGalleries } from "@/lib/publicGalleries";
import { AdultContentGate, useAdultGate } from "@/components/PublicSafetyControls";

const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";

function getLocalProfileId(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ACTIVE_PROFILE_KEY) ?? "";
}

export default function GuestGalleryPage() {
  const params = useParams<{ galleryId: string }>();
  const galleryId = String(params?.galleryId ?? "");
  const searchParams = useSearchParams();
  const focusCommentId = searchParams?.get("comment") ?? "";

  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [isResolved, setIsResolved] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (!galleryId) return;

    let cancelled = false;

    async function resolveGuestPage() {
      let found = getGalleryById(galleryId);

      if (!found) {
        const supabase = getSupabaseBrowserClient();
        if (supabase) {
          // a visitor's read goes through the sanitised public view (nothing else about the exhibition's owner or visitors)
          const { data } = await queryPublicGalleries<Record<string, unknown>>(supabase, "*", (q) =>
            q.eq("id", galleryId).eq("visibility", "PUBLIC").eq("state", "ACTIVE").maybeSingle()
          );

          if (data) {
            found = normalizeSupabaseGallery(data);
          }
        }
      }

      if (cancelled) return;
      setGallery(found);

      if (found?.profile_id) {
        const localProfileId = getLocalProfileId();
        if (localProfileId && localProfileId === found.profile_id) {
          setIsOwner(true);
        }
      }

      if (found) {
        recordGalleryView(found.id);

        if (found.profile_id) {
          const supabase = getSupabaseBrowserClient();
          if (supabase) {
            let publicQuery = supabase
              .from(await publicItemsTable(supabase))
              .select(PUBLIC_ITEM_COLUMNS)
              .eq("profile_id", found.profile_id)
              .eq("is_public", true);
            if (found.itemIds.length > 0 && found.itemIds.length <= 300) {
              publicQuery = publicQuery.in("id", found.itemIds);
            }
            const { data: publicItems } = await publicQuery.order("created_at", { ascending: false });

            const shown = ((publicItems ?? []) as unknown as Record<string, unknown>[]).filter((row) => !isSupplyItem({ universe: row.universe, categoryLabel: row.category_label }));
            if (!cancelled && shown.length > 0) {
              setItems(shown.map((row) => rowToVaultItem(row as Record<string, unknown>)));
              setIsResolved(true);
              return;
            }
          }
        }
      }

      await syncVaultItemsFromSupabase();
      if (cancelled) return;
      setItems(loadItems());
      setIsResolved(true);
    }

    void resolveGuestPage();

    function onVaultUpdate() {
      setItems(loadItems());
    }

    window.addEventListener("vltd:vault-updated", onVaultUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener("vltd:vault-updated", onVaultUpdate);
    };
  }, [galleryId]);

  const resolvedItems = useMemo(() => {
    if (!gallery) return items;

    const byId = new Map(items.map((item) => [item.id, item]));
    const snapshotById = new Map(
      (gallery.publicItemSnapshots ?? []).map((snapshot) => [snapshot.id, snapshot])
    );

    const ordered = gallery.itemIds
      .map((itemId) => {
        const snapshot = snapshotById.get(itemId);
        if (snapshot?.hidden) return vaultItemFromGallerySnapshot(snapshot);
        const hydrated = byId.get(itemId);
        if (hydrated) return hydrated;
        return snapshot ? vaultItemFromGallerySnapshot(snapshot) : undefined;
      })
      .filter(Boolean) as VaultItem[];

    return ordered.length > 0
      ? ordered
      : Array.isArray(gallery.publicItemSnapshots)
        ? gallery.publicItemSnapshots.map(vaultItemFromGallerySnapshot)
        : items;
  }, [gallery, items]);

  const model = useMemo(
    () =>
      resolveGuestGalleryViewModel(gallery, resolvedItems, {
        navigation: {
          show: !!gallery,
          primaryLabel: "Guest View",
          backHref: null,
          homeHref: "/discover",
          homeLabel: "Back to Discover",
        },
        access: {
          modeLabel: "Guest Preview",
          isPublic: true,
        },
      }),
    [gallery, resolvedItems]
  );

  const adultGate = useAdultGate(gallery?.adultOnly === true);

  if (isResolved && !gallery) {
    return (
      <main className="bg-[radial-gradient(circle_at_top,rgba(30,36,46,0.96),rgba(8,10,14,1)_62%)] text-text-primary">
        <div className="mx-auto flex max-w-3xl items-center justify-center px-4">
          <div className="rounded-[14px] border border-white/10 bg-black/25 p-8 text-center ring-1 ring-white/10 backdrop-blur-sm">
            <div className="text-[11px] tracking-[0.22em] text-white/55">EXHIBITION</div>
            <h1 className="mt-3 text-2xl font-semibold">Exhibition not found</h1>
            <p className="mt-3 text-sm text-white/70">
              This exhibition could not be loaded.
            </p>
            <div className="mt-6">
              <Link
                href="/discover"
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[color:var(--pill-active-bg)] px-5 py-2 text-sm font-semibold text-slate-950 transition hover:opacity-95"
              >
                Back to Discover
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!gallery) return null;

  if (adultGate.shouldGate) {
    return <AdultContentGate onConfirm={adultGate.confirm} />;
  }

  return (
    <>
      {isOwner ? (
        <div className="relative z-10 mx-auto flex max-w-5xl items-center justify-end gap-2 px-4 pt-20">
          <Link
            href={`/museum/${gallery.id}`}
            className="inline-flex min-h-[34px] items-center justify-center rounded-full bg-black/45 px-3 py-1 text-xs font-semibold ring-1 backdrop-blur transition hover:bg-black/65"
            style={{ color: "var(--theme-gold, #C8CDD2)", borderColor: "rgba(203,208,213,0.35)" }}
          >
            Edit Exhibition
          </Link>
        </div>
      ) : null}

      <GuestGalleryRenderer model={model} focusCommentId={focusCommentId} />
    </>
  );
}
