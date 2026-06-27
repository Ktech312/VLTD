"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

import {
  getGalleryByInviteToken,
  markGalleryInviteTokenUsedByToken,
  type Gallery,
  type GalleryInvitePermissions,
  type GalleryPublicItemSnapshot,
} from "@/lib/galleryModel";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { getPrimaryImageUrl, type VaultItem } from "@/lib/vaultModel";
import { getVaultImagePublicUrl } from "@/lib/vaultCloud";
import { AdultContentGate, useAdultGate } from "@/components/PublicSafetyControls";

// ─── helpers ────────────────────────────────────────────────

function formatMoney(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function itemSubtitle(item: VaultItem) {
  return [item.subtitle, item.number, item.grade].filter(Boolean).join(" · ");
}

function normalizeVaultItem(raw: Record<string, unknown>): VaultItem {
  const createdAt =
    typeof raw.created_at === "string"
      ? Date.parse(raw.created_at) || Date.now()
      : typeof raw.createdAt === "number"
        ? raw.createdAt
        : Date.now();

  return {
    id: String(raw.id ?? "").trim(),
    profile_id: typeof raw.profile_id === "string" ? raw.profile_id : undefined,
    title: String(raw.title ?? "").trim() || "Untitled Item",
    subtitle: typeof raw.subtitle === "string" ? raw.subtitle : undefined,
    number: typeof raw.number === "string" ? raw.number : undefined,
    grade: typeof raw.grade === "string" ? raw.grade : undefined,
    universe: typeof raw.universe === "string" ? raw.universe : undefined,
    category: typeof raw.category === "string" ? raw.category : undefined,
    categoryLabel:
      typeof raw.category_label === "string"
        ? raw.category_label
        : typeof raw.categoryLabel === "string"
          ? raw.categoryLabel
          : undefined,
    subcategoryLabel:
      typeof raw.subcategory_label === "string"
        ? raw.subcategory_label
        : typeof raw.subcategoryLabel === "string"
          ? raw.subcategoryLabel
          : undefined,
    purchasePrice:
      typeof raw.purchase_price === "number" ? raw.purchase_price : undefined,
    currentValue:
      typeof raw.current_value === "number" ? raw.current_value : undefined,
    imageFrontUrl:
      typeof raw.image_front_url === "string" ? raw.image_front_url : undefined,
    imageFrontStoragePath:
      typeof raw.image_front_storage_path === "string"
        ? raw.image_front_storage_path
        : undefined,
    primaryImageKey:
      typeof raw.primary_image_key === "string" ? raw.primary_image_key : undefined,
    notes: typeof raw.notes === "string" ? raw.notes : undefined,
    storageLocation:
      typeof raw.storage_location === "string" ? raw.storage_location : undefined,
    certNumber:
      typeof raw.cert_number === "string" ? raw.cert_number : undefined,
    serialNumber:
      typeof raw.serial_number === "string" ? raw.serial_number : undefined,
    createdAt,
    isNew: false,
  };
}

function vaultItemFromSnapshot(snapshot: GalleryPublicItemSnapshot): VaultItem {
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
    imageFrontUrl:
      typeof snapshot.imageFrontUrl === "string" ? snapshot.imageFrontUrl : undefined,
    imageFrontStoragePath:
      typeof snapshot.imageFrontStoragePath === "string"
        ? snapshot.imageFrontStoragePath
        : undefined,
    primaryImageKey:
      typeof snapshot.primaryImageKey === "string" ? snapshot.primaryImageKey : undefined,
    createdAt:
      typeof snapshot.createdAt === "number" && Number.isFinite(snapshot.createdAt)
        ? snapshot.createdAt
        : Date.now(),
    isNew: false,
  };
}

// ─── Image lightbox ──────────────────────────────────────────

function ImageLightbox({
  url,
  title,
  onClose,
}: {
  url: string;
  title: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20 transition hover:bg-white/20"
      >
        ✕
      </button>
      <div
        className="relative flex max-h-[90vh] max-w-[90vw] items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={title}
          className="max-h-[88vh] max-w-[88vw] rounded-[14px] object-contain shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
        />
      </div>
    </div>
  );
}

// ─── Item detail modal ───────────────────────────────────────

