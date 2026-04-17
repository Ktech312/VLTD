
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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
        tile: "bg-[rgba(42,24,14,0.72)] ring-[#b98b62]/18",
        arrow: "bg-[rgba(52,30,18,0.52)] text-[#f2dfc8] ring-[#c79b71]/22",
        ghost: "bg-[rgba(52,30,18,0.18)] text-[#f2dfc8]/30 ring-[#c79b71]/10",
        shelf: "from-[#9b7352] to-[#5b3923]",
        support: "from-[#7a5235] to-[#3c2416]",
      };
    case "midnight":
      return {
        panel: "bg-[rgba(5,10,17,0.16)] ring-cyan-300/12 text-slate-100",
        plaque: "bg-[rgba(9,20,33,0.88)] text-cyan-100 ring-cyan-300/16",
        tile: "bg-[rgba(8,18,30,0.76)] ring-cyan-300/12",
        arrow: "bg-[rgba(12,20,36,0.55)] text-cyan-100 ring-cyan-300/18",
        ghost: "bg-[rgba(12,20,36,0.16)] text-cyan-100/25 ring-cyan-300/8",
        shelf: "from-[#4e6884] to-[#23384f]",
        support: "from-[#39546e] to-[#182534]",
      };
    case "marble":
      return {
        panel: "bg-[rgba(255,255,255,0.10)] ring-slate-300/26 text-slate-900",
        plaque: "bg-[rgba(255,255,255,0.90)] text-slate-900 ring-slate-300/45",
        tile: "bg-[rgba(255,255,255,0.74)] ring-slate-300/30",
        arrow: "bg-[rgba(255,255,255,0.55)] text-slate-900 ring-slate-300/30",
        ghost: "bg-[rgba(255,255,255,0.18)] text-slate-900/25 ring-slate-300/10",
        shelf: "from-[#eef2f6] to-[#b8c2cd]",
        support: "from-[#d4dbe3] to-[#9ea9b5]",
      };
    case "classic":
    default:
      return {
        panel: "bg-[rgba(14,11,8,0.16)] ring-white/10 text-stone-100",
        plaque: "bg-[rgba(26,20,14,0.88)] text-amber-100 ring-amber-100/14",
        tile: "bg-[rgba(24,18,12,0.72)] ring-white/10",
        arrow: "bg-[rgba(30,22,16,0.52)] text-amber-100 ring-amber-100/14",
        ghost: "bg-[rgba(30,22,16,0.16)] text-amber-100/25 ring-amber-100/8",
        shelf: "from-[#b7865f] to-[#6a4127]",
        support: "from-[#875c3e] to-[#422717]",
      };
  }
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
    <div className="min-w-0">
      <div
        className={[
          "mb-2 rounded-2xl px-2.5 py-1.5 text-center text-[10px] ring-1 backdrop-blur-sm",
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
            "relative w-full overflow-hidden rounded-[16px] ring-1 shadow-[0_10px_24px_rgba(0,0,0,0.20)]",
            theme.tile,
          ].join(" ")}
        >
          <div className="aspect-[4/5] w-full p-2">
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
  );
}

function ShelfRail({
  theme,
  ghost = false,
}: {
  theme: ReturnType<typeof getShelfThemeClasses>;
  ghost?: boolean;
}) {
  if (ghost) {
    return (
      <div className="pointer-events-none opacity-0">
        <div className="h-3 rounded-full" />
      </div>
    );
  }

  return (
    <div className="pointer-events-none">
      <div className={["h-3 rounded-t-[18px] bg-gradient-to-b", theme.shelf].join(" ")} />
      <div className={["h-4 rounded-b-[18px] bg-gradient-to-b opacity-95", theme.shelf].join(" ")} />
    </div>
  );
}

