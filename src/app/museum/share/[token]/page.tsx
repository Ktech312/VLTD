"use client";

import { PillButton } from "@/components/ui/PillButton";
import { publicItemsTable } from "@/lib/publicItemsSource";
import { vaultItemFromPublicSnapshot as vaultItemFromGallerySnapshot } from "@/lib/hiddenItems";
import { publicRowToItem as normalizeVaultItem } from "@/lib/publicProfile";
import { PUBLIC_ITEM_COLUMNS, PUBLIC_ITEM_COLUMNS_NO_OWNER } from "@/lib/publicItemColumns";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import GuestGalleryRenderer from "@/components/gallery/GuestGalleryRenderer";
import {
  getGalleryByPublicToken,
  recordGalleryView,
  type Gallery,
  type GalleryPublicItemSnapshot,
} from "@/lib/galleryModel";
import { getCurrentUser } from "@/lib/auth";
import { resolveGuestGalleryViewModel } from "@/lib/guestGalleryViewModel";
import { type VaultItem } from "@/lib/vaultModel";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { AdultContentGate, useAdultGate } from "@/components/PublicSafetyControls";

type GateMode = "loading" | "guest_allowed" | "registered_only" | "entered";
type ShareAccessMode = "private" | "public_gallery" | "guest_view" | "registered_users";

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
    <main className="relative text-text-primary" style={getBackgroundShellStyle(backgroundUrl)}>
      {hasBackground ? (
        <div
          className="absolute inset-0 bg-vault-card backdrop-blur-[1.5px]"
          aria-hidden="true"
        />
      ) : null}
      <div className="relative z-10 ">{children}</div>
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
      <div className="mx-auto flex max-w-3xl items-center justify-center px-4">
        <div className="w-full rounded-[28px] bg-[color:var(--surface)] p-8 text-center ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
            SHARED EXHIBITION
          </div>
          <h1 className="mt-3 text-3xl font-semibold">{gallery.title}</h1>
          {gallery.description?.trim() ? (
            <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
              {gallery.description}
            </p>
          ) : null}

          <div className="mt-6 rounded-2xl bg-[color:var(--pill)] px-4 py-4 text-sm ring-1 ring-[color:var(--border)]">
            {requiresRegistered
              ? "Owner only allows registered users to access this exhibition."
              : "Create a free account for full access, or continue as a guest."}
          </div>

          <div className="mt-6 flex flex-col items-center gap-3">
            {!isSignedIn ? (
              <PillButton variant="active" href={`/login?next=${encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/")}`} className="font-black">Create Free Account</PillButton>
            ) : (
              <PillButton variant="active" onClick={onEnterGuest} className="font-black">Continue to Exhibition</PillButton>
            )}

            {!requiresRegistered ? (
              <PillButton onClick={onEnterGuest}>View as Guest</PillButton>
            ) : null}
          </div>

          {gateMode === "registered_only" && !isSignedIn ? (
            <p className="mt-4 text-xs text-[color:var(--muted)]">
              Guest access is disabled for this exhibition.
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

        setGateMode("entered");
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
          // get_gallery_items_by_share_token() (20260823) replaces a direct
          // `.eq("gallery_id", ...)` select — gallery_items_read_public's
          // anon policy no longer treats "this gallery merely has a token"
          // as authorization, so a Locked gallery's items now only come
          // back through the token this page was actually opened with.
          const { data: links, error: linkError } = await supabase.rpc(
            "get_gallery_items_by_share_token",
            { p_token: token }
          );

          if (linkError) {
            console.error("Failed loading gallery_items for shared gallery:", linkError);
          } else {
            const orderedArtifactIdsFromLinks = Array.isArray(links)
              ? links.map((row: any) => String(row?.artifact_id ?? "").trim()).filter(Boolean)
              : [];
            const orderedArtifactIds =
              orderedArtifactIdsFromLinks.length > 0
                ? orderedArtifactIdsFromLinks
                : gallery.itemIds.filter(Boolean);

            const uniqueArtifactIds = [...new Set(orderedArtifactIds)];

            if (uniqueArtifactIds.length > 0) {
              let itemQuery = supabase
                .from(await publicItemsTable(supabase))
                .select(gallery.aliasEnabled ? PUBLIC_ITEM_COLUMNS_NO_OWNER : PUBLIC_ITEM_COLUMNS)
                .in("id", uniqueArtifactIds);
              // An exhibit only shows items from its own profile.
              if (gallery.profile_id) itemQuery = itemQuery.eq("profile_id", gallery.profile_id);
              const { data: vaultRows, error: itemError } = await itemQuery;

              if (itemError) {
                console.error("Failed loading vault_items for shared gallery:", itemError);
              } else {
                const byId = new Map<string, VaultItem>();
                for (const raw of vaultRows ?? []) {
                  const normalized = normalizeVaultItem(raw);
                  byId.set(normalized.id, normalized);
                }

                const snapshotById = new Map(
                  (gallery.publicItemSnapshots ?? []).map((snapshot) => [snapshot.id, snapshot])
                );

                hydratedItems = orderedArtifactIds
                  .map((artifactId) => {
                    const snapshot = snapshotById.get(artifactId);
                    if (snapshot?.hidden) return vaultItemFromGallerySnapshot(snapshot);
                    const hydrated = byId.get(artifactId);
                    if (hydrated) return hydrated;
                    return snapshot ? vaultItemFromGallerySnapshot(snapshot) : undefined;
                  })
                  .filter(Boolean) as VaultItem[];
              }
            }
          }
        }

        if (isCancelled) return;

        if (hydratedItems.length === 0 && Array.isArray(gallery.publicItemSnapshots)) {
          hydratedItems = gallery.publicItemSnapshots.map(vaultItemFromGallerySnapshot);
        }

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
          modeLabel: "Shared Exhibition",
          isPublic: accessMode !== "registered_users",
        },
        itemsAreResolvedGalleryItems: true,
      }),
    [gallery, items, accessMode]
  );

  const adultGate = useAdultGate(gallery?.adultOnly === true);

  if (!isResolved) {
    return (
      <GalleryBackgroundShell backgroundUrl={model.background.url}>
        <div className="mx-auto flex max-w-3xl items-center justify-center px-4">
          <div className="rounded-[28px] bg-[color:var(--surface)] p-8 text-center ring-1 ring-[color:var(--border)]">
            Loading exhibition...
          </div>
        </div>
      </GalleryBackgroundShell>
    );
  }

  if (error) {
    return (
      <GalleryBackgroundShell backgroundUrl={model.background.url}>
        <div className="mx-auto flex max-w-3xl items-center justify-center px-4">
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
        <div className="mx-auto flex max-w-3xl items-center justify-center px-4">
          <div className="rounded-[28px] bg-[color:var(--surface)] p-8 text-center ring-1 ring-[color:var(--border)]">
            <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
              SHARED EXHIBITION
            </div>
            <h1 className="mt-3 text-2xl font-semibold">Link not available</h1>
            <p className="mt-3 text-sm text-[color:var(--muted)]">
              This shared exhibition link is invalid or no longer available.
            </p>
            <div className="mt-6">
              <Link
                href="/museum"
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[color:var(--pill-active-bg)] px-5 py-2 text-sm font-semibold text-[color:var(--fg)]"
              >
                Open Exhibitions
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
        <div className="mx-auto flex max-w-3xl items-center justify-center px-4">
          <div className="w-full rounded-[28px] bg-[color:var(--surface)] p-8 text-center ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
            <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
              SHARED EXHIBITION
            </div>
            <h1 className="mt-3 text-2xl font-semibold">Private Exhibition</h1>
            <p className="mt-3 text-sm text-[color:var(--muted)]">
              This exhibition is private and cannot be viewed from a shared link.
            </p>
          </div>
        </div>
      </GalleryBackgroundShell>
    );
  }

  if (adultGate.shouldGate) {
    return <AdultContentGate onConfirm={adultGate.confirm} />;
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

  return (
    <>
      <div style={{ isolation: "isolate", background: "#0B1320" }}>
        <GuestGalleryRenderer model={model} />
      </div>
    </>
  );
}