function ItemDetailModal({
  item,
  showFinancials,
  onClose,
}: {
  item: VaultItem;
  showFinancials: boolean;
  onClose: () => void;
}) {
  const imageUrl = getPrimaryImageUrl(item) || (item.imageFrontStoragePath ? getVaultImagePublicUrl(item.imageFrontStoragePath) : "");
  const subtitle = itemSubtitle(item);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/70 backdrop-blur-sm px-4 pb-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-[24px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[0_32px_80px_rgba(0,0,0,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--pill)] text-[12px] font-semibold ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]"
        >
          ✕
        </button>

        <div className="flex gap-4">
          {/* Image */}
          <div className="shrink-0 w-[110px]">
            <div className="aspect-[2/3] overflow-hidden rounded-[14px] bg-[color:var(--input)]">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt={item.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] text-[color:var(--muted)]">
                  No image
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="text-[10px] tracking-[0.18em] text-[color:var(--muted2)]">
              {[item.categoryLabel, item.subcategoryLabel].filter(Boolean).join(" · ") || "ITEM"}
            </div>
            <h2 className="mt-1 text-base font-semibold leading-snug">{item.title}</h2>
            {subtitle ? (
              <p className="mt-0.5 text-xs text-[color:var(--muted)]">{subtitle}</p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-1.5">
              {item.grade ? (
                <span className="rounded-full bg-[color:var(--pill)] px-2.5 py-1 text-[10px] font-semibold ring-1 ring-[color:var(--border)]">
                  {item.grade}
                </span>
              ) : null}
              {item.certNumber ? (
                <span className="rounded-full bg-[color:var(--pill)] px-2.5 py-1 text-[10px] ring-1 ring-[color:var(--border)]">
                  Cert #{item.certNumber}
                </span>
              ) : null}
            </div>

            {showFinancials ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {item.purchasePrice != null ? (
                  <div className="rounded-xl bg-[color:var(--input)] px-2.5 py-2 ring-1 ring-[color:var(--border)]">
                    <div className="text-[9px] tracking-[0.14em] text-[color:var(--muted2)]">PAID</div>
                    <div className="mt-0.5 text-sm font-semibold">{formatMoney(item.purchasePrice) ?? "—"}</div>
                  </div>
                ) : null}
                {item.currentValue != null ? (
                  <div className="rounded-xl bg-[color:var(--input)] px-2.5 py-2 ring-1 ring-[color:var(--border)]">
                    <div className="text-[9px] tracking-[0.14em] text-[color:var(--muted2)]">VALUE</div>
                    <div className="mt-0.5 text-sm font-semibold">{formatMoney(item.currentValue) ?? "—"}</div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {item.notes?.trim() ? (
          <div className="mt-4 rounded-xl bg-[color:var(--input)] px-3 py-2.5 text-xs leading-5 text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
            {item.notes}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Gallery item card ───────────────────────────────────────

function InviteItemCard({
  item,
  index,
  permissions,
  onImageEnlarge,
  onShowDetail,
}: {
  item: VaultItem;
  index: number;
  permissions: GalleryInvitePermissions;
  onImageEnlarge: (item: VaultItem) => void;
  onShowDetail: (item: VaultItem) => void;
}) {
  const imageUrl = getPrimaryImageUrl(item) || (item.imageFrontStoragePath ? getVaultImagePublicUrl(item.imageFrontStoragePath) : "");
  const subtitle = itemSubtitle(item);
  const canEnlarge = !!permissions.images;
  const canDetail = !!permissions.descriptionPage;
  const canFinancials = !!permissions.financialHistory;

  function handleCardClick() {
    if (canDetail) { onShowDetail(item); return; }
    if (canEnlarge && imageUrl) { onImageEnlarge(item); return; }
  }

  const isClickable = canDetail || (canEnlarge && !!imageUrl);

  return (
    <article
      className={[
        "group relative overflow-hidden rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] shadow-[0_12px_28px_rgba(0,0,0,0.22)] transition-all duration-150",
        isClickable ? "cursor-pointer hover:scale-[1.015] hover:shadow-[0_16px_40px_rgba(0,0,0,0.32)]" : "",
      ].join(" ")}
      onClick={isClickable ? handleCardClick : undefined}
    >
      {/* Image area */}
      <div className="relative aspect-[2/3] overflow-hidden bg-black/20">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            draggable={false}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-white/40">
            No image
          </div>
        )}

        {/* Enlarge icon — shown only when images-only permission (no detail) */}
        {canEnlarge && !canDetail && imageUrl ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
            <div className="rounded-full bg-black/55 px-3 py-1.5 text-[10px] font-semibold text-white backdrop-blur-sm ring-1 ring-white/20">
              View full size
            </div>
          </div>
        ) : null}

        {/* Detail indicator */}
        {canDetail ? (
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-3 opacity-0 transition-opacity group-hover:opacity-100">
            <div className="rounded-full bg-black/55 px-3 py-1.5 text-[10px] font-semibold text-white backdrop-blur-sm ring-1 ring-white/20">
              View details
            </div>
          </div>
        ) : null}

        {/* Ghost overlay */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2 pb-2 pt-8">
          <div className="line-clamp-2 text-[10px] font-semibold leading-tight text-white/90">
            {item.title}
          </div>
          {subtitle ? (
            <div className="mt-0.5 line-clamp-1 text-[9px] leading-tight text-white/55">
              {subtitle}
            </div>
          ) : null}
        </div>
      </div>

      {/* Bottom strip — value shown only if financial history granted */}
      {canFinancials && item.currentValue != null ? (
        <div className="px-3 py-2 text-[10px] text-white/60">
          EMV {formatMoney(item.currentValue)}
        </div>
      ) : null}
    </article>
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
  const [lightboxItem, setLightboxItem] = useState<VaultItem | null>(null);
  const [detailItem, setDetailItem] = useState<VaultItem | null>(null);
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
          const { data: links } = await supabase
            .from("gallery_items")
            .select("artifact_id, position")
            .eq("gallery_id", gallery.id)
            .order("position", { ascending: true });

          const orderedIds = Array.isArray(links) && links.length > 0
            ? links.map((r: Record<string, unknown>) => String(r.artifact_id ?? "").trim()).filter(Boolean)
            : gallery.itemIds.filter(Boolean);

          const uniqueIds = [...new Set(orderedIds)];

          if (uniqueIds.length > 0) {
            const { data: vaultRows } = await supabase
              .from("vault_items")
              .select("*")
              .in("id", uniqueIds);

            const byId = new Map<string, VaultItem>();
            for (const raw of vaultRows ?? []) {
              const item = normalizeVaultItem(raw as Record<string, unknown>);
              byId.set(item.id, item);
            }

            const snapshotById = new Map(
              (gallery.publicItemSnapshots ?? []).map((s) => [s.id, s])
            );

            items = uniqueIds
              .map((id) => {
                const hydrated = byId.get(id);
                if (hydrated) return hydrated;
                const snapshot = snapshotById.get(id);
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

  const permissionCount = [
    permissions.images,
    permissions.descriptionPage,
    permissions.financialHistory,
  ].filter(Boolean).length;

  return (
    <>
      {/* Lightbox */}
      {lightboxItem ? (
        <ImageLightbox
          url={getPrimaryImageUrl(lightboxItem) || (lightboxItem.imageFrontStoragePath ? getVaultImagePublicUrl(lightboxItem.imageFrontStoragePath) : "")}
          title={lightboxItem.title}
          onClose={() => setLightboxItem(null)}
        />
      ) : null}

      {/* Detail modal */}
      {detailItem ? (
        <ItemDetailModal
          item={detailItem}
          showFinancials={!!permissions.financialHistory}
          onClose={() => setDetailItem(null)}
        />
      ) : null}

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

        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          {/* Gallery hero */}
          <div className="mb-8">
            <div className="text-[10px] tracking-[0.24em] text-[color:var(--muted2)]">EXHIBIT</div>
            <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">{gallery.title}</h1>
            {gallery.description?.trim() ? (
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
                {gallery.description}
              </p>
            ) : null}

            {/* Permission badges */}
            {permissionCount > 0 ? (
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                {permissions.images ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--pill)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--muted2)] ring-1 ring-[color:var(--border)]">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                      <path d="M3 16l5-5 4 4 3-3 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Image view
                  </span>
                ) : null}
                {permissions.descriptionPage ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--pill)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--muted2)] ring-1 ring-[color:var(--border)]">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M4 4h7a1 1 0 0 1 1 1v14a1 1 0 0 0-1-1H4V4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                      <path d="M20 4h-7a1 1 0 0 0-1 1v14a1 1 0 0 1 1-1h7V4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    </svg>
                    Item details
                  </span>
                ) : null}
                {permissions.financialHistory ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--pill)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--muted2)] ring-1 ring-[color:var(--border)]">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    Financial data
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Items grid */}
          {items.length === 0 ? (
            <div className="rounded-[22px] bg-[color:var(--input)] px-6 py-10 text-center text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
              No items in this exhibit yet.
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(min(160px, 100%), 1fr))",
              }}
            >
              {items.map((item, index) => (
                <InviteItemCard
                  key={item.id}
                  item={item}
                  index={index}
                  permissions={permissions}
                  onImageEnlarge={setLightboxItem}
                  onShowDetail={setDetailItem}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
