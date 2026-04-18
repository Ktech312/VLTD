"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import GuestGalleryRenderer from "@/components/gallery/GuestGalleryRenderer";
import {
  getGalleryByPublicToken,
  recordGalleryView,
  type Gallery,
} from "@/lib/galleryModel";
import { getCurrentUser } from "@/lib/auth";
import { resolveGuestGalleryViewModel } from "@/lib/guestGalleryViewModel";
import { type VaultItem } from "@/lib/vaultModel";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

type GateMode = "loading" | "guest_allowed" | "registered_only" | "entered";
type ShareAccessMode = "private" | "public_gallery" | "guest_view" | "registered_users";

function normalizeVaultItem(raw: any): VaultItem {
  const createdAt =
    typeof raw?.created_at === "string"
      ? Date.parse(raw.created_at) || Date.now()
      : typeof raw?.createdAt === "number"
        ? raw.createdAt
        : Date.now();

  return {
    id: String(raw?.id ?? "").trim(),
    profile_id: typeof raw?.profile_id === "string" ? raw.profile_id : undefined,
    universe: typeof raw?.universe === "string" ? raw.universe : undefined,
    category: typeof raw?.category === "string" ? raw.category : undefined,
    customCategoryLabel:
      typeof raw?.custom_category_label === "string"
        ? raw.custom_category_label
        : typeof raw?.customCategoryLabel === "string"
          ? raw.customCategoryLabel
          : undefined,
    categoryLabel:
      typeof raw?.category_label === "string"
        ? raw.category_label
        : typeof raw?.categoryLabel === "string"
          ? raw.categoryLabel
          : undefined,
    subcategoryLabel:
      typeof raw?.subcategory_label === "string"
        ? raw.subcategory_label
        : typeof raw?.subcategoryLabel === "string"
          ? raw.subcategoryLabel
          : undefined,
    title: String(raw?.title ?? "").trim() || "Untitled Item",
    subtitle: typeof raw?.subtitle === "string" ? raw.subtitle : undefined,
    number: typeof raw?.number === "string" ? raw.number : undefined,
    grade: typeof raw?.grade === "string" ? raw.grade : undefined,
    purchasePrice:
      typeof raw?.purchase_price === "number"
        ? raw.purchase_price
        : typeof raw?.purchasePrice === "number"
          ? raw.purchasePrice
          : undefined,
    purchaseTax:
      typeof raw?.purchase_tax === "number"
        ? raw.purchase_tax
        : typeof raw?.purchaseTax === "number"
          ? raw.purchaseTax
          : undefined,
    purchaseShipping:
      typeof raw?.purchase_shipping === "number"
        ? raw.purchase_shipping
        : typeof raw?.purchaseShipping === "number"
          ? raw.purchaseShipping
          : undefined,
    purchaseFees:
      typeof raw?.purchase_fees === "number"
        ? raw.purchase_fees
        : typeof raw?.purchaseFees === "number"
          ? raw.purchaseFees
          : undefined,
    currentValue:
      typeof raw?.current_value === "number"
        ? raw.current_value
        : typeof raw?.currentValue === "number"
          ? raw.currentValue
          : undefined,
    purchaseSource:
      typeof raw?.purchase_source === "string"
        ? raw.purchase_source
        : typeof raw?.purchaseSource === "string"
          ? raw.purchaseSource
          : undefined,
    purchaseLocation:
      typeof raw?.purchase_location === "string"
        ? raw.purchase_location
        : typeof raw?.purchaseLocation === "string"
          ? raw.purchaseLocation
          : undefined,
    orderNumber:
      typeof raw?.order_number === "string"
        ? raw.order_number
        : typeof raw?.orderNumber === "string"
          ? raw.orderNumber
          : undefined,
    imageFrontUrl:
      typeof raw?.image_front_url === "string"
        ? raw.image_front_url
        : typeof raw?.imageFrontUrl === "string"
          ? raw.imageFrontUrl
          : undefined,
    imageBackUrl:
      typeof raw?.image_back_url === "string"
        ? raw.image_back_url
        : typeof raw?.imageBackUrl === "string"
          ? raw.imageBackUrl
          : undefined,
    imageFrontStoragePath:
      typeof raw?.image_front_storage_path === "string"
        ? raw.image_front_storage_path
        : typeof raw?.imageFrontStoragePath === "string"
          ? raw.imageFrontStoragePath
          : undefined,
    primaryImageKey:
      typeof raw?.primary_image_key === "string"
        ? raw.primary_image_key
        : typeof raw?.primaryImageKey === "string"
          ? raw.primaryImageKey
          : undefined,
    notes: typeof raw?.notes === "string" ? raw.notes : undefined,
    storageLocation:
      typeof raw?.storage_location === "string"
        ? raw.storage_location
        : typeof raw?.storageLocation === "string"
          ? raw.storageLocation
          : undefined,
    certNumber:
      typeof raw?.cert_number === "string"
        ? raw.cert_number
        : typeof raw?.certNumber === "string"
          ? raw.certNumber
          : undefined,
    serialNumber:
      typeof raw?.serial_number === "string"
        ? raw.serial_number
        : typeof raw?.serialNumber === "string"
          ? raw.serialNumber
          : undefined,
    createdAt,
    isNew: false,
  };
}

