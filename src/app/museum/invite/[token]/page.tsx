"use client";

import { vaultItemFromPublicSnapshot as vaultItemFromSnapshot } from "@/lib/hiddenItems";
import { publicRowToItem as normalizeVaultItem } from "@/lib/publicProfile";
import { PUBLIC_ITEM_COLUMNS, PUBLIC_ITEM_COLUMNS_FINANCIAL } from "@/lib/publicItemColumns";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AppIcon } from "@/components/ui/AppIcon";

import {
  getGalleryByInviteToken,
  markGalleryInviteTokenUsedByToken,
  type Gallery,
  type GalleryInvitePermissions,
  type GalleryPublicItemSnapshot,
} from "@/lib/galleryModel";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { type VaultItem } from "@/lib/vaultModel";
import GuestGalleryRenderer from "@/components/gallery/GuestGalleryRenderer";
import { resolveGuestGalleryViewModel } from "@/lib/guestGalleryViewModel";
import { AdultContentGate, useAdultGate } from "@/components/PublicSafetyControls";

// The exhibit itself is the shared public exhibit page (GuestGalleryRenderer). The invite only
// decides what a visitor may open: item details, bigger photos, and paid/value figures.

function InviteExhibit({
  gallery,
  items,
  permissions,
}: {
  gallery: Gallery;
  items: VaultItem[];
  permissions: GalleryInvitePermissions;
}) {
  const model = useMemo(
    () =>
      resolveGuestGalleryViewModel(gallery, items, {
        navigation: { show: false, backHref: null, homeHref: "/museum" },
        access: { modeLabel: "Invite Access", isPublic: false },
        itemsAreResolvedGalleryItems: true,
      }),
    [gallery, items]
  );

  const allowed = [
    permissions.images ? { icon: "frame" as const, label: "Image view" } : null,
    permissions.descriptionPage ? { icon: "book" as const, label: "Item details" } : null,
    permissions.financialHistory ? { icon: "dollar" as const, label: "Financial data" } : null,
  ].filter(Boolean) as { icon: "frame" | "book" | "dollar"; label: string }[];

  return (
    <>
      {allowed.length > 0 ? (
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-1.5 px-4 pt-4 sm:px-6">
          <span className="text-[10px] tracking-[0.14em] text-[color:var(--muted2)]">YOUR INVITE ALLOWS</span>
          {allowed.map((entry) => (
            <span
              key={entry.label}
              className="inline-flex items-center gap-1 rounded-full bg-[color:var(--pill)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--muted2)] ring-1 ring-[color:var(--border)]"
            >
              <AppIcon name={entry.icon} size={9} strokeWidth={2} />
              {entry.label}
            </span>
          ))}
        </div>
      ) : null}
      <GuestGalleryRenderer model={model} invitePermissions={permissions} />
    </>
  );
}

// ─── Main page ───────────────────────────────────────────────

type PageState =
  | { status: "loading" }
  | { status: "invalid" }
  | { status: "expired" }
  | { status: "ready"; gallery: Gallery; items: VaultItem[]; permissions: GalleryInvitePermissions };

