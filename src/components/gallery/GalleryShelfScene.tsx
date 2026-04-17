
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
        panel: "bg-[rgba(20,12,8,0.14)] ring-[#b98b62]/18 text-stone-100",
        plaque: "bg-[rgba(58,34,20,0.86)] text-[#f2dfc8] ring-[#c79b71]/25",
        tile: "bg-[rgba(42,24,14,0.58)] ring-[#b98b62]/18",
        shelfTop: "from-[#c09369] to-[#875a37]",
        shelfFace: "from-[#72482b] to-[#452818]",
        support: "from-[#8a6141] to-[#3d2315]",
      };
    case "midnight":
      return {
        panel: "bg-[rgba(5,10,17,0.14)] ring-cyan-300/12 text-slate-100",
        plaque: "bg-[rgba(9,20,33,0.86)] text-cyan-100 ring-cyan-300/16",
        tile: "bg-[rgba(8,18,30,0.62)] ring-cyan-300/12",
        shelfTop: "from-[#48627f] to-[#2c425d]",
        shelfFace: "from-[#1b2739] to-[#0d1625]",
        support: "from-[#304963] to-[#0d1625]",
      };
    case "marble":
      return {
        panel: "bg-[rgba(255,255,255,0.10)] ring-slate-300/26 text-slate-900",
        plaque: "bg-[rgba(255,255,255,0.88)] text-slate-900 ring-slate-300/45",
        tile: "bg-[rgba(255,255,255,0.54)] ring-slate-300/30",
        shelfTop: "from-[#fafbfc] to-[#e0e5eb]",
        shelfFace: "from-[#d6dce3] to-[#aab4bf]",
        support: "from-[#dfe5eb] to-[#97a1ad]",
      };
    case "classic":
    default:
      return {
        panel: "bg-[rgba(14,11,8,0.14)] ring-white/10 text-stone-100",
        plaque: "bg-[rgba(26,20,14,0.84)] text-amber-100 ring-amber-100/14",
        tile: "bg-[rgba(24,18,12,0.54)] ring-white/10",
        shelfTop: "from-[#9b7352] to-[#755035]",
        shelfFace: "from-[#5a3b25] to-[#311d12]",
        support: "from-[#6e4a32] to-[#301d12]",
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
            "relative w-full overflow-hidden rounded-[14px] ring-1 shadow-[0_8px_18px_rgba(0,0,0,0.18)]",
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
}: {
  theme: ReturnType<typeof getShelfThemeClasses>;
}) {
  return (
    <div className="pointer-events-none">
      <div className={["h-3 rounded-t-[18px] bg-gradient-to-b", theme.shelfTop].join(" ")} />
      <div className={["h-4 rounded-b-[18px] bg-gradient-to-b", theme.shelfFace].join(" ")} />
      <div className="flex justify-between px-8 sm:px-14">
        <div className={["h-9 w-1.5 rounded-b-full bg-gradient-to-b", theme.support].join(" ")} />
        <div className={["h-9 w-1.5 rounded-b-full bg-gradient-to-b", theme.support].join(" ")} />
        <div className={["h-9 w-1.5 rounded-b-full bg-gradient-to-b", theme.support].join(" ")} />
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

  const itemsPerRow = 4;
  const maxShelves = 4;
  const visibleItems = items.slice(0, itemsPerRow * maxShelves);
  const rows = Array.from({ length: maxShelves }, (_, i) =>
    visibleItems.slice(i * itemsPerRow, (i + 1) * itemsPerRow)
  );

  const positions = [
    { cards: "15%", shelf: "31%" },
    { cards: "35%", shelf: "51%" },
    { cards: "55%", shelf: "71%" },
    { cards: "74%", shelf: "90%" },
  ];

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
            {/* wall/background remains untouched; only shelf layout changes */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sceneBackground}
              alt=""
              className="block h-auto w-full object-contain"
              draggable={false}
            />

            <div className="absolute inset-0">
              {rows.map((row, rowIndex) =>
                row.length > 0 ? (
                  <div key={`row-${rowIndex}`}>
                    <div
                      className="absolute left-[6%] right-[6%]"
                      style={{ top: positions[rowIndex].cards }}
                    >
                      <div className="grid grid-cols-4 gap-4">
                        {row.map((item) => (
                          <DisplayCard
                            key={item.id}
                            item={item}
                            theme={theme}
                            galleryHrefPrefix={galleryHrefPrefix}
                          />
                        ))}
                      </div>
                    </div>

                    <div
                      className="absolute left-[7%] right-[7%]"
                      style={{ top: positions[rowIndex].shelf }}
                    >
                      <ShelfRail theme={theme} />
                    </div>
                  </div>
                ) : null
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