function getShareAccessMode(gallery: Gallery): ShareAccessMode {
  if (gallery.guestViewMode === "guest") return "registered_users";
  if (gallery.visibility === "LOCKED") return "private";
  if (gallery.visibility === "INVITE") return "guest_view";
  return "public_gallery";
}

function getBackgroundShellStyle(backgroundUrl?: string | null): CSSProperties | undefined {
  if (!backgroundUrl?.trim()) return undefined;

  return {
    backgroundImage: `url(${backgroundUrl})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundAttachment: "fixed",
  };
}

function GalleryBackgroundShell({
  backgroundUrl,
  children,
}: {
  backgroundUrl?: string | null;
  children: ReactNode;
}) {
  const hasBackground = !!backgroundUrl?.trim();

  return (
    <main className="relative min-h-screen text-white" style={getBackgroundShellStyle(backgroundUrl)}>
      {hasBackground ? (
        <div
          className="absolute inset-0 bg-[rgba(7,10,18,0.58)] backdrop-blur-[1.5px]"
          aria-hidden="true"
        />
      ) : null}
      <div className="relative z-10 min-h-screen">{children}</div>
    </main>
  );
}

function GateCard({
  gallery,
  accessMode,
  gateMode,
  isSignedIn,
  backgroundUrl,
  onEnterGuest,
}: {
  gallery: Gallery;
  accessMode: ShareAccessMode;
  gateMode: GateMode;
  isSignedIn: boolean;
  backgroundUrl?: string | null;
  onEnterGuest: () => void;
}) {
  const requiresRegistered = accessMode === "registered_users";

  return (
    <GalleryBackgroundShell backgroundUrl={backgroundUrl}>
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
        <div className="w-full rounded-[28px] bg-[color:var(--surface)] p-8 text-center ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
            SHARED GALLERY
          </div>
          <h1 className="mt-3 text-3xl font-semibold">{gallery.title}</h1>
          {gallery.description?.trim() ? (
            <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
              {gallery.description}
            </p>
          ) : null}

          <div className="mt-6 rounded-2xl bg-[color:var(--pill)] px-4 py-4 text-sm ring-1 ring-[color:var(--border)]">
            {requiresRegistered
              ? "Owner only allows registered users to access this gallery."
              : "Create a free account for full access, or continue as a guest."}
          </div>

          <div className="mt-6 flex flex-col items-center gap-3">
            {!isSignedIn ? (
              <Link
                href={`/login?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/")}`}
                className="vltd-pill-main-glow inline-flex min-h-[48px] items-center justify-center rounded-full bg-[color:var(--pill-active-bg)] px-6 py-3 text-sm font-semibold text-[color:var(--fg)]"
              >
                Create Free Account
              </Link>
            ) : (
              <button
                type="button"
                onClick={onEnterGuest}
                className="vltd-pill-main-glow inline-flex min-h-[48px] items-center justify-center rounded-full bg-[color:var(--pill-active-bg)] px-6 py-3 text-sm font-semibold text-[color:var(--fg)]"
              >
                Continue to Gallery
              </button>
            )}

            {!requiresRegistered ? (
              <button
                type="button"
                onClick={onEnterGuest}
                className="text-sm text-[color:var(--muted)] underline underline-offset-4"
              >
                View as Guest
              </button>
            ) : null}
          </div>

          {gateMode === "registered_only" && !isSignedIn ? (
            <p className="mt-4 text-xs text-[color:var(--muted)]">
              Guest access is disabled for this gallery.
            </p>
          ) : null}
        </div>
      </div>
    </GalleryBackgroundShell>
  );
}

