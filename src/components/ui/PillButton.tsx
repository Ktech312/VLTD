"use client";

import * as React from "react";
import Link from "next/link";

export type PillVariant = "default" | "active" | "primary" | "success" | "danger";
/**
 * "default" is the approved 36px / 44px control. "compact" is the one shared compact variant for dense panels
 * (editor toolbars, chips, sheets): a 32px (28px on desktop) visual with 12px text and 10px padding, and an
 * invisible hit area that brings the touch target to 44px on phones. Same corners, weights, focus, selected,
 * disabled and loading treatment as the default.
 */
export type PillSize = "default" | "compact";

type PillButtonProps = {
  children: React.ReactNode;
  variant?: PillVariant;
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  disabled?: boolean;
  title?: string;
  type?: "button" | "submit" | "reset";
  className?: string;
  size?: PillSize;
  /** Toggle-style pills: exposes the on/off state to assistive technology. */
  pressed?: boolean;
  /** Disclosure-style pills: whether the controlled region is open, and which region it controls. */
  ariaExpanded?: boolean;
  ariaControls?: string;
  ariaLabel?: string;
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
export function pillClassName(variant: PillVariant = "default", disabled = false, extra = "", size: PillSize = "default"): string {
  // Icon-only compact controls (fixed w-8 width) get a 44px-wide phone target too; text pills keep their own width so neighbours never overlap.
  const iconOnlyCompact = size === "compact" && /(^|\s)w-8(\s|$)/.test(extra);
  const geometry =
    size === "compact"
      ? [
          "relative h-8 md:h-7 px-2.5 text-xs font-medium",
          // 44px touch target on phones without growing the visual
          iconOnlyCompact
            ? "max-md:after:absolute max-md:after:-inset-x-1.5 max-md:after:-inset-y-1.5 max-md:after:content-['']"
            : "max-md:after:absolute max-md:after:inset-x-0 max-md:after:-inset-y-1.5 max-md:after:content-['']",
        ].join(" ")
      : "h-11 md:h-9 px-3 text-[13px] font-medium";
  const base = [
    "inline-flex items-center justify-center gap-1.5",
    geometry,
    "rounded-[8px]",
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
  size = "default",
  pressed,
  ariaExpanded,
  ariaControls,
  ariaLabel,
}: PillButtonProps) {
  const fullClassName = pillClassName(variant, !!disabled, className, size);

  if (href) {
    return (
      <Link
        href={disabled ? "#" : href}
        onClick={(e) => {
          if (disabled) { e.preventDefault(); return; }
          onClick?.(e);
        }}
        aria-disabled={disabled || undefined}
        aria-label={ariaLabel}
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
      aria-pressed={pressed}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      aria-label={ariaLabel}
      title={title}
      className={fullClassName}
      style={style}
    >
      {children}
    </button>
  );
}