export default function InviteGalleryPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";

  const [pageState, setPageState] = useState<PageState>({ status: "loading" });
  const markedRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setPageState({ status: "invalid" });
      return;
    }

    let cancelled = false;

    async function load() {
      const lookup = await getGalleryByInviteToken(token);

      if (cancelled) return;

      if (!lookup) {
        setPageState({ status: "invalid" });
        return;
      }

      const { gallery, inviteToken } = lookup;

      // Check expiry (belt-and-suspenders — server side already checks)
      if (typeof inviteToken.expiresAt === "number" && inviteToken.expiresAt < Date.now()) {
        setPageState({ status: "expired" });
        return;
      }

      const permissions: GalleryInvitePermissions = inviteToken.permissions ?? {};

      // Load items from Supabase
      let items: VaultItem[] = [];
      const supabase = getSupabaseBrowserClient();

      if (supabase && gallery.itemIds.length > 0) {
        try {
          // get_gallery_items_by_invite_token() (20260823) replaces a
          // direct select — real invite validation (disabled/expired/
          // token match) now happens inside the function itself, not just
          // client-side after the fact.
          const { data: links } = await supabase.rpc(
            "get_gallery_items_by_invite_token",
            { p_token: token }
          );

          const orderedIds = Array.isArray(links) && links.length > 0
            ? links.map((r: Record<string, unknown>) => String(r.artifact_id ?? "").trim()).filter(Boolean)
            : gallery.itemIds.filter(Boolean);

          const uniqueIds = [...new Set(orderedIds)];

          if (uniqueIds.length > 0) {
            const { data: vaultRows } = await supabase
              .from("vault_items")
              .select(permissions.financialHistory ? PUBLIC_ITEM_COLUMNS_FINANCIAL : PUBLIC_ITEM_COLUMNS)
              .in("id", uniqueIds);

            const byId = new Map<string, VaultItem>();
            for (const raw of vaultRows ?? []) {
              const item = normalizeVaultItem(raw as unknown as Record<string, unknown>);
              byId.set(item.id, item);
            }

            const snapshotById = new Map(
              (gallery.publicItemSnapshots ?? []).map((s) => [s.id, s])
            );

            items = uniqueIds
              .map((id) => {
                const snapshot = snapshotById.get(id);
                if (snapshot?.hidden) return vaultItemFromSnapshot(snapshot);
                const hydrated = byId.get(id);
                if (hydrated) return hydrated;
                return snapshot ? vaultItemFromSnapshot(snapshot) : undefined;
              })
              .filter(Boolean) as VaultItem[];
          }
        } catch (err) {
          console.error("Invite gallery item load failed:", err);
        }
      }

      // Fallback to snapshots if no Supabase data
      if (items.length === 0 && Array.isArray(gallery.publicItemSnapshots)) {
        items = gallery.publicItemSnapshots.map(vaultItemFromSnapshot);
      }

      if (cancelled) return;

      setPageState({ status: "ready", gallery, items, permissions });

      // Mark token used — once per mount
      if (!markedRef.current) {
        markedRef.current = true;
        void markGalleryInviteTokenUsedByToken(token);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [token]);

  const adultGate = useAdultGate(
    pageState.status === "ready" ? pageState.gallery.adultOnly === true : false
  );

  // ── Render states ──

  const shellClass = "min-h-screen text-[color:var(--fg)] bg-[color:var(--bg)]";

  if (pageState.status === "loading") {
    return (
      <main className={shellClass}>
        <div className="mx-auto flex max-w-2xl items-center justify-center px-4">
          <div className="rounded-[28px] bg-[color:var(--surface)] p-8 text-center ring-1 ring-[color:var(--border)]">
            Loading exhibit…
          </div>
        </div>
      </main>
    );
  }

  if (pageState.status === "invalid") {
    return (
      <main className={shellClass}>
        <div className="mx-auto flex max-w-2xl items-center justify-center px-4">
          <div className="w-full rounded-[28px] bg-[color:var(--surface)] p-8 text-center ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
            <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">INVITE LINK</div>
            <h1 className="mt-3 text-2xl font-semibold">Link not available</h1>
            <p className="mt-3 text-sm text-[color:var(--muted)]">
              This invite link is invalid, has been disabled, or doesn&apos;t exist.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (pageState.status === "expired") {
    return (
      <main className={shellClass}>
        <div className="mx-auto flex max-w-2xl items-center justify-center px-4">
          <div className="w-full rounded-[28px] bg-[color:var(--surface)] p-8 text-center ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
            <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">INVITE LINK</div>
            <h1 className="mt-3 text-2xl font-semibold">Link expired</h1>
            <p className="mt-3 text-sm text-[color:var(--muted)]">
              This invite link has expired. Ask the owner for a new link.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const { gallery, items, permissions } = pageState;

  if (adultGate.shouldGate) {
    return <AdultContentGate onConfirm={adultGate.confirm} />;
  }

  return (
    <main className={shellClass}>
      {/* Header */}
      <div
        className="sticky top-0 z-30 border-b border-[color:var(--border)] backdrop-blur-xl"
        style={{ background: "var(--theme-nav-bg, rgba(11,19,32,0.96))" }}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link
            href="/museum"
            className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--pill)] px-3 py-1.5 text-xs font-semibold ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]"
          >
            ← Exhibitions
          </Link>
          <span className="ml-auto rounded-full bg-[color:var(--pill)] px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-[color:var(--muted2)] ring-1 ring-[color:var(--border)]">
            INVITE ACCESS
          </span>
        </div>
      </div>

      <InviteExhibit gallery={gallery} items={items} permissions={permissions} />
    </main>
  );
}
