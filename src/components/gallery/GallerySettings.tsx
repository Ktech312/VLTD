"use client";

import { Gallery } from "@/lib/galleryModel";
import { GalleryLayout, GALLERY_LAYOUTS } from "@/lib/galleryLayout";

export default function GallerySettings({
  gallery,
  onChange
}:{
  gallery: Gallery;
  onChange:(g:Gallery)=>void;
}){

  function updateLayout(layout:GalleryLayout){

    onChange({
      ...gallery,
      layout
    })
  }

  return (

    <div className="mt-6">

      <div className="text-sm font-semibold">
        Gallery Layout
      </div>

      <div className="mt-3 flex flex-wrap gap-2">

        {GALLERY_LAYOUTS.map(l => (

          <button
            key={l}
            onClick={()=>updateLayout(l)}
            className={[
              "px-4 py-2 rounded-full text-sm",
              gallery.layout === l
                ? "bg-[color:var(--pill-active-bg)] text-[color:var(--fg)]"
                : "bg-[color:var(--pill)]"
            ].join(" ")}
          >

            {l}

          </button>

        ))}

      </div>

    </div>

  )
}