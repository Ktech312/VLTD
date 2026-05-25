"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

import FavoriteButton from "@/components/FavoriteButton";
import type { GalleryShelfOverlayStyle } from "@/lib/galleryModel";
import type { VaultItem } from "@/lib/vaultModel";

export const GALLERY_STAGE_MAX_WIDTH_CLASS = "max-w-[1120px]";
export const GALLERY_STAGE_HEIGHT_CLASS = "h-[1500px] sm:h-[2200px] lg:h-[2700px]";

const ROW_ANCHORS = ["34%", "54%", "74%", "94%"] as const;

function itemImage(item: VaultItem) {
  return item.imageFrontUrl || item.imageBackUrl || "";
}

function itemSubtitle(item: VaultItem) {
  return [item.subtitle, item.number, item.grade].filter(Boolean).join(" • ");
}

function formatMoney(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

type Props = {
  items: VaultItem[];
  galleryHrefPrefix?: string;
  themePack?: string | null;
  title?: string;
  subtitle?: string;
  guestMode?: boolean;
  backgroundImageUrl?: string | null;
  shelvesEnabled?: boolean;
  shelfOverlayStyle?: GalleryShelfOverlayStyle;
};

function getShelfThemeClasses(themePack?: string | null) {
  switch ((themePack || "classic").toLowerCase()) {
    case "walnut":
      return {
        stageShell: "ring-[#b98b62]/18 bg-[rgba(20,12,8,0.10)]",
        plaque: "bg-[rgba(58,34,20,0.84)] text-[#f2dfc8] ring-[#c79b71]/22",
        tile: "bg-[rgba(42,24,14,0.48)] ring-[#b98b62]/16",
        frame: "bg-[linear-gradient(180deg,rgba(255,255,255,0.10)_0%,rgba(0,0,0,0.28)_100%)] ring-2 ring-[#F5B548]/55 shadow-[0_14px_32px_rgba(0,0,0,0.55),0_0_0_2px_rgba(245,181,72,0.18),inset_0_1px_0_rgba(255,220,160,0.18)]",
        shelfTop: "from-[#c09369] to-[#875a37]",
        shelfFace: "from-[#72482b] to-[#452818]",
        support: "from-[#8a6141] to-[#3d2315]",
        vignette: "bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.00)_0%,rgba(0,0,0,0.10)_62%,rgba(0,0,0,0.34)_100%)]",
      };
    case "midnight":
      return {
        stageShell: "ring-cyan-300/12 bg-vault-card",
        plaque: "bg-vault-card text-cyan-100 ring-cyan-300/16",
        tile: "bg-vault-card ring-cyan-300/12",
        frame: "bg-[linear-gradient(180deg,rgba(72,98,127,0.22)_0%,rgba(0,0,0,0.55)_100%)] ring-2 ring-[#F5B548]/55 shadow-[0_14px_32px_rgba(0,0,0,0.65),0_0_0_2px_rgba(245,181,72,0.18),inset_0_1px_0_rgba(147,210,255,0.14)]",
        shelfTop: "from-[#48627f] to-[#2c425d]",
        shelfFace: "from-[#141414] to-[#141414]",
        support: "from-[#304963] to-[#141414]",
        vignette: "bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.00)_0%,rgba(0,0,0,0.10)_62%,rgba(0,0,0,0.34)_100%)]",
      };
    case "cold-blue":
      return {
        stageShell: "ring-white/10 bg-vault-card",
        plaque: "bg-vault-card text-stone-100 ring-white/12",
        tile: "bg-vault-card ring-white/10",
        frame: "bg-[linear-gradient(180deg,rgba(80,84,100,0.30)_0%,rgba(14,14,18,0.70)_100%)] ring-2 ring-[#F5B548]/55 shadow-[0_14px_32px_rgba(0,0,0,0.65),0_0_0_2px_rgba(245,181,72,0.18),inset_0_1px_0_rgba(255,255,255,0.14)]",
        shelfTop: "from-[#5f5f69] to-[#3f4048]",
        shelfFace: "from-[#262832] to-[#141414]",
        support: "from-[#4a4d58] to-[#141414]",
        vignette: "bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.00)_0%,rgba(0,0,0,0.14)_62%,rgba(0,0,0,0.38)_100%)]",
      };
    case "marble":
      return {
        stageShell: "ring-slate-300/20 bg-[rgba(255,255,255,0.06)]",
        plaque: "bg-[rgba(255,255,255,0.82)] text-slate-900 ring-slate-300/40",
        tile: "bg-[rgba(255,255,255,0.44)] ring-slate-300/24",
        frame: "bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(215,225,240,0.90)_100%)] ring-2 ring-[#F5B548]/60 shadow-[0_14px_32px_rgba(100,120,165,0.26),0_0_0_2px_rgba(245,181,72,0.20),inset_0_1px_0_rgba(255,255,255,1)]",
        shelfTop: "from-[#fafbfc] to-[#e0e5eb]",
        shelfFace: "from-[#d6dce3] to-[#aab4bf]",
        support: "from-[#dfe5eb] to-[#97a1ad]",
        vignette: "bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.00)_0%,rgba(0,0,0,0.06)_64%,rgba(0,0,0,0.18)_100%)]",
      };
    case "classic":
    default:
      return {
        stageShell: "ring-white/10 bg-[rgba(14,11,8,0.10)]",
        plaque: "bg-[rgba(26,20,14,0.82)] text-amber-100 ring-amber-100/14",
        tile: "bg-[rgba(24,18,12,0.44)] ring-white/10",
        frame: "bg-[linear-gradient(180deg,rgba(255,255,255,0.09)_0%,rgba(0,0,0,0.30)_100%)] ring-2 ring-[#F5B548]/55 shadow-[0_14px_32px_rgba(0,0,0,0.58),0_0_0_2px_rgba(245,181,72,0.18),inset_0_1px_0_rgba(255,220,140,0.14)]",
        shelfTop: "from-[#9b7352] to-[#755035]",
        shelfFace: "from-[#5a3b25] to-[#311d12]",
        support: "from-[#6e4a32] to-[#301d12]",
        vignette: "bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.00)_0%,rgba(0,0,0,0.08)_62%,rgba(0,0,0,0.26)_100%)]",
      };
  }
}

function favoriteMetadata(item: VaultItem) {
  return {
    title: item.title,
    subtitle: itemSubtitle(item),
    image: itemImage(item),
  };
}

function DisplayCard({
  item,
  theme,
  galleryHrefPrefix,
}: {
  item: VaultItem;
  theme: ReturnType<typeof getShelfThemeClasses>;
  galleryHrefPrefix: string;
}) {
  return (
    <div className="min-w-0 self-end">
      <div
        className={[
          "mb-1.5 rounded-xl px-2 py-1.5 text-center text-[11px] ring-1 backdrop-blur-sm sm:mb-2 sm:rounded-2xl sm:px-2.5 sm:text-[10px]",
          theme.plaque,
        ].join(" ")}
      >
        <div className="line-clamp-2 font-semibold leading-tight">{item.title}</div>
        <div className="mt-1 line-clamp-1 opacity-80">{itemSubtitle(item) || "—"}</div>
        <div className="mt-1 font-medium">EMV {formatMoney(item.currentValue)}</div>
      </div>

      <div className="relative w-full">
        <Link href={`${galleryHrefPrefix}/${item.id}`} className="group block w-full">
          <div
            className={[
              "relative w-full overflow-hidden rounded-[12px] sm:rounded-[14px]",
              theme.frame,
            ].join(" ")}
          >
            <div className="aspect-[4/5] w-full p-1.5 sm:p-2">
              {itemImage(item) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={itemImage(item)}
                  alt={item.title}
                  className="h-full w-full object-contain object-bottom transition duration-300 group-hover:scale-[1.02]"
                  draggable={false}
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full items-end justify-center pb-4 text-sm text-white/65">
                  No image
                </div>
              )}
            </div>
          </div>
        </Link>

        <div className="pointer-events-auto absolute right-2 top-2 z-30">
          <FavoriteButton
            contentType="item"
            contentId={String(item.id)}
            metadata={favoriteMetadata(item)}
            label="Favorite item"
            compact
            showMessage={false}
          />
        </div>
      </div>
    </div>
  );
}
