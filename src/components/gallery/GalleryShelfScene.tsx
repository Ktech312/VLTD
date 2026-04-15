// Path: src/components/gallery/GalleryShelfScene.tsx
"use client";

import Link from "next/link";

import type { VaultItem } from "@/lib/vaultModel";
import { getThemeBackgroundSimple } from "@/lib/galleryModel";

function itemImage(item: VaultItem) {
  return item.imageFrontUrl || item.imageBackUrl || "";
}

function itemMeta(item: VaultItem) {
  return [item.subtitle, item.number, item.grade].filter(Boolean).join(" • ");
}

type Props = {
  items: VaultItem[];
  galleryHrefPrefix?: string;
  themeId?: string | null;
  shelfStyleId?: string | null;
  backdropStyleId?: string | null;
  themePack?: string | null;
  title?: string;
  subtitle?: string;
  guestMode?: boolean;
  backgroundImageUrl?: string | null;
};

function getShelfThemeClasses(themePack?: string | null) {
  switch ((themePack || "classic").toLowerCase()) {
    case "walnut":
      return {
        overlay: "bg-[linear-gradient(180deg,rgba(19,10,6,0.24),rgba(13,8,6,0.54))]",
        panel: "bg-[rgba(20,12,8,0.34)] ring-[#b98b62]/30 text-stone-100",
        label: "bg-[rgba(58,34,20,0.70)] text-[#f2dfc8] ring-[#c79b71]/25",
        card: "bg-[linear-gradient(180deg,rgba(39,24,16,0.62),rgba(24,15,10,0.72))] ring-[#b98b62]/24 text-stone-100",
        shelfTop: "bg-[linear-gradient(180deg,#ad8159,#7c5231)]",
        shelfFace: "bg-[linear-gradient(180deg,#70472a,#432716)]",
        support: "bg-[linear-gradient(180deg,#8a6141,#3d2315)]",
      };
    case "midnight":
      return {
        overlay: "bg-[linear-gradient(180deg,rgba(4,8,14,0.26),rgba(2,5,10,0.58))]",
        panel: "bg-[rgba(5,10,17,0.34)] ring-cyan-300/16 text-slate-100",
        label: "bg-[rgba(9,20,33,0.74)] text-cyan-100 ring-cyan-300/18",
        card: "bg-[linear-gradient(180deg,rgba(10,16,28,0.68),rgba(5,9,17,0.76))] ring-cyan-200/12 text-slate-100",
        shelfTop: "bg-[linear-gradient(180deg,#3c516d,#26384f)]",
        shelfFace: "bg-[linear-gradient(180deg,#1b2739,#0d1625)]",
        support: "bg-[linear-gradient(180deg,#304963,#0d1625)]",
      };
    case "marble":
      return {
        overlay: "bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(52,58,68,0.36))]",
        panel: "bg-[rgba(255,255,255,0.22)] ring-slate-300/45 text-slate-900",
        label: "bg-[rgba(255,255,255,0.70)] text-slate-900 ring-slate-300/55",
        card: "bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(231,235,241,0.66))] ring-slate-300/40 text-slate-900",
        shelfTop: "bg-[linear-gradient(180deg,#f5f6f8,#dadfe6)]",
        shelfFace: "bg-[linear-gradient(180deg,#d7dde4,#a9b2bd)]",
        support: "bg-[linear-gradient(180deg,#dfe5eb,#97a1ad)]",
      };
    case "classic":
    default:
      return {
        overlay: "bg-[linear-gradient(180deg,rgba(15,12,8,0.22),rgba(11,9,7,0.52))]",
        panel: "bg-[rgba(14,11,8,0.32)] ring-white/12 text-stone-100",
        label: "bg-[rgba(26,20,14,0.72)] text-amber-100 ring-amber-100/16",
        card: "bg-[linear-gradient(180deg,rgba(28,21,15,0.62),rgba(16,12,9,0.72))] ring-white/12 text-stone-100",
        shelfTop: "bg-[linear-gradient(180deg,#8a6548,#67472f)]",
        shelfFace: "bg-[linear-gradient(180deg,#583a25,#301d12)]",
        support: "bg-[linear-gradient(180deg,#6e4a32,#301d12)]",
      };
  }
}

