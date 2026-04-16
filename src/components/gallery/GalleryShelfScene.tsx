// FULL REPLACEMENT FILE
// Background-only fix: constrain height and center image

import React from "react";

export default function GalleryShelfScene({
  sceneBackground,
  children,
}: {
  sceneBackground?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-[26px] p-4 ring-1 ring-white/10 bg-black/20">
      <div className="overflow-visible rounded-[22px] ring-1 ring-white/10 bg-black/20 flex justify-center">
        {sceneBackground ? (
          <img
            src={sceneBackground}
            alt=""
            className="w-full h-auto max-h-[420px] object-contain mx-auto"
            draggable={false}
          />
        ) : null}
      </div>

      {children}
    </div>
  );
}
