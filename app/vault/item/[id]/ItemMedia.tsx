"use client";

import { useState } from "react";
import ImageViewer from "@/components/ImageViewer";
import ImageThumbnailRail from "@/components/ImageThumbnailRail";

export default function ItemMedia({ images }) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);

  const current = images[index];

  return (
    <>
      <div className="grid grid-cols-[80px_1fr] gap-4">
        <ImageThumbnailRail images={images} active={index} onSelect={setIndex} />

        <div className="aspect-[4/3] bg-black/20 rounded overflow-hidden" onClick={() => setOpen(true)}>
          {current ? <img src={current} className="w-full h-full object-cover" /> : "No image"}
        </div>
      </div>

      {open && <ImageViewer images={images} index={index} onClose={() => setOpen(false)} />}
    </>
  );
}
