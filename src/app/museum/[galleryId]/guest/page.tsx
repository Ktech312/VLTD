"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import ShareBar from "@/components/ShareBar";

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
import { AdultContentGate, ReportContentButton, useAdultGate } from "@/components/PublicSafetyControls";

function vaultItemFromGallerySnapshot(snapshot: GalleryPublicItemSnapshot): VaultItem {
  return {
    id: String(snapshot.id ?? "").trim(),
    title: String(snapshot.title ?? "").trim() || "Untitled Item",
    subtitle: typeof snapshot.subtitle === "string" ? snapshot.subtitle : undefined,
    number: typeof snapshot.number === "string" ? snapshot.number : undefined,
    grade: typeof snapshot.grade === "string" ? snapshot.grade : undefined,
    currentValue:
      typeof snapshot.currentValue === "number" && Number.isFinite(snapshot.currentValue)
        ? snapshot.currentValue
        : undefined,
    imageFrontUrl: typeof snapshot.imageFrontUrl === "string" ? snapshot.imageFrontUrl : undefined,
    imageBackUrl: typeof snapshot.imageBackUrl === "string" ? snapshot.imageBackUrl : undefined,
    imageFrontStoragePath:
      typeof snapshot.imageFrontStoragePath === "string" ? snapshot.imageFrontStoragePath : undefined,
    primaryImageKey:
      typeof snapshot.primaryImageKey === "string" ? snapshot.primaryImageKey : undefined,
    createdAt:
      typeof snapshot.createdAt === "number" && Number.isFinite(snapshot.createdAt)
        ? snapshot.createdAt
        : Date.now(),
    isNew: false,
  };
}

function rowToVaultItem(row: Record<string, unknown>): VaultItem {
  return {
    id: String(row.id ?? ""),
    profile_id: typeof row.profile_id === "string" ? row.profile_id : undefined,
    title: typeof row.title === "string" ? row.title : "Untitled Item",
    subtitle: typeof row.subtitle === "string" ? row.subtitle : undefined,
    universe: typeof row.universe === "string" ? row.universe : undefined,
    category: typeof row.category === "string" ? row.category : undefined,
    grade: typeof row.grade === "string" ? row.grade : undefined,
    notes: typeof row.notes === "string" ? row.notes : undefined,
    currentValue: typeof row.current_value === "number" ? row.current_value : undefined,
    purchasePrice: typeof row.purchase_price === "number" ? row.purchase_price : undefined,
    imageFrontUrl: typeof row.image_front_url === "string" && row.image_front_url ? row.image_front_url : undefined,
    imageFrontStoragePath: typeof row.image_front_storage_path === "string" ? row.image_front_storage_path : undefined,
    status: (row.status === "COLLECTION" || row.status === "FOR_SALE" || row.status === "SOLD" || row.status === "WISHLIST")
      ? row.status : undefined,
    isPublic: true,
    createdAt: typeof row.created_at === "number" ? row.created_at : Date.now(),
    isNew: false,
  };
}

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
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    if (!galleryId) return;

    let cancelled = false;

    async function resolveGuestPage() {
      let found = getGalleryById(galleryId);

      if (!found) {
        const supabase = getSupabaseBrowserClient();
        if (supabase) {
          const { data } = await supabase
            .from("galleries")
            .select("*")
            .eq("id", galleryId)
            .eq("visibility", "PUBLIC")
            .eq("state", "ACTIVE")
            .maybeSingle();

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
            const { data: publicItems } = await supabase
              .from("vault_items")
              .select("*")
              .eq("profile_id", found.profile_id)
              .eq("is_public", true)
              .order("created_at", { ascending: false });

            if (!cancelled && publicItems && publicItems.length > 0) {
              setItems(publicItems.map((row) => rowToVaultItem(row as Record<string, unknown>)));
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
        const hydrated = byId.get(itemId);
        if (hydrated) return hydrated;
        const snapshot = snapshotById.get(itemId);
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
          <div className="rounded-[28px] border border-white/10 bg-black/25 p-8 text-center ring-1 ring-white/10 backdrop-blur-sm">
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

  const publicShareUrl = gallery.share?.publicToken
    ? `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://vltd.vercel.app"}/museum/share/${gallery.share.publicToken}`
    : typeof window !== "undefined" ? window.location.href : "";

  return (
    <>
      <div className="fixed right-4 top-4 z-40 flex items-center gap-2">
        {isOwner ? (
          <Link
            href={`/museum/${gallery.id}`}
            className="inline-flex min-h-[34px] items-center justify-center rounded-full bg-black/45 px-3 py-1 text-xs font-semibold ring-1 backdrop-blur transition hover:bg-black/65"
            style={{ color: "var(--theme-gold, #F5B548)", borderColor: "rgba(245,181,72,0.35)" }}
          >
            Edit Exhibition
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => setShowShare((s) => !s)}
          className="flex items-center gap-1.5 rounded-full bg-[rgba(245,181,72,0.12)] px-3 py-2 text-xs font-semibold text-[#F5B548] ring-1 ring-[rgba(245,181,72,0.35)] backdrop-blur-sm transition-all hover:bg-[rgba(245,181,72,0.2)]"
          aria-label="Share this exhibition"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          Share
        </button>
        <ReportContentButton contentType="gallery" contentId={gallery.id} />
      </div>

      {showShare && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={() => setShowShare(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-[#111827] p-6 pb-10 ring-1 ring-white/10 shadow-2xl">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <p className="mb-1 text-sm font-semibold text-white">{gallery.title}</p>
            <p className="mb-4 text-xs text-white/40">Share this exhibition</p>
            <ShareBar title={gallery.title} shareUrl={publicShareUrl} compact />
          </div>
        </>
      )}

      <GuestGalleryRenderer model={model} focusCommentId={focusCommentId} />
    </>
  );
}
