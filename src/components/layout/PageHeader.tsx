"use client";

import type { ReactNode } from "react";

/**
 * Full-bleed page header strip — spans the entire browser viewport edge to
 * edge, independent of the page's own max-width content column. Title and
 * description sizing match VLT Lounge (the reference page for this pattern).
 */
export function PageHeader({
  title,
  description,
  actions,
  contentClassName = "max-w-[1440px]",
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  contentClassName?: string;
}) {
  return (
    <div
      className="relative left-1/2 w-screen -translate-x-1/2"
      style={{
        background: "var(--theme-nav-bg, rgba(16, 18, 21, 0.95))",
        borderBottom: "1px solid var(--theme-nav-border, rgba(203, 208, 213, 0.15))",
      }}
    >
      <div className={`mx-auto w-full px-4 py-5 sm:px-6 lg:px-8 ${contentClassName}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-end gap-x-5 gap-y-1">
            <h1 className="text-[38px] font-extrabold uppercase leading-[0.9] tracking-[-0.03em] sm:text-[46px]">
              {title}
            </h1>
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