export default function GalleryShelfScene({
  items,
  galleryHrefPrefix = "/vault/item",
  themePack,
  title,
  subtitle,
  guestMode = false,
  backgroundImageUrl,
}: Props) {
  const theme = getShelfThemeClasses(themePack);
  const sceneBackground = backgroundImageUrl?.trim() || getThemeBackgroundSimple(themePack || undefined);

  const topRow = items.slice(0, 4);
  const bottomRow = items.slice(4, 8);

  function renderShelfRow(rowItems: VaultItem[], rowLabel: string, featured = false) {
    if (rowItems.length === 0) return null;

    return (
      <div className="relative">
        <div className={["relative rounded-[26px] p-5 ring-1 shadow-[0_24px_64px_rgba(0,0,0,0.34)]", theme.panel].join(" ")}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] tracking-[0.18em] text-white/65">{rowLabel}</div>
              <div className="mt-1 text-lg font-semibold">{featured ? "Featured Shelf" : "Collector Shelf"}</div>
            </div>

            <div className={["rounded-full px-3 py-1 text-[10px] tracking-[0.14em] ring-1", theme.label].join(" ")}>
              {guestMode ? "GUEST VIEW" : "CURATED VIEW"}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {rowItems.map((item, index) => (
              <Link
                key={item.id}
                href={`${galleryHrefPrefix}/${item.id}`}
                className={[
                  "group relative overflow-hidden rounded-[22px] p-3 ring-1 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(0,0,0,0.28)]",
                  theme.card,
                  featured && index === 0 ? "xl:scale-[1.03]" : "",
                ].join(" ")}
              >
                <div className="relative aspect-[4/5] overflow-hidden rounded-[16px] bg-black/20">
                  {itemImage(item) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={itemImage(item)}
                      alt={item.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                      draggable={false}
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-white/65">
                      No image
                    </div>
                  )}

                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(0,0,0,0.10))]" />
                </div>

                <div className="mt-3">
                  <div className="line-clamp-2 text-base font-semibold">{item.title}</div>
                  <div className="mt-1 line-clamp-1 text-sm text-white/70">{itemMeta(item) || "—"}</div>
                </div>
              </Link>
            ))}
          </div>

          <div className="pointer-events-none mt-5">
            <div className={["h-3 rounded-t-[18px]", theme.shelfTop].join(" ")} />
            <div className={["h-5 rounded-b-[18px]", theme.shelfFace].join(" ")} />
            <div className="flex justify-between px-8">
              <div className={["h-10 w-2 rounded-b-full", theme.support].join(" ")} />
              <div className={["h-10 w-2 rounded-b-full", theme.support].join(" ")} />
              <div className={["h-10 w-2 rounded-b-full", theme.support].join(" ")} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-[30px] ring-1 ring-white/10 shadow-[0_30px_90px_rgba(0,0,0,0.38)]">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${sceneBackground})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className={["absolute inset-0", theme.overlay].join(" ")} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_42%)]" />

      <div className="relative px-5 py-6 sm:px-6 sm:py-7">
        {(title || subtitle) && (
          <div className="mb-6 max-w-3xl text-white">
            {title ? <div className="text-2xl font-semibold sm:text-3xl">{title}</div> : null}
            {subtitle ? (
              <div className="mt-2 text-sm leading-6 text-white/75">{subtitle}</div>
            ) : null}
          </div>
        )}

        <div className="grid gap-6">
          {renderShelfRow(topRow, "FEATURED WALL", true)}
          {renderShelfRow(bottomRow, "SECOND WALL")}
        </div>
      </div>
    </section>
  );
}
