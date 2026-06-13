"use client";

import * as React from "react";

export function SafeImage({
  src,
  alt,
  className,
  fallback,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}) {
  // Never render <img src="">
  if (!src || typeof src !== "string" || src.trim() === "") {
    return <>{fallback ?? null}</>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
}

export default SafeImage;