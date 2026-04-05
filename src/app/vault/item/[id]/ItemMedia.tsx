"use client";

import { useState } from "react";
import ImageViewer from "@/components/ImageViewer";
import ImageThumbnailRail from "@/components/ImageThumbnailRail";

type ItemMediaProps = {
  images: string[];
};

export default function ItemMedia({ images }: ItemMediaProps) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);

  const safeImages = Array.isArray(images) ? images : [];
  const current = safeImages[index] ?? "";

  return (
    <>
      <div className="grid grid-cols-[80px_1fr] gap-4">
        <ImageThumbnailRail images={safeImages} active={index} onSelect={setIndex} />

        <div
          className="aspect-[4/3] overflow-hidden rounded bg-black/20"
          onClick={() => {
            if (current) setOpen(true);
          }}
        >
          {current ? (
            <img src={current} alt="" className="h-full w-full object-cover" />
          ) : (
            "No image"
          )}
        </div>
      </div>

      {open ? (
        <ImageViewer images={safeImages} index={index} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}