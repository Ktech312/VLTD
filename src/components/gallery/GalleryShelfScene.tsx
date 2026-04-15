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
        overlay: "bg-[linear-gradient(180deg,rgba(19,10,6,0.16),rgba(13,8,6,0.36))]",
        panel: "bg-[rgba(20,12,8,0.16)] ring-[#b98b62]/24 text-stone-100",
        label: "bg-[rgba(58,34,20,0.70)] text-[#f2dfc8] ring-[#c79b71]/25",
        card: "bg-[linear-gradient(180deg,rgba(39,24,16,0.38),rgba(24,15,10,0.52))] ring-[#b98b62]/20 text-stone-100",
        shelfTop: "bg-[linear-gradient(180deg,#c09369,#875a37)]",
        shelfFace: "bg-[linear-gradient(180deg,#72482b,#452818)]",
        support: "bg-[linear-gradient(180deg,#8a6141,#3d2315)]",
      };
    case "midnight":
      return {
        overlay: "bg-[linear-gradient(180deg,rgba(4,8,14,0.20),rgba(2,5,10,0.46))]",
        panel: "bg-[rgba(5,10,17,0.18)] ring-cyan-300/12 text-slate-100",
        label: "bg-[rgba(9,20,33,0.74)] text-cyan-100 ring-cyan-300/18",
        card: "bg-[linear-gradient(180deg,rgba(10,16,28,0.42),rgba(5,9,17,0.56))] ring-cyan-200/10 text-slate-100",
        shelfTop: "bg-[linear-gradient(180deg,#48627f,#2c425d)]",
        shelfFace: "bg-[linear-gradient(180deg,#1b2739,#0d1625)]",
        support: "bg-[linear-gradient(180deg,#304963,#0d1625)]",
      };
    case "marble":
      return {
        overlay: "bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(52,58,68,0.18))]",
        panel: "bg-[rgba(255,255,255,0.10)] ring-slate-300/26 text-slate-900",
        label: "bg-[rgba(255,255,255,0.78)] text-slate-900 ring-slate-300/55",
        card: "bg-[linear-gradient(180deg,rgba(255,255,255,0.42),rgba(231,235,241,0.54))] ring-slate-300/34 text-slate-900",
        shelfTop: "bg-[linear-gradient(180deg,#fafbfc,#e0e5eb)]",
        shelfFace: "bg-[linear-gradient(180deg,#d6dce3,#aab4bf)]",
        support: "bg-[linear-gradient(180deg,#dfe5eb,#97a1ad)]",
      };
    case "classic":
    default:
      return {
        overlay: "bg-[linear-gradient(180deg,rgba(15,12,8,0.18),rgba(11,9,7,0.34))]",
        panel: "bg-[rgba(14,11,8,0.14)] ring-white/10 text-stone-100",
        label: "bg-[rgba(26,20,14,0.72)] text-amber-100 ring-amber-100/16",
        card: "bg-[linear-gradient(180deg,rgba(28,21,15,0.36),rgba(16,12,9,0.48))] ring-white/10 text-stone-100",
        shelfTop: "bg-[linear-gradient(180deg,#9b7352,#755035)]",
        shelfFace: "bg-[linear-gradient(180deg,#5a3b25,#311d12)]",
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

  const featuredItems = items.slice(0, 3);
  const secondaryItems = items.slice(3, 7);

  function renderCard(item: VaultItem, emphasis: "hero" | "standard" = "standard") {
    const hero = emphasis === "hero";

    return (
      <Link
        key={item.id}
        href={`${galleryHrefPrefix}/${item.id}`}
        className={[
          "group relative overflow-hidden rounded-[24px] p-3 ring-1 transition duration-300 hover:-translate-y-1",
          theme.card,
          hero ? "md:px-4 md:py-4 md:shadow-[0_26px_60px_rgba(0,0,0,0.28)]" : "shadow-[0_18px_40px_rgba(0,0,0,0.20)]",
        ].join(" ")}
      >
        <div className={`relative ${hero ? "aspect-[4/5]" : "aspect-[4/5]"} overflow-hidden rounded-[18px] bg-black/20`}>
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

          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(0,0,0,0.12))]" />
        </div>

        <div className="mt-3">
          <div className={`line-clamp-2 ${hero ? "text-lg" : "text-base"} font-semibold`}>{item.title}</div>
          <div className="mt-1 line-clamp-1 text-sm text-white/70">{itemMeta(item) || "—"}</div>
        </div>
      </Link>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-[34px] ring-1 ring-white/10 shadow-[0_34px_100px_rgba(0,0,0,0.40)]">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${sceneBackground})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className={["absolute inset-0", theme.overlay].join(" ")} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),transparent_42%)]" />

      <div className="relative px-5 py-6 sm:px-6 sm:py-7">
        {(title || subtitle) && (
          <div className="mb-6 max-w-3xl text-white">
            {title ? <div className="text-2xl font-semibold sm:text-3xl">{title}</div> : null}
            {subtitle ? <div className="mt-2 text-sm leading-6 text-white/75">{subtitle}</div> : null}
          </div>
        )}

        <div className={["rounded-[30px] p-5 ring-1 backdrop-blur-[1px]", theme.panel].join(" ")}>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] tracking-[0.18em] text-white/60">FEATURED EXHIBITION SHELF</div>
              <div className="mt-1 text-lg font-semibold">{guestMode ? "Guest Shelf View" : "Collector Shelf View"}</div>
            </div>

            <div className={["rounded-full px-3 py-1 text-[10px] tracking-[0.14em] ring-1", theme.label].join(" ")}>
              {guestMode ? "GUEST VIEW" : "CURATED VIEW"}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.95fr)]">
            <div>{featuredItems[0] ? renderCard(featuredItems[0], "hero") : null}</div>

            <div className="grid gap-4 sm:grid-cols-2">
              {featuredItems.slice(1).map((item) => renderCard(item))}
            </div>
          </div>

          <div className="pointer-events-none mt-5">
            <div className={["h-4 rounded-t-[18px]", theme.shelfTop].join(" ")} />
            <div className={["h-6 rounded-b-[18px]", theme.shelfFace].join(" ")} />
            <div className="flex justify-between px-8">
              <div className={["h-12 w-2 rounded-b-full", theme.support].join(" ")} />
              <div className={["h-12 w-2 rounded-b-full", theme.support].join(" ")} />
              <div className={["h-12 w-2 rounded-b-full", theme.support].join(" ")} />
            </div>
          </div>
        </div>

        {secondaryItems.length > 0 ? (
          <div className={["mt-6 rounded-[30px] p-5 ring-1 backdrop-blur-[1px]", theme.panel].join(" ")}>
            <div className="mb-4 text-[11px] tracking-[0.18em] text-white/60">SECOND SHELF</div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {secondaryItems.map((item) => renderCard(item))}
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
        ) : null}
      </div>
    </section>
  );
}
