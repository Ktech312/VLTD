"use client";

/* eslint-disable @next/next/no-img-element -- This is the app-owned progressive image primitive. */

import { useState } from "react";
import type { CSSProperties } from "react";

type ProgressiveImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  imageClassName?: string;
  placeholderClassName?: string;
  loading?: "eager" | "lazy";
  draggable?: boolean;
  style?: CSSProperties;
};

export default function ProgressiveImage({
  src,
  alt,
  className = "",
  imageClassName = "object-cover",
  placeholderClassName = "",
  loading = "lazy",
  draggable = false,
  style,
}: ProgressiveImageProps) {
  const [loaded, setLoaded] = useState(false);
  const imageSrc = typeof src === "string" ? src.trim() : "";

  return (
    <div
      className={[
        "relative isolate overflow-hidden bg-[radial-gradient(circle_at_35%_20%,rgba(255,255,255,0.14),rgba(104,220,255,0.06)_35%,rgba(255,255,255,0.025)_62%,rgba(0,0,0,0.18)_100%)]",
        className,
      ].join(" ")}
      style={style}
    >
      <div
        aria-hidden="true"
        className={[
          "absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(104,220,255,0.04)_42%,rgba(0,0,0,0.16))]",
          placeholderClassName,
        ].join(" ")}
      />

      {imageSrc ? (
        <>
          <img
            src={imageSrc}
            alt=""
            aria-hidden="true"
            className={["absolute inset-0 h-full w-full scale-105 blur-xl transition-opacity duration-300", imageClassName, loaded ? "opacity-0" : "opacity-70"].join(" ")}
            loading={loading}
            decoding="async"
            draggable={false}
          />
          <img
            src={imageSrc}
            alt={alt}
            className={["relative z-10 h-full w-full transition-opacity duration-300", imageClassName, loaded ? "opacity-100" : "opacity-0"].join(" ")}
            onLoad={() => setLoaded(true)}
            loading={loading}
            decoding="async"
            draggable={draggable}
          />
        </>
      ) : (
        <div className="relative z-10 h-full w-full" role="img" aria-label={alt} />
      )}
    </div>
  );
}
