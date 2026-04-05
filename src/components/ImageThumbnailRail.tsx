"use client";

type ImageThumbnailRailProps = {
  images: string[];
  active: number;
  onSelect: (index: number) => void;
};

export default function ImageThumbnailRail({
  images,
  active,
  onSelect,
}: ImageThumbnailRailProps) {
  const safeImages = Array.isArray(images) ? images : [];

  return (
    <div className="flex flex-col gap-2">
      {safeImages.map((img, i) => (
        <button
          key={`${img}-${i}`}
          type="button"
          onClick={() => onSelect(i)}
          className={[
            "overflow-hidden rounded border",
            i === active ? "border-white/60" : "border-white/10",
          ].join(" ")}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img}
            alt=""
            className="h-16 w-16 object-cover"
          />
        </button>
      ))}
    </div>
  );
}