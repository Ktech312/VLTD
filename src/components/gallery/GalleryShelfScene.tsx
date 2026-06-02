"use client";

import Link from "next/link";
import type { CSSProperties } from "react";

import type { GalleryShelfOverlayStyle } from "@/lib/galleryModel";
import type { VaultItem } from "@/lib/vaultModel";

export const GALLERY_STAGE_MAX_WIDTH_CLASS = "max-w-[1120px]";
export const GALLERY_STAGE_HEIGHT_CLASS = "h-[1500px] sm:h-[2200px] lg:h-[2700px]";

const SHELF_COLUMNS = 3;
const SHELF_ROWS = 6;
const SHELF_SLOT_COUNT = SHELF_COLUMNS * SHELF_ROWS;
const ROW_ANCHORS = ["27%", "41%", "55%", "69%", "83%", "97%"] as const;
const EMBEDDED_MOBILE_STAGE_HEIGHT = 2200;
const EMBEDDED_DESKTOP_STAGE_HEIGHT = 2700;
const EMBEDDED_MOBILE_ROW_ANCHORS = ["432px", "729px", "1026px", "1323px", "1620px", "1917px"] as const;
const EMBEDDED_DESKTOP_ROW_ANCHORS = ["616px", "1016px", "1416px", "1816px", "2216px", "2616px"] as const;

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
  onItemClick?: (item: VaultItem) => void;
  themePack?: string | null;
  title?: string;
  subtitle?: string;
  guestMode?: boolean;
  backgroundImageUrl?: string | null;
  shelvesEnabled?: boolean;
  shelfOverlayStyle?: GalleryShelfOverlayStyle;
  slotLayout?: (string | null)[];
  embeddedPreview?: boolean;
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

