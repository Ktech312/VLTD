"use client";

import * as React from "react";
import Link from "next/link";

type Variant = "default" | "active" | "primary" | "success" | "danger";

type PillButtonProps = {
  children: React.ReactNode;
  variant?: Variant;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  type?: "button" | "submit" | "reset";
  className?: string;
  /** Renders as a Next.js Link instead of a <button> -- for nav-style pills. */
  href?: string;
  /** Inline style passthrough -- for bespoke colors a variant doesn't cover.
   *  Inline styles win over the variant's background/color classes. */
  style?: React.CSSProperties;
};

export function PillButton({
  children,
  variant = "default",
  onClick,
  disabled,
  title,
  type = "button",
  className = "",
  href,
  style,
}: PillButtonProps) {
  const base = [
    "inline-flex items-center justify-center",
    "h-11 sm:h-10",
    "px-4",
    "rounded-[8px]",
    "text-sm font-medium",
    "whitespace-nowrap",
    "ring-1 transition select-none vltd-selectable",
    "active:scale-[0.98]",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20",
  ].join(" ");

  const styles =
    variant === "success"
      ? [
          "bg-emerald-500/90",
          "text-white",
          "ring-emerald-400/60",
          "font-semibold",
          "hover:bg-emerald-500",
        ].join(" ")
      : variant === "danger"
      ? [
          "bg-red-500/10",
          "text-red-400",
          "ring-red-400/30",
          "font-semibold",
          "hover:bg-red-500/15",
        ].join(" ")
      : variant === "active"
      ? [
          "bg-[color:var(--pill)]",
          "text-[color:var(--fg)]",
          "ring-[color:var(--pill-active-ring)]",
          "vltd-selected",
          "font-semibold",
          "hover:bg-[color:var(--pill-hover)]",
        ].join(" ")
      : variant === "primary"
      ? [
          "bg-[color:var(--pill)]",
          "text-[color:var(--fg)]",
          "ring-[color:var(--pill-active-ring)]",
          "vltd-selected",
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

  const fullClassName = [base, styles, disabledStyles, className]
    .filter(Boolean)
    .join(" ");

  if (href) {
    return (
      <Link
        href={disabled ? "#" : href}
        onClick={(e) => {
          if (disabled) { e.preventDefault(); return; }
          onClick?.();
        }}
        aria-disabled={disabled || undefined}
        title={title}
        className={fullClassName}
        style={style}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      className={fullClassName}
      style={style}
    >
      {children}
    </button>
  );
}
