
"use client";

import Link from "next/link";
import type { VaultItem } from "@/lib/vaultModel";
import { getThemeBackgroundSimple } from "@/lib/galleryModel";

function itemImage(item: VaultItem) {
  return item.imageFrontUrl || item.imageBackUrl || "";
}

function formatMoney(value?: number) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function GalleryShelfScene({
  items,
  galleryHrefPrefix = "/vault/item",
  themePack,
  backgroundImageUrl,
}: {
  items: VaultItem[];
  galleryHrefPrefix?: string;
  themePack?: string | null;
  backgroundImageUrl?: string | null;
}) {
  const bg = backgroundImageUrl || getThemeBackgroundSimple(themePack || undefined);
  const row = items.slice(0, 5);

  return (
    <section className="relative rounded-[28px] overflow-hidden ring-1 ring-white/10 bg-black">

      {/* WALL */}
      <div className="w-full flex justify-center bg-black pt-6 pb-0">
        {bg && (
          <img
            src={bg}
            alt=""
            className="w-full max-w-[900px] h-auto object-contain"
            draggable={false}
          />
        )}
      </div>

      {/* ITEMS BLOCK */}
      <div className="-mt-24 px-6 pb-8">
        <div className="grid grid-cols-5 gap-4">
          {row.map((item) => (
            <div key={item.id} className="flex flex-col items-center">

              {/* PLAQUE */}
              <div className="mb-2 text-[10px] text-center bg-[#2a1a10] text-[#e6d3b3] px-2 py-1 rounded-lg w-full">
                <div className="font-semibold truncate">{item.title}</div>
                <div>Est. {formatMoney(item.currentValue)}</div>
              </div>

              {/* IMAGE */}
              <Link href={`${galleryHrefPrefix}/${item.id}`} className="w-full">
                <div className="aspect-[3/4] w-full bg-black rounded-lg overflow-hidden">
                  {itemImage(item) ? (
                    <img
                      src={itemImage(item)}
                      alt={item.title}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-white/50 text-sm">
                      No image
                    </div>
                  )}
                </div>
              </Link>

            </div>
          ))}
        </div>

        {/* SHELF */}
        <div className="mt-4">
          <div className="h-4 bg-gradient-to-b from-[#b07a50] to-[#6b3f24] rounded-t-lg" />
          <div className="h-6 bg-gradient-to-b from-[#6b3f24] to-[#3a1f10] rounded-b-lg" />
        </div>
      </div>
    </section>
  );
}
