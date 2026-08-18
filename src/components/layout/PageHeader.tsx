"use client";

import type { ReactNode } from "react";

/**
 * Full-bleed page header strip — spans the entire browser viewport edge to
 * edge, independent of the page's own max-width content column. Title and
 * description sizing match VLT Lounge (the reference page for this pattern).
 * The colored band itself stays as thin as the original Lounge header (no
 * added vertical padding) — the pt-6/pb-6 spacing lives on the transparent
 * outer wrapper so it never gets painted into the strip.
 */
const LOUNGE_TITLE_CLASS =
  "text-[38px] font-extrabold uppercase leading-[0.9] tracking-[-0.03em] sm:text-[46px]";

export function PageHeader({
  title,
  description,
  actions,
  contentClassName = "max-w-[1440px]",
  titleClassName = LOUNGE_TITLE_CLASS,
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
          className={`mx-auto flex w-full flex-col gap-4 px-4 sm:px-6 lg:flex-row lg:min-h-[42px] lg:items-end lg:justify-between lg:px-8 ${contentClassName}`}
        >
          <div className="flex flex-wrap items-end gap-x-5 gap-y-1">
            <h1 className={titleClassName}>{title}</h1>
            {description ? (
              <p className="pb-1 text-sm leading-tight" style={{ color: "var(--muted)" }}>
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2.5">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}