export default function SharedGalleryPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;

  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [isResolved, setIsResolved] = useState(false);
  const [error, setError] = useState("");
  const [gateMode, setGateMode] = useState<GateMode>("loading");
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    async function resolvePublicGallery() {
      if (!token) {
        setIsResolved(true);
        return;
      }

      setError("");
      setIsResolved(false);

      try {
        const authResult = await getCurrentUser();
        const signedIn = !!authResult?.data?.user;
        if (!isCancelled) {
          setIsSignedIn(signedIn);
        }

        const found = await getGalleryByPublicToken(token);

        if (isCancelled) return;

        if (!found) {
          setGallery(null);
          setItems([]);
          setIsResolved(true);
          return;
        }

        const accessMode = getShareAccessMode(found);

        if (accessMode === "private") {
          setGallery(found);
          setGateMode("loading");
          setItems([]);
          setIsResolved(true);
          return;
        }

        setGallery(found);

        if (accessMode === "registered_users" && !signedIn) {
          setGateMode("registered_only");
          setIsResolved(true);
          return;
        }

        setGateMode("guest_allowed");
        setIsResolved(true);
      } catch (err) {
        if (isCancelled) return;
        console.error("Public gallery load failed:", err);
        setError(err instanceof Error ? err.message : "Failed to load shared gallery.");
        setGallery(null);
        setItems([]);
        setIsResolved(true);
      }
    }

    void resolvePublicGallery();

    return () => {
      isCancelled = true;
    };
  }, [token]);

  useEffect(() => {
    let isCancelled = false;

    async function hydrateItems() {
      if (!gallery) return;
      if (gateMode !== "entered") return;

      try {
        const supabase = getSupabaseBrowserClient();
        let hydratedItems: VaultItem[] = [];

        if (supabase) {
          const { data: links, error: linkError } = await supabase
            .from("gallery_items")
            .select("artifact_id, position")
            .eq("gallery_id", gallery.id)
            .order("position", { ascending: true });

          if (linkError) {
            console.error("Failed loading gallery_items for shared gallery:", linkError);
          } else {
            const orderedArtifactIds = Array.isArray(links)
              ? links.map((row: any) => String(row?.artifact_id ?? "").trim()).filter(Boolean)
              : [];

            const uniqueArtifactIds = [...new Set(orderedArtifactIds)];

            if (uniqueArtifactIds.length > 0) {
              const { data: vaultRows, error: itemError } = await supabase
                .from("vault_items")
                .select("*")
                .in("id", uniqueArtifactIds);

              if (itemError) {
                console.error("Failed loading vault_items for shared gallery:", itemError);
              } else {
                const byId = new Map<string, VaultItem>();
                for (const raw of vaultRows ?? []) {
                  const normalized = normalizeVaultItem(raw);
                  byId.set(normalized.id, normalized);
                }

                hydratedItems = uniqueArtifactIds
                  .map((artifactId) => byId.get(artifactId))
                  .filter(Boolean) as VaultItem[];
              }
            }
          }
        }

        if (isCancelled) return;

        setItems(hydratedItems);
        void recordGalleryView(gallery.id);
      } catch (err) {
        if (isCancelled) return;
        console.error("Failed hydrating public gallery items:", err);
      }
    }

    void hydrateItems();

    return () => {
      isCancelled = true;
    };
  }, [gallery, gateMode]);

  const accessMode = useMemo(
    () => (gallery ? getShareAccessMode(gallery) : "private"),
    [gallery]
  );

  const model = useMemo(
    () =>
      resolveGuestGalleryViewModel(gallery, items, {
        navigation: {
          show: false,
          backHref: null,
          homeHref: "/museum",
        },
        access: {
          modeLabel: "Shared Gallery",
          isPublic: accessMode !== "registered_users",
        },
        itemsAreResolvedGalleryItems: true,
      }),
    [gallery, items, accessMode]
  );

  if (!isResolved) {
    return (
      <GalleryBackgroundShell backgroundUrl={model.background.url}>
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
          <div className="rounded-[28px] bg-[color:var(--surface)] p-8 text-center ring-1 ring-[color:var(--border)]">
            Loading gallery...
          </div>
        </div>
      </GalleryBackgroundShell>
    );
  }

  if (error) {
    return (
      <GalleryBackgroundShell backgroundUrl={model.background.url}>
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
          <div className="rounded-[28px] border border-red-500/40 bg-red-500/10 p-8 text-center text-red-200">
            {error}
          </div>
        </div>
      </GalleryBackgroundShell>
    );
  }

  if (!gallery) {
    return (
      <GalleryBackgroundShell backgroundUrl={model.background.url}>
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
          <div className="rounded-[28px] bg-[color:var(--surface)] p-8 text-center ring-1 ring-[color:var(--border)]">
            <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
              SHARED GALLERY
            </div>
            <h1 className="mt-3 text-2xl font-semibold">Link not available</h1>
            <p className="mt-3 text-sm text-[color:var(--muted)]">
              This shared gallery link is invalid or no longer available.
            </p>
            <div className="mt-6">
              <Link
                href="/museum"
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[color:var(--pill-active-bg)] px-5 py-2 text-sm font-semibold text-[color:var(--fg)]"
              >
                Open Museum
              </Link>
            </div>
          </div>
        </div>
      </GalleryBackgroundShell>
    );
  }

  if (accessMode === "private") {
    return (
      <GalleryBackgroundShell backgroundUrl={model.background.url}>
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
          <div className="w-full rounded-[28px] bg-[color:var(--surface)] p-8 text-center ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
            <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
              SHARED GALLERY
            </div>
            <h1 className="mt-3 text-2xl font-semibold">Private Gallery</h1>
            <p className="mt-3 text-sm text-[color:var(--muted)]">
              This gallery is private and cannot be viewed from a shared link.
            </p>
          </div>
        </div>
      </GalleryBackgroundShell>
    );
  }

  if (gateMode === "guest_allowed" || gateMode === "registered_only") {
    return (
      <GateCard
        gallery={gallery}
        accessMode={accessMode}
        gateMode={gateMode}
        isSignedIn={isSignedIn}
        backgroundUrl={model.background.url}
        onEnterGuest={() => setGateMode("entered")}
      />
    );
  }

  return <GuestGalleryRenderer model={model} />;
}
