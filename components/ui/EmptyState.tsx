"use client";

import * as React from "react";
import { PillButton } from "@/components/ui/PillButton";

export function EmptyState({
  icon,
  title,
  subtitle,
  description,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  action,
  className,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
  description?: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  action?: React.ReactNode;
  className?: string;
}) {
  const bodyText = subtitle ?? description;

  return (
    <div
      className={[
        "rounded-3xl bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]",
        className ?? "",
      ].join(" ")}
    >
      <div className="flex items-start gap-4">
        {icon ? (
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[color:var(--pill)] ring-1 ring-[color:var(--border)] text-xl">
            {icon}
          </div>
        ) : null}

        <div className="flex-1">
          <div className="text-lg font-semibold">{title}</div>
          {bodyText ? <div className="mt-2 text-sm text-[color:var(--muted)]">{bodyText}</div> : null}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {primaryLabel ? (
              <PillButton variant="active" onClick={onPrimary}>
                {primaryLabel}
              </PillButton>
            ) : null}

            {secondaryLabel ? <PillButton onClick={onSecondary}>{secondaryLabel}</PillButton> : null}

            {action ? <div className="ml-1">{action}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmptyState;