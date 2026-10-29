"use client";

import type { ReactNode } from "react";

/**
 * Full-bleed page header strip — spans the entire browser viewport edge to
 * edge, independent of the page's own max-width content column. Title style
 * matches Insights (the confirmed reference for this pattern) on every page.
 * The colored band itself stays a fixed 50px tall regardless of title size —
 * the pt-6/pb-6 spacing lives on the transparent outer wrapper so it never
 * gets painted into the strip, and leading-[1.2] (not leading-none) leaves
 * real room for descenders on mixed-case titles.
 *
 * 50px (not 42px, EK 2026-08-23): the action-strip pills are 40px tall, so a
 * 42px band left ~1px of slack total -- buttons touched the top/bottom edge
 * with no breathing room. 50px gives ~5px on each side without changing the
 * pill recipe itself (used across too many pages to shrink safely).
 */
const DEFAULT_TITLE_CLASS =
  "font-serif text-[28px] leading-[1.2] sm:text-[34px] text-[color:var(--fg)]";

export function PageHeader({
  title,
  description,
  actions,
  titleAdornment,
  contentClassName = "max-w-[1440px]",
  titleClassName = DEFAULT_TITLE_CLASS,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Sits right of the title (for example the Browse menu). */
  titleAdornment?: ReactNode;
  contentClassName?: string;
  titleClassName?: string;
}) {
  return (
    <div className="pt-6 pb-6">
      {/* The coloured band is drawn behind the content (vltd-page-band) instead of making the content itself viewport-wide, so the
          title and actions sit in the same column as the tab bar and page content under them, scrollbar or not. */}
      <div
        className={`vltd-page-band relative isolate mx-auto flex w-full flex-col gap-4 px-4 sm:px-6 lg:flex-row lg:min-h-[50px] lg:items-center lg:justify-between lg:px-8 ${contentClassName}`}
      >
        <div className="flex flex-wrap items-end gap-x-5 gap-y-1">
          {titleAdornment ? (
            <div className="flex items-center gap-3">
              <h1 className={titleClassName}>{title}</h1>
              {titleAdornment}
            </div>
          ) : (
            <h1 className={titleClassName}>{title}</h1>
          )}
          {description ? (
            <p className="pb-1 text-sm leading-tight" style={{ color: "var(--muted)" }}>
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap shrink-0 items-center gap-2.5 max-md:gap-y-3">{actions}</div> : null}
      </div>
    </div>
  );
}
