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
        panel: "bg-[rgba(20,12,8,0.18)] ring-[#b98b62]/20 text-stone-100",
        plaque: "bg-[rgba(58,34,20,0.88)] text-[#f2dfc8] ring-[#c79b71]/25",
        tile: "bg-[rgba(42,24,14,0.58)] ring-[#b98b62]/18",
        shelfTop: "bg-[linear-gradient(180deg,#c09369,#875a37)]",
        shelfFace: "bg-[linear-gradient(180deg,#72482b,#452818)]",
        support: "bg-[linear-gradient(180deg,#8a6141,#3d2315)]",
      };
    case "midnight":
      return {
        panel: "bg-[rgba(5,10,17,0.20)] ring-cyan-300/12 text-slate-100",
        plaque: "bg-[rgba(9,20,33,0.88)] text-cyan-100 ring-cyan-300/16",
        tile: "bg-[rgba(8,18,30,0.62)] ring-cyan-300/12",
        shelfTop: "bg-[linear-gradient(180deg,#48627f,#2c425d)]",
        shelfFace: "bg-[linear-gradient(180deg,#1b2739,#0d1625)]",
        support: "bg-[linear-gradient(180deg,#304963,#0d1625)]",
      };
    case "marble":
      return {
        panel: "bg-[rgba(255,255,255,0.14)] ring-slate-300/28 text-slate-900",
        plaque: "bg-[rgba(255,255,255,0.90)] text-slate-900 ring-slate-300/45",
        tile: "bg-[rgba(255,255,255,0.54)] ring-slate-300/30",
        shelfTop: "bg-[linear-gradient(180deg,#fafbfc,#e0e5eb)]",
        shelfFace: "bg-[linear-gradient(180deg,#d6dce3,#aab4bf)]",
        support: "bg-[linear-gradient(180deg,#dfe5eb,#97a1ad)]",
      };
    case "classic":
    default:
      return {
        panel: "bg-[rgba(14,11,8,0.18)] ring-white/10 text-stone-100",
        plaque: "bg-[rgba(26,20,14,0.86)] text-amber-100 ring-amber-100/14",
        tile: "bg-[rgba(24,18,12,0.54)] ring-white/10",
        shelfTop: "bg-[linear-gradient(180deg,#9b7352,#755035)]",
        shelfFace: "bg-[linear-gradient(180deg,#5a3b25,#311d12)]",
        support: "bg-[linear-gradient(180deg,#6e4a32,#301d12)]",
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
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((item) => (
          <div key={item.id} className="min-w-0">
            <div
              className={[
                "mb-2 rounded-2xl px-3 py-2 text-center text-[11px] ring-1 backdrop-blur-sm",
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
                <div className="aspect-[3/4] w-full p-2">
                  {itemImage(item) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={itemImage(item)}
                      alt={item.title}
                      className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.02]"
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

      <div className="pointer-events-none">
        <div className={["h-4 rounded-t-[18px]", theme.shelfTop].join(" ")} />
        <div className={["h-6 rounded-b-[18px]", theme.shelfFace].join(" ")} />
        <div className="flex justify-between px-8 sm:px-14">
          <div className={["h-12 w-2 rounded-b-full", theme.support].join(" ")} />
          <div className={["h-12 w-2 rounded-b-full", theme.support].join(" ")} />
          <div className={["h-12 w-2 rounded-b-full", theme.support].join(" ")} />
        </div>
      </div>
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
  const theme = getShelfThemeClasses(themePack);
  const sceneBackground =
    backgroundImageUrl?.trim() || getThemeBackgroundSimple(themePack || undefined);

  const firstShelf = items.slice(0, 5);
  const secondShelf = items.slice(5, 10);

  return (
    <section className="relative overflow-hidden rounded-[30px] ring-1 ring-white/10 shadow-[0_30px_90px_rgba(0,0,0,0.34)]">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,10,14,0.86),rgba(8,10,14,0.94))]" />

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

        <div className={["rounded-[26px] p-4 backdrop-blur-[1px] ring-1", theme.panel].join(" ")}>
          <div className="overflow-hidden rounded-[22px] ring-1 ring-white/10 bg-black/20">
            {sceneBackground ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={sceneBackground}
                alt=""
                className="block h-auto w-full object-contain"
                draggable={false}
              />
            ) : null}
          </div>

          <div className="-mt-3 sm:-mt-4">
            <ShelfRow items={firstShelf} theme={theme} galleryHrefPrefix={galleryHrefPrefix} />
          </div>

          {secondShelf.length > 0 ? (
            <div className="mt-8">
              <ShelfRow items={secondShelf} theme={theme} galleryHrefPrefix={galleryHrefPrefix} />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
