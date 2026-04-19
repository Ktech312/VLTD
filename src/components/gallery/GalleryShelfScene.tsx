"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

import type { VaultItem } from "@/lib/vaultModel";

export const GALLERY_STAGE_MAX_WIDTH_CLASS = "max-w-[1120px]";
export const GALLERY_STAGE_HEIGHT_CLASS = "h-[2700px] sm:h-[2820px]";

const ROW_ANCHORS = ["31%", "47%", "62%", "77.5%"] as const;

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
};

function getShelfThemeClasses(themePack?: string | null) {
  switch ((themePack || "classic").toLowerCase()) {
    case "walnut":
      return {
        stageShell: "ring-[#b98b62]/18 bg-[rgba(20,12,8,0.10)]",
        plaque: "bg-[rgba(58,34,20,0.84)] text-[#f2dfc8] ring-[#c79b71]/22",
        tile: "bg-[rgba(42,24,14,0.48)] ring-[#b98b62]/16",
        shelfTop: "from-[#c09369] to-[#875a37]",
        shelfFace: "from-[#72482b] to-[#452818]",
        support: "from-[#8a6141] to-[#3d2315]",
        vignette: "bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.00)_0%,rgba(0,0,0,0.10)_62%,rgba(0,0,0,0.34)_100%)]",
      };
    case "midnight":
      return {
        stageShell: "ring-cyan-300/12 bg-[rgba(5,10,17,0.08)]",
        plaque: "bg-[rgba(9,20,33,0.84)] text-cyan-100 ring-cyan-300/16",
        tile: "bg-[rgba(8,18,30,0.44)] ring-cyan-300/12",
        shelfTop: "from-[#48627f] to-[#2c425d]",
        shelfFace: "from-[#1b2739] to-[#0d1625]",
        support: "from-[#304963] to-[#0d1625]",
        vignette: "bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.00)_0%,rgba(0,0,0,0.10)_62%,rgba(0,0,0,0.34)_100%)]",
      };
    case "cold-blue":
      return {
        stageShell: "ring-white/10 bg-[rgba(10,10,14,0.10)]",
        plaque: "bg-[rgba(20,20,24,0.84)] text-stone-100 ring-white/12",
        tile: "bg-[rgba(18,18,24,0.46)] ring-white/10",
        shelfTop: "from-[#5f5f69] to-[#3f4048]",
        shelfFace: "from-[#262832] to-[#13141a]",
        support: "from-[#4a4d58] to-[#13141a]",
        vignette: "bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.00)_0%,rgba(0,0,0,0.14)_62%,rgba(0,0,0,0.38)_100%)]",
      };
    case "marble":
      return {
        stageShell: "ring-slate-300/20 bg-[rgba(255,255,255,0.06)]",
        plaque: "bg-[rgba(255,255,255,0.82)] text-slate-900 ring-slate-300/40",
        tile: "bg-[rgba(255,255,255,0.44)] ring-slate-300/24",
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
        shelfTop: "from-[#9b7352] to-[#755035]",
        shelfFace: "from-[#5a3b25] to-[#311d12]",
        support: "from-[#6e4a32] to-[#301d12]",
        vignette: "bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.00)_0%,rgba(0,0,0,0.08)_62%,rgba(0,0,0,0.26)_100%)]",
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
    <div className="min-w-0 self-end">
      <div
        className={[
          "mb-2 rounded-2xl px-2.5 py-1.5 text-center text-[10px] ring-1 backdrop-blur-sm",
          theme.plaque,
        ].join(" ")}
      >
        <div className="line-clamp-2 font-semibold leading-tight">{item.title}</div>
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
    </div>
  );
}

function AnchoredRow({
  row,
  anchor,
  theme,
  galleryHrefPrefix,
}: {
  row: VaultItem[];
  anchor: string;
  theme: ReturnType<typeof getShelfThemeClasses>;
  galleryHrefPrefix: string;
}) {
  return (
    <div
      className="absolute left-[4%] right-[4%]"
      style={{ top: anchor, transform: "translateY(-150%)" }}
    >
      <div className="grid grid-cols-4 items-end gap-[0.8rem]">
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
  );
}

export default function GalleryShelfScene({
  items,
  galleryHrefPrefix = "/vault/item",
  themePack,
  backgroundImageUrl,
  shelvesEnabled = true,
}: Props) {
  const theme = getShelfThemeClasses(themePack);
  const sceneBackground = backgroundImageUrl?.trim() || "";

  const itemsPerRow = 4;
  const shelfCount = 4;
  const visibleItems = items.slice(0, itemsPerRow * shelfCount);
  const rows = Array.from({ length: shelfCount }, (_, i) =>
    visibleItems.slice(i * itemsPerRow, (i + 1) * itemsPerRow)
  );

  const backgroundStyle: CSSProperties | undefined = sceneBackground
    ? {
        backgroundImage: `url(${sceneBackground})`,
        backgroundSize: "auto 114%",
        backgroundPosition: "center top",
        backgroundRepeat: "no-repeat",
      }
    : undefined;

  return (
    <section className="mt-0">
      <div
        className={[
          "relative mx-auto overflow-hidden rounded-[30px] ring-1 shadow-[0_30px_90px_rgba(0,0,0,0.34)]",
          GALLERY_STAGE_MAX_WIDTH_CLASS,
          theme.stageShell,
        ].join(" ")}
      >
        <div className={["relative", GALLERY_STAGE_HEIGHT_CLASS].join(" ")}>
          <div className="absolute inset-0" style={backgroundStyle} />
          <div className={["absolute inset-0", theme.vignette].join(" ")} />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,10,16,0.08),rgba(6,10,16,0.12))]" />

          {shelvesEnabled
            ? rows.map((row, index) =>
                row.length > 0 ? (
                  <AnchoredRow
                    key={index}
                    row={row}
                    anchor={ROW_ANCHORS[index]}
                    theme={theme}
                    galleryHrefPrefix={galleryHrefPrefix}
                  />
                ) : null
              )
            : null}
        </div>
      </div>
    </section>
  );
}
