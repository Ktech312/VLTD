"use client";

import React from "react";

export function SectionCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "rounded-3xl",
        "bg-[color:var(--surface)]",
        "ring-1 ring-[color:var(--border)]",
        "shadow-[var(--shadow-pill)]",
        "vltd-frame-glow",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}