function itemCategoryBadge(item: VaultItem) {
  const source =
    item.categoryLabel ||
    item.category ||
    item.universe ||
    "Item";

  return String(source)
    .split(/[\s_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function PremiumDisplayCard({
  item,
  galleryHrefPrefix,
  onItemClick,
}: {
  item: VaultItem;
  galleryHrefPrefix: string;
  onItemClick?: (item: VaultItem) => void;
}) {
  const subtitle = itemSubtitle(item);
  const value = formatMoney(item.currentValue);

  const cardInner = (
    <div
      className={[
        "relative aspect-[3/4] w-full overflow-hidden rounded-[16px] bg-[#0b1018] p-[2px] sm:rounded-[18px] sm:p-[5px]",
        "shadow-[0_18px_38px_rgba(0,0,0,0.52),0_0_0_1px_rgba(255,234,174,0.32),0_0_22px_rgba(245,181,72,0.18),inset_0_1px_0_rgba(255,255,255,0.36),inset_0_-12px_18px_rgba(54,32,8,0.55)]",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-[16px] before:bg-[linear-gradient(135deg,#fff0a8_0%,#d99a2b_18%,#6f4514_37%,#f7cf72_54%,#3a250d_72%,#ffe7a0_100%)] sm:before:rounded-[18px]",
        "after:pointer-events-none after:absolute after:inset-[2px] after:rounded-[13px] after:ring-1 after:ring-black/70 sm:after:inset-[5px] sm:after:rounded-[13px]",
      ].join(" ")}
    >
      <div className="relative z-10 h-full overflow-hidden rounded-[13px] bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(0,0,0,0.30))] ring-1 ring-black/70">
        <div className="pointer-events-none absolute inset-[2px] z-10 rounded-[10px] ring-1 ring-[#ffe8a3]/35 sm:inset-[3px] sm:rounded-[12px]" />
        <div className="pointer-events-none absolute left-1 top-1 z-20 h-4 w-4 rounded-full border border-[#ffd978]/80 bg-[#131018] shadow-[inset_0_0_0_2px_rgba(0,0,0,0.55),0_0_12px_rgba(245,181,72,0.35)] sm:left-1.5 sm:top-1.5 sm:h-5 sm:w-5" />
        <div className="pointer-events-none absolute right-1 top-1 z-10 h-4 w-4 rounded-full border border-[#ffd978]/80 bg-[#131018] shadow-[inset_0_0_0_2px_rgba(0,0,0,0.55),0_0_12px_rgba(245,181,72,0.35)] sm:right-1.5 sm:top-1.5 sm:h-5 sm:w-5" />
        <div className="pointer-events-none absolute inset-x-5 top-2 z-10 h-px bg-[linear-gradient(90deg,transparent,#ffdf87,transparent)] sm:inset-x-7 sm:top-3" />
        <div className="absolute inset-x-0 top-0 h-[76%] overflow-hidden bg-[radial-gradient(circle_at_50%_0%,rgba(255,230,160,0.16),rgba(0,0,0,0.18)_45%,rgba(0,0,0,0.40))]">
          {itemImage(item) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={itemImage(item)}
              alt={item.title}
              className="h-full w-full object-contain object-center transition duration-300 group-hover:scale-[1.025]"
              draggable={false}
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-white/65">
              No image
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_6%,rgba(255,255,255,0.20),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_42%,rgba(0,0,0,0.18))]" />
          <div className="absolute right-1 top-1 z-30 grid h-5 w-5 place-items-center rounded-full bg-[#111018] text-[7px] font-bold tracking-[0.04em] text-[#f7d979] ring-1 ring-[#F5B548]/80 shadow-[inset_0_0_0_2px_rgba(0,0,0,0.55),0_0_14px_rgba(245,181,72,0.34)] sm:right-1.5 sm:top-1.5 sm:h-6 sm:w-6 sm:text-[8px]">
            {itemCategoryBadge(item)}
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 flex h-[24%] flex-col justify-center border-t border-[#F5B548]/65 bg-[linear-gradient(180deg,rgba(22,20,27,0.99),rgba(8,8,12,0.99))] px-1 text-center shadow-[inset_0_1px_0_rgba(255,233,169,0.22)] sm:px-2">
          <div className="pointer-events-none absolute inset-x-2 top-1 h-px bg-[linear-gradient(90deg,transparent,rgba(255,234,174,0.85),transparent)]" />
          <div className="truncate font-serif text-[8px] font-semibold leading-tight text-[#f5d16d] sm:text-[9px]">
            {item.title}
          </div>
          <div className="mt-0.5 truncate text-[6px] uppercase tracking-[0.06em] text-white/62 sm:text-[7px]">
            {subtitle || "Collection piece"} - EMV {value}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-w-0 self-end">
      {onItemClick ? (
        <button type="button" onClick={() => onItemClick(item)} className="group block w-full text-left">
          {cardInner}
        </button>
      ) : (
        <Link href={`${galleryHrefPrefix}/${item.id}`} className="group block w-full">
          {cardInner}
        </Link>
      )}
    </div>
  );
}

function AnchoredRow({
  row,
  anchor,
  desktopAnchor,
  galleryHrefPrefix,
  onItemClick,
  shelfOverlayStyle,
  embeddedPreview = false,
}: {
  row: Array<VaultItem | null>;
  anchor: string;
  desktopAnchor?: string;
  galleryHrefPrefix: string;
  onItemClick?: (item: VaultItem) => void;
  shelfOverlayStyle?: GalleryShelfOverlayStyle;
  embeddedPreview?: boolean;
}) {
  const showGlassShelf = shelfOverlayStyle === "glass";
  const showMetalShelf = shelfOverlayStyle === "metal";

  return (
    <div
      className={
        embeddedPreview
          ? "absolute left-[3%] right-[3%] [top:var(--mobile-row-anchor)] md:[top:var(--desktop-row-anchor)] sm:left-[8%] sm:right-[8%]"
          : "absolute left-[4%] right-[4%]"
      }
      style={
        embeddedPreview
          ? ({
              "--mobile-row-anchor": anchor,
              "--desktop-row-anchor": desktopAnchor ?? anchor,
              transform: "translateY(-104%)",
            } as CSSProperties)
          : { top: anchor, transform: "translateY(-104%)" }
      }
    >
      <div className="relative pb-5">
        {showGlassShelf ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-[1.5%] bottom-1 z-0">
            <div className="relative h-6">
              <div className="absolute inset-x-0 bottom-[10px] h-[2px] rounded-full bg-white/72 shadow-[0_0_22px_rgba(255,255,255,0.42)]" />
              <div className="absolute inset-x-2 bottom-[5px] h-[12px] rounded-[999px] bg-[linear-gradient(180deg,rgba(255,255,255,0.40),rgba(255,255,255,0.18)_28%,rgba(155,210,255,0.20)_66%,rgba(78,122,165,0.30)_100%)] opacity-90 shadow-[0_12px_30px_rgba(0,0,0,0.24)]" />
              <div className="absolute inset-x-5 bottom-[2px] h-[2px] rounded-full bg-white/30" />
            </div>
          </div>
        ) : null}

        {showMetalShelf ? (
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-[1.5%] bottom-1 z-0">
            <div className="relative h-6">
              <div className="absolute inset-x-0 bottom-[10px] h-[2px] rounded-full bg-white/45 shadow-[0_0_14px_rgba(255,255,255,0.18)]" />
              <div className="absolute inset-x-2 bottom-[4px] h-[13px] rounded-[999px] bg-[linear-gradient(180deg,#f6f7f9_0%,#cfd6dd_18%,#818b97_48%,#d6dde5_72%,#5b6571_100%)] opacity-95 shadow-[0_10px_24px_rgba(0,0,0,0.30)]" />
              <div className="absolute inset-x-4 bottom-[7px] h-[2px] rounded-full bg-white/55" />
              <div className="absolute inset-x-6 bottom-[1px] h-[2px] rounded-full bg-black/18" />
            </div>
          </div>
        ) : null}

        <div
          className={[
            "relative z-10 grid items-end gap-2",
            "mx-auto max-w-[760px] grid-cols-3 gap-x-3 gap-y-7 sm:gap-x-4 sm:gap-y-8",
          ].join(" ")}
        >
          {row.map((item, index) =>
            item ? (
              <PremiumDisplayCard
                key={item.id}
                item={item}
                galleryHrefPrefix={galleryHrefPrefix}
                onItemClick={onItemClick}
              />
            ) : (
              <div
                key={"empty-" + index}
                className={[
                  "aspect-[3/4] rounded-[10px]",
                  embeddedPreview ? "invisible" : "opacity-20",
                ].join(" ")}
                style={
                  embeddedPreview
                    ? undefined
                    : { background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(255,255,255,0.18)" }
                }
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}

function buildShelfSlots(items: VaultItem[], slotLayout?: (string | null)[]) {
  const maxSlots = SHELF_SLOT_COUNT;
  const itemById = new Map(items.map((item) => [item.id, item]));

  if (!slotLayout?.length) {
    return Array.from({ length: maxSlots }, (_, index) => items[index] ?? null);
  }

  const slots = Array.from({ length: maxSlots }, (_, index) => {
    const itemId = slotLayout[index];
    return itemId ? itemById.get(itemId) ?? null : null;
  });

  if (slotLayout.length >= maxSlots) {
    return slots;
  }

  const placedIds = new Set(
    slots
      .filter((item): item is VaultItem => item !== null)
      .map((item) => item.id)
  );
  const unplaced = items.filter((item) => !placedIds.has(item.id));
  let nextUnplacedIndex = 0;

  return slots.map((slot) => {
    if (slot) return slot;
    if (nextUnplacedIndex >= unplaced.length) return null;
    return unplaced[nextUnplacedIndex++];
  });
}

export default function GalleryShelfScene({
  items,
  galleryHrefPrefix = "/vault/item",
  onItemClick,
  themePack,
  backgroundImageUrl,
  shelvesEnabled = true,
  shelfOverlayStyle = "none",
  slotLayout,
  embeddedPreview = false,
}: Props) {
  const theme = getShelfThemeClasses(themePack);
  const sceneBackground = backgroundImageUrl?.trim() || "";

  const itemsPerRow = SHELF_COLUMNS;
  const visibleItems = buildShelfSlots(items, slotLayout);
  const shelfCount = SHELF_ROWS;
  const rowAnchors = embeddedPreview ? EMBEDDED_MOBILE_ROW_ANCHORS : ROW_ANCHORS;
  const desktopRowAnchors = embeddedPreview ? EMBEDDED_DESKTOP_ROW_ANCHORS : ROW_ANCHORS;
  const rows = Array.from({ length: shelfCount }, (_, i) =>
    visibleItems.slice(i * itemsPerRow, (i + 1) * itemsPerRow)
  );

  const backgroundStyle: CSSProperties | undefined = sceneBackground
    ? {
        backgroundImage: `url(${sceneBackground})`,
        backgroundSize: "100% auto",
        backgroundPosition: "center top",
        backgroundRepeat: "no-repeat",
      }
    : undefined;
  const embeddedStageStyle = embeddedPreview
    ? ({
        "--embedded-mobile-stage-height": `${EMBEDDED_MOBILE_STAGE_HEIGHT}px`,
        "--embedded-desktop-stage-height": `${EMBEDDED_DESKTOP_STAGE_HEIGHT}px`,
      } as CSSProperties)
    : undefined;

  return (
    <section className="mt-0">
      <div
        className={[
          "relative mx-auto overflow-hidden rounded-[30px] ring-1 shadow-[0_30px_90px_rgba(0,0,0,0.34)]",
          embeddedPreview ? "max-w-[940px]" : GALLERY_STAGE_MAX_WIDTH_CLASS,
          theme.stageShell,
        ].join(" ")}
      >
        <div
          className={[
            "relative",
            embeddedPreview
              ? "h-[var(--embedded-mobile-stage-height)] md:h-[var(--embedded-desktop-stage-height)]"
              : GALLERY_STAGE_HEIGHT_CLASS,
          ].join(" ")}
          style={embeddedStageStyle}
        >
          <div
            className={embeddedPreview ? "absolute inset-0 vltd-embedded-shelf-bg" : "absolute inset-0"}
            style={backgroundStyle}
          />
          <div className={["absolute inset-0", theme.vignette].join(" ")} />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,10,16,0.08),rgba(6,10,16,0.12))]" />

          {shelvesEnabled
            ? rows.map((row, index) => (
                <AnchoredRow
                  key={index}
                  row={row}
                  anchor={rowAnchors[index]}
                  desktopAnchor={desktopRowAnchors[index]}
                  galleryHrefPrefix={galleryHrefPrefix}
                  onItemClick={onItemClick}
                  shelfOverlayStyle={shelfOverlayStyle}
                  embeddedPreview={embeddedPreview}
                />
              ))
            : null}
        </div>
      </div>
    </section>
  );
}
