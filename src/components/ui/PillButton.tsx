"use client";

import * as React from "react";

type Variant = "default" | "active" | "primary";

export function PillButton({
  children,
  variant = "default",
  onClick,
  disabled,
  title,
  type = "button",
  className = "",
}: {
  children: React.ReactNode;
  variant?: Variant;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  type?: "button" | "submit" | "reset";
  className?: string;
}) {
  const base = [
    "inline-flex items-center justify-center",
    "h-11 sm:h-10",
    "px-4",
    "rounded-full",
    "text-sm font-medium",
    "whitespace-nowrap",
    "ring-1 transition select-none vltd-selectable",
    "active:scale-[0.98]",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
  ].join(" ");

  const styles =
    variant === "active"
      ? [
          "bg-[color:var(--pill)]",
          "text-[color:var(--fg)]",
          "ring-[color:var(--pill-active-ring)]",
          "vltd-pill-main-glow",
          "font-semibold",
          "hover:bg-[color:var(--pill-hover)]",
        ].join(" ")
      : variant === "primary"
      ? [
          "bg-[color:var(--pill)]",
          "text-[color:var(--fg)]",
          "ring-[color:var(--pill-active-ring)]",
          "vltd-pill-main-glow",
          "font-semibold",
          "hover:bg-[color:var(--pill-hover)]",
        ].join(" ")
      : [
          "bg-[color:var(--pill)]",
          "text-[color:var(--fg)]",
          "ring-[color:var(--border)]",
          "hover:bg-[color:var(--pill-hover)]",
        ].join(" ");

  const disabledStyles = disabled
    ? "opacity-60 cursor-not-allowed active:scale-100"
    : "";

  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      className={[base, styles, disabledStyles, className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </button>
  );
}