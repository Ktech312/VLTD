
"use client";

import Link from "next/link";

import type { VaultItem } from "@/lib/vaultModel";
import { getThemeBackgroundSimple } from "@/lib/galleryModel";

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
};

function getShelfThemeClasses(themePack?: string | null) {
  switch ((themePack || "classic").toLowerCase()) {
    case "walnut":
      return {
        panel: "bg-[rgba(20,12,8,0.16)] ring-[#b98b62]/18 text-stone-100",
        plaque: "bg-[rgba(58,34,20,0.88)] text-[#f2dfc8] ring-[#c79b71]/25",
        tile: "bg-[rgba(42,24,14,0.58)] ring-[#b98b62]/18",
      };
    case "midnight":
      return {
        panel: "bg-[rgba(5,10,17,0.18)] ring-cyan-300/12 text-slate-100",
        plaque: "bg-[rgba(9,20,33,0.88)] text-cyan-100 ring-cyan-300/16",
        tile: "bg-[rgba(8,18,30,0.62)] ring-cyan-300/12",
      };
    case "marble":
      return {
        panel: "bg-[rgba(255,255,255,0.10)] ring-slate-300/26 text-slate-900",
        plaque: "bg-[rgba(255,255,255,0.90)] text-slate-900 ring-slate-300/45",
        tile: "bg-[rgba(255,255,255,0.58)] ring-slate-300/30",
      };
    case "classic":
    default:
      return {
        panel: "bg-[rgba(14,11,8,0.16)] ring-white/10 text-stone-100",
        plaque: "bg-[rgba(26,20,14,0.86)] text-amber-100 ring-amber-100/14",
        tile: "bg-[rgba(24,18,12,0.54)] ring-white/10",
      };
  }
}

function ShelfRow({
  items,
  theme,
  galleryHrefPrefix,
}: {
  items: VaultItem[];
  theme: ReturnType<typeof getShelfThemeClasses>;
  galleryHrefPrefix: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((item) => (
        <div key={item.id} className="min-w-0">
          <div
            className={[
              "mb-1.5 rounded-2xl px-2.5 py-1.5 text-center text-[10px] ring-1 backdrop-blur-sm",
              theme.plaque,
            ].join(" ")}
          >
            <div className="line-clamp-2 font-semibold">{item.title}</div>
            <div className="mt-1 line-clamp-1 opacity-80">{itemSubtitle(item) || "—"}</div>
            <div className="mt-1 font-medium">Estimated market value {formatMoney(item.currentValue)}</div>
          </div>

          <Link href={`${galleryHrefPrefix}/${item.id}`} className="group block w-full">
            <div
              className={[
                "relative w-full overflow-hidden rounded-[16px] ring-1 shadow-[0_10px_24px_rgba(0,0,0,0.18)]",
                theme.tile,
              ].join(" ")}
            >
              <div className="aspect-[4/5] w-full p-1.5">
                {itemImage(item) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={itemImage(item)}
                    alt={item.title}
                    className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.01]"
                    draggable={false}
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-white/65">
                    No image
                  </div>
                )}
              </div>
            </div>
          </Link>
        </div>
      ))}
    </div>
  );
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
  const themeKey = (themePack || "classic").toLowerCase();
  const theme = getShelfThemeClasses(themePack);
  const wallImage = `/themes/${themeKey}-shelf-wall.webp`;
  const railImage = `/themes/${themeKey}-shelf-rail.png`;
  const firstShelf = items.slice(0, 5);

  return (
    <section className="relative overflow-hidden rounded-[30px] ring-1 ring-white/10 shadow-[0_30px_90px_rgba(0,0,0,0.34)]">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,10,14,0.92),rgba(8,10,14,0.98))]" />

      <div className="relative px-4 py-5 sm:px-5 sm:py-6">
        {(title || subtitle) && (
          <div className="mb-5 max-w-3xl text-white">
            {title ? <div className="text-xl font-semibold sm:text-2xl">{title}</div> : null}
            {subtitle ? (
              <div className="mt-2 text-sm leading-6 text-white/75">{subtitle}</div>
            ) : null}
            <div className={["mt-3 inline-flex rounded-full px-3 py-1 text-[11px] ring-1", theme.plaque].join(" ")}>
              {guestMode ? "Guest shelf presentation" : "Curated shelf presentation"}
            </div>
          </div>
        )}

        <div className={["rounded-[26px] p-3.5 backdrop-blur-[1px] ring-1", theme.panel].join(" ")}>
          <div className="overflow-hidden rounded-[22px] ring-1 ring-white/10 bg-black/20">
            {/* wall-only art for guest shelf; keeps preview/shared theme files untouched */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={wallImage || backgroundImageUrl || getThemeBackgroundSimple(themePack || undefined)}
              alt=""
              className="block h-auto w-full object-contain"
              draggable={false}
            />
          </div>

          <div className="-mt-8 sm:-mt-10 scale-[0.92] origin-top">
            <ShelfRow items={firstShelf} theme={theme} galleryHrefPrefix={galleryHrefPrefix} />
          </div>

          <div className="-mt-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={railImage}
              alt=""
              className="pointer-events-none block w-full h-auto"
              draggable={false}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
