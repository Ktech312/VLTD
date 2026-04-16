"use client";

export default function GalleryShelfScene({ backgroundImageUrl }: { backgroundImageUrl?: string }) {
  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* FIX: force correct aspect ratio like source image */}
      <div className="w-full overflow-hidden rounded-2xl">
        {backgroundImageUrl && (
          <img
            src={backgroundImageUrl}
            alt=""
            className="w-full h-auto object-contain"
          />
        )}
      </div>
    </div>
  );
}
