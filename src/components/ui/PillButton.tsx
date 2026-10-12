"use client";

import * as React from "react";
import Link from "next/link";

export type PillVariant = "default" | "active" | "primary" | "success" | "danger";

type PillButtonProps = {
  children: React.ReactNode;
  variant?: PillVariant;
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
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

/**
 * The shared pill recipe (Revision 2): 36px tall on desktop, 44px on touch/mobile, 8px corners,
 * 12px side padding, 6px icon-to-label gap, 13px label at weight 500, 16px icons.
 * Anything that must look like a pill (menu triggers, local navigation, filter chips) takes its
 * classes from here so the geometry stays in one place.
 */
export function pillClassName(variant: PillVariant = "default", disabled = false, extra = ""): string {
  const base = [
    "inline-flex items-center justify-center gap-1.5",
    "h-11 md:h-9",
    "px-3",
    "rounded-[8px]",
    "text-[13px] font-medium",
    "whitespace-nowrap",
    "[&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0",
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
      : variant === "active" || variant === "primary"
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

  // .vltd-disabled (globals.css) instead of an opacity-N class: the light-theme legacy rule resets any class containing "opacity-6".
  const disabledStyles = disabled ? "vltd-disabled cursor-not-allowed active:scale-100" : "";

  return [base, styles, disabledStyles, extra].filter(Boolean).join(" ");
}

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
  const fullClassName = pillClassName(variant, !!disabled, className);

  if (href) {
    return (
      <Link
        href={disabled ? "#" : href}
        onClick={(e) => {
          if (disabled) { e.preventDefault(); return; }
          onClick?.(e);
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
