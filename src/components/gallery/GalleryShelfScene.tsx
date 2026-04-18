
"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import type { VaultItem } from "@/lib/vaultModel";

export const GALLERY_STAGE_MAX_WIDTH_CLASS = "max-w-[1120px]";
export const GALLERY_STAGE_HEIGHT_CLASS = "h-[3000px] sm:h-[3200px]"; // doubled

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
  backgroundImageUrl?: string | null;
  shelvesEnabled?: boolean;
};

function getTheme(themePack?: string | null) {
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

function Card({ item, theme, prefix }: any) {
  return (
    <div>
      <div className={"mb-2 rounded-2xl px-3 py-2 text-center text-[11px] ring-1 " + theme.plaque}>
        <div>{item.title}</div>
        <div>{itemSubtitle(item) || "—"}</div>
        <div>{formatMoney(item.currentValue)}</div>
      </div>

      <Link href={`${prefix}/${item.id}`}>
        <div className={"rounded-xl p-2 " + theme.tile}>
          {itemImage(item) ? (
            <img src={itemImage(item)} className="w-full h-auto object-contain" />
          ) : (
            <div>No image</div>
          )}
        </div>
      </Link>
    </div>
  );
}

function Shelf({ row, theme, prefix }: any) {
  return (
    <div className="flex flex-col justify-end">
      <div className="grid grid-cols-4 gap-6">
        {row.map((item: any) => (
          <Card key={item.id} item={item} theme={theme} prefix={prefix} />
        ))}
      </div>

      <div className="mt-6">
        <div className={"h-4 bg-gradient-to-b " + theme.shelfTop}></div>
        <div className={"h-6 bg-gradient-to-b " + theme.shelfFace}></div>
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
  const theme = getTheme(themePack);

  const rows = Array.from({ length: 4 }, (_, i) =>
    items.slice(i * 4, (i + 1) * 4)
  );

  return (
    <div className="mt-0">
      <div className={"relative mx-auto rounded-3xl " + GALLERY_STAGE_MAX_WIDTH_CLASS}>
        <div className={"relative " + GALLERY_STAGE_HEIGHT_CLASS}>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />

          {shelvesEnabled && (
            <div className="absolute inset-0 px-[4%] pt-[12%] pb-[10%]">
              <div className="grid h-full grid-rows-4 gap-16">
                {rows.map((row, i) => (
                  <Shelf key={i} row={row} theme={theme} prefix={galleryHrefPrefix} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
