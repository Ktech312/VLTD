"use client";

import type { ReactNode } from "react";

/**
 * Full-bleed page header strip — spans the entire browser viewport edge to
 * edge, independent of the page's own max-width content column. Title style
 * matches Insights (the confirmed reference for this pattern) on every page.
 * The colored band itself stays a fixed 42px tall regardless of title size —
 * the pt-6/pb-6 spacing lives on the transparent outer wrapper so it never
 * gets painted into the strip, and leading-[1.2] (not leading-none) leaves
 * real room for descenders on mixed-case titles.
 */
const DEFAULT_TITLE_CLASS =
  "font-serif text-[28px] leading-[1.2] sm:text-[34px] text-[color:var(--fg)]";

export function PageHeader({
  title,
  description,
  actions,
  contentClassName = "max-w-[1440px]",
  titleClassName = DEFAULT_TITLE_CLASS,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  contentClassName?: string;
  titleClassName?: string;
}) {
  return (
    <div className="pt-6 pb-6">
      <div
        className="relative left-1/2 w-screen -translate-x-1/2"
        style={{ background: "var(--theme-nav-bg, rgba(16, 18, 21, 0.95))" }}
      >
        <div
          className={`mx-auto flex w-full flex-col gap-4 px-4 sm:px-6 lg:flex-row lg:min-h-[42px] lg:items-center lg:justify-between lg:px-8 ${contentClassName}`}
        >
          <div className="flex flex-wrap items-end gap-x-5 gap-y-1">
            <h1 className={titleClassName}>{title}</h1>
            {description ? (
              <p className="pb-1 text-sm leading-tight" style={{ color: "var(--muted)" }}>
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap shrink-0 items-center gap-2.5">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}