function ArrowButton({
  direction,
  disabled,
  onClick,
  theme,
}: {
  direction: "left" | "right";
  disabled: boolean;
  onClick: () => void;
  theme: ReturnType<typeof getShelfThemeClasses>;
}) {
  return (
    <button
      type="button"
      aria-label={direction === "left" ? "Previous shelf page" : "Next shelf page"}
      disabled={disabled}
      onClick={onClick}
      className={[
        "absolute top-1/2 z-20 -translate-y-1/2 rounded-full px-3 py-2 text-lg ring-1 backdrop-blur-sm transition",
        direction === "left" ? "left-3" : "right-3",
        disabled ? theme.ghost : theme.arrow,
        disabled ? "cursor-default" : "hover:scale-[1.03]",
      ].join(" ")}
    >
      {direction === "left" ? "‹" : "›"}
    </button>
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
  const themeKey = (themePack || "classic").toLowerCase();
  const sceneBackground = `/themes/${themeKey}-shelf-wall.webp`;
  const itemsPerShelf = 4;
  const shelfCount = 4;
  const pageSize = itemsPerShelf * shelfCount;

  const [page, setPage] = useState(0);

  const pages = useMemo(() => {
    const chunks: VaultItem[][] = [];
    for (let i = 0; i < items.length; i += pageSize) {
      chunks.push(items.slice(i, i + pageSize));
    }
    return chunks.length ? chunks : [[]];
  }, [items]);

  const visibleItems = pages[Math.min(page, pages.length - 1)] ?? [];
  const rows = Array.from({ length: shelfCount }, (_, rowIndex) =>
    visibleItems.slice(rowIndex * itemsPerShelf, rowIndex * itemsPerShelf + itemsPerShelf)
  );

  const hasMultiplePages = pages.length > 1;

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

        <div className={["rounded-[26px] p-4 backdrop-blur-[1px] ring-1", theme.panel].join(" ")}>
          <div className="relative mx-auto max-w-[1100px] overflow-hidden rounded-[22px] ring-1 ring-white/10 bg-black/20">
            <div className="relative h-[980px] sm:h-[1040px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sceneBackground || backgroundImageUrl || getThemeBackgroundSimple(themePack || undefined)}
                alt=""
                className="absolute inset-0 h-full w-full object-cover object-[42%_top]"
                draggable={false}
              />

              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.05),rgba(0,0,0,0.12))]" />

              <ArrowButton
                direction="left"
                disabled={!hasMultiplePages || page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                theme={theme}
              />
              <ArrowButton
                direction="right"
                disabled={!hasMultiplePages || page >= pages.length - 1}
                onClick={() => setPage((p) => Math.min(pages.length - 1, p + 1))}
                theme={theme}
              />

              <div className="absolute inset-x-6 top-[118px]">
                <div className="grid grid-cols-4 gap-4">
                  {rows[0].map((item) => (
                    <DisplayCard
                      key={item.id}
                      item={item}
                      theme={theme}
                      galleryHrefPrefix={galleryHrefPrefix}
                    />
                  ))}
                </div>
              </div>
              <div className="absolute inset-x-8 top-[288px]">
                <ShelfRail theme={theme} />
              </div>

              <div className="absolute inset-x-6 top-[356px]">
                <div className="grid grid-cols-4 gap-4">
                  {rows[1].map((item) => (
                    <DisplayCard
                      key={item.id}
                      item={item}
                      theme={theme}
                      galleryHrefPrefix={galleryHrefPrefix}
                    />
                  ))}
                </div>
              </div>
              <div className="absolute inset-x-8 top-[526px]">
                <ShelfRail theme={theme} />
              </div>

              <div className="absolute inset-x-6 top-[594px]">
                <div className="grid grid-cols-4 gap-4">
                  {rows[2].map((item) => (
                    <DisplayCard
                      key={item.id}
                      item={item}
                      theme={theme}
                      galleryHrefPrefix={galleryHrefPrefix}
                    />
                  ))}
                </div>
              </div>
              <div className="absolute inset-x-8 top-[764px]">
                <ShelfRail theme={theme} />
              </div>

              <div className="absolute inset-x-6 top-[832px]">
                <div className="grid grid-cols-4 gap-4">
                  {rows[3].map((item) => (
                    <DisplayCard
                      key={item.id}
                      item={item}
                      theme={theme}
                      galleryHrefPrefix={galleryHrefPrefix}
                    />
                  ))}
                </div>
              </div>
              <div className="absolute inset-x-8 bottom-6">
                <ShelfRail theme={theme} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
